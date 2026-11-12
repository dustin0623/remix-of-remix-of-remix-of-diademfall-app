import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ABILITIES } from "./catalog/abilities";
import { TROOPS } from "./catalog/troops";
import { SUMMONERS } from "./catalog/summoners";
import type { CardCatalog } from "./catalogs";
import { simulateBattle, type BattleResult } from "./engine";
import type { UnitCard } from "./units";

const unit = (id: string, props: Partial<UnitCard> = {}): UnitCard => ({
  id,
  name: id,
  banner: "bastion_orders",
  affiliation: "banner",
  set: "ancient",
  rarity: "common",
  mana: 6,
  steel: 0,
  shot: 0,
  spell: 0,
  armor: 0,
  health: 1000,
  speed: 1,
  abilities: [],
  crop: "50% 50%",
  levelCap: 1,
  ...props,
});
function battle(left: UnitCard[], right: UnitCard[], rulesets: string[] = [], seed = 7) {
  const cards = [...left, ...right];
  const catalog: CardCatalog = {
    version: "ability-test",
    unit: (id) => cards.find((c) => c.id === id),
    summoner: () => undefined,
  };
  return simulateBattle(
    { seed, manaCap: 99, rulesets, banners: ["bastion_orders", "veil_covenant"] },
    [
      { summonerId: "", unitIds: left.map((c) => c.id) },
      { summonerId: "", unitIds: right.map((c) => c.id) },
    ],
    catalog,
  );
}
const attacks = (result: BattleResult, id: string, round?: number) =>
  result.events.filter(
    (e) =>
      e.kind === "attack" &&
      e.actor?.endsWith("-" + id) &&
      (round === undefined || e.round === round),
  );
const hit = (result: BattleResult, id: string) => attacks(result, id)[0]!;
const targetState = (result: BattleResult, actor: string, target: string) =>
  hit(result, actor)
    .teams.flat()
    .find((u) => u.cardId === target)!;

describe("shared ability roster", () => {
  it("has 24 mechanics in six combat roles, with every mechanic shared by multiple banners", () => {
    expect(ABILITIES).toHaveLength(24);
    for (const role of ["defense", "offense", "targeting", "control", "restoration", "support"]) {
      expect(ABILITIES.filter((a) => a.category === role)).toHaveLength(4);
    }
    for (const ability of ABILITIES) {
      expect(ability).not.toHaveProperty("banner");
      const bearers = TROOPS.filter((t) =>
        t.abilityUnlocks.some((a) => a.abilityId === ability.id),
      );
      expect(
        new Set(bearers.map((t) => t.banner).filter(Boolean)).size,
        ability.id,
      ).toBeGreaterThanOrEqual(2);
    }
  });
  it("has no dangling troop unlocks or summoner grants and budgets strong unlocks", () => {
    const ids = new Set(ABILITIES.map((a) => a.id));
    const strong = new Set([
      "ancient_scale",
      "moonrush",
      "pounce",
      "runebreath",
      "doom_count",
      "grave_recall",
    ]);
    for (const t of TROOPS) {
      expect(new Set(t.abilityUnlocks.map((a) => a.abilityId)).size).toBe(t.abilityUnlocks.length);
      expect(t.abilityUnlocks.length).toBeLessThanOrEqual(t.mana <= 3 ? 2 : 3);
      for (const a of t.abilityUnlocks) {
        expect(ids.has(a.abilityId), t.id).toBe(true);
        expect(a.unlockLevel).toBeLessThanOrEqual(t.levelCap);
        if (strong.has(a.abilityId)) {
          expect(t.mana).toBeGreaterThanOrEqual(6);
          expect(a.unlockLevel).toBeGreaterThanOrEqual(Math.ceil(t.levelCap / 2));
        }
      }
    }
    for (const s of SUMMONERS)
      for (const e of s.effects) {
        if (e.kind === "grantAbility") expect(ids.has(e.abilityId!)).toBe(true);
      }
  });
  it("ships one transparent 150 x 152 PNG per mechanic", () => {
    for (const a of ABILITIES) {
      const png = readFileSync(
        new URL("../../public/assets/abilities/" + a.id + ".png", import.meta.url),
      );
      expect(png.toString("hex", 0, 8)).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(150);
      expect(png.readUInt32BE(20)).toBe(152);
      expect(png[25]).toBe(6); // RGBA; the export QA checks transparent corner pixels.
    }
  });
});

