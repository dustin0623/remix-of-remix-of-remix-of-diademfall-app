/**
 * Deterministic Diademfall battle engine (local v1).
 * Implements the combat contract from docs/diademfall-complete-v4/battle-rules.md
 * with a practical subset of abilities and rulesets. Produces a full replay.
 */
import { CURRENT_CATALOG, type CardCatalog } from "./catalogs";
import { unitAtLevel, type UnitCard } from "./units";
import type { MatchConfig, TeamPick } from "./match";
import { Rng, hash } from "./rng";

type Channel = "steel" | "shot" | "spell";

export interface BUnit {
  uid: string; cardId: string; name: string; side: 0 | 1;
  /** the card at its battle level (printed stats before modifiers) */
  card: UnitCard;
  steel: number; shot: number; spell: number;
  armor: number; maxArmor: number; hp: number; maxHp: number; speed: number;
  acc: number; abil: Set<string>; alive: boolean;
  atkMod: number; spdRound: number; spdNext: number; spdUntil: number; spdUntilBonus: number;
  brace: number; tempArmor: number; souls: number; boneGain: number;
  forgeUsed: boolean; graveUsed: boolean; vanishUsed: boolean; vanishUntil: number; oathUsed: boolean;
  misleadRound: number; scaleRound: number; roarUsed: boolean; killRound: number; runeIdx: number;
  hexIdx: number; hexRound: number; hexSpeed: number; hexPower: number; healLock: number;
  doom?: number | undefined; debtors: string[]; debtRound: number; marked: number; spotted: number;
  healMod: number; link?: string | undefined; noRestore: boolean; spotRound: number;
}

export interface SnapUnit { uid: string; cardId: string; name: string; hp: number; maxHp: number; armor: number; alive: boolean; buffs: string[] }
export interface BattleEvent {
  round: number;
  kind: "round" | "attack" | "miss" | "ability" | "death" | "info" | "end";
  text: string;
  actor?: string | undefined; target?: string | undefined; amount?: number | undefined; channel?: Channel | undefined;
  teams: [SnapUnit[], SnapUnit[]];
}
export interface BattleResult { winner: 0 | 1 | "draw"; rounds: number; events: BattleEvent[] }

const MAX_ROUNDS = 30;

