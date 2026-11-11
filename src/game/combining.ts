/**
 * Card combining (Card Essence, "CE"). Pure and deterministic; the database (combine_card_assets and the
 * public.card_level_requirement_table() generated from CE_REQUIREMENTS by sql-constants.ts) is authoritative,
 * this module mirrors it for display, previews and ranked level gating.
 *
 * Every opened card starts at 1 CE / level 1. Combining compatible copies (same card, same foil, same owner,
 * all free — not listed, rented or locked) merges their CE permanently into one surviving asset.
 */
import type { Foil, Rarity } from "./packs";

/** Cumulative CE required for each level (index 0 = level 1). Length = level cap for that rarity. */
export const CE_REQUIREMENTS: Record<Foil, Record<Rarity, readonly number[]>> = {
  regular: {
    common: [1, 2, 4, 7, 11, 16, 22, 29, 37, 46],
    uncommon: [1, 2, 4, 7, 11, 16, 22, 29],
    rare: [1, 2, 4, 7, 11, 16],
    epic: [1, 2, 4, 7],
    legendary: [1, 2, 4],
  },
  gold: {
    common: [1, 2, 3, 5, 8, 11, 14, 18, 23, 28],
    uncommon: [1, 2, 3, 5, 8, 11, 14, 18],
    rare: [1, 2, 3, 4, 6, 8],
    epic: [1, 2, 3, 4],
    legendary: [1, 2, 3],
  },
};

/** Flat (rarity, foil, level, CE) rows, the shape of public.card_level_requirement_table(). */
export function requirementRows() {
  const rows: { rarity: Rarity; foil: Foil; level: number; required_essence: number }[] = [];
  for (const foil of Object.keys(CE_REQUIREMENTS) as Foil[])
    for (const rarity of Object.keys(CE_REQUIREMENTS[foil]) as Rarity[])
      CE_REQUIREMENTS[foil][rarity].forEach((ce, i) => rows.push({ rarity, foil, level: i + 1, required_essence: ce }));
  return rows;
}

/** Highest useful CE (the requirement for the maximum level). */
export const maxEssence = (rarity: Rarity, foil: Foil) => CE_REQUIREMENTS[foil][rarity].at(-1)!;
export const maxLevel = (rarity: Rarity, foil: Foil = "regular") => CE_REQUIREMENTS[foil][rarity].length;

/** The highest level whose CE requirement has been reached. */
export function levelForEssence(rarity: Rarity, foil: Foil, essence: number): number {
  const req = CE_REQUIREMENTS[foil][rarity];
  let lv = 1;
  for (let i = 0; i < req.length; i++) if (essence >= req[i]!) lv = i + 1;
  return lv;
}

export interface EssenceProgress { level: number; essence: number; maxLevel: number; nextLevelEssence: number | null; atMax: boolean }

/** Level plus progress to the next level (e.g. Common Regular 6 CE -> level 3, 6 / 7 CE). */
export function essenceProgress(rarity: Rarity, foil: Foil, essence: number): EssenceProgress {
  const req = CE_REQUIREMENTS[foil][rarity];
  const level = levelForEssence(rarity, foil, essence);
  const atMax = level >= req.length;
  return { level, essence, maxLevel: req.length, nextLevelEssence: atMax ? null : req[level]!, atMax };
}

/**
 * Highest level a troop plays at under a summoner: a max-level summoner commands every rarity at max level.
 * allowed = 1 + floor((summonerLevel - 1) * (troopLevelCap - 1) / (summonerLevelCap - 1))
 */
export function allowedTroopLevel(summonerLevel: number, summonerLevelCap: number, troopLevelCap: number): number {
  if (summonerLevelCap <= 1) return troopLevelCap;
  const s = Math.max(1, Math.min(summonerLevelCap, Math.floor(summonerLevel) || 1));
  return 1 + Math.floor(((s - 1) * (troopLevelCap - 1)) / (summonerLevelCap - 1));
}

/** The level a troop actually plays at: its owned level, temporarily lowered to what the summoner permits. */
export const playedTroopLevel = (ownedLevel: number, summonerLevel: number, summonerLevelCap: number, troopLevelCap: number) =>
  Math.min(Math.max(1, Math.min(troopLevelCap, ownedLevel)), allowedTroopLevel(summonerLevel, summonerLevelCap, troopLevelCap));

export interface CombineAsset { id: string; cardId: string; foil: Foil; essence: number; status: string }

export type CombinePlan =
  | { ok: true; essenceBefore: number; essenceAdded: number; essenceAfter: number; levelBefore: number; levelAfter: number }
  | { ok: false; error: string };

/** Mirrors combine_card_assets' checks so the UI can preview (and refuse) a combine before calling the server. */
export function planCombine(rarity: Rarity, target: CombineAsset, sources: CombineAsset[]): CombinePlan {
  if (sources.length === 0) return { ok: false, error: "Pick at least one copy to combine." };
  if (new Set(sources.map((s) => s.id)).size !== sources.length || sources.some((s) => s.id === target.id))
    return { ok: false, error: "Each copy can only be used once." };
  for (const a of [target, ...sources]) {
    if (a.status !== "available") return { ok: false, error: "Listed, rented or locked cards can't be combined." };
    if (a.cardId !== target.cardId) return { ok: false, error: "Only copies of the same card can be combined." };
    if (a.foil !== target.foil) return { ok: false, error: "Regular and Gold cards can't be combined together." };
  }
  if (sources.some((s) => s.essence > target.essence)) return { ok: false, error: "The card with the most CE must be the one that survives." };
  const added = sources.reduce((n, s) => n + s.essence, 0);
  const after = target.essence + added;
  if (after > maxEssence(rarity, target.foil)) return { ok: false, error: `That goes past the maximum of ${maxEssence(rarity, target.foil)} CE.` };
  return {
    ok: true, essenceBefore: target.essence, essenceAdded: added, essenceAfter: after,
    levelBefore: levelForEssence(rarity, target.foil, target.essence), levelAfter: levelForEssence(rarity, target.foil, after),
  };
}

/** Price per CE for a marketplace listing (8-decimal truncation, like every Coin amount). */
export const pricePerEssence = (price: number, essence: number) => Math.trunc((price / Math.max(1, essence)) * 1e8) / 1e8;
