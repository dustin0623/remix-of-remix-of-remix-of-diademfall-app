import { HERO_RARITY_DEFS, HeroRarity, pickHeroType } from "@/game/data/HeroRarity";
import { ENERGY_PER_STAMINA } from "@/lib/config/constants/game";

export const MAX_HERO_LEVEL = 10;

export type UpgradeStat = "power" | "speed" | "stamina" | "bombNumber" | "bombRange";
export const UPGRADE_STATS: UpgradeStat[] = ["power", "speed", "stamina", "bombNumber", "bombRange"];
export const STAT_LABEL: Record<UpgradeStat, string> = {
  power: "Power", speed: "Speed", stamina: "Stamina", bombNumber: "Bombs", bombRange: "Range",
};

export interface LevelStats {
  level: number;
  power: number;
  speed: number;
  stamina: number;
  bombNumber: number;
  bombRange: number;
  maxEnergy: number;
}

/** Coins to go from `level` to `level + 1` (1,425,000 total for 1 → 10). */
export function levelUpCost(level: number): number | null {
  if (!Number.isInteger(level) || level < 1 || level >= MAX_HERO_LEVEL) return null;
  return level ** 2 * 5_000;
}

function isRarity(r: string): r is HeroRarity {
  return (Object.values(HeroRarity) as string[]).includes(r);
}

export function statRange(rarity: string, stat: UpgradeStat): { min: number; max: number } {
  const d = HERO_RARITY_DEFS[isRarity(rarity) ? rarity : HeroRarity.Common];
  return stat === "bombNumber" ? d.bombNum : d[stat];
}

export function upgradeableStats(rarity: string, s: LevelStats): UpgradeStat[] {
  return UPGRADE_STATS.filter((k) => s[k] < statRange(rarity, k).max);
}

/** Rolls +1 into a random unmaxed stat and raises the level. Null when the hero can't level. */
export function rollStatUpgrade(rarity: string, s: LevelStats, rand: () => number = Math.random): { stats: LevelStats; stat: UpgradeStat } | null {
  if (s.level >= MAX_HERO_LEVEL) return null;
  const eligible = upgradeableStats(rarity, s);
  if (eligible.length === 0) return null;
  const stat = eligible[Math.min(eligible.length - 1, Math.floor(rand() * eligible.length))];
  if (!stat) return null;
  const next = { ...s, level: s.level + 1, [stat]: s[stat] + 1 };
  if (stat === "stamina") next.maxEnergy = s.maxEnergy + ENERGY_PER_STAMINA;
  return { stats: next, stat };
}

/** Level 1 base stats of a rarity plus (level - 1) random upgrades. */
export function buildHeroAtLevel(rarity: HeroRarity, level: number, rand: () => number = Math.random): LevelStats {
  const d = HERO_RARITY_DEFS[rarity];
  let s: LevelStats = {
    level: 1, power: d.power.min, speed: d.speed.min, stamina: d.stamina.min,
    bombNumber: d.bombNum.min, bombRange: d.bombRange.min, maxEnergy: d.stamina.min * ENERGY_PER_STAMINA,
  };
  const target = Math.max(1, Math.min(MAX_HERO_LEVEL, Math.floor(level)));
  while (s.level < target) {
    const r = rollStatUpgrade(rarity, s, rand);
    if (!r) break;
    s = r.stats;
  }
  return s;
}

// ---------- Fusion ----------

export const FUSION_INPUTS = 3;
export const FUSION_DAILY_LIMIT = 10;
export interface FusionRecipe { from: HeroRarity; to: HeroRarity; chance: number; fee: number }
export const FUSION_RECIPES: FusionRecipe[] = [
  { from: HeroRarity.Common, to: HeroRarity.Uncommon, chance: 0.75, fee: 5_000 },
  { from: HeroRarity.Uncommon, to: HeroRarity.Rare, chance: 0.6, fee: 15_000 },
  { from: HeroRarity.Rare, to: HeroRarity.Epic, chance: 0.5, fee: 40_000 },
  { from: HeroRarity.Epic, to: HeroRarity.Legendary, chance: 0.4, fee: 100_000 },
];
export function fusionRecipe(from: string): FusionRecipe | undefined {
  return FUSION_RECIPES.find((r) => r.from === from);
}

/** Fused hero level = floor((L1 + L2 + L3) / 3), clamped 1–10. */
export function fusedLevel(levels: number[]): number {
  const sum = levels.reduce((a, b) => a + (b || 1), 0);
  return Math.max(1, Math.min(MAX_HERO_LEVEL, Math.floor(sum / FUSION_INPUTS)));
}

export function rollFusedHero(recipe: FusionRecipe, levels: number[], rand: () => number = Math.random) {
  const stats = buildHeroAtLevel(recipe.to, fusedLevel(levels), rand);
  return { ...stats, rarity: recipe.to, type: pickHeroType(rand) };
}
