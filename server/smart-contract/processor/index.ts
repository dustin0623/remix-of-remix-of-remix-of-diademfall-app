import type { PendingTransactionDocument, TransactionType } from "@/lib/modules/transactions-pending/server.model";
import type { HandlerResult, TransactionHandler } from "../polling/transaction-poller";
import { createDepositHandler, type DepositDeps, type TransferSettings } from "./deposit";
import { createWithdrawHandler, type WithdrawDeps } from "./withdraw";

/**
 * Action router: maps a pending transaction's `type` to the code that executes it.
 * The chain is fixed per deployment (config.auth.chain), so handlers call that chain's module.
 */
export type ActionHandler = (tx: PendingTransactionDocument) => Promise<HandlerResult>;
export type ActionRegistry = Partial<Record<TransactionType, ActionHandler>>;

/** Mock handler: succeeds instantly with a fake tx id (dev / mock mode only). */
export const mockSuccess: ActionHandler = async (tx) => ({
  ok: true,
  onChainTxId: `mock-${tx.transactionId.slice(0, 8)}`,
  data: { mock: true },
});

export function createProcessor(registry: ActionRegistry, fallback?: ActionHandler): TransactionHandler {
  return async (tx) => {
    const handler = registry[tx.type] ?? fallback;
    if (!handler) return { ok: false, error: `No handler for transaction type: ${tx.type}`, retryable: false };
    return handler(tx);
  };
}

/** Live handlers: deposits (verified on Solana, credited via the ledger) and Coin withdrawals. */
export function createLiveRegistry(deps: { settings: () => TransferSettings } & Omit<DepositDeps, "settings"> & Omit<WithdrawDeps, "settings">): ActionRegistry {
  return {
    deposit: createDepositHandler(deps),
    withdraw: createWithdrawHandler(deps),
  };
}
