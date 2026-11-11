import { DEPOSIT_MAX_ATTEMPTS } from "@/lib/wallet/transfers";
import { transferSettings } from "./settings.server";

/**
 * One cycle of the live transfer worker against the Cloud queue: deposits are verified on Solana and
 * credited through the ledger, withdrawals are paid from the treasury (or refunded when they never left).
 * Safe to run from several places at once: rows are claimed atomically and every credit/refund is idempotent.
 */
export async function runLiveTransferCycle(workerId: string, batchSize = 10): Promise<number> {
  const [{ createPollingContext }, { pollOnce }, { createProcessor, createLiveRegistry }, solana, ledger, admin] = await Promise.all([
    import("../../../server/smart-contract/polling/context"),
    import("../../../server/smart-contract/polling/transaction-poller"),
    import("../../../server/smart-contract/processor"),
    import("@/lib/chains/modules/solana/server"),
    import("@/lib/economy/ledger.server"),
    import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin),
  ]);

  const registry = createLiveRegistry({
    settings: transferSettings,
    validate: (input) => solana.validatePayment(input),
    credit: (entry) => ledger.recordLedgerEntry(admin, entry),
    transfer: ({ to, amount, symbol, transactionId }) =>
      solana.transferToken({ to, amount, symbol, action: "withdraw", metadata: { transactionId } }),
    refund: async (transactionId, reason) => {
      const { error } = await admin.rpc("refund_withdrawal", { p_transaction_id: transactionId, p_reason: reason });
      if (error) throw new Error(`Refund failed: ${error.message}`);
    },
  });

  return pollOnce(
    createPollingContext({ workerId, batchSize, maxAttempts: DEPOSIT_MAX_ATTEMPTS }),
    createProcessor(registry),
  );
}
