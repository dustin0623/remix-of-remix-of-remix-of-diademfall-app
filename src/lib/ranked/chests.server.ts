/** Trusted division-chest and season helpers. Only call with the service client, after the caller is authenticated. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CHEST_ALGORITHM, reserveView, rollChest, type ChestRoll, type Reserve } from "@/game/chests";
import { CHEST_COIN_POOL_SHARE, type ChestType } from "@/game/divisions";
import { RARITY_ORDER } from "@/game/packs";

type Admin = SupabaseClient<Database>;

export interface OpenedChest {
  rolls: (ChestRoll & { assetId?: string })[];
  serverSeed: string;
  clientSeed: string;
  reserve: Reserve;
}

async function readReserve(admin: Admin): Promise<Reserve> {
  const { data } = await admin.from("legionnaire_reward_reserve").select("rarity, remaining_units");
  const counts = Object.fromEntries(RARITY_ORDER.map((r) => [r, 0])) as Reserve;
  for (const row of data ?? []) counts[row.rarity as keyof Reserve] = row.remaining_units;
  return reserveView(counts);
}

/**
 * Opens one chest: rolls it in TS from the hidden server seed + the player's seed against the capped reserve view,
 * then the database re-checks the reserve, mints cards, records Credits and keeps Coin shares for season close.
 * Retries when another opening changed the capped reserve in between.
 */
export async function openChestTrusted(admin: Admin, playerId: string, chestId: string, clientSeed: string, auto = false):
  Promise<{ ok: true; chest: OpenedChest } | { ok: false; error: string }> {
  const { data: c } = await admin.from("item_openings").select("id, player_id, chest_type:item_id, status, algorithm")
    .eq("id", chestId).eq("item_type", "chest").eq("player_id", playerId).maybeSingle();
  if (!c) return { ok: false, error: "Chest not found." };
  if (c.algorithm !== CHEST_ALGORITHM) return { ok: false, error: "This chest uses an unknown algorithm." };
  for (let attempt = 0; attempt < 4; attempt++) {
    let rolls: ChestRoll[] = [];
    let reserve = await readReserve(admin);
    if (c.status === "unopened") {
      const { data: secret } = await admin.from("game_secrets").select("server_seed")
        .eq("action_type", "division_chest").eq("target_id", c.id).eq("status", "committed").maybeSingle();
      if (!secret) return { ok: false, error: "Chest not found." };
      rolls = rollChest(c.chest_type as ChestType, secret.server_seed, clientSeed, c.id, reserve);
    }
    const { data, error } = await admin.rpc("open_division_chest", {
      p_player_id: playerId, p_chest_id: c.id, p_client_seed: clientSeed,
      p_results: rolls as never, p_reserve: reserve as never, p_auto: auto,
    });
    if (error) {
      if ((error.message ?? "").includes("Reward reserve changed")) continue;
      console.error("[chests] open failed", error);
      return { ok: false, error: "Opening failed. Try again." };
    }
    const r = data as unknown as { results: OpenedChest["rolls"]; serverSeed: string; clientSeed: string; reserve: Reserve };
    reserve = r.reserve;
    return { ok: true, chest: { rolls: r.results ?? [], serverSeed: r.serverSeed, clientSeed: r.clientSeed, reserve } };
  }
  return { ok: false, error: "Too many chests are opening right now. Try again." };
}

/**
 * Lazy season rollover: once the active season has ended and its matches are settled, auto-open every unopened
 * chest (client seed "season-close"), then settle chest Coin shares and start the next season with reset ratings.
 */
export async function rolloverSeasonIfDue(admin: Admin) {
  const { data: s } = await admin.from("ranked_seasons").select("key, ends_at").eq("status", "active").maybeSingle();
  if (!s || new Date(s.ends_at).getTime() > Date.now()) return false;
  const { data: open } = await admin.from("item_openings").select("id, player_id").eq("item_type", "chest").eq("season_key", s.key).eq("status", "unopened");
  for (const ch of open ?? []) await openChestTrusted(admin, ch.player_id, ch.id, "season-close", true);
  const { error } = await admin.rpc("close_ranked_season", { p_key: s.key, p_pool_share: CHEST_COIN_POOL_SHARE });
  if (error) {
    if (!/unfinished matches|Unopened chests/.test(error.message ?? "")) console.error("[season] close failed", error);
    return false;
  }
  return true;
}
