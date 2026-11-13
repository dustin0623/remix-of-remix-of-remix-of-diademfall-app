import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ABILITIES } from "./catalog/abilities";
import { TROOPS } from "./catalog/troops";
import { SUMMONERS } from "./catalog/summoners";
import type { SummonerEffect } from "./catalog/types";
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
function battle(
  left: UnitCard[],
  right: UnitCard[],
  rulesets: string[] = [],
  seed = 7,
  effects: [SummonerEffect[], SummonerEffect[]] = [[], []],
) {
  const cards = [...left, ...right];
  const catalog: CardCatalog = {
    version: "ability-test",
    unit: (id) => cards.find((c) => c.id === id),
    summoner: (id) => ({
      id,
      name: id,
      banner: "bastion_orders",
      set: "ancient",
      rarity: "rare",
      mana: 3,
      effects: effects[id === "left" ? 0 : 1],
    }),
  };
  return simulateBattle(
    { seed, manaCap: 99, rulesets, banners: ["bastion_orders", "veil_covenant"] },
    [
      { summonerId: "left", unitIds: left.map((c) => c.id) },
      { summonerId: "right", unitIds: right.map((c) => c.id) },
    ],
    catalog,
  );
}
const attacks = (r: BattleResult, id: string, round?: number) =>
  r.events.filter(
    (e) =>
      e.kind === "attack" &&
      e.actor?.endsWith("-" + id) &&
      (round === undefined || e.round === round),
  );
const state = (r: BattleResult, actor: string, target: string) =>
  attacks(r, actor)[0]!
    .teams.flat()
    .find((u) => u.cardId === target)!;
const stat = (target: string, stat: string, value: number): SummonerEffect => ({
  kind: "stat",
  target,
  stat,
  value,
});

