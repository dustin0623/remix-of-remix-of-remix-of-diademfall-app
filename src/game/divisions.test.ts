import { describe, expect, it } from "vitest";
import config from "../../docs/diademfall-complete-v6/ranked/ranked-config.json";
import { RANKED_CONFIG } from "./catalog/ranked-divisions";
import { divisionOf, divisionProgress, DIVISIONS, divisionsCrossed, ratingChange, rulesetCountFor, seasonResetRating } from "./divisions";
import { LEAGUES } from "./ladder";

describe("v6 ranked divisions", () => {
  it("matches docs/diademfall-complete-v6/ranked/ranked-config.json", () => expect(RANKED_CONFIG).toEqual(config));
  it("has 16 divisions with the published thresholds", () => {
    expect(DIVISIONS).toHaveLength(16);
    expect(DIVISIONS.map((d) => d.minRating)).toEqual([0, 1000, 1135, 1270, 1400, 1535, 1670, 1800, 1935, 2070, 2200, 2335, 2470, 2600, 2800, 3000]);
  });
  it("league boundaries stay at the ladder's league bands", () => {
    for (const l of LEAGUES) expect(divisionOf(l.min).league).toBe(l.id);
  });
  it("names divisions III / II / I, Wood has no tier", () => {
    expect([0, 1000, 1135, 1270, 1535, 3000].map((r) => divisionOf(r).name)).toEqual(["Wood", "Bronze III", "Bronze II", "Bronze I", "Silver II", "Champion I"]);
    expect(divisionOf(1134).name).toBe("Bronze III");
  });
  it("14 divisions give chests: Bronze II 2 Scout … Champion I 9 Crown", () => {
    expect(DIVISIONS.filter((d) => d.chests.length > 0)).toHaveLength(14);
    expect(divisionOf(1135).chests).toEqual([{ type: "scout", count: 2 }]);
    expect(divisionOf(1535).chests).toEqual([{ type: "war", count: 1 }, { type: "scout", count: 2 }]);
    expect(divisionOf(1935).chests).toEqual([{ type: "crown", count: 1 }, { type: "war", count: 2 }]);
    expect(divisionOf(3000).chests).toEqual([{ type: "crown", count: 9 }]);
    expect(divisionOf(1000).chests).toEqual([]);
  });
  it("progress shows rating still needed for the next division", () => {
    expect(divisionProgress(1100)).toMatchObject({ toNext: 35, next: { name: "Bronze II" } });
    expect(divisionProgress(3100)).toMatchObject({ next: null, pct: 100 });
  });
});

describe("rating movement", () => {
  it("win +20, loss -20, draw 0", () => {
    expect(ratingChange(1000, "win", 0).after).toBe(1020);
    expect(ratingChange(1000, "loss", 0).after).toBe(980);
    expect(ratingChange(1000, "draw", 4).after).toBe(1000);
  });
  it("+10 extra from the 3rd win in a row", () => {
    expect(ratingChange(1000, "win", 1)).toMatchObject({ after: 1020, streakAfter: 2, streakBonus: 0 });
    expect(ratingChange(1000, "win", 2)).toMatchObject({ after: 1030, streakAfter: 3, streakBonus: 10 });
    expect(ratingChange(1000, "win", 7).after).toBe(1030);
  });
  it("no streak bonus in Champion", () => {
    expect(ratingChange(2600, "win", 5).after).toBe(2620);
    expect(ratingChange(2599, "win", 5).after).toBe(2629);
  });
  it("a loss or draw resets the streak", () => {
    expect(ratingChange(1000, "loss", 5).streakAfter).toBe(0);
    expect(ratingChange(1000, "draw", 5).streakAfter).toBe(0);
  });
  it("rating never falls below 0", () => expect(ratingChange(10, "loss", 0).after).toBe(0));
});

describe("rules per match", () => {
  it("Wood 0, Bronze 1, Silver III 1, Silver II and up 2", () => {
    expect([999, 1000, 1399, 1400, 1535, 2600].map((r) => rulesetCountFor(r))).toEqual([0, 1, 1, 1, 2, 2]);
  });
  it("the lower-rated player's division decides", () => expect(rulesetCountFor(990, 1600)).toBe(0));
});

describe("advancement chests and season reset", () => {
  it("only divisions crossed upwards count", () => {
    expect(divisionsCrossed(1120, 1140).map((d) => d.id)).toEqual(["bronze_ii"]);
    expect(divisionsCrossed(1135, 1155)).toEqual([]);
    expect(divisionsCrossed(1140, 1120)).toEqual([]);
  });
  it("season reset: Wood 0, Bronze 1000, Silver 1000, Gold 1400, Diamond 1800, Champion 2200", () => {
    expect([500, 1300, 1700, 2000, 2400, 3100].map(seasonResetRating)).toEqual([0, 1000, 1000, 1400, 1800, 2200]);
  });
});
