/**
 * Loads the current card catalog (src/game/catalog, v5: 150 cards incl. 12 Wayfarers), pack supply and the chest
 * reward reserve into Lovable Cloud and retires older catalog cards.
 * Idempotent; safe to re-run after a remix or a catalog edit. Old matches keep their game version,
 * and retired cards stay in the database (inactive) so old submissions and replays still resolve.
 *
 *   bun scripts/load-catalog.ts        (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment)
 */
import { createClient } from "@supabase/supabase-js";
import { SUMMONERS } from "../src/game/catalog/summoners";
import { TROOPS } from "../src/game/catalog/troops";
import { CATALOG_VERSION, catalogHash } from "../src/game/catalogs";
import { rulesetSelectionWeight } from "../src/game/rule-support";
import { PACK_RULES } from "../src/game/packs";
import { RESERVE_PACKS, reserveComposition } from "../src/game/chests";

const ENGINE_VERSION = "battle-engine-1.0.0";
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function must<T>(label: string, r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r.data;
}

// 1. Game version: retire the old active version, activate the current one.
must("retire versions", await db.from("game_versions").update({ status: "retired" }).eq("status", "active").neq("version", CATALOG_VERSION));
const version = must("version", await db.from("game_versions")
  .upsert({ version: CATALOG_VERSION, engine_version: ENGINE_VERSION, status: "active", published_at: new Date().toISOString() }, { onConflict: "version" })
  .select("id").single());
const gv = version.id;

// 2. Packs, banners, abilities, level tables and ability unlocks are NOT stored in the database:
//    the TS catalog is their only home (cards.set_id / banner_id are guarded by CHECK constraints).

// 3. Cards (summoners + troops), then retire every card that is not in the current catalog.
//    Wayfarers have affiliation "wayfarer" and no Banner (banner_id null).
//    Supply counters (total_printed/total_combined/max_supply) are left out so reloading never resets them.
must("cards", await db.from("cards").upsert([
  ...SUMMONERS.map((s) => ({ id: s.id, game_version_id: gv, set_id: s.set, banner_id: s.banner, affiliation: "banner", card_type: "summoner", name: s.name, rarity: s.rarity, mana: s.mana, level_cap: s.levelCap, definition: { effects: s.effects, lore: s.lore }, active: true })),
  ...TROOPS.map((t) => ({ id: t.id, game_version_id: gv, set_id: t.set, banner_id: t.banner, affiliation: t.affiliation, card_type: "unit", name: t.name, rarity: t.rarity, mana: t.mana, level_cap: t.levelCap, definition: { role: t.role, channel: t.channel }, active: true })),
]));
must("retire cards", await db.from("cards").update({ active: false }).neq("game_version_id", gv));

// 4. Battle rules, ranked divisions and Card Essence levels are NOT stored in the database: the SQL procedures read
//    generated constant functions (src/game/sql-constants.ts, checked against the migrations by sql-constants.test.ts).

// 5. Catalog fingerprint.
must("hash", await db.from("game_versions").update({ catalog_hash: catalogHash(rulesetSelectionWeight) }).eq("id", gv));

// 6. Pack editions: insert caps once; existing rows are never changed (caps are fixed, counters live in the DB).
must("pack supply", await db.from("pack_supply").upsert(PACK_RULES.editions.map((e) => ({
  set_id: e.id, price_credits: PACK_RULES.priceCredits, maximum_packs: e.maximumPacks, public_allocation: e.publicSale, reserve_allocation: e.reserve,
})), { onConflict: "set_id", ignoreDuplicates: true }));
// Players own only cards they open from packs: no cards are granted here.

// 7. Legionnaire reward reserve: once, open the 20,000 committed reserve packs with the public seed and record
//    the reward-card units per rarity (also counts them as issued + opened Legionnaire reserve packs). No-op afterwards.
const seeded = must("reward reserve", await db.rpc("seed_legionnaire_reserve", { p_counts: reserveComposition(), p_packs: RESERVE_PACKS }));

const cards = await db.from("cards").select("*", { count: "exact", head: true }).eq("active", true);
console.log(JSON.stringify({ version: CATALOG_VERSION, activeCards: cards.count, rewardReserveSeeded: seeded }));
