/**
 * Draftable troop roster, adapted from the v2 catalog (src/game/catalog/troops.ts).
 * `UnitCard` holds a troop's stats at one level; `UNITS` are the printed level-1 cards.
 */
import { TROOPS } from "./catalog/troops";
import type { AbilityUnlock, Affiliation, BannerId, StatLine, TroopDefinition } from "./catalog/types";

export interface UnitCard {
  id: string;
  name: string;
  /** null for Wayfarers (shared troops any summoner may recruit) */
  banner: BannerId | null;
  /** "wayfarer" troops belong to no Banner; frozen legacy cards are all "banner" (absent = banner) */
  affiliation?: Affiliation;
  /** pack id (v2: ancient | oath | legionnaire; frozen legacy cards: alpha | beta) */
  set: string;
  rarity: string;
  mana: number;
  steel: number;
  shot: number;
  spell: number;
  armor: number;
  health: number;
  speed: number;
  /** abilities active at this card's level */
  abilities: string[];
  /** object-position for cropping the placeholder banner art */
  crop: string;
  levelCap: number;
  /** level these stats are for (1 when absent) */
  level?: number;
  role?: string;
  levels?: StatLine[];
  abilityUnlocks?: AbilityUnlock[];
}

const CROPS = ["50% 20%", "30% 40%", "70% 35%", "50% 60%", "20% 25%", "80% 55%", "40% 75%", "60% 30%"];

function fromTroop(t: TroopDefinition, i: number): UnitCard {
  const l1 = t.levels[0] ?? { level: 1, ...t.baseStats };
  return {
    id: t.id, name: t.name, banner: t.banner, affiliation: t.affiliation, set: t.set, rarity: t.rarity, mana: t.mana,
    steel: l1.steel, shot: l1.shot, spell: l1.spell, armor: l1.armor, health: l1.health, speed: l1.speed,
    abilities: t.abilityUnlocks.filter((a) => a.unlockLevel <= 1).map((a) => a.abilityId),
    crop: CROPS[i % CROPS.length]!, levelCap: t.levelCap, level: 1, role: t.role, levels: t.levels, abilityUnlocks: t.abilityUnlocks,
  };
}

export const UNITS: UnitCard[] = TROOPS.map(fromTroop);
export const isWayfarer = (u: Pick<UnitCard, "affiliation">) => u.affiliation === "wayfarer";
export const WAYFARERS: UnitCard[] = UNITS.filter(isWayfarer);
export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u])) as Record<string, UnitCard>;

/** Stats and unlocked abilities at a level (clamped to 1..levelCap). Cards without a level table keep printed stats. */
export function unitAtLevel(u: UnitCard, level = 1): UnitCard {
  if (!u.levels?.length) return u;
  const lv = Math.max(1, Math.min(u.levelCap, Math.floor(level) || 1));
  const s = u.levels.find((x) => x.level === lv) ?? u.levels[0]!;
  return {
    ...u, level: lv, steel: s.steel, shot: s.shot, spell: s.spell, armor: s.armor, health: s.health, speed: s.speed,
    abilities: (u.abilityUnlocks ?? []).filter((a) => a.unlockLevel <= lv).map((a) => a.abilityId),
  };
}
