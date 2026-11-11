import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Currency } from "./currency";

export interface LedgerRow {
  id: string;
  currency: Currency;
  amount: string;
  balanceAfter: string;
  entryType: string;
  createdAt: string;
}
export interface Wallet {
  credits: string;
  coins: string;
  lockedCredits: string;
  lockedCoins: string;
  recent: LedgerRow[];
}

/** Signed-in player's balances and latest ledger entries (owner-only reads; amounts kept as exact strings). */
export const walletQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["wallet", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Wallet> => {
      const [balances, ledger] = await Promise.all([
        supabase.from("currency_balances").select("currency, available::text, locked::text").eq("player_id", userId!),
        supabase.from("currency_ledger")
          .select("id, currency, amount::text, balance_after::text, entry_type, created_at")
          .eq("player_id", userId!).order("created_at", { ascending: false }).limit(8),
      ]);
      if (balances.error) throw balances.error;
      if (ledger.error) throw ledger.error;
      const rows = (balances.data ?? []) as unknown as { currency: Currency; available: string; locked: string }[];
      const bal = (c: Currency) => rows.find((r) => r.currency === c);
      const entries = (ledger.data ?? []) as unknown as {
        id: string; currency: Currency; amount: string; balance_after: string; entry_type: string; created_at: string;
      }[];
      return {
        credits: bal("credits")?.available ?? "0",
        coins: bal("coins")?.available ?? "0",
        lockedCredits: bal("credits")?.locked ?? "0",
        lockedCoins: bal("coins")?.locked ?? "0",
        recent: entries.map((e) => ({
          id: e.id, currency: e.currency, amount: e.amount, balanceAfter: e.balance_after,
          entryType: e.entry_type, createdAt: e.created_at,
        })),
      };
    },
  });
