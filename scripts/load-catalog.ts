/**
 * Loads the current card catalog (src/game/catalog, v5: 150 cards incl. 12 Wayfarers) into Lovable Cloud
 * and retires older catalog rows.
 * Idempotent; safe to re-run after a remix or a catalog edit. Old matches keep their game version,
 * and retired cards stay in the database (inactive) so old submissions and replays still resolve.
 *
 *   bun scripts/load-catalog.ts        (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment)
 */
import { createClient } from "@supabase/supabase-js";
import { RULESETS } from "../src/game/catalog/rulesets";
import { SUMMONERS } from "../src/game/catalog/summoners";
import { TROOPS } from "../src/game/catalog/troops";
import { CATALOG_VERSION, catalogHash } from "../src/game/catalogs";
import { rulesetSelectionWeight } from "../src/game/rule-support";
import { PACK_RULES } from "../src/game/packs";

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
must("cards", await db.from("cards").upsert([
  ...SUMMONERS.map((s) => ({ id: s.id, game_version_id: gv, set_id: s.set, banner_id: s.banner, affiliation: "banner", card_type: "summoner", name: s.name, rarity: s.rarity, mana: s.mana, level_cap: s.levelCap, definition: { effects: s.effects, lore: s.lore }, active: true })),
  ...TROOPS.map((t) => ({ id: t.id, game_version_id: gv, set_id: t.set, banner_id: t.banner, affiliation: t.affiliation, card_type: "unit", name: t.name, rarity: t.rarity, mana: t.mana, level_cap: t.levelCap, definition: { role: t.role, channel: t.channel }, active: true })),
]));
must("retire cards", await db.from("cards").update({ active: false }).neq("game_version_id", gv));

// 4. Battle rules: only rules the engine enforces get a ranked roll weight; retire rules not in the current catalog.
must("rulesets", await db.from("rulesets").upsert(RULESETS.map((r) => ({
  id: r.id, game_version_id: gv, name: r.name, category: r.category, phase: r.phase, description: r.text,
  definition: r.values, incompatible_with: r.incompatibleWith, selection_weight: rulesetSelectionWeight(r.id), active: true,
}))));
must("retire rulesets", await db.from("rulesets").update({ active: false }).neq("game_version_id", gv));

// 5. Catalog fingerprint.
must("hash", await db.from("game_versions").update({ catalog_hash: catalogHash(rulesetSelectionWeight) }).eq("id", gv));

// 6. Pack editions: insert caps once; existing rows are never changed (caps are fixed, counters live in the DB).
must("pack supply", await db.from("pack_supply").upsert(PACK_RULES.editions.map((e) => ({
  set_id: e.id, price_credits: PACK_RULES.priceCredits, maximum_packs: e.maximumPacks, public_allocation: e.publicSale, reserve_allocation: e.reserve,
})), { onConflict: "set_id", ignoreDuplicates: true }));
// Players own only cards they open from packs: no cards are granted here.

const count = async (t: "cards" | "rulesets", active = false) => {
  let q = db.from(t).select("*", { count: "exact", head: true });
  if (active) q = q.eq("active", true);
  return (await q).count;
};
console.log(JSON.stringify({
  version: CATALOG_VERSION, activeCards: await count("cards", true),
  activeRulesets: await count("rulesets", true),
}));
