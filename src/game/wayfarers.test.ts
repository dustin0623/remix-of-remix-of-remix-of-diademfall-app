import { describe, expect, it } from "vitest";
import { SUMMONERS } from "./catalog/summoners";
import type { BannerId } from "./catalog/types";
import { CATALOG_VERSION, THREE_PACKS_CATALOG_VERSION, catalogFor } from "./catalogs";
import { simulateBattle } from "./engine";
import { aiDraft, maxWayfarers, rollMatch, SUPPORTED_RULESETS, validateTeam, type MatchConfig, type TeamPick } from "./match";
import { PACK_POOLS_BY_ALGORITHM, PACK_IDS, RARITY_ORDER } from "./packs";
import { validateRankedTeam } from "./ranked";
import { UNIT_BY_ID, WAYFARERS } from "./units";

const summonerOf = (b: BannerId) => SUMMONERS.find((s) => s.banner === b)!.id;
const ALL_BANNERS: BannerId[] = ["bastion_orders", "wild_courts", "veil_covenant", "hollow_legions", "skybound_houses", "wyrm_clans"];
const cfgWith = (rulesets: string[], manaCap = 99): MatchConfig => ({ seed: 1, manaCap, rulesets, banners: ALL_BANNERS });

describe("Wayfarer catalog", () => {
  it("has 12 Wayfarers, 4 per pack, with no Banner", () => {
    expect(WAYFARERS).toHaveLength(12);
    for (const p of PACK_IDS) expect(WAYFARERS.filter((w) => w.set === p)).toHaveLength(4);
    for (const w of WAYFARERS) expect(w.banner).toBeNull();
  });
  it("new packs can give Wayfarers; packs bought before the update cannot", () => {
    const ids = (alg: "diademfall-pack-v1" | "diademfall-pack-v2") =>
      PACK_IDS.flatMap((p) => RARITY_ORDER.flatMap((r) => PACK_POOLS_BY_ALGORITHM[alg][p][r].map((c) => c.id)));
    expect(ids("diademfall-pack-v2")).toHaveLength(138);
    expect(ids("diademfall-pack-v1")).toHaveLength(126);
    for (const w of WAYFARERS) {
      expect(ids("diademfall-pack-v2")).toContain(w.id);
      expect(ids("diademfall-pack-v1")).not.toContain(w.id);
    }
  });
  it("old battles use the 138-card catalog without Wayfarers", () => {
    expect(catalogFor(THREE_PACKS_CATALOG_VERSION).unit("ruin_jackal")).toBeUndefined();
    expect(catalogFor(CATALOG_VERSION).unit("ruin_jackal")).toBeDefined();
  });
});

describe("Wayfarer team limit", () => {
  const two = ["ruin_jackal", "hedge_crossbowman"];
  const three = [...two, "camp_scavenger"];
  const five = [...three, "roadside_tinker", "pebble_familiar"];
  const team = (unitIds: string[]): TeamPick => ({ summonerId: summonerOf("bastion_orders"), unitIds });

  it("allows 2 Wayfarers normally, 0 under Closed Ranks, 4 under Open Contract", () => {
    expect(maxWayfarers([])).toBe(2);
    expect(maxWayfarers(["closed_ranks"])).toBe(0);
    expect(maxWayfarers(["open_contract"])).toBe(4);
  });
  it("standard match: 2 Wayfarers pass, 3 fail", () => {
    expect(validateTeam(team(two), cfgWith([]))).toBeNull();
    expect(validateTeam(team(three), cfgWith([]))).toMatch(/At most 2 Wayfarers/);
  });
  it("Closed Ranks: even 1 Wayfarer fails", () => {
    expect(validateTeam(team(["ruin_jackal"]), cfgWith(["closed_ranks"]))).toMatch(/Closed Ranks/);
  });
  it("Open Contract: 4 Wayfarers pass, 5 fail", () => {
    expect(validateTeam(team(five.slice(0, 4)), cfgWith(["open_contract"]))).toBeNull();
    expect(validateTeam(team(five), cfgWith(["open_contract"]))).toMatch(/At most 4 Wayfarers/);
  });
  it("any commander can recruit Wayfarers in ranked, but not another Banner's troops", () => {
    const ok = validateRankedTeam({ summonerId: summonerOf("wild_courts"), unitIds: two }, cfgWith([]));
    expect(ok).toBeNull();
    const bad = validateRankedTeam({ summonerId: summonerOf("wild_courts"), unitIds: ["ashen_page"] }, cfgWith([]));
    expect(bad).toMatch(/not from/);
  });
  it("the computer opponent never breaks the Wayfarer limit", () => {
    for (const rules of [[], ["closed_ranks"], ["open_contract"]]) {
      for (let s = 1; s < 40; s++) {
        const cfg = { ...rollMatch(s * 101), rulesets: rules, manaCap: 40 };
        const t = aiDraft(cfg, s);
        expect(validateTeam(t, cfg)).toBeNull();
        expect(t.unitIds.filter((id) => UNIT_BY_ID[id]!.affiliation === "wayfarer").length).toBeLessThanOrEqual(maxWayfarers(rules));
      }
    }
  });
  it("Closed Ranks and Open Contract can be rolled", () => {
    expect(SUPPORTED_RULESETS).toContain("closed_ranks");
    expect(SUPPORTED_RULESETS).toContain("open_contract");
  });
});


describe("Wayfarer support in the shared kit", () => {
  it("uses the same healing, repair and defensive abilities as banner troops", () => {
    expect(UNIT_BY_ID["bronze_pilgrim"]!.abilities).toContain("salvager");
    expect(UNIT_BY_ID["bannerless_veteran"]!.abilities).toContain("salvager");
    expect(UNIT_BY_ID["contract_mender"]!.abilities).toContain("field_ration");
    expect(UNIT_BY_ID["ruin_jackal"]!.abilities).toContain("windread");
    expect(UNIT_BY_ID["greycloak_duelist"]!.abilities).toContain("shieldwall");
  });
  it("a Wayfarer heals and repairs a banner frontline in real catalog battles", () => {
    const cfg = cfgWith([],60);
    const result = simulateBattle(cfg,[
      {summonerId:summonerOf("bastion_orders"),unitIds:["granite_bailiff","bronze_pilgrim","contract_mender"]},
      {summonerId:summonerOf("wild_courts"),unitIds:["whitehart_ravager","grove_tender","needlewing_hunter"]},
    ]);
    const repair=result.events.find(e=>e.actor?.includes("bronze_pilgrim") && e.text.includes("(Salvager)"));
    const heal=result.events.find(e=>e.actor?.includes("contract_mender") && e.text.includes("Field Ration"));
    expect(repair?.target).toContain("granite_bailiff");
    expect(heal?.target).toContain("granite_bailiff");
    expect(heal?.amount).toBeLessThanOrEqual(2);
  });
});
