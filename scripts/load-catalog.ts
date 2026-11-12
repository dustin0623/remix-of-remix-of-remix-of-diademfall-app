/**
 * Loads the current card catalog (src/game/catalog: 138 cards incl. 12 Wayfarers) into Lovable Cloud and
 * retires older catalog cards. Game versions, pack editions and the chest reward reserve are SQL constant
 * functions (src/game/sql-constants.ts), so nothing else is loaded.
 * Idempotent; safe to re-run after a remix or a catalog edit. Old matches keep their game version,
 * and retired cards stay in the database (inactive) so old submissions and replays still resolve.
 *
 *   bun scripts/load-catalog.ts        (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment)
 */
import { createClient } from "@supabase/supabase-js";
import { SUMMONERS } from "../src/game/catalog/summoners";
import { TROOPS } from "../src/game/catalog/troops";
import { CATALOG_VERSION } from "../src/game/catalogs";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function must<T>(label: string, r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r.data;
}

// 1. The active game version and its catalog_hash come from game_version_table() (generated from src/game/catalogs.ts).
const gv = CATALOG_VERSION;

// 2. Packs, banners, abilities, level tables and ability unlocks are NOT stored in the database:
//    the TS catalog is their only home (cards.set_id / banner_id are guarded by CHECK constraints).

// 3. Cards (summoners + troops), then retire every card that is not in the current catalog.
//    Wayfarers have affiliation "wayfarer" and no Banner (banner_id null).
//    Supply counters (total_printed/total_combined/max_supply) are left out so reloading never resets them.
must("cards", await db.from("cards").upsert([
  ...SUMMONERS.map((s) => ({ id: s.id, game_version: gv, set_id: s.set, banner_id: s.banner, affiliation: "banner", card_type: "summoner", name: s.name, rarity: s.rarity, mana: s.mana, level_cap: s.levelCap, definition: { effects: s.effects, lore: s.lore }, active: true })),
  ...TROOPS.map((t) => ({ id: t.id, game_version: gv, set_id: t.set, banner_id: t.banner, affiliation: t.affiliation, card_type: "unit", name: t.name, rarity: t.rarity, mana: t.mana, level_cap: t.levelCap, definition: { role: t.role, channel: t.channel }, active: true })),
]));
must("retire cards", await db.from("cards").update({ active: false }).or(`game_version.is.null,game_version.neq.${gv}`));

// 4. Battle rules, ranked divisions and Card Essence levels are NOT stored in the database: the SQL procedures read
//    generated constant functions (src/game/sql-constants.ts, checked against the migrations by sql-constants.test.ts).

// 5. Pack editions (caps) and the Legionnaire reward reserve are constants; their counters are derived from
//    purchases, openings and chest-minted cards. Players own only cards they open from packs: no cards are granted here.

const cards = await db.from("cards").select("*", { count: "exact", head: true }).eq("active", true);
console.log(JSON.stringify({ version: CATALOG_VERSION, activeCards: cards.count }));
