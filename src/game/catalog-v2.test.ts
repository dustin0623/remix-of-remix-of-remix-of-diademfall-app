import { describe, expect, it } from "vitest";
import { SETS } from "./catalog/sets";
import { SUMMONERS } from "./catalog/summoners";
import { TROOPS } from "./catalog/troops";
import { RULESETS } from "./catalog/rulesets";
import { CATALOG_VERSION, LEGACY_CATALOG_VERSION, catalogFor, displayUnit, retiredCards, rulesetName } from "./catalogs";
import { simulateBattle } from "./engine";
import { aiDraft, cardLegal, rollMatch, rulesetSelectionWeight, SUPPORTED_RULESETS, validateTeam } from "./match";
import { UNIT_BY_ID, UNITS, unitAtLevel } from "./units";

describe("catalog v2", () => {
  it("has 3 launch packs: 18 commanders, 120 troops (108 Banner + 12 Wayfarers), 138 cards", () => {
    expect(SETS.map((s) => s.id)).toEqual(["ancient", "oath", "legionnaire"]);
    expect(SUMMONERS).toHaveLength(18);
    expect(TROOPS).toHaveLength(120);
    expect(UNITS).toHaveLength(120);
    expect(TROOPS.filter((t) => t.affiliation === "wayfarer")).toHaveLength(12);
    expect(SETS.reduce((n, s) => n + s.total, 0)).toBe(138);
  });
  it("splits every pack into 6 commanders and 40 troops", () => {
    const count = (set: string) => [SUMMONERS.filter((s) => s.set === set).length, TROOPS.filter((t) => t.set === set).length];
    expect(count("ancient")).toEqual([6, 40]);
    expect(count("oath")).toEqual([6, 40]);
    expect(count("legionnaire")).toEqual([6, 40]);
  });
  it("uses the documented rarity level caps", () => {
    const caps: Record<string, number> = { common: 10, uncommon: 8, rare: 6, epic: 4, legendary: 3 };
    for (const t of TROOPS) expect(t.levelCap).toBe(caps[t.rarity]);
  });
});

describe("card levels", () => {
  it("level stats come from the level table and abilities unlock at their level", () => {
    const page = UNIT_BY_ID["ashen_page"]!; // brace unlocks at level 7
    expect(page.health).toBe(1);
    expect(page.abilities).toEqual([]);
    const l7 = unitAtLevel(page, 7);
    expect(l7.health).toBe(4);
    expect(l7.abilities).toContain("brace");
  });
  it("clamps levels to the card's cap", () => {
    const page = UNIT_BY_ID["ashen_page"]!;
    expect(unitAtLevel(page, 99).level).toBe(10);
    expect(unitAtLevel(page, 0).level).toBe(1);
  });
});

describe("pack battle rules", () => {
  const oathTroop = TROOPS.find((t) => t.set === "oath")!;
  const ancientTroop = TROOPS.find((t) => t.set === "ancient")!;
  it("Ancient Blood allows only Ancient Pack cards", () => {
    expect(cardLegal(ancientTroop, ["ancient_only"])).toBe(true);
    expect(cardLegal(oathTroop, ["ancient_only"])).toBe(false);
  });
  it("Oathbound Roster and Legion March limit to their pack", () => {
    expect(cardLegal(oathTroop, ["oath_only"])).toBe(true);
    expect(cardLegal(oathTroop, ["legionnaire_only"])).toBe(false);
  });
  it("Humble Origins bans Legendary cards", () => {
    expect(cardLegal({ set: "oath", rarity: "legendary" }, ["humble_origins"])).toBe(false);
  });
  it("only rules the engine enforces can be rolled in ranked", () => {
    for (const id of ["grand_muster", "crown_and_legend", "echoing_hall", "open_chronicle"]) expect(rulesetSelectionWeight(id)).toBe(0);
    for (const id of SUPPORTED_RULESETS) {
      expect(RULESETS.some((r) => r.id === id)).toBe(true);
      expect(rulesetSelectionWeight(id)).toBe(100);
    }
  });
  it("AI teams obey every pack rule", () => {
    for (const rule of ["ancient_only", "oath_only", "legionnaire_only"]) {
      const cfg = { ...rollMatch(4242), rulesets: [rule] };
      const t = aiDraft(cfg, 7);
      expect(validateTeam(t, cfg)).toBeNull();
      for (const id of t.unitIds) expect(cardLegal(UNIT_BY_ID[id]!, [rule])).toBe(true);
    }
  });
  it("Shared Burden and Runic Overflow fire in battle", () => {
    const fired = (rule: string, label: string) => {
      for (let s = 1; s < 300; s++) {
        const cfg = { ...rollMatch(s * 31), rulesets: [rule], manaCap: 40 };
        const r = simulateBattle(cfg, [aiDraft(cfg, s), aiDraft(cfg, s + 1)]);
        if (r.events.some((e) => e.text.includes(label))) return true;
      }
      return false;
    };
    expect(fired("shared_burden", "Shared Burden")).toBe(true);
    expect(fired("runic_overflow", "Runic Overflow")).toBe(true);
  });
});

describe("old replays", () => {
  // Prelaunch rebalance: no published battle hashes need compatibility.
  it("old cards still have names for the replay viewer but are retired from drafting", () => {
    expect(displayUnit("wallward_recruit")?.name).toBe("Wallward Recruit");
    expect(UNIT_BY_ID["wallward_recruit"]).toBeUndefined();
    expect(catalogFor(LEGACY_CATALOG_VERSION).unit("wallward_recruit")).toBeDefined();
    expect(catalogFor(CATALOG_VERSION).unit("wallward_recruit")).toBeUndefined();
    expect(rulesetName("old_guard")).toBe("Old Guard");
  });
});

describe("saved teams", () => {
  it("flags retired Alpha/Beta cards", () => {
    expect(retiredCards({ summonerId: "aldric_stonebanner", unitIds: ["ashen_page", "wallward_recruit"] })).toEqual(["wallward_recruit"]);
    expect(retiredCards({ summonerId: "aldric_stonebanner", unitIds: ["ashen_page"] })).toEqual([]);
  });
  it("the draft validator rejects unknown units", () => {
    const cfg = rollMatch(99);
    expect(validateTeam({ summonerId: SUMMONERS[0]!.id, unitIds: ["wallward_recruit"] }, { ...cfg, rulesets: [] })).toMatch(/Unknown/);
  });
});
