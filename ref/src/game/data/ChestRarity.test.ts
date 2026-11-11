import { describe, expect, it } from "vitest";
import { CHEST_STATS } from "./ChestRarity";

describe("faster-clearing chest economy", () => {
  it("pays 75/240/800/3250/16000 coins from common to legendary", () => {
    expect(Object.values(CHEST_STATS).map((s) => s.coins)).toEqual([75, 240, 800, 3250, 16000]);
  });
  it("halves chest HP to 60/150/300/600/1250", () => {
    expect(Object.values(CHEST_STATS).map((s) => s.hp)).toEqual([60, 150, 300, 600, 1250]);
  });
  it("keeps spawn weights at 80/13/5/1.6/0.4", () => {
    expect(Object.values(CHEST_STATS).map((s) => s.weight)).toEqual([80, 13, 5, 1.6, 0.4]);
  });
});