import { describe, expect, it } from "vitest";
import type { BattleInput } from "./battle-contract";
import { SUMMONERS } from "./catalog/summoners";
import type { BannerId } from "./catalog/types";
import { CATALOG_VERSION, THREE_PACKS_CATALOG_VERSION, catalogFor } from "./catalogs";
import { simulateBattle } from "./engine";
import { aiDraft, maxWayfarers, rollMatch, SUPPORTED_RULESETS, validateTeam, type MatchConfig, type TeamPick } from "./match";
import { PACK_POOLS_BY_ALGORITHM, PACK_IDS, RARITY_ORDER } from "./packs";
import { resolveBattle, validateRankedTeam } from "./ranked";
import { UNIT_BY_ID, WAYFARERS } from "./units";
import threePacksReplays from "./legacy/three-packs-replays.fixture.json";

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
    expect(ids("diademfall-pack-v2")).toHaveLength(150);
    expect(ids("diademfall-pack-v1")).toHaveLength(138);
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
  it("any summoner can recruit Wayfarers in ranked, but not another Banner's troops", () => {
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

describe("Wayfarer abilities fire in battle", () => {
  /** Runs battles with the given player team against varied enemies until an event text matches. */
  const fires = (player: TeamPick, label: string | RegExp, enemyBanner?: BannerId, rulesets: string[] = []) => {
    for (let s = 1; s < 200; s++) {
      const cfg = { ...cfgWith(rulesets, 60), seed: s * 7 + 3, banners: enemyBanner ? [enemyBanner] : ALL_BANNERS };
      const r = simulateBattle(cfg, [player, aiDraft(cfg, s)]);
      if (r.events.some((e) => (typeof label === "string" ? e.text.includes(label) : label.test(e.text)))) return true;
    }
    return false;
  };
  const bastion = summonerOf("bastion_orders");

  it("Contract Bond: exactly 2 Wayfarers get +1 health", () => {
    const pick = { summonerId: bastion, unitIds: ["nameless_colossus", "hedge_crossbowman", "granite_bailiff"] };
    expect(fires(pick, "honor their contract")).toBe(true);
  });
  it("Contract Bond does nothing with 3 Wayfarers", () => {
    const pick = { summonerId: bastion, unitIds: ["nameless_colossus", "hedge_crossbowman", "ruin_jackal"] };
    expect(fires(pick, "honor their contract", undefined, ["open_contract"])).toBe(false);
  });
  it("Makeshift Guard props up an armorless neighbour", () => {
    expect(fires({ summonerId: bastion, unitIds: ["bronze_pilgrim", "ashen_page"] }, "Makeshift Guard")).toBe(true);
  });
  it("Field Ration heals a wounded ally every 3rd round", () => {
    expect(fires({ summonerId: bastion, unitIds: ["granite_bailiff", "contract_mender", "citadel_behemoth"] }, "Field Ration")).toBe(true);
  });
  it("Salvager regains armor when a unit's armor breaks", () => {
    expect(fires({ summonerId: bastion, unitIds: ["granite_bailiff", "bannerless_veteran", "gatebolt_archer"] }, "salvages 1 armor")).toBe(true);
  });
  it("Last Pay spurs neighbours when the bearer falls", () => {
    expect(fires({ summonerId: bastion, unitIds: ["ashen_page", "greycloak_duelist", "lantern_squire"] }, "Last Pay")).toBe(true);
  });
  it("Roadwise reacts to an enemy ability (Pounce on the rearmost unit)", () => {
    const wild = UNIT_BY_ID["needlewing_hunter"]!;
    const enemyFront = ["moss_oracle"].concat(Object.values(UNIT_BY_ID).filter((u) => u.banner === "wild_courts" && u.id !== wild.id && u.id !== "moss_oracle").slice(0, 2).map((u) => u.id));
    const enemy: TeamPick = { summonerId: summonerOf("wild_courts"), unitIds: [...enemyFront, wild.id] };
    const player: TeamPick = { summonerId: bastion, unitIds: ["granite_bailiff", "citadel_behemoth", "ruin_jackal"] };
    const r = simulateBattle(cfgWith([], 60), [player, enemy]);
    expect(r.events.some((e) => e.text.includes("pounces on Ruin Jackal"))).toBe(true);
    expect(r.events.some((e) => e.text.includes("Ruin Jackal sidesteps the trap (Roadwise"))).toBe(true);
  });
});

describe("battles from before Wayfarers", () => {
  it("three-packs-1.0.0 battles still reproduce their stored result hash", () => {
    expect(threePacksReplays.length).toBeGreaterThan(0);
    for (const r of threePacksReplays) {
      const input = r.input as unknown as BattleInput;
      expect(input.gameVersion).toBe(THREE_PACKS_CATALOG_VERSION);
      expect(resolveBattle(input).resultHash).toBe(r.resultHash);
    }
  });
});
