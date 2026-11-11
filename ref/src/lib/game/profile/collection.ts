export const HERO_COLLECTION_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type HeroCollectionRarity = (typeof HERO_COLLECTION_RARITIES)[number];

export interface HeroCollection {
  total: number;
  byRarity: Record<HeroCollectionRarity, number>;
}

/** Counts the heroes a player currently owns, per rarity. Unknown rarities count toward the total only. */
export function countHeroCollection(rows: { rarity: string | null }[]): HeroCollection {
  const byRarity = Object.fromEntries(HERO_COLLECTION_RARITIES.map((r) => [r, 0])) as Record<HeroCollectionRarity, number>;
  for (const row of rows) {
    const r = row.rarity as HeroCollectionRarity;
    if (r in byRarity) byRarity[r] += 1;
  }
  return { total: rows.length, byRarity };
}
