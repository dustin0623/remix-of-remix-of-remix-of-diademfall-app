import { describe, expect, it } from "vitest";
import { energyAfterRest } from "./rules";
import { maxEnergyFor } from "@/lib/config/constants/game";

const HOUR = 3_600_000;

describe("hero energy pool and rest recovery", () => {
  it("max energy is stamina × 50", () => {
    expect(maxEnergyFor(3)).toBe(150);
    expect(maxEnergyFor(16)).toBe(800);
  });
  it("a resting hero recovers 50 energy per hour", () => {
    expect(energyAfterRest(0, 800, HOUR)).toBe(50);
  });
  it("a full natural rest takes one hour per stamina", () => {
    expect(energyAfterRest(0, maxEnergyFor(5), 5 * HOUR)).toBe(250);
    expect(energyAfterRest(0, maxEnergyFor(5), 2.5 * HOUR)).toBe(125);
  });
  it("recovery is the same flat rate regardless of pool size", () => {
    expect(energyAfterRest(10, 150, HOUR / 2)).toBe(35);
    expect(energyAfterRest(10, 800, HOUR / 2)).toBe(35);
  });
  it("recovery stops at max energy", () => {
    expect(energyAfterRest(55, 60, HOUR)).toBe(60);
  });
});
