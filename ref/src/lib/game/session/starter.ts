import { HeroRarity, HERO_TYPES, rollHeroAttributes } from "@/game/data/HeroRarity";
import type { SessionHero } from "./types";

/** The four starter bombers every new player begins with (unique ids per player). */
export function starterHeroes(): SessionHero[] {
  const rarities = [HeroRarity.Common, HeroRarity.Uncommon, HeroRarity.Rare, HeroRarity.Epic];
  const types = HERO_TYPES;
  return rarities.map((rarity, i) => {
    const a = rollHeroAttributes(rarity);
    return {
      id: `hero_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      name: types[(i * 3) % types.length]!,
      type: types[(i * 3) % types.length]!,
      level: 1,
      rarity,
      power: a.power,
      speed: a.speed,
      stamina: a.stamina,
      bombNumber: a.bombNum,
      bombRange: a.bombRange,
      maxEnergy: a.energy,
    };
  });
}
