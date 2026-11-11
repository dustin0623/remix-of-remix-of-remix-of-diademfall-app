import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATALOG_VERSION } from "@/game/catalogs";
import { isPackAlgorithm, openPack, PACK_ALGORITHM, PACK_IDS, PACK_RULES, randomSeed, type Foil, type PackAlgorithm, type PackId, type Rarity } from "@/game/packs";
import { ledgerKey } from "@/lib/economy/currency";

const loadAdmin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const packId = z.enum(PACK_IDS as [PackId, ...PackId[]]);

export type BuyResult = { ok: true; owned: number; balanceAfter: string } | { ok: false; error: string };

/** Buy packs from the public store with Credits (atomic: ledger debit + supply + inventory). */
export const buyPacks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pack: packId, quantity: z.number().int().min(1).max(PACK_RULES.maxPerPurchase), requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<BuyResult> => {
    const admin = await loadAdmin();
    const { data: r, error } = await admin.rpc("purchase_packs", {
      p_player_id: context.userId, p_set_id: data.pack, p_quantity: data.quantity,
      p_idempotency_key: ledgerKey("pack_purchase", context.userId, data.requestId),
    });
    if (error) {
      const m = error.message ?? "";
      if (m.includes("Insufficient balance")) return { ok: false, error: "Not enough Credits." };
      if (m.includes("Sold out")) return { ok: false, error: "Not enough packs left in the store." };
      if (m.includes("not on sale")) return { ok: false, error: "This pack is not on sale." };
      console.error("[packs] purchase failed", error);
      return { ok: false, error: "Purchase failed. Try again." };
    }
    const res = r as unknown as { owned: number; balanceAfter: string };
    return { ok: true, owned: Number(res.owned), balanceAfter: String(res.balanceAfter) };
  });

export type CommitResult = { ok: true; openingId: string; commitHash: string } | { ok: false; error: string };

/** Step 1: the server commits to a hidden seed before the player picks theirs. */
export const commitPackOpening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pack: packId }).parse(d))
  .handler(async ({ data, context }): Promise<CommitResult> => {
    const admin = await loadAdmin();
    const { data: r, error } = await admin.rpc("commit_pack_opening", {
      p_player_id: context.userId, p_set_id: data.pack, p_server_seed: randomSeed(),
      p_algorithm: PACK_ALGORITHM, p_catalog_version: CATALOG_VERSION,
    });
    if (error) {
      if ((error.message ?? "").includes("No unopened pack")) return { ok: false, error: "You have no unopened pack of this kind." };
      console.error("[packs] commit failed", error);
      return { ok: false, error: "Couldn't start the opening. Try again." };
    }
    const res = r as unknown as { openingId: string; commitHash: string };
    return { ok: true, openingId: res.openingId, commitHash: res.commitHash };
  });

export interface RevealedCard { assetId: string; cardId: string; foil: Foil; rarity: Rarity; slot: number }
export type RevealResult =
  | { ok: true; cards: RevealedCard[]; serverSeed: string; clientSeed: string; commitHash: string; openingId: string; pack: PackId; algorithm: PackAlgorithm }
  | { ok: false; error: string };

/** Step 2: combine the hidden seed with the player's seed, burn the pack and mint five cards. */
export const revealPackOpening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ openingId: z.string().uuid(), clientSeed: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data, context }): Promise<RevealResult> => {
    const admin = await loadAdmin();
    const { data: o } = await admin.from("pack_openings").select("id, player_id, set_id, status, commit_hash, algorithm")
      .eq("id", data.openingId).eq("player_id", context.userId).maybeSingle();
    if (!o) return { ok: false, error: "Opening not found." };
    // Openings keep the algorithm (card pools) they were committed with, so ones started before a catalog update still open fairly.
    if (!isPackAlgorithm(o.algorithm)) return { ok: false, error: "This opening uses an unknown pack algorithm." };
    const algorithm = o.algorithm;
    const { data: secret } = await admin.from("game_secrets").select("server_seed")
      .eq("action_type", "pack_opening").eq("target_id", o.id).eq("status", "committed").maybeSingle();
    if (!secret && o.status !== "revealed") return { ok: false, error: "Opening not found." };
    const pack = o.set_id as PackId;
    const pulls = secret ? openPack(pack, secret.server_seed, data.clientSeed, o.id, algorithm) : [];
    const { data: r, error } = await admin.rpc("reveal_pack_opening", {
      p_player_id: context.userId, p_opening_id: o.id, p_client_seed: data.clientSeed, p_results: pulls as never,
    });
    if (error) {
      console.error("[packs] reveal failed", error);
      return { ok: false, error: (error.message ?? "").includes("No unopened pack") ? "You have no unopened pack of this kind." : "Opening failed. Try again." };
    }
    const res = r as unknown as { results: RevealedCard[]; serverSeed: string; clientSeed: string };
    return { ok: true, cards: res.results, serverSeed: res.serverSeed, clientSeed: res.clientSeed, commitHash: o.commit_hash, openingId: o.id, pack, algorithm };
  });
