import { describe, expect, it } from "vitest";
import { SUMMONERS } from "./catalog/summoners";
import { TROOPS } from "./catalog/troops";
import {
  CE_REQUIREMENTS, allowedTroopLevel, essenceProgress, levelForEssence, maxEssence, planCombine, pricePerEssence, requirementRows,
  type CombineAsset,
} from "./combining";
import type { Rarity } from "./packs";
import { lockedTeam, playedLevels } from "./ranked";

const asset = (id: string, essence: number, over: Partial<CombineAsset> = {}): CombineAsset =>
  ({ id, cardId: "ruin_jackal", foil: "regular", essence, status: "available", ...over });

describe("Card Essence requirements", () => {
  it("regular maximums: Common 46, Uncommon 29, Rare 16, Epic 7, Legendary 4", () => {
    expect([maxEssence("common", "regular"), maxEssence("uncommon", "regular"), maxEssence("rare", "regular"), maxEssence("epic", "regular"), maxEssence("legendary", "regular")])
      .toEqual([46, 29, 16, 7, 4]);
  });
  it("gold maximums: Common 28, Uncommon 18, Rare 8, Epic 4, Legendary 3", () => {
    expect([maxEssence("common", "gold"), maxEssence("uncommon", "gold"), maxEssence("rare", "gold"), maxEssence("epic", "gold"), maxEssence("legendary", "gold")])
      .toEqual([28, 18, 8, 4, 3]);
  });
  it("regular Common table matches the spec", () => {
    expect(CE_REQUIREMENTS.regular.common).toEqual([1, 2, 4, 7, 11, 16, 22, 29, 37, 46]);
  });
  it("gold Rare table matches the spec", () => {
    expect(CE_REQUIREMENTS.gold.rare).toEqual([1, 2, 3, 4, 6, 8]);
  });
  it("every card's level cap equals the number of levels for its rarity", () => {
    for (const c of [...SUMMONERS, ...TROOPS]) {
      expect(CE_REQUIREMENTS.regular[c.rarity as Rarity].length, c.id).toBe(c.levelCap);
      expect(CE_REQUIREMENTS.gold[c.rarity as Rarity].length, c.id).toBe(c.levelCap);
    }
  });
  it("database rows cover 31 regular + 31 gold levels", () => {
    expect(requirementRows()).toHaveLength(62);
  });
});

describe("levels from CE", () => {
  it("a new card is level 1 with 1 CE", () => {
    expect(levelForEssence("common", "regular", 1)).toBe(1);
  });
  it("Common Regular with 6 CE is level 3, 6 / 7 CE", () => {
    const p = essenceProgress("common", "regular", 6);
    expect(p.level).toBe(3);
    expect(p.nextLevelEssence).toBe(7);
  });
  it("Uncommon Regular with 4 CE is level 3 (Ruin Jackal example)", () => {
    expect(levelForEssence("uncommon", "regular", 4)).toBe(3);
  });
  it("Gold needs fewer copies: Common Gold with 5 CE is level 4, Regular is level 3", () => {
    expect(levelForEssence("common", "gold", 5)).toBe(4);
    expect(levelForEssence("common", "regular", 5)).toBe(3);
  });
  it("Legendary Regular at 4 CE is max level 3", () => {
    const p = essenceProgress("legendary", "regular", 4);
    expect(p.level).toBe(3);
    expect(p.atMax).toBe(true);
  });
});

describe("planCombine", () => {
  it("combining 1 + 2 + 1 CE keeps the 2-CE copy and reaches 4 CE / level 3", () => {
    const plan = planCombine("uncommon", asset("b", 2), [asset("a", 1), asset("c", 1)]);
    expect(plan).toEqual({ ok: true, essenceBefore: 2, essenceAdded: 2, essenceAfter: 4, levelBefore: 2, levelAfter: 3 });
  });
  it("refuses Regular + Gold", () => {
    expect(planCombine("common", asset("a", 1), [asset("b", 1, { foil: "gold" })]).ok).toBe(false);
  });
  it("refuses different cards", () => {
    expect(planCombine("common", asset("a", 1), [asset("b", 1, { cardId: "other" })]).ok).toBe(false);
  });
  it("refuses listed or rented copies", () => {
    expect(planCombine("common", asset("a", 1), [asset("b", 1, { status: "listed" })]).ok).toBe(false);
    expect(planCombine("common", asset("a", 1, { status: "rented" }), [asset("b", 1)]).ok).toBe(false);
  });
  it("refuses a survivor with less CE than a source", () => {
    expect(planCombine("common", asset("a", 1), [asset("b", 2)]).ok).toBe(false);
  });
  it("refuses going past the maximum CE (Epic Regular max 7)", () => {
    expect(planCombine("epic", asset("a", 4), [asset("b", 4)]).ok).toBe(false);
    expect(planCombine("epic", asset("a", 4), [asset("b", 3)]).ok).toBe(true);
  });
});

describe("summoner level gating", () => {
  // Rare summoner (cap 6) table from the spec: rows = summoner level, columns = Common..Legendary troop caps 10/8/6/4/3.
  const table: Record<number, number[]> = {
    1: [1, 1, 1, 1, 1], 2: [2, 2, 2, 1, 1], 3: [4, 3, 3, 2, 1], 4: [6, 5, 4, 2, 2], 5: [8, 6, 5, 3, 2], 6: [10, 8, 6, 4, 3],
  };
  for (const [lv, row] of Object.entries(table)) {
    it(`Rare summoner level ${lv} commands ${row.join("/")}`, () => {
      expect([10, 8, 6, 4, 3].map((cap) => allowedTroopLevel(Number(lv), 6, cap))).toEqual(row);
    });
  }

  it("ranked plays a troop above the summoner's limit at the permitted level", () => {
    const rare = SUMMONERS.find((s) => s.levelCap === 6)!;
    const common = TROOPS.find((t) => t.levelCap === 10 && (t.banner === rare.banner || t.affiliation === "wayfarer"))!;
    const pick = { summonerId: rare.id, unitIds: [common.id] };
    expect(playedLevels(pick, { [rare.id]: 3, [common.id]: 9 })[common.id]).toBe(4);
    expect(playedLevels(pick, { [rare.id]: 3, [common.id]: 2 })[common.id]).toBe(2);
    const team = lockedTeam({ matchId: "m", playerId: "p", side: 1, pick, levels: { [rare.id]: 3, [common.id]: 9 }, rulesets: [] });
    expect(team.summonerLevel).toBe(3);
    expect(team.formation[0]!.level).toBe(4);
  });
});

describe("market price per CE", () => {
  it("16 Coins for a 16-CE card is 1 Coin per CE", () => {
    expect(pricePerEssence(16, 16)).toBe(1);
  });
});
