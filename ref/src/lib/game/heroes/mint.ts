import { HERO_RARITY_DEFS, pickHeroRarity, pickHeroType, rollInt } from "@/game/data/HeroRarity";
import { ENERGY_PER_STAMINA, MINT_COST } from "@/lib/config/constants/game";
import { rollSkills } from "./skills";
import type { SessionHero } from "@/lib/game/session/types";

/** Heroes mintable in one purchase (same limit as the Boom Miner reference). */
export const MAX_MINT_PER_TX = 10;

export function mintCost(count: number): number {
  return count * MINT_COST;
}

export function validMintCount(count: unknown): count is number {
  return typeof count === "number" && Number.isInteger(count) && count >= 1 && count <= MAX_MINT_PER_TX;
}

/** Server-side stat RNG; starting level is 1 + rolled points above rarity minimums. */
export function rollHero(rand: () => number = Math.random): Omit<SessionHero, "id" | "name" | "mintedNumber"> {
  const rarity = pickHeroRarity(rand);
  const type = pickHeroType(rand);
  const def = HERO_RARITY_DEFS[rarity];
  const power = rollInt(rand, def.power);
  const speed = rollInt(rand, def.speed);
  const stamina = rollInt(rand, def.stamina);
  const bombNumber = rollInt(rand, def.bombNum);
  const bombRange = rollInt(rand, def.bombRange);
  const level = 1 + power - def.power.min + speed - def.speed.min + stamina - def.stamina.min
    + bombNumber - def.bombNum.min + bombRange - def.bombRange.min;
  return {
    type,
    rarity,
    level,
    power,
    speed,
    stamina,
    bombNumber,
    bombRange,
    maxEnergy: stamina * ENERGY_PER_STAMINA,
    skills: rollSkills(rarity, rand),
  };
}
