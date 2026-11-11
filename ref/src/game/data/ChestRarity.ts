/** Chest rarities share the hero rarity names (common → legendary). */
export enum ChestRarity {
  Common = "common",
  Uncommon = "uncommon",
  Rare = "rare",
  Epic = "epic",
  Legendary = "legendary",
}

export interface ChestStats {
  hp: number;
  coins: number;
  tint: number;
  /** Map appearance chance, in percent (out of 100). */
  weight: number;
}

export const CHEST_STATS: Record<ChestRarity, ChestStats> = {
  [ChestRarity.Common]:    { hp: 60,   coins: 75,    tint: 0x999fa6, weight: 80.0 },
  [ChestRarity.Uncommon]:  { hp: 150,  coins: 240,   tint: 0x22c373, weight: 13.0 },
  [ChestRarity.Rare]:      { hp: 300,  coins: 800,   tint: 0x2ca2ff, weight: 5.0 },
  [ChestRarity.Epic]:      { hp: 600,  coins: 3250,  tint: 0xa46bf5, weight: 1.6 },
  [ChestRarity.Legendary]: { hp: 1250, coins: 16000, tint: 0xefa831, weight: 0.4 },
};

/** Texture key per rarity; files live in /public/game/items/chests/. */
export const CHEST_TEXTURE: Record<ChestRarity, string> = {
  [ChestRarity.Common]:    "chest_common",
  [ChestRarity.Uncommon]:  "chest_uncommon",
  [ChestRarity.Rare]:      "chest_rare",
  [ChestRarity.Epic]:      "chest_epic",
  [ChestRarity.Legendary]: "chest_legendary",
};

export function pickChestRarity(rand: () => number): ChestRarity {
  const total = Object.values(CHEST_STATS).reduce((s, v) => s + v.weight, 0);
  let r = rand() * total;
  for (const rarity of Object.keys(CHEST_STATS) as ChestRarity[]) {
    r -= CHEST_STATS[rarity as ChestRarity].weight;
    if (r <= 0) return rarity as ChestRarity;
  }
  return ChestRarity.Common;
}
