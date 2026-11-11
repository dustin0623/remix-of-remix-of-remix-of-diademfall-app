import { describe, expect, it } from "vitest";
import { energyBarClass, energyColorClass, energyPct, heroStatus } from "./display";

describe("hero display helpers", () => {
  it("marks on-map heroes as Working (W)", () => {
    expect(heroStatus({ onMap: true, energy: 50, maxEnergy: 200 }).letter).toBe("W");
    expect(heroStatus({ onMap: true, energy: 50, maxEnergy: 200 }).label).toBe("Working");
  });

  it("marks depleted heroes as Sleeping (S)", () => {
    expect(heroStatus({ energy: 0, maxEnergy: 200 }).letter).toBe("S");
    expect(heroStatus({ energy: 0, maxEnergy: 200 }).label).toBe("Sleeping");
  });

  it("marks off-map heroes with energy as R (resting or ready)", () => {
    expect(heroStatus({ energy: 50, maxEnergy: 200 }).letter).toBe("R");
    expect(heroStatus({ energy: 150, maxEnergy: 200 }).label).toBe("Ready");
    expect(heroStatus({ energy: 99, maxEnergy: 200 }).label).toBe("Resting");
  });

  it("colors the energy number with the same thresholds as the bar", () => {
    const low = energyPct(20, 200); // 10%
    const mid = energyPct(80, 200); // 40%
    const high = energyPct(160, 200); // 80%
    expect(energyColorClass(low)).toBe("text-destructive");
    expect(energyBarClass(low)).toBe("bg-destructive");
    expect(energyColorClass(mid)).toBe("text-warning");
    expect(energyBarClass(mid)).toBe("bg-warning");
    expect(energyColorClass(high)).toBe("text-success");
    expect(energyBarClass(high)).toBe("bg-success");
  });
});
