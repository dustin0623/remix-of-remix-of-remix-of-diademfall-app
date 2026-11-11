import { describe, expect, it } from "vitest";
import { rollSkills, skillSlots } from "./skills";

describe("hero skills", () => {
  it("gives skill slots by rarity", () => {
    expect(skillSlots("uncommon")).toBe(1);
    expect(skillSlots("rare")).toBe(2);
    expect(skillSlots("epic")).toBe(3);
    expect(skillSlots("legendary")).toBe(4);
    expect(skillSlots("common", () => 0.1)).toBe(1);
    expect(skillSlots("common", () => 0.5)).toBe(0);
  });
  it("rolls distinct skills", () => {
    const s = rollSkills("legendary");
    expect(new Set(s).size).toBe(4);
  });
  it("never rolls the removed Bonus Pay skill", () => {
    for (let i = 0; i < 200; i++) expect(rollSkills("legendary")).not.toContain("bonus_pay");
  });
});