describe("shared troop ability roster", () => {
  it("has 18 shared mechanics, valid unlocks and high-impact unlock budgets", () => {
    expect(ABILITIES).toHaveLength(18);
    const ids = new Set(ABILITIES.map((a) => a.id));
    expect(ids.size).toBe(18);
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
    for (const t of TROOPS) {
      expect(new Set(t.abilityUnlocks.map((a) => a.abilityId)).size, t.id).toBe(
        t.abilityUnlocks.length,
      );
      expect(t.abilityUnlocks.length).toBeLessThanOrEqual(t.mana <= 3 ? 2 : 3);
      for (const a of t.abilityUnlocks) {
        expect(ids.has(a.abilityId), t.id).toBe(true);
        expect(a.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(a.unlockLevel).toBeLessThanOrEqual(t.levelCap);
        if (["moonrush", "pounce", "grave_recall"].includes(a.abilityId)) {
          expect(t.mana).toBeGreaterThanOrEqual(6);
          expect(a.unlockLevel).toBeGreaterThanOrEqual(Math.ceil(t.levelCap / 2));
        }
      }
    }
  });
  it("ships a transparent 150 x 152 PNG for every active mechanic", () => {
    for (const a of ABILITIES) {
      const png = readFileSync(
        new URL("../../public/assets/abilities/" + a.id + ".png", import.meta.url),
      );
      expect(png.toString("hex", 0, 8)).toBe("89504e470d0a1a0a");
      expect([png.readUInt32BE(16), png.readUInt32BE(20), png[25]]).toEqual([150, 152, 6]);
    }
  });
});

describe("commander support", () => {
  it("enforces Commander mana costs and edition ability limits", () => {
    expect(SUMMONERS).toHaveLength(18);
    for (const s of SUMMONERS) {
      expect(s.mana, s.id).toBeGreaterThanOrEqual(3);
      if (s.effects.length === 2) expect(s.mana, s.id).toBe(6);
      expect(s.effects.length).toBeGreaterThanOrEqual(1);
      expect(s.effects.length, s.id).toBeLessThanOrEqual(s.set === "legionnaire" ? 1 : 2);
      for (const e of s.effects) {
        expect(e.kind).toBe("stat");
        expect(["all_allies", "all_enemies"]).toContain(e.target);
        expect(["steel", "shot", "spell", "health", "armor", "magicResistance"]).toContain(e.stat);
        expect(e.condition).toBeUndefined();
        expect(e.abilityId).toBeUndefined();
      }
    }
  });
  it.each(["steel", "shot", "spell"] as const)(
    "buffs and debuffs %s without creating another attack type",
    (channel) => {
      const r = battle(
        [unit("attacker", { [channel]: 2, speed: 100 }), unit("support")],
        [unit("enemy", { [channel]: 2 })],
        [],
        7,
        [[stat("all_allies", channel, 1), stat("all_enemies", channel, -1)], []],
      );
      const first = r.events[0]!.teams;
      expect(first[0][0]!.stats?.[channel]).toBe(3);
      expect(first[0][1]!.stats?.[channel]).toBe(0);
      expect(first[1][0]!.stats?.[channel]).toBe(1);
    },
  );
  it("floors enemy health/attack at 1 and armor at 0", () => {
    const r = battle([unit("a")], [unit("b", { health: 1, steel: 1, armor: 0 })], [], 7, [
      [
        stat("all_enemies", "health", -2),
        stat("all_enemies", "steel", -2),
        stat("all_enemies", "armor", -2),
      ],
      [],
    ]);
    expect(r.events[0]!.teams[1][0]).toMatchObject({
      hp: 1,
      maxHp: 1,
      armor: 0,
      stats: { steel: 1, spell: 0, shot: 0 },
    });
  });
  it("adds opposing effects before clamping, regardless of which side owns the commander", () => {
    const a = [unit("a", { health: 1, steel: 1 })],
      b = [unit("b", { health: 1, steel: 1 })];
    const buff = [stat("all_allies", "health", 1), stat("all_allies", "steel", 1)];
    const debuff = [stat("all_enemies", "health", -1), stat("all_enemies", "steel", -1)];
    const left = battle(a, b, [], 7, [buff, debuff]).events[0]!.teams[0][0]!;
    const right = battle(b, a, [], 7, [debuff, buff]).events[0]!.teams[1][0]!;
    expect([left.hp, left.stats?.steel]).toEqual([1, 1]);
    expect([right.hp, right.stats?.steel]).toEqual([1, 1]);
  });
  it("Magic Ward protects every allied troop and does not stack with Ancient Scale", () => {
    for (const abilities of [[], ["ancient_scale"]]) {
      const r = battle(
        [unit("front", { armor: 5 }), unit("rear", { health: 90, abilities })],
        [unit("mage", { spell: 3, speed: 100, abilities: ["hunt"] })],
        [],
        7,
        [[stat("all_allies", "magicResistance", 1)], []],
      );
      expect(state(r, "mage", "rear").hp).toBe(88);
      expect(r.events[0]!.teams[0].every((u) => u.buffs.includes("Magic Ward"))).toBe(true);
    }
    const r = battle(
      [unit("front", { armor: 5 })],
      [unit("mage", { spell: 1, speed: 100 })],
      [],
      7,
      [[stat("all_allies", "magicResistance", 1)], []],
    );
    expect(state(r, "mage", "front")).toMatchObject({ hp: 999, armor: 5 });
  });
  it("Oathless Day disables commander effects; Unwritten Deeds leaves their support active", () => {
    const ward = [stat("all_allies", "magicResistance", 1), stat("all_allies", "armor", 1)];
    for (const [rules, hp, armor] of [
      [["oathless_day"], 997, 0],
      [["unwritten_deeds"], 998, 1],
    ] as const) {
      const r = battle([unit("guard")], [unit("mage", { spell: 3, speed: 100 })], [...rules], 7, [
        ward,
        [],
      ]);
      expect(state(r, "mage", "guard")).toMatchObject({ hp, armor });
    }
  });
});

describe("targeting and extra attacks", () => {
  const enemies = [unit("front"), unit("weak", { health: 90 }), unit("rear", { health: 100 })];
  it("Wildshot reaches every position across seeds and remains deterministic", () => {
    const left = [unit("wild", { spell: 1, speed: 100, abilities: ["wildshot"] })];
    const targets = new Set(
      Array.from(
        { length: 30 },
        (_, seed) => attacks(battle(left, enemies, [], seed), "wild")[0]!.target,
      ),
    );
    expect(targets.size).toBe(3);
    expect(battle(left, enemies)).toEqual(battle(left, enemies));
  });
  it("Flank and Hunt allow melee attacks from the back", () => {
    for (const [ability, target] of [
      ["flank", "rear"],
      ["hunt", "weak"],
    ]) {
      const r = battle(
        [unit("a"), unit("b"), unit("hunter", { steel: 1, speed: 100, abilities: [ability!] })],
        enemies,
      );
      expect(attacks(r, "hunter")[0]!.target).toContain("-" + target);
    }
  });
  it("Spotter prioritizes backline ranged, magic and non-attacking troops", () => {
    for (const props of [{ shot: 1 }, { spell: 1 }, {}]) {
      const r = battle(
        [unit("spot", { spell: 1, speed: 100, abilities: ["spotter", "hunt"] })],
        [unit("tank", { health: 50 }), unit("fighter", { steel: 1 }), unit("support", props)],
      );
      expect(attacks(r, "spot")[0]!.target).toContain("-support");
    }
  });
  it("Spotter falls back to the front and does not bypass armor", () => {
    const r = battle(
      [unit("tank"), unit("spot", { shot: 3, speed: 100, abilities: ["spotter"] })],
      [unit("enemy", { armor: 2, steel: 1 })],
    );
    expect(state(r, "spot", "enemy")).toMatchObject({ hp: 999, armor: 0 });
  });
  it("Duel at Dawn overrides targeting and ranged still cannot shoot from the front", () => {
    expect(
      attacks(
        battle([unit("hunter", { steel: 1, speed: 100, abilities: ["hunt", "flank"] })], enemies, [
          "duel_at_dawn",
        ]),
        "hunter",
      )[0]!.target,
    ).toContain("-front");
    expect(
      attacks(battle([unit("shot", { shot: 3, abilities: ["wildshot"] })], enemies), "shot"),
    ).toHaveLength(0);
  });
  it("Moonrush follows a killing blow at full power but cannot chain", () => {
    const r = battle(
      [unit("moon", { spell: 3, speed: 100, abilities: ["moonrush"] })],
      [unit("first", { health: 1 }), unit("second", { health: 1 }), unit("third")],
    );
    expect(attacks(r, "moon", 1).map((e) => e.amount)).toEqual([3, 3]);
    expect(attacks(r, "moon", 1).map((e) => e.target?.split("-").at(-1))).toEqual([
      "first",
      "second",
    ]);
    expect(
      attacks(
        battle([unit("moon", { spell: 3, speed: 100, abilities: ["moonrush"] })], enemies),
        "moon",
        1,
      ),
    ).toHaveLength(1);
  });
  it("a revived target does not trigger Moonrush", () => {
    const r = battle(
      [unit("moon", { spell: 3, speed: 100, abilities: ["moonrush"] })],
      [unit("reviver", { health: 2, abilities: ["grave_recall"] }), unit("rear")],
    );
    expect(attacks(r, "moon", 1)).toHaveLength(1);
  });
  it("Pounce makes one legal opening attack and cannot enable an idle backline melee unit", () => {
    const r = battle(
      [
        unit("pouncer", { steel: 2, speed: 100, abilities: ["pounce"] }),
        unit("b"),
        unit("idle", { steel: 2, abilities: ["pounce"] }),
      ],
      enemies,
    );
    expect(attacks(r, "pouncer", 0)).toHaveLength(1);
    expect(attacks(r, "idle", 0)).toHaveLength(0);
    expect(attacks(r, "pouncer", 1)).toHaveLength(1);
  });
});

describe("protection and support turns", () => {
  it("Brace reduces physical damage before armor and never reduces a hit below 1", () => {
    const r = battle(
      [unit("guard", { armor: 2, abilities: ["brace"] })],
      [unit("enemy", { steel: 4, speed: 100 })],
    );
    expect(state(r, "enemy", "guard")).toMatchObject({ hp: 999, armor: 0 });
    expect(
      state(
        battle(
          [unit("guard", { abilities: ["brace"] })],
          [unit("enemy", { steel: 1, speed: 100 })],
        ),
        "enemy",
        "guard",
      ).hp,
    ).toBe(999);
  });
  it("Brace still protects after the bearer takes its turn and does not reduce magic", () => {
    const r = battle(
      [unit("guard", { steel: 1, speed: 100, abilities: ["brace"] })],
      [unit("enemy", { steel: 3 })],
    );
    expect(state(r, "enemy", "guard").hp).toBe(998);
    expect(
      state(
        battle(
          [unit("guard", { abilities: ["brace"] })],
          [unit("enemy", { spell: 3, speed: 100 })],
        ),
        "enemy",
        "guard",
      ).hp,
    ).toBe(997);
  });
  it("Shieldwall protects adjacent allies once and Broken Formation disables it", () => {
    const left = [
      unit("wall1", { abilities: ["shieldwall"] }),
      unit("middle", { health: 90 }),
      unit("wall2", { abilities: ["shieldwall"] }),
    ];
    const right = [unit("enemy", { steel: 3, speed: 100, abilities: ["hunt"] })];
    expect(state(battle(left, right), "enemy", "middle").hp).toBe(88);
    expect(state(battle(left, right, ["broken_formation"]), "enemy", "middle").hp).toBe(87);
  });
  it("Forgeheart blocks only the first successful attack, preserving armor", () => {
    const r = battle(
      [unit("guard", { armor: 2, abilities: ["forgeheart"] })],
      [unit("enemy", { steel: 3, speed: 100 })],
    );
    expect(state(r, "enemy", "guard")).toMatchObject({ hp: 1000, armor: 2 });
    expect(attacks(r, "enemy", 2)[0]!.teams[0][0]).toMatchObject({ hp: 999, armor: 0 });
    expect(r.events.filter((e) => e.text.includes("blocks the attack"))).toHaveLength(1);
  });
  it("Ancient Scale reduces magic while preserving its armor bypass", () => {
    const r = battle(
      [unit("guard", { armor: 5, abilities: ["ancient_scale"] })],
      [unit("enemy", { spell: 3, speed: 100 })],
    );
    expect(state(r, "enemy", "guard")).toMatchObject({ hp: 998, armor: 5 });
  });
  it("Bloodscent increases damage only after the enemy is wounded", () => {
    const r = battle(
      [unit("hunter", { spell: 2, speed: 100, abilities: ["bloodscent"] })],
      [unit("enemy")],
    );
    expect(attacks(r, "hunter", 1)[0]!.amount).toBe(2);
    expect(attacks(r, "hunter", 2)[0]!.amount).toBe(3);
  });
  it("Primal Mend heals the bearer every turn while Field Ration heals the frontline", () => {
    for (const ability of ["primal_mend", "field_ration"]) {
      const r = battle(
        [unit("healer", { abilities: [ability] })],
        [unit("enemy", { spell: 3, speed: 100 })],
      );
      const heals = r.events.filter((e) => e.kind === "ability" && e.text.includes("restores"));
      const amount = ability === "field_ration" ? 1 : 2;
      expect(heals.slice(0, 3).map((e) => [e.round, e.amount])).toEqual([
        [1, amount],
        [2, amount],
        [3, amount],
      ]);
    }
    const r = battle(
      [unit("front"), unit("healer", { abilities: ["field_ration"] })],
      [unit("enemy", { spell: 3, speed: 100 })],
    );
    expect(r.events.find((e) => e.text.includes("Field Ration"))?.target).toContain("-front");
  });
  it("Salvager repairs the most damaged armor and obeys Gilded March", () => {
    const left = [unit("front", { armor: 4 }), unit("repairer", { abilities: ["salvager"] })];
    const right = [unit("enemy", { steel: 3, speed: 100 })];
    const r = battle(left, right);
    expect(r.events.find((e) => e.text.includes("(Salvager)"))).toMatchObject({
      amount: 2,
      target: expect.stringContaining("-front"),
    });
    expect(r.events.find((e) => e.text.includes("(Salvager)"))?.teams[0][0]?.armor).toBe(3);
    expect(
      battle(left, right, ["gilded_march"]).events.some((e) => e.text.includes("(Salvager)")),
    ).toBe(false);
  });
  it("Grave Recall revives once with 1 health, no armor and unchanged attack, skipping its turn", () => {
    const r = battle(
      [unit("reviver", { health: 2, steel: 2, abilities: ["grave_recall"] })],
      [unit("enemy", { steel: 2, speed: 100 })],
    );
    const revive = r.events.filter((e) => e.text.includes("claws back"));
    expect(revive).toHaveLength(1);
    expect(revive[0]!.teams[0][0]).toMatchObject({ hp: 1, armor: 0, stats: { steel: 2 } });
    expect(attacks(r, "reviver", 1)).toHaveLength(0);
  });
  it("Hexweave prevents healing even through Forgeheart, without changing attack power", () => {
    const r = battle(
      [unit("hex", { spell: 1, speed: 100, abilities: ["hexweave"] })],
      [unit("enemy", { spell: 5, speed: 99, abilities: ["field_ration", "forgeheart"] })],
    );
    expect(r.events.some((e) => e.text.includes("Field Ration"))).toBe(false);
    expect(attacks(r, "enemy", 2)[0]!.amount).toBe(5);
  });
  it("Hexweave expires after the next round without refresh", () => {
    const r = battle(
      [unit("front"), unit("hex", { health: 1, spell: 1, speed: 100, abilities: ["hexweave"] })],
      [unit("enemy", { steel: 1, speed: 99, abilities: ["flank", "field_ration"] })],
    );
    expect(r.events.find((e) => e.kind === "round" && e.round === 2)!.teams[1][0]!.buffs).toContain(
      "healing blocked",
    );
    expect(
      r.events.find((e) => e.kind === "round" && e.round === 3)!.teams[1][0]!.buffs,
    ).not.toContain("healing blocked");
    expect(r.events.find((e) => e.text.includes("Field Ration"))?.round).toBe(3);
  });
  it("Crosswind affects only the hit target next round, capped at -2", () => {
    const r = battle(
      Array.from({ length: 4 }, (_, i) =>
        unit("wind" + i, { spell: 1, speed: 100, abilities: ["crosswind"] }),
      ),
      [unit("front", { speed: 4 }), unit("rear", { speed: 8 })],
    );
    expect(
      r.events.find((e) => e.kind === "round" && e.round === 1)!.teams[1][0]!.stats?.speed,
    ).toBe(4);
    const round2 = r.events.find((e) => e.kind === "round" && e.round === 2)!;
    expect(round2.teams[1].map((u) => u.stats?.speed)).toEqual([2, 8]);
  });
  it("Crosswind misses do not slow", () => {
    const r = Array.from({ length: 30 }, (_, seed) =>
      battle(
        [unit("wind", { spell: 1, speed: 1, abilities: ["crosswind"] })],
        [unit("enemy", { speed: 100 })],
        [],
        seed,
      ),
    ).find((r) => r.events.some((e) => e.kind === "miss" && e.round === 1))!;
    expect(r.events.some((e) => e.round === 1 && e.text.includes("Crosswind"))).toBe(false);
  });
  it("Windread gives speed in every position without bonus attack power", () => {
    for (const back of [false, true]) {
      const reader = unit("reader", { spell: 1, speed: 2, abilities: ["windread"] });
      const r = battle(back ? [unit("a"), unit("b"), reader] : [reader], [
        unit("enemy", { spell: 1, speed: 2 }),
      ]);
      expect(r.events.find((e) => e.kind === "attack")?.actor).toContain("-reader");
      expect(attacks(r, "reader", 1)[0]!.amount).toBe(1);
    }
  });
  it("Unwritten Deeds suppresses troop abilities while fatigue still ends defensive stalemates", () => {
    const r = battle(
      [unit("guard", { abilities: ["brace", "forgeheart", "primal_mend"] })],
      [unit("enemy", { steel: 3, speed: 100 })],
      ["unwritten_deeds"],
    );
    expect(state(r, "enemy", "guard").hp).toBe(997);
    const end = battle(
      [unit("a", { health: 3, abilities: ["forgeheart"] })],
      [unit("b", { health: 3, abilities: ["forgeheart"] })],
      ["closing_chapter"],
    );
    expect(end.rounds).toBe(10);
    expect(end.winner).toBe("draw");
  });
});
