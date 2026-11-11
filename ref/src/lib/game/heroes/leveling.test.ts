import { describe, expect, it } from "vitest";
import { HeroRarity, rollHeroAttributes } from "@/game/data/HeroRarity";
import { buildHeroAtLevel, fusedLevel, fusionRecipe, levelUpCost, rollStatUpgrade, upgradeableStats } from "./leveling";

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]!; };

describe("hero leveling", () => {
  it("new common heroes start at base stats with 50 energy", () => {
    const a = rollHeroAttributes(HeroRarity.Common);
    expect(a).toMatchObject({ power: 2, speed: 1, stamina: 1, bombNum: 1, bombRange: 1, energy: 50 });
  });
  it("9 upgrades reach level 10 with every stat maxed", () => {
    for (const r of Object.values(HeroRarity)) {
      const s = buildHeroAtLevel(r, 10, Math.random);
      expect(s.level).toBe(10);
      expect(upgradeableStats(r, s)).toEqual([]);
    }
  });
  it("level 9 has exactly one stat point left", () => {
    const s = buildHeroAtLevel(HeroRarity.Legendary, 9, Math.random);
    expect(upgradeableStats(HeroRarity.Legendary, s)).toHaveLength(1);
  });
  it("stamina upgrade adds 50 max energy", () => {
    const base = buildHeroAtLevel(HeroRarity.Common, 1);
    const r = rollStatUpgrade(HeroRarity.Common, base, seq([0.5]))!; // index 2 = stamina
    expect(r.stat).toBe("stamina");
    expect(r.stats.maxEnergy).toBe(100);
  });
  it("level 10 cannot level further", () => {
    expect(rollStatUpgrade(HeroRarity.Common, buildHeroAtLevel(HeroRarity.Common, 10))).toBeNull();
    expect(levelUpCost(10)).toBeNull();
  });
  it.each([[1, 5_000], [2, 20_000], [3, 45_000], [4, 80_000], [5, 125_000], [6, 180_000], [7, 245_000], [8, 320_000], [9, 405_000]])("costs %i squared × 5,000 for the next level (%i coins)", (level, cost) => {
    expect(levelUpCost(level)).toBe(cost);
  });
  it("costs 1,425,000 coins in total from level 1 to 10", () => {
    expect(Array.from({ length: 9 }, (_, i) => levelUpCost(i + 1) ?? 0).reduce((a, b) => a + b, 0)).toBe(1_425_000);
  });
  it.each([0, -1, 1.5, 10, 11, NaN])("cannot quote an upgrade at invalid or capped level %s", (level) => {
    expect(levelUpCost(level)).toBeNull();
  });
});

describe("hero fusion", () => {
  it("carries floor of average level", () => {
    expect(fusedLevel([1, 1, 1])).toBe(1);
    expect(fusedLevel([4, 6, 5])).toBe(5);
    expect(fusedLevel([10, 10, 9])).toBe(9);
  });
  it("common → uncommon is 75% for 5,000 coins", () => {
    expect(fusionRecipe("common")).toMatchObject({ to: "uncommon", chance: 0.75, fee: 5_000 });
    expect(fusionRecipe("legendary")).toBeUndefined();
  });
});
