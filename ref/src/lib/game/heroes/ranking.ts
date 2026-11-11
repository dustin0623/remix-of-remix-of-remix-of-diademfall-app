/** Browser-safe hero ranking: highest rarity first, then strongest stats. */
export const RARITY_RANK = ["common", "uncommon", "rare", "epic", "legendary"] as const;

export interface RankableHero {
  id: string;
  name: string;
  rarity: string;
  level?: number;
  power: number;
  speed: number;
  stamina: number;
  bombNumber: number;
  bombRange: number;
  skills?: string[];
}

export const rarityRank = (r: string) => RARITY_RANK.indexOf(r.toLowerCase() as (typeof RARITY_RANK)[number]);

/** Combined stat strength used as the tie-breaker within a rarity. */
export const heroStrength = (h: RankableHero) =>
  h.power * 3 + h.bombNumber * 2 + h.bombRange * 2 + h.speed + h.stamina + (h.skills?.length ?? 0) * 2 + (h.level ?? 1);

/** Strongest-first comparator; stable on id for equal heroes. */
export function compareStrongest(a: RankableHero, b: RankableHero): number {
  return (
    rarityRank(b.rarity) - rarityRank(a.rarity) ||
    heroStrength(b) - heroStrength(a) ||
    b.power - a.power ||
    a.id.localeCompare(b.id)
  );
}

export type HeroSort = "strongest" | "rarity" | "power" | "speed" | "stamina" | "bombs" | "range" | "name";

const STAT: Record<string, (h: RankableHero) => number> = {
  power: (h) => h.power, speed: (h) => h.speed, stamina: (h) => h.stamina,
  bombs: (h) => h.bombNumber, range: (h) => h.bombRange, rarity: (h) => rarityRank(h.rarity),
};

export function sortHeroes<T extends RankableHero>(heroes: T[], sort: HeroSort = "strongest"): T[] {
  const list = [...heroes];
  if (sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name) || compareStrongest(a, b));
  const stat = STAT[sort];
  return list.sort((a, b) => (stat ? stat(b) - stat(a) : 0) || compareStrongest(a, b));
}

export type CollectionStatus = "working" | "idle" | "house" | "resting";
export interface StatusRankableHero extends RankableHero {
  onMap?: boolean | undefined;
  houseId?: string | null | undefined;
  energy?: number | undefined;
  maxEnergy: number;
}

/** Same states as the card badges; a partially recovered hero is still resting. */
export function collectionHeroStatus(hero: StatusRankableHero): CollectionStatus {
  if (hero.houseId) return "house";
  if (hero.onMap) return "working";
  return (hero.energy ?? hero.maxEnergy) >= hero.maxEnergy ? "idle" : "resting";
}

const STATUS_ORDER: Record<"deploy" | "heroes", readonly CollectionStatus[]> = {
  deploy: ["working", "idle", "house", "resting"],
  heroes: ["working", "house", "resting", "idle"],
};

/** Group by page-specific status, preserving the selected strongest/stat order inside each group. */
export function sortCollectionHeroes<T extends StatusRankableHero>(
  heroes: T[], page: "deploy" | "heroes", sort: HeroSort = "strongest",
): T[] {
  const groups: Record<CollectionStatus, T[]> = { working: [], idle: [], house: [], resting: [] };
  for (const hero of sortHeroes(heroes, sort)) groups[collectionHeroStatus(hero)].push(hero);
  return STATUS_ORDER[page].flatMap((status) => groups[status]);
}

/** Mirrors the Marketplace filter window minus price: rarities, hero name, minimum stats. */
export interface HeroFilter {
  rarities: string[];
  search: string;
  stats: Record<string, number>;
}

/** Hero name without its mint number, so "Bomber #7" and "Bomber" match. */
const baseName = (n: string) => n.replace(/\s*#\d+\s*$/, "").trim().toLowerCase();

export function filterHeroes<T extends RankableHero>(heroes: T[], f: HeroFilter): T[] {
  const q = f.search.trim().toLowerCase();
  const rarities = f.rarities ?? [];
  const stats = f.stats ?? {};
  return heroes.filter((h) =>
    (!rarities.length || rarities.includes(h.rarity.toLowerCase())) &&
    (!q || baseName(h.name).includes(q)) &&
    Object.entries(stats).every(([key, min]) => !min || Number((h as unknown as Record<string, unknown>)[key]) >= min),
  );
}

/** Picks the strongest deployable heroes to fill the free map slots. */
export function pickDeployable<T extends RankableHero>(eligible: T[], slots: number): T[] {
  return slots > 0 ? [...eligible].sort(compareStrongest).slice(0, slots) : [];
}
