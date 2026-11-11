import { describe, expect, it } from "vitest";
import { MAX_MINT_PER_TX, mintCost, rollHero, validMintCount } from "./mint";
import { HERO_RARITY_DEFS, HeroRarity } from "@/game/data/HeroRarity";
import { rollStatUpgrade, upgradeableStats } from "./leveling";

describe("hero minting rules", () => {
  it("costs 100,000 coins per hero", () => {
    expect(mintCost(1)).toBe(100_000);
    expect(mintCost(3)).toBe(300_000);
  });
  it("allows 1 to 10 heroes per mint", () => {
    expect(MAX_MINT_PER_TX).toBe(10);
    expect(validMintCount(0)).toBe(false);
    expect(validMintCount(10)).toBe(true);
    expect(validMintCount(11)).toBe(false);
    expect(validMintCount(2.5)).toBe(false);
  });
  it("a mint with two bonus stat points starts at level 3", () => {
    const values = [0, 0, 0.99, 0, 0, 0, 0];
    let i = 0;
    const hero = rollHero(() => values[i++] ?? 0);
    expect(hero).toMatchObject({ rarity: "common", level: 3, power: 4, speed: 1, stamina: 1, bombNumber: 1, bombRange: 1, maxEnergy: 50 });
  });
  it("minimum rolls start at level 1 and maximum rolls start at level 10", () => {
    expect(rollHero(() => 0)).toMatchObject({ level: 1, power: 2, speed: 1, stamina: 1, bombNumber: 1, bombRange: 1 });
    expect(rollHero(() => 0.999999)).toMatchObject({ rarity: "legendary", level: 10, power: 8, speed: 7, stamina: 7, bombNumber: 4, bombRange: 5, maxEnergy: 350 });
  });
  it.each([[HeroRarity.Common, 0.4], [HeroRarity.Uncommon, 0.85], [HeroRarity.Rare, 0.96], [HeroRarity.Epic, 0.995], [HeroRarity.Legendary, 0.999999]])("%s mint stats determine the level and remaining upgrades", (rarity, rarityRoll) => {
    const values = [rarityRoll, 0, 0.5, 0.8, 0.2, 0.8, 0.5];
    let i = 0;
    const hero = rollHero(() => values[i++] ?? 0);
    const def = HERO_RARITY_DEFS[rarity];
    expect(hero.rarity).toBe(rarity);
    const bonus = hero.power - def.power.min + hero.speed - def.speed.min + hero.stamina - def.stamina.min
      + hero.bombNumber - def.bombNum.min + hero.bombRange - def.bombRange.min;
    expect(hero.level).toBe(1 + bonus);
    expect(hero.maxEnergy).toBe(hero.stamina * 50);
    let stats = { ...hero, level: hero.level ?? 1 };
    const initialLevel = stats.level;
    let upgrades = 0;
    while (stats.level < 10) {
      const upgrade = rollStatUpgrade(rarity, stats, () => 0.4);
      expect(upgrade).not.toBeNull();
      if (!upgrade) break;
      stats = { ...stats, ...upgrade.stats };
      upgrades++;
    }
    expect(upgrades).toBe(10 - initialLevel);
    expect(stats.level).toBe(10);
    expect(upgradeableStats(rarity, stats)).toEqual([]);
  });
});
