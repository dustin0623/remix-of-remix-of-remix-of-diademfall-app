import { describe, expect, it } from "vitest";
import { countHeroCollection } from "./collection";

describe("countHeroCollection", () => {
  it("counts owned heroes per rarity and in total", () => {
    const c = countHeroCollection([
      { rarity: "common" },
      { rarity: "common" },
      { rarity: "rare" },
      { rarity: "legendary" },
    ]);
    expect(c.total).toBe(4);
    expect(c.byRarity).toEqual({ common: 2, uncommon: 0, rare: 1, epic: 0, legendary: 1 });
  });

  it("returns zero for a player with no heroes", () => {
    expect(countHeroCollection([]).total).toBe(0);
  });
});