/** `catalog` defaults to the current cards; replays pass the catalog of their game version. */
export function simulateBattle(cfg: MatchConfig, picks: [TeamPick, TeamPick], catalog: CardCatalog = CURRENT_CATALOG): BattleResult {
  const R = cfg.rulesets;
  const has = (id: string) => R.includes(id);
  const rng = new Rng(cfg.seed);
  const events: BattleEvent[] = [];
  let round = 0;
  const teams: [BUnit[], BUnit[]] = [[], []];
  const T = (s: number): BUnit[] => teams[s as 0 | 1];

  const snap = (): [SnapUnit[], SnapUnit[]] => teams.map((t) => t.map((u) => ({
    uid: u.uid, cardId: u.cardId, name: u.name, hp: u.hp, maxHp: u.maxHp, armor: u.armor + u.tempArmor, alive: u.alive,
    buffs: [u.brace > 0 ? "brace" : "", u.marked >= round && u.marked > 0 ? "marked" : "", u.spotted >= round && u.spotted > 0 ? "spotted" : "",
      u.doom !== undefined ? `doom ${u.doom}` : "", u.hexSpeed || u.hexPower ? "hexed" : "", u.vanishUntil >= round && u.vanishUntil > 0 ? "vanished" : ""].filter(Boolean),
  }))) as [SnapUnit[], SnapUnit[]];
  const log = (e: Omit<BattleEvent, "teams" | "round">) => events.push({ ...e, round, teams: snap() });

  // ---- create units
  picks.forEach((p, side) => {
    p.unitIds.forEach((id, i) => {
      const c = unitAtLevel(catalog.unit(id)!, p.levels?.[id] ?? 1);
      let armor = c.armor;
      if (has("shattered_guard")) armor = Math.floor(armor / 2);
      if (has("gilded_march") && c.armor > 0) armor += 2;
      T(side).push({
        uid: `${side}-${i}-${id}`, cardId: id, name: c.name, side: side as 0 | 1, card: c,
        steel: c.steel, shot: c.shot, spell: c.spell, armor, maxArmor: armor, hp: c.health, maxHp: c.health, speed: c.speed,
        acc: 0, abil: new Set(has("unwritten_deeds") ? [] : c.abilities), alive: true,
        atkMod: 0, spdRound: 0, spdNext: 0, spdUntil: 0, spdUntilBonus: 0, brace: 0, tempArmor: 0, souls: 0, boneGain: 0,
        forgeUsed: false, graveUsed: false, vanishUsed: false, vanishUntil: 0, oathUsed: false, misleadRound: 0, scaleRound: 0,
        roarUsed: false, killRound: 0, runeIdx: 0, hexIdx: 0, hexRound: 0, hexSpeed: 0, hexPower: 0, healLock: 0,
        debtors: [], debtRound: 0, marked: 0, spotted: 0, healMod: 0, noRestore: has("gilded_march"), spotRound: 0,
      });
    });
  });

  const living = (s: number) => T(s).filter((u) => u.alive);
  const posOf = (u: BUnit) => living(u.side).indexOf(u) + 1;
  const adjacent = (u: BUnit) => {
    if (has("broken_formation")) return [] as BUnit[];
    const l = living(u.side); const i = l.indexOf(u);
    return [l[i - 1], l[i + 1]].filter(Boolean) as BUnit[];
  };
  const overflowRound = [0, 0];
  const unspent = picks.map((p) => {
    // mana spent is approximated from printed costs
    const s = catalog.summoner(p.summonerId);
    const spent = (s?.mana ?? 0) + p.unitIds.reduce((a, id) => a + catalog.unit(id)!.mana, 0);
    return Math.max(0, cfg.manaCap - spent);
  });

  // ---- summoner effects
  picks.forEach((p, side) => {
    const s = catalog.summoner(p.summonerId);
    if (!s) return;
    if (has("oathless_day")) { log({ kind: "info", text: `${s.name}'s commands are silenced (Oathless Day).` }); return; }
    const allies = T(side); const enemies = T(1 - side);
    const pickTargets = (t: string): BUnit[] => {
      const by = (f: (u: BUnit) => number, dir: 1 | -1) => [...allies].sort((a, b) => dir * (f(b) - f(a)))[0]!;
      switch (t) {
        case "all_allies": return allies;
        case "all_enemies": return enemies;
        case "front_ally": return allies.slice(0, 1);
        case "front_two": return allies.slice(0, 2);
        case "rear_ally": return allies.slice(-1);
        case "rear_three": return allies.slice(-3);
        case "middle_allies": return allies.slice(1, -1);
        case "steel_allies": return allies.filter((u) => u.steel > 0);
        case "shot_allies": return allies.filter((u) => u.shot > 0);
        case "spell_allies": case "support_allies": return allies.filter((u) => u.spell > 0);
        case "highest_mana_ally": return [by((u) => u.card.mana, 1)];
        case "lowest_mana_ally": return [by((u) => u.card.mana, -1)];
        case "lowest_health_ally": return [by((u) => u.maxHp, -1)];
        case "highest_speed_ally": return [by((u) => u.speed, 1)];
        default: return [];
      }
    };
    for (const e of s.effects) {
      const targets = pickTargets(e.target).filter(Boolean);
      if (e.kind === "grantAbility" && e.abilityId) targets.forEach((u) => u.abil.add(e.abilityId!));
      else if (e.stat && e.value) {
        const cond = e.condition;
        for (const u of targets) {
          const c = u.card;
          if (cond === "printedArmorAtLeast1" && c.armor < 1) continue;
          if (cond === "printedHealthAtMost5" && c.health > 5) continue;
          if (cond === "unspentManaAtLeast2" && unspent[side]! < 2) continue;
          const bonus = e.value + (e.value > 0 && u.abil.has("bannerhold") && posOf(u) <= 2 ? 1 : 0);
          if (cond === "rounds1to2" || cond === "round1Only") { u.spdUntil = cond === "round1Only" ? 1 : 2; u.spdUntilBonus = bonus; continue; }
          switch (e.stat) {
            case "armor": u.armor += bonus; u.maxArmor += bonus; break;
            case "health": u.hp += bonus; u.maxHp += bonus; break;
            case "speed": u.speed += bonus; break;
            case "steel": u.steel += bonus; break;
            case "shot": u.shot += bonus; break;
            case "spell": u.spell += bonus; break;
            case "accuracy": u.acc += bonus; break;
            case "attackPower": u.atkMod += bonus; break;
            case "healingReceived": u.healMod += bonus; break;
          }
        }
      }
    }
    log({ kind: "ability", text: `${s.name} rallies the ${side === 0 ? "player" : "enemy"} warband.` });
  });

  // colossus wake, hoardfire, crown favor, fate knot
  for (const side of [0, 1] as const) {
    for (const u of T(side)) {
      if (u.abil.has("colossus_wake")) adjacent(u).forEach((a) => { a.maxHp += 1; a.hp += 1; });
      if (u.abil.has("hoardfire") && u.spell > 0) u.spell += Math.min(2, Math.floor(unspent[side]! / 3));
      if (u.abil.has("fate_knot")) {
        const n = adjacent(u).sort((a, b) => a.card.mana - b.card.mana)[0]!;
        if (n) { u.link = n.uid; n.link = u.uid; }
      }
    }
    if (has("crown_favor") && T(side).length) {
      const top = [...T(side)].sort((a, b) => b.card.mana - a.card.mana)[0]!;
      top.maxHp += 1; top.hp += 1; top.abil.add("_crown");
    }
  }

  const curSpeed = (u: BUnit) => {
    let s = u.speed + u.spdRound - u.hexSpeed;
    if (round <= u.spdUntil) s += u.spdUntilBonus;
    if (u.abil.has("windread") && posOf(u) >= 4) s += 1;
    return Math.max(1, s);
  };
  const byUid = (id: string) => teams[0].concat(teams[1]).find((u) => u.uid === id);

  const checkWin = (): 0 | 1 | "draw" | null => {
    const a = living(0).length, b = living(1).length;
    if (!a && !b) return "draw"; if (!a) return 1; if (!b) return 0; return null;
  };

  const defeat = (u: BUnit, killer?: BUnit) => {
    u.alive = false;
    log({ kind: "death", text: `${u.name} falls.`, target: u.uid });
    if (killer && killer.alive) {
      if (killer.abil.has("primal_mend") && killer.killRound !== round) {
        killer.killRound = round;
        const w = living(killer.side).filter((x) => x.hp < x.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]!;
        if (w) heal(w, 2, "Primal Mend");
      }
    }
    for (const o of teams[0].concat(teams[1])) {
      if (!o.alive) continue;
      if (o.abil.has("bone_harvest") && o.boneGain < 3) { o.boneGain++; o.armor++; }
      if (o.abil.has("soul_tithe")) {
        o.souls++;
        if (o.souls >= 3) { o.souls -= 3; heal(o, 3, "Soul Tithe"); o.hexPower = 0; o.hexSpeed = 0; }
      }
    }
    if (u.abil.has("grave_recall") && !u.graveUsed) {
      u.graveUsed = true; u.alive = true; u.hp = 2; u.armor = 0; u.atkMod -= 1;
      log({ kind: "ability", text: `${u.name} claws back from the grave (Grave Recall).`, actor: u.uid });
    }
    if (u.alive === false && u.side !== undefined) {
      // Trailblazer: allies behind advance
      for (const a of living(u.side)) if (a.abil.has("trailblazer")) { a.spdRound += 2; }
    }
  };

  const heal = (u: BUnit, amt: number, src: string) => {
    if (u.healLock >= round && u.healLock > 0) return;
    let a = amt + u.healMod; if (has("red_hour") && round >= 6) a -= 1;
    a = Math.max(0, Math.min(a, u.maxHp - u.hp));
    if (a <= 0) return;
    u.hp += a;
    log({ kind: "ability", text: `${u.name} restores ${a} health (${src}).`, target: u.uid, amount: a });
  };

  const directDamage = (u: BUnit, amt: number, src: string) => {
    if (!u.alive || amt <= 0) return;
    u.hp -= amt;
    log({ kind: "ability", text: `${u.name} takes ${amt} direct damage (${src}).`, target: u.uid, amount: amt });
    if (u.hp <= 0) defeat(u);
  };

  /** Apply an attack hit; returns damage to health. */
  const applyHit = (att: BUnit, tgt: BUnit, ch: Channel, power: number) => {
    let dmg = power;
    if (has("open_flanks") && posOf(tgt) >= 4) dmg += 1;
    if (ch === "spell") {
      // bypass armor
    } else {
      let ignore = tgt.spotted >= round && tgt.spotted > 0 && ch === "shot" ? 1 : 0;
      const absorbT = Math.min(tgt.tempArmor, dmg); tgt.tempArmor -= absorbT; dmg -= absorbT;
      const effArmor = Math.max(0, tgt.armor - ignore); ignore = 0;
      const hadArmor = tgt.armor > 0;
      const absorb = Math.min(effArmor, dmg); tgt.armor -= absorb; dmg -= absorb;
      if (hadArmor && tgt.armor === 0) {
        if (tgt.abil.has("forgeheart") && !tgt.forgeUsed && !tgt.noRestore) { tgt.forgeUsed = true; tgt.armor = Math.min(2, tgt.maxArmor); log({ kind: "ability", text: `${tgt.name}'s Forgeheart reforges 2 armor.`, actor: tgt.uid }); }
        if (tgt.abil.has("vanish") && !tgt.vanishUsed) { tgt.vanishUsed = true; tgt.vanishUntil = round + 1; log({ kind: "ability", text: `${tgt.name} slips behind the veil (Vanish).`, actor: tgt.uid }); }
      }
      const shield = Math.min(2, adjacent(tgt).filter((a) => a.abil.has("shieldwall") && a.armor > 0).length);
      dmg = Math.max(0, dmg - shield);
      const b = Math.min(tgt.brace, dmg); tgt.brace -= b; dmg -= b;
    }
    if (tgt.abil.has("ancient_scale") && power >= 4 && tgt.scaleRound !== round) { tgt.scaleRound = round; dmg = Math.max(0, dmg - 2); }
    if (dmg <= 0) return 0;
    // Oathkeeper: an adjacent ally takes lethal damage instead
    if (dmg >= tgt.hp) {
      const keeper = adjacent(tgt).find((a) => a.abil.has("oathkeeper") && !a.oathUsed);
      if (keeper) { keeper.oathUsed = true; log({ kind: "ability", text: `${keeper.name} keeps the oath and takes the blow!`, actor: keeper.uid, target: tgt.uid }); keeper.hp -= dmg; if (keeper.hp <= 0) defeat(keeper, att); return dmg; }
    }
    // Shared Burden: 4+ damage spills 1 onto each living neighbour; the target takes the rest.
    const sharers = has("shared_burden") && dmg >= 4 ? adjacent(tgt) : [];
    dmg -= sharers.length;
    tgt.hp -= dmg;
    for (const n of sharers) directDamage(n, 1, "Shared Burden");
    if (tgt.abil.has("death_debt") && tgt.debtRound !== round) { tgt.debtRound = round; tgt.debtors.push(att.uid); }
    if (tgt.link && dmg >= 2) { const l = byUid(tgt.link); if (l && l.alive) { l.hp -= 1; if (l.hp <= 0) defeat(l); } }
    if (tgt.abil.has("bloodline_roar") || living(tgt.side).some((a) => a.abil.has("bloodline_roar"))) {
      if (!tgt.roarUsed && tgt.hp > 0 && tgt.hp <= tgt.maxHp / 2) { tgt.roarUsed = true; tgt.atkMod += 1; }
    }
    return dmg;
  };

  const chooseAction = (u: BUnit): { ch: Channel; power: number; target: BUnit } | null => {
    const enemies = living(1 - u.side);
    if (!enemies.length) return null;
    const pos = posOf(u);
    let order: Channel[] = ["spell", "shot", "steel"];
    if (u.abil.has("runebreath")) { const cyc: Channel[] = ["steel", "spell", "shot"]; order = [cyc[u.runeIdx % 3]!]; }
    for (const ch of order) {
      let base = u.abil.has("runebreath") ? Math.max(u.card.steel, u.card.shot, u.card.spell, u.spell) : u[ch];
      if (base <= 0) continue;
      if (ch === "steel" && pos > 2 && !u.abil.has("runebreath")) continue;
      if (ch === "shot" && pos === 1 && !u.abil.has("runebreath")) continue;
      let power = base + u.atkMod - u.hexPower;
      if (ch === "steel" && has("steel_tempest")) power += 1;
      if (ch === "shot" && has("distant_thunder")) { if (pos >= 5) power += 1; if (pos <= 2) power -= 1; }
      if (ch === "shot" && u.abil.has("volley_line") && adjacent(u).some((a) => a.card.shot > 0)) power += 1;
      if (ch === "spell" && has("spell_scarcity")) power = Math.min(power, 3);
      if (has("red_hour") && round >= 6) power += 1;
      power = Math.max(0, power);
      if (power <= 0) continue;
      let target = enemies[0]!;
      if (has("duel_at_dawn") && pos === 1) target = enemies[0]!;
      // Vanish: untargetable from positions 3-6
      if (target.vanishUntil >= round && target.vanishUntil > 0 && pos >= 3) target = enemies[1] ?? target;
      // Mislead: redirect attacks aimed at back-rank allies
      if (posOf(target) > 1) {
        const decoy = enemies.find((e) => e.abil.has("mislead") && e.misleadRound !== round && e !== target);
        if (decoy) { decoy.misleadRound = round; log({ kind: "ability", text: `${decoy.name} misleads the attack (Mislead).`, actor: decoy.uid }); target = decoy; }
      }
      return { ch, power, target };
    }
    return null;
  };

  const doAttack = (u: BUnit, a: { ch: Channel; power: number; target: BUnit }, label = "") => {
    const t = a.target;
    let power = a.power;
    if (u.abil.has("bloodscent") && t.hp < t.maxHp) power += 1;
    if (t.marked >= round && t.marked > 0 && u.card.banner === "wild_courts") power += 1;
    let acc = u.acc + (u.abil.has("windread") && posOf(u) >= 4 ? 10 : 0) + (has("open_flanks") && posOf(u) >= 4 ? 10 : 0);
    if (a.ch === "shot" && has("steel_tempest")) acc -= 5;
    if (a.ch === "shot" && t.spotted >= round && t.spotted > 0) acc += 5;
    const chance = Math.max(10, Math.min(100, 90 + acc + 5 * (curSpeed(u) - curSpeed(t))));
    const roll = rng.next("accuracy") * 100;
    if (roll >= chance) { log({ kind: "miss", text: `${u.name}${label} misses ${t.name}.`, actor: u.uid, target: t.uid, channel: a.ch }); return; }
    const line = living(t.side); const behind = line[line.indexOf(t) + 1];
    const dealt = applyHit(u, t, a.ch, power);
    // Runic Overflow: each team's first Spell hit per round splashes 1 onto the unit behind the target.
    if (a.ch === "spell" && has("runic_overflow") && behind && overflowRound[u.side] !== round) { overflowRound[u.side] = round; directDamage(behind, 1, "Runic Overflow"); }
    log({ kind: "attack", text: `${u.name}${label} hits ${t.name} with ${a.ch} for ${power}${dealt !== power ? ` (${dealt} to health)` : ""}.`, actor: u.uid, target: t.uid, amount: power, channel: a.ch });
    // after-hit triggers
    if (t.alive && u.card.banner === "wild_courts" && u.abil.has("packmark") && !(t.marked >= round)) t.marked = round;
    if (t.alive && u.abil.has("spotter") && u.spotRound !== round) { u.spotRound = round; t.spotted = round; }
    if (t.alive && u.abil.has("hexweave") && u.hexRound !== round) {
      u.hexRound = round; const k = u.hexIdx++ % 3;
      if (k === 0) t.hexSpeed = 1; else if (k === 1) t.hexPower = 1; else t.healLock = round + 1;
    }
    if (t.alive && u.abil.has("doom_count") && t.doom === undefined) t.doom = 3;
    if (t.hp <= 0 && t.alive) defeat(t, u);
  };

  // ---- battle start: Pounce
  for (const side of [0, 1] as const) for (const u of living(side)) {
    if (u.abil.has("pounce") && posOf(u) >= 4) {
      const enemy = living(1 - side).at(-1);
      if (enemy) { enemy.hp -= 1; log({ kind: "ability", text: `${u.name} pounces on ${enemy.name} for 1.`, actor: u.uid, target: enemy.uid, amount: 1 }); if (enemy.hp <= 0) defeat(enemy, u); }
    }
  }

  let winner: 0 | 1 | "draw" | null = checkWin();
  while (winner === null && round < MAX_ROUNDS) {
    round++;
    log({ kind: "round", text: `Round ${round}` });
    // round start
    for (const side of [0, 1] as const) {
      for (const u of living(side)) {
        u.spdRound = u.spdNext; u.spdNext = 0;
        if (u.abil.has("brace") && posOf(u) <= 2) u.brace = 2;
        if (u.abil.has("_crown")) u.brace = Math.max(u.brace, 1);
        if (u.abil.has("retinue") && !has("broken_formation")) {
          const l = living(side); const i = l.indexOf(u);
          if (l[i - 1] && l[i + 1]) [u, l[i - 1]!, l[i + 1]!].forEach((x) => (x.tempArmor = 1));
        }
        if (u.abil.has("mirrorcraft")) { const top = Math.max(...living(1 - side).map(curSpeed), 0); u.spdRound += Math.max(0, top - curSpeed(u)); }
      }
      if (has("fickle_fortune")) { const l = living(side); if (l.length) l[rng.int(l.length, "fickle")]!.spdRound += 1; }
    }
    const queue = [...living(0), ...living(1)].sort((a, b) => curSpeed(b) - curSpeed(a) || hash(cfg.seed, round, a.uid) - hash(cfg.seed, round, b.uid));
    for (const u of queue) {
      if (!u.alive) continue;
      u.brace = 0;
      const a = chooseAction(u);
      if (!a) continue;
      doAttack(u, a);
      if (u.abil.has("runebreath")) u.runeIdx++;
      if (u.alive && u.abil.has("moonrush") && round % 3 === 0) {
        const again = chooseAction(u);
        if (again) doAttack(u, { ...again, power: Math.max(1, Math.floor(again.power * 0.7)) }, " (Moonrush)");
      }
      if (u.alive && u.abil.has("crosswind")) {
        const nxt = queue.slice(queue.indexOf(u) + 1).find((x) => x.alive && x.side !== u.side);
        if (nxt) nxt.spdNext -= 2;
      }
      winner = checkWin(); if (winner !== null) break;
    }
    if (winner !== null) break;
    // round end
    for (const u of [...living(0), ...living(1)]) {
      for (const d of u.debtors) { const e = byUid(d); if (e) directDamage(e, 2, `Death Debt of ${u.name}`); }
      u.debtors = [];
      if (u.doom !== undefined) { u.doom--; if (u.doom <= 0) { u.doom = undefined; directDamage(u, 3, "Doom Count"); } }
      u.tempArmor = 0;
      if (u.hexRound < round) { u.hexSpeed = 0; u.hexPower = 0; }
    }
    if (has("last_light")) for (const s of [0, 1]) { const r = living(s).at(-1); if (r) directDamage(r, 1, "Last Light"); }
    const fatigueStart = has("closing_chapter") ? 8 : 20;
    if (round > fatigueStart) {
      const amt = round - fatigueStart;
      for (const u of [...living(0), ...living(1)]) directDamage(u, amt, "Fatigue");
    }
    if (has("turning_wheel")) for (const s of [0, 1] as const) {
      const l = living(s); if (l.length > 1) { const front = l[0]!; teams[s] = [...T(s).filter((x) => x !== front), front]; }
    }
    winner = checkWin();
  }
  const w = winner ?? "draw";
  log({ kind: "end", text: w === "draw" ? "The battle ends in a draw." : w === 0 ? "Victory!" : "Defeat." });
  return { winner: w, rounds: round, events };
}
