import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const loadAdmin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

export type CombineResult =
  | { ok: true; assetId: string; essenceAfter: number; levelBefore: number; levelAfter: number }
  | { ok: false; error: string };

const friendly = (m: string) =>
  m.includes("not available") ? "One of those cards is listed, rented out or already combined."
  : m.includes("Not your") ? "You can only combine cards you own."
  : m.includes("Regular and Gold") ? "Regular and Gold cards can't be combined together."
  : m.includes("Different cards") ? "Only copies of the same card can be combined."
  : m.includes("most CE") ? "The card with the most CE must be the one that survives."
  : m.includes("maximum CE") ? "That would go past this card's maximum level."
  : m.includes("used once") ? "Each copy can only be used once."
  : "Couldn't combine those cards. Try again.";

/** Permanently merge copies into one surviving card (combine_card_assets runs it in one transaction). */
export const combineCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    targetAssetId: z.string().uuid(),
    sourceAssetIds: z.array(z.string().uuid()).min(1).max(100),
  }).parse(d))
  .handler(async ({ data, context }): Promise<CombineResult> => {
    const admin = await loadAdmin();
    const { data: r, error } = await admin.rpc("combine_card_assets", {
      p_player_id: context.userId, p_target_asset_id: data.targetAssetId, p_source_asset_ids: data.sourceAssetIds,
    });
    if (error) { console.error("[combine] failed", error); return { ok: false, error: friendly(error.message ?? "") }; }
    const v = r as { assetId: string; essenceAfter: number; levelBefore: number; levelAfter: number };
    return { ok: true, assetId: v.assetId, essenceAfter: v.essenceAfter, levelBefore: v.levelBefore, levelAfter: v.levelAfter };
  });
