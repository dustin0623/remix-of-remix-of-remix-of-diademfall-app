import { describe, expect, it } from "vitest";
import { HOUSE_TIERS, houseBonusFor, demoNftId } from "./houses";
import { energyAfterRest } from "@/lib/game/dungeon/rules";

const HOUR = 3_600_000;

describe("houses", () => {
  it("has 1/2/5/8/14 beds from common to legendary", () => {
    expect(Object.values(HOUSE_TIERS).map((t) => t.slots)).toEqual([1, 2, 5, 8, 14]);
  });
  it("Villa adds 120 energy/hr", () => {
    expect(houseBonusFor("legendary")).toBe(120);
  });
  it("no house means no bonus", () => {
    expect(houseBonusFor(null)).toBe(0);
  });
  it("house bonuses stay at 15/30/60/90/120 energy per hour", () => {
    expect(Object.values(HOUSE_TIERS).map((t) => t.bonusPerHour)).toEqual([15, 30, 60, 90, 120]);
  });
  it("Tiny House rest gives 50 + 15 = 65 energy in an hour", () => {
    expect(energyAfterRest(0, 1000, HOUR, false, houseBonusFor("common"))).toBe(65);
  });
  it("Villa rest gives 50 + 120 = 170 energy in an hour", () => {
    expect(energyAfterRest(0, 1000, HOUR, false, houseBonusFor("legendary"))).toBe(170);
  });
  it("demo NFT id is per player and tier", () => {
    expect(demoNftId("p1", "rare")).toBe("demo-rare-p1");
  });
});
