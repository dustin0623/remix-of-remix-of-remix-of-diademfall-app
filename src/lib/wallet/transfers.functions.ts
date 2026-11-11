import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CURRENCIES } from "@/lib/economy/currency";
import {
  DEPOSIT_ASSETS,
  DEPOSIT_MAX_ATTEMPTS,
  MIN_WITHDRAWAL_COINS,
  TEST_DEPOSIT_MAX,
  USDC_MINT,
  depositTag,
  withdrawalInput,
} from "@/lib/wallet/transfers";

const settingsModule = () => import("./settings.server");
const pendingRepo = async () =>
  (await import("@/lib/modules/transactions-pending/server.repository")).pendingTransactionRepository;
const processedRepo = async () =>
  (await import("@/lib/modules/transactions-processed/server.repository")).processedTransactionRepository;

export interface TransferInfo {
  depositTag: string;
  /** Memo the deposit transaction must carry (JSON, as the in-app wallet writes it). */
  depositMemo: string;
  treasuryAddress: string | null;
  usdcMint: string;
  coinMint: string | null;
  depositsOpen: { usdc: boolean; coin: boolean };
  withdrawalsOpen: boolean;
  minWithdrawal: string;
  testMode: boolean;
  testDepositMax: typeof TEST_DEPOSIT_MAX;
}

/** Deposit address, memo tag and which transfers are open (no secrets, only public addresses). */
export const getTransferInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TransferInfo> => {
    const s = (await settingsModule()).transferSettings();
    const tag = depositTag(context.userId);
    return {
      depositTag: tag,
      depositMemo: JSON.stringify({ action: "deposit", metadata: { tag } }),
      treasuryAddress: s.treasuryAddress,
      usdcMint: USDC_MINT,
      coinMint: s.coinMint,
      depositsOpen: { usdc: !!s.treasuryAddress, coin: !!s.treasuryAddress && !!s.coinMint },
      withdrawalsOpen: !!s.coinMint && s.hasSigner,
      minWithdrawal: MIN_WITHDRAWAL_COINS,
      testMode: s.testMode,
      testDepositMax: TEST_DEPOSIT_MAX,
    };
  });

export type TransferRequestResult = { ok: true; transactionId: string } | { ok: false; error: string };

/** Queue a deposit the player already sent: the worker verifies it on Solana before crediting anything. */
export const requestDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        asset: z.enum(DEPOSIT_ASSETS),
        signature: z.string().trim().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/, "Enter a valid Solana transaction signature"),
        fromAddress: z.string().trim().max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<TransferRequestResult> => {
    const s = (await settingsModule()).transferSettings();
    if (!s.treasuryAddress) return { ok: false, error: "Deposits aren't open yet." };
    const mint = data.asset === "usdc" ? USDC_MINT : s.coinMint;
    if (!mint) return { ok: false, error: "Coin deposits open when the Coin token launches." };
    if (await (await processedRepo()).findSuccessByRef("deposit", data.signature))
      return { ok: false, error: "This payment was already credited." };
    const pending = await pendingRepo();
    const existing = await pending.findByRef("deposit", data.signature);
    if (existing) {
      return existing.playerId === context.userId
        ? { ok: true, transactionId: existing.transactionId }
        : { ok: false, error: "This payment is already being checked." };
    }
    const tx = await pending.create({
      type: "deposit",
      playerId: context.userId,
      walletAddress: data.fromAddress || null,
      onChainRef: data.signature,
      maxAttempts: DEPOSIT_MAX_ATTEMPTS,
      metadata: { fromAddress: data.fromAddress ?? "", assetType: "token", symbol: mint, amount: "0", asset: data.asset },
    });
    return { ok: true, transactionId: tx.transactionId };
  });

/** Preview only: add test Credits/Coins through the same queue and ledger as a real deposit. */
export const requestTestDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ currency: z.enum(CURRENCIES), amount: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<TransferRequestResult> => {
    if (!(await settingsModule()).isTransferTestMode()) return { ok: false, error: "Test deposits are only available in the preview." };
    if (data.amount > TEST_DEPOSIT_MAX[data.currency])
      return { ok: false, error: `Test deposits are capped at ${TEST_DEPOSIT_MAX[data.currency].toLocaleString("en-US")}.` };
    const tx = await (await pendingRepo()).create({
      type: "deposit",
      playerId: context.userId,
      maxAttempts: 1,
      metadata: { fromAddress: "test", assetType: "token", symbol: "TEST", amount: String(data.amount), currency: data.currency, test: true },
    });
    return { ok: true, transactionId: tx.transactionId };
  });

/** Withdraw Coins to a Solana address: the debit and the queued payout happen in one database step. */
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => withdrawalInput.extend({ test: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }): Promise<TransferRequestResult> => {
    const s = (await settingsModule()).transferSettings();
    if (data.test && !s.testMode) return { ok: false, error: "Test withdrawals are only available in the preview." };
    if (!data.test && (!s.coinMint || !s.hasSigner)) return { ok: false, error: "Withdrawals open when the Coin token launches." };
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: r, error } = await admin.rpc("request_withdrawal", {
      p_player_id: context.userId,
      p_transaction_id: data.requestId,
      // Sent as a string so 8-decimal Coin amounts never pass through a float.
      p_amount: data.amount as unknown as number,
      p_address: data.address,
      p_symbol: data.test ? "TEST" : s.coinMint!,
      p_test: data.test,
    });
    if (error) {
      const m = error.message ?? "";
      if (m.includes("Insufficient balance")) return { ok: false, error: "Not enough Coins." };
      if (m.includes("Invalid withdrawal address")) return { ok: false, error: "Enter a valid Solana address." };
      if (m.includes("already used")) return { ok: false, error: "This request was already used. Try again." };
      console.error("[wallet] withdrawal failed", error);
      return { ok: false, error: "Withdrawal failed. Try again." };
    }
    return { ok: true, transactionId: (r as { transactionId: string }).transactionId };
  });

/**
 * Process queued transfers now. Called by the Wallet page while one of the player's transfers is waiting,
 * so no separate worker is needed; the queue claims rows atomically, so overlapping calls are harmless.
 */
export const processTransferQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getTransactionStore } = await import("@/lib/config/database");
    if (getTransactionStore() !== "cloud") return { processed: 0 };
    const { data: mine } = await context.supabase.from("wallet_transfers").select("transaction_id").in("status", ["PENDING", "PROCESSING"]).limit(1);
    if (!mine?.length) return { processed: 0 };
    const { runLiveTransferCycle } = await import("./worker.server");
    const processed = await runLiveTransferCycle(`wallet-${context.userId.slice(0, 8)}`);
    return { processed };
  });
