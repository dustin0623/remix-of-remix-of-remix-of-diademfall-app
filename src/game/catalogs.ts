/**
 * Versioned card catalogs. New play uses the v2 catalog; ranked replays re-simulate with the
 * catalog of the game version they were played on, so old result hashes keep verifying.
 */
import { ABILITIES } from "./catalog/abilities";
import { BANNERS as CATALOG_BANNERS } from "./catalog/banners";
import { RULESETS } from "./catalog/rulesets";
import { SETS } from "./catalog/sets";
import { SUMMONERS } from "./catalog/summoners";
import { TROOPS } from "./catalog/troops";
import type { SummonerEffect } from "./catalog/types";
import { LEGACY_SUMMONERS } from "./legacy/summoners";
import { LEGACY_UNIT_BY_ID } from "./legacy/units";
import { hashCanonical } from "./sha256";
import { UNIT_BY_ID, type UnitCard } from "./units";
import type { BannerId } from "./catalog/types";

export const CATALOG_VERSION = "three-packs-1.0.0";
export const LEGACY_CATALOG_VERSION = "alpha-beta-1.0.0";

export interface SummonerCard { id: string; name: string; banner: BannerId; set: string; rarity: string; mana: number; effects: SummonerEffect[] }

export interface CardCatalog {
  version: string;
  unit: (id: string) => UnitCard | undefined;
  summoner: (id: string) => SummonerCard | undefined;
}

const SUMMONER_BY_ID = Object.fromEntries(SUMMONERS.map((s) => [s.id, s])) as Record<string, SummonerCard>;
const LEGACY_SUMMONER_BY_ID = Object.fromEntries(LEGACY_SUMMONERS.map((s) => [s.id, s as SummonerCard])) as Record<string, SummonerCard>;

export const CURRENT_CATALOG: CardCatalog = { version: CATALOG_VERSION, unit: (id) => UNIT_BY_ID[id], summoner: (id) => SUMMONER_BY_ID[id] };
export const LEGACY_CATALOG: CardCatalog = { version: LEGACY_CATALOG_VERSION, unit: (id) => LEGACY_UNIT_BY_ID[id], summoner: (id) => LEGACY_SUMMONER_BY_ID[id] };

/** Catalog for a game version; unknown versions use the current catalog. */
export function catalogFor(gameVersion: string | undefined): CardCatalog {
  return gameVersion === LEGACY_CATALOG_VERSION ? LEGACY_CATALOG : CURRENT_CATALOG;
}

/** Card info for display (names/art) in replays: current card first, then retired Alpha/Beta cards. */
export function displayUnit(id: string): UnitCard | undefined {
  return UNIT_BY_ID[id] ?? LEGACY_UNIT_BY_ID[id];
}

/** Card ids in a team that are not in the current catalog (retired Alpha/Beta cards or typos). */
export function retiredCards(pick: { summonerId: string; unitIds: string[] }): string[] {
  return [pick.summonerId, ...pick.unitIds].filter((id) => id && !UNIT_BY_ID[id] && !SUMMONER_BY_ID[id]);
}

const LEGACY_RULE_NAMES: Record<string, string> = { old_guard: "Old Guard", new_banner: "New Banner", mixed_company: "Mixed Company" };
const RULE_NAME = Object.fromEntries(RULESETS.map((r) => [r.id, r.name])) as Record<string, string>;
/** Display name for a ruleset id, including rules retired with the Alpha/Beta catalog. */
export function rulesetName(id: string): string {
  return RULE_NAME[id] ?? LEGACY_RULE_NAMES[id] ?? id;
}

/** Fingerprint of the v2 catalog stored on game_versions.catalog_hash. */
export function catalogHash(rulesetWeight: (id: string) => number): string {
  return hashCanonical({
    version: CATALOG_VERSION, sets: SETS, banners: CATALOG_BANNERS, summoners: SUMMONERS, troops: TROOPS, abilities: ABILITIES,
    rulesets: RULESETS.map((r) => ({ ...r, selectionWeight: rulesetWeight(r.id) })),
  });
}
