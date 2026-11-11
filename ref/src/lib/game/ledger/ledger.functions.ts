import { createServerFn } from "@tanstack/react-start";
import { requirePlayer } from "@/lib/game/session/player.server";
import {
  isLedgerRange,
  isLedgerTab,
  LEDGER_PAGE_SIZE,
  ledgerSince,
  ledgerStatus,
  type LedgerPage,
  type LedgerRange,
  type LedgerRecord,
  type LedgerTab,
} from "./ledger";

interface ListInput {
  playerId: string;
  token: string;
  tab: LedgerTab;
  range: LedgerRange;
  tzOffset: number;
  offset: number;
}

/** One page of the signed-in player's coin ledger for a tab and date range. */
export const listLedger = createServerFn({ method: "POST" })
  .inputValidator((i: Partial<Record<keyof ListInput, unknown>>): ListInput => {
    if (typeof i?.playerId !== "string" || typeof i?.token !== "string") throw new Error("Invalid input");
    if (!isLedgerTab(i.tab) || !isLedgerRange(i.range)) throw new Error("Invalid filter");
    const tzOffset = Number(i.tzOffset ?? 0);
    const offset = Number(i.offset ?? 0);
    if (!Number.isInteger(tzOffset) || Math.abs(tzOffset) > 840) throw new Error("Invalid time zone");
    if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) throw new Error("Invalid page");
    return { playerId: i.playerId, token: i.token, tab: i.tab, range: i.range, tzOffset, offset };
  })
  .handler(async ({ data }): Promise<LedgerPage> => {
    const row = await requirePlayer(data.playerId, data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = ledgerSince(data.range, new Date(), data.tzOffset);
    const { data: result, error } = await supabaseAdmin.rpc("list_ledger", {
      p_player_id: row.id,
      p_category: data.tab,
      p_since: since ? since.toISOString() : (null as unknown as string),
      p_limit: LEDGER_PAGE_SIZE,
      p_offset: data.offset,
    });
    if (error || !result) throw new Error("Could not load your history");
    const r = result as unknown as {
      total: number;
      net: number;
      records: (Omit<LedgerRecord, "status"> & { status: string; queueStatus: string | null })[];
    };
    return {
      total: Number(r.total),
      net: Number(r.net),
      records: r.records.map(({ queueStatus, ...rec }) => ({
        ...rec,
        id: Number(rec.id),
        amount: Number(rec.amount),
        balanceBefore: Number(rec.balanceBefore),
        balanceAfter: Number(rec.balanceAfter),
        metadata: rec.metadata ?? {},
        status: ledgerStatus(rec.status, queueStatus),
      })),
    };
  });
