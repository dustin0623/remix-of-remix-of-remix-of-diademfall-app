import { describe, expect, it } from "vitest";
import { simulateBattle } from "./engine";
import { aiDraft, rollMatch, teamMana, validateTeam, cardCost } from "./match";

describe("diademfall engine", () => {
  it("is deterministic for the same seed", () => {
    const cfg = rollMatch(12345);
    const a = aiDraft(cfg, 1), b = aiDraft(cfg, 2);
    const r1 = simulateBattle(cfg, [a, b]);
    const r2 = simulateBattle(cfg, [a, b]);
    expect(r1.winner).toBe(r2.winner);
    expect(r1.events.length).toBe(r2.events.length);
  });
  it("AI teams always fit the mana cap", () => {
    for (let s = 1; s < 60; s++) {
      const cfg = rollMatch(s * 7919);
      const t = aiDraft(cfg, s);
      expect(teamMana(t, cfg.rulesets)).toBeLessThanOrEqual(cfg.manaCap);
      expect(validateTeam(t, cfg)).toBeNull();
      const r = simulateBattle(cfg, [t, aiDraft(cfg, s + 1)]);
      expect(r.events.at(-1)?.kind).toBe("end");
    }
  });
  it("Lean Campaign adds 1 mana capped at 12, Royal Stipend discounts first unit by 2", () => {
    expect(cardCost(5, ["lean_campaign"])).toBe(6);
    expect(cardCost(12, ["lean_campaign"])).toBe(12);
    expect(cardCost(1, ["royal_stipend"], true)).toBe(0);
  });
});
