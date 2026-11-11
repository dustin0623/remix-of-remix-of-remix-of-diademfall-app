import type { ServerTransferResult } from "@/lib/chains/modules/solana/server";
import type { SolanaActionResult } from "@/lib/chains/modules/solana/types";
import type { ActionHandler } from "./index";
import type { TransferSettings } from "./deposit";

export const TRANSFER_NOT_SENT = "NOT_SENT";

export interface WithdrawDeps {
  settings: () => TransferSettings;
  transfer: (input: { to: string; amount: string; symbol: string; transactionId: string }) => Promise<SolanaActionResult<ServerTransferResult>>;
  /** Return the debited Coins (idempotent per transaction). */
  refund: (transactionId: string, reason: string) => Promise<void>;
}

/**
 * Sends a queued Coin withdrawal from the treasury. Withdrawals run once (max_attempts 1) and are never
 * retried automatically: Coins are refunded only when the payout certainly never left; an uncertain send
 * is recorded as FAILED for an operator to check on chain, so a player can never be paid twice.
 */
export function createWithdrawHandler(deps: WithdrawDeps): ActionHandler {
  return async (tx) => {
    const settings = deps.settings();
    const meta = tx.metadata as Record<string, unknown>;
    const refundAndFail = async (reason: string) => {
      await deps.refund(tx.transactionId, reason);
      return { ok: false as const, error: `${reason} Your Coins were returned.`, retryable: false };
    };

    if (meta["test"] === true) {
      if (!settings.testMode) return refundAndFail("Test withdrawals only run in the preview.");
      return { ok: true, onChainTxId: null, data: { test: true, simulated: true } };
    }
    if (!settings.coinMint || !settings.hasSigner) return refundAndFail("Withdrawals aren't open yet.");
    if (meta["symbol"] !== settings.coinMint) return refundAndFail("Unknown withdrawal token.");

    const r = await deps.transfer({
      to: String(meta["recipientAddress"]),
      amount: String(meta["amount"]),
      symbol: settings.coinMint,
      transactionId: tx.transactionId,
    });
    if (r.ok) return { ok: true, onChainTxId: r.data.signature, data: { from: r.data.from, to: r.data.to, amount: r.data.amount } };
    if (r.code === TRANSFER_NOT_SENT) return refundAndFail(`Payout failed: ${r.error}.`);
    return { ok: false, error: `Payout status unknown, held for review: ${r.error}`, retryable: false };
  };
}
