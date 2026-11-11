import { describe, expect, it } from "vitest";
import { levelFromXp, levelProgress, xpForLevel } from "./level";

describe("player level", () => {
  it("level 2 starts at 1000 XP", () => {
    expect(levelFromXp(999)).toBe(1);
    expect(levelFromXp(1000)).toBe(2);
  });
  it("level 3 needs 4000 cumulative XP", () => {
    expect(xpForLevel(3)).toBe(4000);
    expect(levelFromXp(3999)).toBe(2);
  });
  it("one legendary chest (1280 HP = 1280 XP) reaches level 2", () => {
    const p = levelProgress(1280);
    expect(p.level).toBe(2);
    expect(p.intoLevel).toBe(280);
    expect(p.levelSpan).toBe(3000);
  });
});
