import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TransferStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface TransferRow {
  transactionId: string;
  type: "deposit" | "withdraw" | string;
  status: TransferStatus;
  /** Amount requested (withdrawals, test deposits) or credited (finished deposits); null while a deposit is being checked. */
  amount: string | null;
  currency: "credits" | "coins" | null;
  address: string | null;
  signature: string | null;
  test: boolean;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

/** The player's deposits and withdrawals: queued ones first, then finished ones (owner-only reads). */
export const transfersQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["wallet", "transfers", userId],
    enabled: !!userId,
    queryFn: async (): Promise<TransferRow[]> => {
      // One wallet_transfers row per transfer; waiting rows have no processed_at yet.
      const { data, error } = await supabase.from("wallet_transfers")
        .select("transaction_id, type, status, metadata, on_chain_ref, on_chain_tx_id, wallet_address, result, error, last_error, created_at, processed_at")
        .eq("player_id", userId!).in("type", ["deposit", "withdraw"]).order("created_at", { ascending: false }).limit(150);
      if (error) throw error;
      const all = data ?? [];
      const pending = all.filter((t) => !t.processed_at);
      const done = all.filter((t) => t.processed_at).sort((a, b) => b.processed_at!.localeCompare(a.processed_at!));
      const rows: TransferRow[] = [];
      for (const p of pending) {
        const m = (p.metadata ?? {}) as Record<string, unknown>;
        const isTestDeposit = p.type === "deposit" && m["test"] === true;
        rows.push({
          transactionId: p.transaction_id,
          type: p.type,
          status: p.status as TransferStatus,
          amount: p.type === "withdraw" || isTestDeposit ? str(m["amount"]) : null,
          currency: p.type === "withdraw" ? "coins" : ((str(m["currency"]) ?? (m["asset"] === "usdc" ? "credits" : m["asset"] === "coin" ? "coins" : null)) as TransferRow["currency"]),
          address: p.type === "withdraw" ? str(m["recipientAddress"]) : str(p.wallet_address),
          signature: p.on_chain_ref,
          test: m["test"] === true,
          error: p.last_error,
          createdAt: p.created_at,
          finishedAt: null,
        });
      }
      for (const d of done) {
        const m = (d.metadata ?? {}) as Record<string, unknown>;
        const r = (d.result ?? {}) as Record<string, unknown>;
        rows.push({
          transactionId: d.transaction_id,
          type: d.type,
          status: d.status as TransferStatus,
          amount: d.type === "withdraw" ? str(m["amount"]) : (str(r["credited"]) ?? (m["test"] === true ? str(m["amount"]) : null)),
          currency: d.type === "withdraw" ? "coins" : ((str(r["currency"]) ?? str(m["currency"]) ?? (m["asset"] === "usdc" ? "credits" : m["asset"] === "coin" ? "coins" : null)) as TransferRow["currency"]),
          address: d.type === "withdraw" ? str(m["recipientAddress"]) : (str(r["from"]) ?? str(d.wallet_address)),
          signature: d.on_chain_tx_id ?? d.on_chain_ref,
          test: m["test"] === true,
          error: d.error,
          createdAt: d.created_at,
          finishedAt: d.processed_at,
        });
      }
      return rows;
    },
  });