describe("targeting and attack cadence", () => {
  const enemies = [unit("front"), unit("weak", { health: 90 }), unit("rear", { health: 100 })];
  it("Wildshot reaches different positions across seeds and remains deterministic", () => {
    const left = [unit("wild", { spell: 1, speed: 100, abilities: ["wildshot"] })];
    const targets = new Set(
      Array.from({ length: 30 }, (_, seed) => hit(battle(left, enemies, [], seed), "wild").target),
    );
    expect(targets.size).toBe(3);
    expect(battle(left, enemies)).toEqual(battle(left, enemies));
  });
  it("Flank attacks the rear from position 3", () => {
    const r = battle(
      [unit("a"), unit("b"), unit("flanker", { steel: 1, speed: 100, abilities: ["flank"] })],
      enemies,
    );
    expect(hit(r, "flanker").target).toContain("-rear");
  });
  it("Hunt selects lowest current health from position 3; equal health favors the front", () => {
    const left = [
      unit("a"),
      unit("b"),
      unit("hunter", { steel: 1, speed: 100, abilities: ["hunt"] }),
    ];
    expect(hit(battle(left, enemies), "hunter").target).toContain("-weak");
    expect(hit(battle(left, [unit("first"), unit("second")]), "hunter").target).toContain("-first");
  });
  it("Duel at Dawn overrides a front unit's special targeting", () => {
    const r = battle(
      [unit("hunter", { steel: 1, speed: 100, abilities: ["hunt", "flank"] })],
      enemies,
      ["duel_at_dawn"],
    );
    expect(hit(r, "hunter").target).toContain("-front");
  });
  it("Wildshot cannot give a front Shot unit permission to fire", () => {
    expect(
      attacks(battle([unit("wild", { shot: 3, abilities: ["wildshot"] })], enemies), "wild"),
    ).toHaveLength(0);
  });
  it("Moonrush fires only on every third round at half base power", () => {
    const r = battle([unit("moon", { spell: 8, speed: 100, abilities: ["moonrush"] })], enemies);
    expect(attacks(r, "moon", 2)).toHaveLength(1);
    expect(attacks(r, "moon", 3).map((e) => e.amount)).toEqual([8, 4]);
  });
  it("Runebreath advances on the Moonrush attack, including into the next round", () => {
    const r = battle(
      [unit("rune", { steel: 2, speed: 100, abilities: ["runebreath", "moonrush"] })],
      enemies,
    );
    expect(
      attacks(r, "rune")
        .slice(0, 5)
        .map((e) => e.channel),
    ).toEqual(["steel", "spell", "shot", "steel", "spell"]);
  });
  it("Pounce hits before round 1 and Roadwise responds to the ability", () => {
    const r = battle(
      [unit("a"), unit("b"), unit("c"), unit("cat", { abilities: ["pounce"] })],
      [unit("front"), unit("rear", { abilities: ["roadwise"] })],
    );
    expect(r.events.find((e) => e.text.includes("pounces"))?.round).toBe(0);
    expect(r.events.find((e) => e.text.includes("Roadwise"))?.round).toBe(0);
  });
});

