import { infiniteQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ACTIVITY_CATEGORIES, CATEGORIZED_TYPES, type ActivityCategory, type ActivityRow } from "./activity";
import type { Currency } from "./currency";

export const ACTIVITY_PAGE_SIZE = 50;

export interface ActivityFilter {
  currency: Currency | "all";
  category: ActivityCategory | "all";
}

/** One page of the signed-in player's ledger, newest first (owner-only read; amounts as exact strings). */
export async function fetchActivityPage(userId: string, filter: ActivityFilter, offset: number, limit = ACTIVITY_PAGE_SIZE): Promise<ActivityRow[]> {
    let q = supabase
      .from("currency_ledger")
      .select("id, currency, amount::text, balance_after::text, entry_type, reference_type, reference_id, metadata, created_at")
      .eq("player_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);
    if (filter.currency !== "all") q = q.eq("currency", filter.currency);
    if (filter.category === "other") q = q.not("entry_type", "in", `(${CATEGORIZED_TYPES.join(",")})`);
    else if (filter.category !== "all") q = q.in("entry_type", [...ACTIVITY_CATEGORIES[filter.category].types]);
    const { data, error } = await q;
    if (error) throw error;
    return ((data ?? []) as unknown as {
      id: string; currency: Currency; amount: string; balance_after: string; entry_type: string;
      reference_type: string | null; reference_id: string | null; metadata: unknown; created_at: string;
    }[]).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      currency: r.currency,
      amount: r.amount,
      balanceAfter: r.balance_after,
      entryType: r.entry_type,
      referenceType: r.reference_type,
      referenceId: r.reference_id,
      metadata: (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as Record<string, unknown>,
    }));
  }

/** Signed-in player's ledger, newest first, paged (owner-only read; amounts as exact strings). */
export const activityQuery = (userId: string | undefined, filter: ActivityFilter) =>
  infiniteQueryOptions({
    queryKey: ["wallet", "activity", userId, filter],
    enabled: !!userId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchActivityPage(userId!, filter, pageParam),
    getNextPageParam: (last, all) => (last.length < ACTIVITY_PAGE_SIZE ? undefined : all.length * ACTIVITY_PAGE_SIZE),
  });
