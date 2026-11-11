import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ledgerEntrySchema, type LedgerEntryInput } from "./currency";

export type LedgerResult =
  | { ok: true; entryId: string; balanceAfter: string; duplicate: boolean }
  | { ok: false; error: "invalid_input" | "insufficient_balance" | "key_conflict" | "failed"; message: string };

/**
 * The only way to change a player's Credits/Coins. Server-only (needs the admin client):
 * atomic balance update + immutable ledger row; replaying the same idempotency key returns the
 * original entry instead of paying twice. Returns a result object, never throws.
 */
export async function recordLedgerEntry(admin: SupabaseClient<Database>, input: LedgerEntryInput): Promise<LedgerResult> {
  const parsed = ledgerEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input", message: parsed.error.issues[0]?.message ?? "Invalid entry" };
  const e = parsed.data;
  const { data, error } = await admin.rpc("record_ledger_entry", {
    p_player_id: e.playerId,
    p_currency: e.currency,
    // Sent as a string so 8-decimal Coin amounts never pass through a float.
    p_amount: e.amount as unknown as number,
    p_entry_type: e.entryType,
    p_idempotency_key: e.idempotencyKey,
    ...(e.referenceType ? { p_reference_type: e.referenceType } : {}),
    ...(e.referenceId ? { p_reference_id: e.referenceId } : {}),
    p_metadata: (e.metadata ?? {}) as never,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("Insufficient balance")) return { ok: false, error: "insufficient_balance", message: "Not enough balance." };
    if (msg.includes("Idempotency key reused")) return { ok: false, error: "key_conflict", message: msg };
    console.error("[ledger] record failed", error);
    return { ok: false, error: "failed", message: "Ledger write failed." };
  }
  const r = data as { entryId: string; balanceAfter: string; duplicate: boolean };
  return { ok: true, entryId: r.entryId, balanceAfter: String(r.balanceAfter), duplicate: r.duplicate };
}