describe("damage, protection and restoration", () => {
  it("Brace prevents 2 physical health damage before the bearer acts", () => {
    const r = battle(
      [unit("guard", { abilities: ["brace"] })],
      [unit("enemy", { steel: 3, speed: 100 })],
    );
    expect(targetState(r, "enemy", "guard").hp).toBe(999);
  });
  it("Shieldwall protects a neighbor and Broken Formation suppresses it", () => {
    const left = [unit("front"), unit("wall", { armor: 2, abilities: ["shieldwall"] })];
    const right = [unit("enemy", { steel: 3, speed: 100 })];
    expect(targetState(battle(left, right), "enemy", "front").hp).toBe(998);
    expect(targetState(battle(left, right, ["broken_formation"]), "enemy", "front").hp).toBe(997);
  });
  it("Forgeheart restores only after survival and never rescues a lethal hit", () => {
    const right = [unit("enemy", { steel: 3, speed: 100 })];
    const live = battle([unit("guard", { armor: 1, health: 3, abilities: ["forgeheart"] })], right);
    expect(targetState(live, "enemy", "guard").armor).toBe(1);
    const dead = battle([unit("guard", { armor: 1, health: 2, abilities: ["forgeheart"] })], right);
    expect(dead.events.some((e) => e.text.includes("Forgeheart"))).toBe(false);
  });
  it("Ancient Scale checks health damage after armor rather than printed power", () => {
    const right = [unit("enemy", { steel: 5, speed: 100 })];
    expect(
      targetState(
        battle([unit("guard", { armor: 2, abilities: ["ancient_scale"] })], right),
        "enemy",
        "guard",
      ).hp,
    ).toBe(997);
    expect(
      targetState(
        battle([unit("guard", { armor: 1, abilities: ["ancient_scale"] })], right),
        "enemy",
        "guard",
      ).hp,
    ).toBe(998);
  });
  it("Packmark and Bloodscent benefit an ally from a different banner without stacking marks", () => {
    const r = battle(
      [
        unit("marker", { steel: 1, speed: 100, abilities: ["packmark"], banner: "veil_covenant" }),
        unit("hunter", {
          steel: 1,
          speed: 99,
          abilities: ["bloodscent"],
          banner: "bastion_orders",
        }),
      ],
      [unit("enemy")],
    );
    expect(hit(r, "marker").amount).toBe(1);
    expect(hit(r, "hunter").amount).toBe(3);
  });
  it("Spotter bypasses 1 armor without removing the ignored armor", () => {
    const r = battle(
      [
        unit("marker", { spell: 1, speed: 100, abilities: ["spotter"] }),
        unit("shooter", { shot: 3, speed: 99 }),
      ],
      [unit("enemy", { armor: 2 })],
    );
    const state = targetState(r, "shooter", "enemy");
    expect(state.armor).toBe(1);
    expect(state.hp).toBe(997);
  });
  it("Doom waits three round ends and deals 2 direct damage", () => {
    const r = battle(
      [unit("doom", { spell: 1, speed: 100, abilities: ["doom_count"] })],
      [unit("enemy")],
    );
    const doom = r.events.find((e) => e.text.includes("takes") && e.text.includes("Doom Count"));
    expect(doom?.round).toBe(3);
    expect(doom?.amount).toBe(2);
  });
  it("Hexweave power reduction lasts through the following round and then expires", () => {
    const r = battle(
      [unit("hex", { spell: 1, speed: 100, abilities: ["hexweave"] })],
      [unit("enemy", { spell: 5, speed: 100 })],
    );
    expect([1, 2, 3, 4].map((round) => attacks(r, "enemy", round)[0]?.amount)).toEqual([
      5, 4, 4, 5,
    ]);
  });
  it("Grave Recall revives once at 1 health and skips its pending turn", () => {
    const r = battle(
      [unit("reviver", { health: 2, steel: 1, abilities: ["grave_recall"] })],
      [unit("enemy", { steel: 2, speed: 100 })],
    );
    expect(r.events.filter((e) => e.text.includes("claws back"))).toHaveLength(1);
    expect(r.events.find((e) => e.text.includes("claws back"))?.teams[0][0]?.hp).toBe(1);
    expect(attacks(r, "reviver", 1)).toHaveLength(0);
  });
  it("Field Ration heals on every third round", () => {
    const r = battle(
      [unit("healer", { abilities: ["field_ration"] })],
      [unit("enemy", { spell: 1, speed: 100 })],
    );
    expect(
      r.events
        .filter((e) => e.text.includes("Field Ration"))
        .slice(0, 3)
        .map((e) => [e.round, e.amount]),
    ).toEqual([
      [3, 1],
      [6, 1],
      [9, 1],
    ]);
  });
  it("Primal Mend restores 1 health on an enemy defeat to any wounded ally", () => {
    const r = battle(
      [
        unit("front"),
        unit("killer", { steel: 3, speed: 100, abilities: ["primal_mend", "flank"] }),
      ],
      [unit("enemy", { spell: 1, speed: 200 }), unit("victim", { health: 1 })],
    );
    expect(r.events.find((e) => e.text.includes("Primal Mend"))?.amount).toBe(1);
  });
  it("Makeshift Guard grants temporary armor to an armorless neighbor", () => {
    const r = battle(
      [unit("front"), unit("helper", { abilities: ["makeshift_guard"] })],
      [unit("enemy", { steel: 3, speed: 100 })],
    );
    expect(targetState(r, "enemy", "front").hp).toBe(998);
  });
  it("Salvager restores only once per round and Gilded March forbids restoration", () => {
    const left = [
      unit("front", { armor: 1 }),
      unit("salvager", { armor: 1, abilities: ["salvager"] }),
    ];
    const right = [
      unit("backstab", { steel: 1, speed: 100, abilities: ["flank"] }),
      unit("enemy", { steel: 1, speed: 99 }),
    ];
    const r = battle(left, right);
    expect(r.events.filter((e) => e.round === 1 && e.text.includes("salvages"))).toHaveLength(1);
    expect(
      battle(left, right, ["gilded_march"]).events.some((e) => e.text.includes("salvages")),
    ).toBe(false);
  });
  it("Windread increases a backline unit's initiative", () => {
    const r = battle(
      [
        unit("a"),
        unit("b"),
        unit("c"),
        unit("reader", { spell: 1, speed: 2, abilities: ["windread"] }),
      ],
      [unit("enemy", { spell: 1, speed: 2 })],
    );
    expect(r.events.find((e) => e.kind === "attack")?.actor).toContain("-reader");
  });
  it("Last Pay rewards adjacent survivors when the bearer falls", () => {
    const r = battle(
      [unit("martyr", { health: 1, abilities: ["last_pay"] }), unit("survivor")],
      [unit("enemy", { steel: 1, speed: 100 })],
    );
    const pay = r.events.find((e) => e.text.includes("Last Pay"));
    expect(pay?.teams[0].find((u) => u.cardId === "survivor")?.buffs).toContain("last pay");
  });
  it("Crosswind penalties cap at -2 even with four bearers", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const left = Array.from({ length: 4 }, (_, i) =>
        unit("wind" + i, { spell: 1, speed: 100, abilities: ["crosswind"] }),
      );
      left.push(unit("scout", { spell: 1, speed: 1 }));
      const r = battle(left, [unit("enemy", { spell: 1, speed: 4 })], [], seed);
      const turns = r.events
        .filter((e) => e.round === 2 && (e.kind === "attack" || e.kind === "miss"))
        .map((e) => e.actor);
      expect(turns.findIndex((id) => id?.endsWith("-enemy"))).toBeLessThan(
        turns.findIndex((id) => id?.endsWith("-scout")),
      );
    }
  });
});
