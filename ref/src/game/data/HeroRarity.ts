import { ENERGY_PER_STAMINA } from "@/lib/config/constants/game";

export enum HeroRarity {
  Common = "common",
  Uncommon = "uncommon",
  Rare = "rare",
  Epic = "epic",
  Legendary = "legendary",
}

export interface HeroAttributes {
  power: number;
  speed: number;
  stamina: number;
  bombNum: number;
  bombRange: number;
  energy: number;
}

interface Range {
  min: number;
  max: number;
}

/** Stat ranges are Level 1 base (min) → Level 10 max; each rarity has exactly 9 upgrade points. */
interface RarityDef {
  weight: number; // percent
  power: Range;
  speed: Range;
  stamina: Range;
  bombNum: Range;
  bombRange: Range;
  tint: number;
  label: string;
}

export const HERO_RARITY_DEFS: Record<HeroRarity, RarityDef> = {
  [HeroRarity.Common]: {
    weight: 80.0,
    power: { min: 2, max: 4 },
    speed: { min: 1, max: 3 },
    stamina: { min: 1, max: 3 },
    bombNum: { min: 1, max: 2 },
    bombRange: { min: 1, max: 3 },
    tint: 0x999fa6,
    label: "Common",
  },
  [HeroRarity.Uncommon]: {
    weight: 14.0,
    power: { min: 3, max: 5 },
    speed: { min: 2, max: 4 },
    stamina: { min: 2, max: 4 },
    bombNum: { min: 1, max: 2 },
    bombRange: { min: 2, max: 4 },
    tint: 0x22c373,
    label: "Uncommon",
  },
  [HeroRarity.Rare]: {
    weight: 5.0,
    power: { min: 4, max: 6 },
    speed: { min: 3, max: 5 },
    stamina: { min: 3, max: 5 },
    bombNum: { min: 2, max: 3 },
    bombRange: { min: 2, max: 4 },
    tint: 0x2ca2ff,
    label: "Rare",
  },
  [HeroRarity.Epic]: {
    weight: 0.995,
    power: { min: 5, max: 7 },
    speed: { min: 4, max: 6 },
    stamina: { min: 4, max: 6 },
    bombNum: { min: 2, max: 3 },
    bombRange: { min: 3, max: 5 },
    tint: 0xa46bf5,
    label: "Epic",
  },
  [HeroRarity.Legendary]: {
    weight: 0.005,
    power: { min: 6, max: 8 },
    speed: { min: 5, max: 7 },
    stamina: { min: 5, max: 7 },
    bombNum: { min: 3, max: 4 },
    bombRange: { min: 3, max: 5 },
    tint: 0xefa831,
    label: "Legendary",
  },
};

export enum HeroType {
  Rick     = "Rick",
  Rocky    = "Rocky",
  Rascal   = "Rascal",
  RedHorn  = "Red Horn",
  Ducky    = "Ducky",
  Bolt     = "Bolt",
  Pinky    = "Pinky",
  Moss     = "Moss",
  Ghost    = "Ghost",
  Tim      = "Tim",
  // HD test-bench sprites (64x96 frames); not rolled at mint yet.
  Ape          = "Ape",
  Avian        = "Avian",
  Bear         = "Bear",
  BlueSeal     = "Blue Seal",
  GrinningBear = "Grinning Bear",
}

/** HD hero types (64x96 frames in /public/game/sprites/players-hd/). */
export const HD_HERO_TYPES: HeroType[] = [HeroType.Ape, HeroType.Avian, HeroType.Bear, HeroType.BlueSeal, HeroType.GrinningBear];

export const HERO_TYPES: HeroType[] = Object.values(HeroType).filter((t) => !HD_HERO_TYPES.includes(t));

/** Sprite sheet key for each hero type. Files live in /public/game/sprites/players/. */
export const HERO_SPRITES: Record<HeroType, string> = {
  [HeroType.Rick]:   "ricky",
  [HeroType.Rocky]:   "rocky",
  [HeroType.Rascal]:  "rascal",
  [HeroType.RedHorn]: "redhorn",
  [HeroType.Ducky]:   "ducky",
  [HeroType.Bolt]:    "bolt",
  [HeroType.Pinky]:   "pinky",
  [HeroType.Moss]:   "mossy",
  [HeroType.Ghost]:  "ghosty",
  [HeroType.Tim]:   "timmy",
  [HeroType.Ape]:          "ape",
  [HeroType.Avian]:        "avian",
  [HeroType.Bear]:         "bear",
  [HeroType.BlueSeal]:     "blue-seal",
  [HeroType.GrinningBear]: "grinning-bear",
};

/** Per-sheet frame size, file path and display scale. HD sheets are 64x96 per
 *  frame (same 3x4 layout) and are scaled down to match the classic ~32px height. */
export interface HeroSheet { url: string; frameW: number; frameH: number; scale: number }
export function heroSheet(key: string): HeroSheet {
  const hd = HD_HERO_TYPES.some((t) => HERO_SPRITES[t] === key);
  return hd
    ? { url: `/game/sprites/players-hd/${key}.png`, frameW: 64, frameH: 96, scale: 32 / 96 }
    : { url: `/game/sprites/players/${key}.png`, frameW: 16, frameH: 20, scale: 1.6 };
}

/** Sprite sheet layout: 3 cols x 4 rows of 16x20 frames.
 *  Row 0 = walk down, 1 = walk left, 2 = walk right, 3 = walk up. */
export const HERO_SPRITE_FRAME_W = 16;
export const HERO_SPRITE_FRAME_H = 20;
export const HERO_SPRITE_COLS = 3;
export type HeroFacing = "down" | "left" | "right" | "up";
export const HERO_FACING_ROW: Record<HeroFacing, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

export function pickHeroRarity(rand: () => number): HeroRarity {
  const total = Object.values(HERO_RARITY_DEFS).reduce((s, v) => s + v.weight, 0);
  let r = rand() * total;
  for (const rarity of Object.keys(HERO_RARITY_DEFS) as HeroRarity[]) {
    r -= HERO_RARITY_DEFS[rarity].weight;
    if (r <= 0) return rarity;
  }
  return HeroRarity.Common;
}

export function rollInt(rand: () => number, r: Range): number {
  return Math.floor(rand() * (r.max - r.min + 1)) + r.min;
}

/** New heroes start at Level 1 with the base (minimum) stats of their rarity. */
export function rollHeroAttributes(rarity: HeroRarity, _rand: () => number = Math.random): HeroAttributes {
  const def = HERO_RARITY_DEFS[rarity];
  return {
    power: def.power.min,
    speed: def.speed.min,
    stamina: def.stamina.min,
    bombNum: def.bombNum.min,
    bombRange: def.bombRange.min,
    energy: def.stamina.min * ENERGY_PER_STAMINA,
  };
}

export function pickHeroType(rand: () => number = Math.random): HeroType {
  return HERO_TYPES[Math.floor(rand() * HERO_TYPES.length)]!;
}
