import type { LedgerEntryInput } from "@/lib/economy/currency";
import type { LedgerResult } from "@/lib/economy/ledger.server";
import type { PaymentValidationResult } from "@/lib/chains/modules/solana/server";
import type { SolanaActionResult } from "@/lib/chains/modules/solana/types";
import {
  DEPOSIT_CURRENCY,
  DEPOSIT_ENTRY_TYPE,
  TEST_DEPOSIT_MAX,
  USDC_MINT,
  depositMemoMatches,
  toCoinAmount,
  usdcToCredits,
  type DepositAsset,
} from "@/lib/wallet/transfers";
import type { Currency } from "@/lib/economy/currency";
import type { ActionHandler } from "./index";

export interface TransferSettings {
  treasuryAddress: string | null;
  coinMint: string | null;
  hasSigner: boolean;
  /** Preview only: test deposits and simulated withdrawals. */
  testMode: boolean;
}

export interface DepositDeps {
  settings: () => TransferSettings;
  validate: (input: { signature: string; expected: { to: string; symbol: string } }) => Promise<SolanaActionResult<PaymentValidationResult>>;
  credit: (entry: LedgerEntryInput) => Promise<LedgerResult>;
}

const fail = (error: string, retryable = false) => ({ ok: false as const, error, retryable });

/**
 * Credits a deposit once the payment is confirmed on Solana: right token, sent to the treasury,
 * memo tagged with this player's deposit tag. One ledger entry per signature (key deposit:{signature}).
 */
export function createDepositHandler(deps: DepositDeps): ActionHandler {
  return async (tx) => {
    const settings = deps.settings();
    const meta = tx.metadata as Record<string, unknown>;

    if (meta["test"] === true) {
      if (!settings.testMode) return fail("Test deposits are only accepted in the preview.");
      const currency = meta["currency"] as Currency;
      const amount = String(meta["amount"] ?? "0");
      if (!(currency in TEST_DEPOSIT_MAX) || !(Number(amount) > 0) || Number(amount) > TEST_DEPOSIT_MAX[currency])
        return fail("Invalid test deposit.");
      const r = await deps.credit({
        playerId: tx.playerId,
        currency,
        amount,
        entryType: "test_deposit",
        idempotencyKey: `deposit:test:${tx.transactionId}`,
        referenceType: "transfer",
        referenceId: tx.transactionId,
        metadata: { test: true },
      });
      if (!r.ok) return fail(r.message, r.error === "failed");
      return { ok: true, onChainTxId: null, data: { currency, credited: amount, test: true } };
    }

    const signature = tx.onChainRef;
    const asset = meta["asset"] as DepositAsset;
    if (!signature) return fail("Deposit has no transaction signature.");
    if (!settings.treasuryAddress) return fail("Deposits aren't open yet.");
    const mint = asset === "usdc" ? USDC_MINT : asset === "coin" ? settings.coinMint : null;
    if (!mint) return fail("This deposit currency isn't accepted yet.");

    const check = await deps.validate({ signature, expected: { to: settings.treasuryAddress, symbol: mint } });
    // Not found yet / RPC trouble: try again on the next cycle while the transaction confirms.
    if (!check.ok) return fail(check.error, true);
    const v = check.data;
    if (!v.valid) return fail(v.reason ?? "Payment could not be verified.");
    if (!depositMemoMatches(v.memo, tx.playerId)) return fail("This payment isn't tagged with your account's deposit memo.");

    const received = v.amount ?? "0";
    const currency = DEPOSIT_CURRENCY[asset];
    const amount = asset === "usdc" ? usdcToCredits(received) : toCoinAmount(received);
    if (!/[1-9]/.test(amount)) return fail("Deposit is too small to credit.");

    const r = await deps.credit({
      playerId: tx.playerId,
      currency,
      amount,
      entryType: DEPOSIT_ENTRY_TYPE[asset],
      idempotencyKey: `deposit:${signature}`,
      referenceType: "transfer",
      referenceId: tx.transactionId,
      metadata: { signature, from: v.from, symbol: v.symbol, received },
    });
    if (!r.ok) return fail(r.error === "key_conflict" ? "This payment was already credited." : r.message, r.error === "failed");
    return { ok: true, onChainTxId: signature, blockNumber: v.slot, data: { currency, credited: amount, received, from: v.from } };
  };
}
