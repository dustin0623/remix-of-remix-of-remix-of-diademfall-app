/** Deterministic prelaunch combat: shared troop abilities and automatic commander support. */
import { CURRENT_CATALOG, type CardCatalog } from "./catalogs";
import { unitAtLevel, type UnitCard } from "./units";
import type { MatchConfig, TeamPick } from "./match";
import { Rng, hash } from "./rng";

type Channel = "steel" | "shot" | "spell";
export interface BUnit {
  uid: string;
  cardId: string;
  name: string;
  side: 0 | 1;
  card: UnitCard;
  steel: number;
  shot: number;
  spell: number;
  armor: number;
  maxArmor: number;
  hp: number;
  maxHp: number;
  speed: number;
  magicResistance: number;
  abil: Set<string>;
  alive: boolean;
  spdRound: number;
  spdNext: number;
  brace: number;
  forgeUsed: boolean;
  graveUsed: boolean;
  skipRound: number;
  healLock: number;
}
export interface SnapUnit {
  uid: string;
  cardId: string;
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  alive: boolean;
  buffs: string[];
  stats?: { steel: number; shot: number; spell: number; speed: number };
  abilities?: string[];
}
export interface BattleEvent {
  round: number;
  kind: "round" | "attack" | "miss" | "ability" | "death" | "info" | "end";
  text: string;
  actor?: string | undefined;
  target?: string | undefined;
  amount?: number | undefined;
  channel?: Channel | undefined;
  teams: [SnapUnit[], SnapUnit[]];
}
export interface BattleResult {
  winner: 0 | 1 | "draw";
  rounds: number;
  events: BattleEvent[];
}
const MAX_ROUNDS = 30;
const CHANNELS: Channel[] = ["spell", "shot", "steel"];

export function simulateBattle(
  cfg: MatchConfig,
  picks: [TeamPick, TeamPick],
  catalog: CardCatalog = CURRENT_CATALOG,
): BattleResult {
  const has = (id: string) => cfg.rulesets.includes(id);
  const rng = new Rng(cfg.seed);
  const events: BattleEvent[] = [];
  let round = 0;
  const teams: [BUnit[], BUnit[]] = [[], []];
  const living = (side: number) => teams[side as 0 | 1].filter((u) => u.alive);
  const posOf = (u: BUnit) => living(u.side).indexOf(u) + 1;
  const curSpeed = (u: BUnit) =>
    Math.max(1, u.speed + u.spdRound + (u.abil.has("windread") ? 1 : 0));
  const adjacent = (u: BUnit) => {
    if (has("broken_formation")) return [] as BUnit[];
    const line = living(u.side),
      i = line.indexOf(u);
    return [line[i - 1], line[i + 1]].filter((x): x is BUnit => !!x);
  };
  const snap = (): [SnapUnit[], SnapUnit[]] =>
    teams.map((team) =>
      team.map((u) => ({
        uid: u.uid,
        cardId: u.cardId,
        name: u.name,
        hp: u.hp,
        maxHp: u.maxHp,
        armor: u.armor,
        alive: u.alive,
        stats: { steel: u.steel, shot: u.shot, spell: u.spell, speed: curSpeed(u) },
        abilities: [...u.abil],
        buffs: [
          u.magicResistance > 0 ? "Magic Ward" : "",
          u.abil.has("forgeheart") && !u.forgeUsed ? "Forgeheart" : "",
          u.healLock >= round && u.healLock > 0 ? "healing blocked" : "",
          u.spdRound < 0 ? "slowed" : "",
        ].filter(Boolean),
      })),
    ) as [SnapUnit[], SnapUnit[]];
  const log = (event: Omit<BattleEvent, "teams" | "round">) =>
    events.push({ ...event, round, teams: snap() });

  picks.forEach((pick, side) =>
    pick.unitIds.forEach((id, i) => {
      const card = unitAtLevel(catalog.unit(id)!, pick.levels?.[id] ?? 1);
      let armor = card.armor;
      if (has("shattered_guard")) armor = Math.floor(armor / 2);
      if (has("gilded_march") && card.armor > 0) armor += 2;
      teams[side as 0 | 1].push({
        uid: `${side}-${i}-${id}`,
        cardId: id,
        name: card.name,
        side: side as 0 | 1,
        card,
        steel: card.steel,
        shot: card.shot,
        spell: card.spell,
        armor,
        maxArmor: armor,
        hp: card.health,
        maxHp: card.health,
        speed: card.speed,
        magicResistance: 0,
        abil: new Set(has("unwritten_deeds") ? [] : card.abilities),
        alive: true,
        spdRound: 0,
        spdNext: 0,
        brace: 0,
        forgeUsed: false,
        graveUsed: false,
        skipRound: -1,
        healLock: 0,
      });
    }),
  );

  // Apply both commanders before clamping, so opposing buffs/debuffs cancel equally on either side.
  for (const [side, pick] of picks.entries()) {
    const commander = catalog.summoner(pick.summonerId);
    if (!commander) continue;
    if (has("oathless_day")) {
      log({ kind: "info", text: `${commander.name}'s commands are silenced (Oathless Day).` });
      continue;
    }
    for (const effect of commander.effects) {
      const targets =
        effect.target === "all_allies"
          ? teams[side as 0 | 1]
          : effect.target === "all_enemies"
            ? teams[(1 - side) as 0 | 1]
            : [];
      if (effect.kind !== "stat" || !effect.stat || !effect.value) continue;
      for (const unit of targets) {
        const bonus = effect.value;
        switch (effect.stat) {
          case "health":
            unit.maxHp += bonus;
            break;
          case "armor":
            unit.maxArmor += bonus;
            break;
          case "speed":
            unit.speed += bonus;
            break;
          case "steel":
          case "shot":
          case "spell":
            if (unit.card[effect.stat] > 0) unit[effect.stat] += bonus;
            break;
          case "magicResistance":
            unit.magicResistance += bonus;
            break;
        }
      }
    }
  }
  for (const u of teams.flat()) {
    u.hp = u.maxHp = Math.max(1, u.maxHp);
    u.armor = u.maxArmor = Math.max(0, u.maxArmor);
    u.speed = Math.max(1, u.speed);
    u.magicResistance = Math.max(0, u.magicResistance);
    for (const channel of CHANNELS) u[channel] = u.card[channel] > 0 ? Math.max(1, u[channel]) : 0;
  }
  for (const [side, pick] of picks.entries()) {
    const commander = catalog.summoner(pick.summonerId);
    if (commander && !has("oathless_day"))
      log({
        kind: "ability",
        text: `${commander.name} supports the ${side === 0 ? "player" : "enemy"} troops.`,
      });
  }
  if (has("crown_favor"))
    for (const team of teams) {
      const champion = [...team].sort((a, b) => b.card.mana - a.card.mana)[0];
      if (champion) {
        champion.maxHp++;
        champion.hp++;
        champion.abil.add("_crown");
      }
    }
  const checkWin = (): 0 | 1 | "draw" | null => {
    const a = living(0).length,
      b = living(1).length;
    return !a && !b ? "draw" : !a ? 1 : !b ? 0 : null;
  };
  const defeat = (u: BUnit) => {
    u.alive = false;
    log({ kind: "death", text: `${u.name} falls.`, target: u.uid });
    if (u.abil.has("grave_recall") && !u.graveUsed) {
      u.graveUsed = true;
      u.alive = true;
      u.hp = 1;
      u.armor = 0;
      u.brace = 0;
      u.skipRound = round;
      log({
        kind: "ability",
        text: `${u.name} claws back from the grave (Grave Recall).`,
        actor: u.uid,
      });
    }
  };
  const directDamage = (u: BUnit, amount: number, source: string) => {
    if (!u.alive || amount <= 0) return;
    u.hp -= amount;
    log({
      kind: "ability",
      text: `${u.name} takes ${amount} direct damage (${source}).`,
      target: u.uid,
      amount,
    });
    if (u.hp <= 0) defeat(u);
  };
  const heal = (u: BUnit, amount: number, source: string, actor: BUnit) => {
    if (!u.alive || (u.healLock > 0 && u.healLock >= round)) return;
    const restored = Math.max(
      0,
      Math.min(u.maxHp - u.hp, amount - (has("red_hour") && round >= 6 ? 1 : 0)),
    );
    if (!restored) return;
    u.hp += restored;
    log({
      kind: "ability",
      text: `${u.name} restores ${restored} health (${source}).`,
      actor: actor.uid,
      target: u.uid,
      amount: restored,
    });
  };
  const support = (u: BUnit) => {
    if (u.abil.has("primal_mend")) heal(u, 2, "Primal Mend", u);
    if (u.abil.has("field_ration")) {
      const front = living(u.side)[0];
      if (front) heal(front, 1, "Field Ration", u);
    }
    if (u.abil.has("salvager") && !has("gilded_march")) {
      const target = living(u.side)
        .filter((a) => a.armor < a.maxArmor)
        .sort((a, b) => b.maxArmor - b.armor - (a.maxArmor - a.armor))[0];
      if (target) {
        const amount = Math.min(2, target.maxArmor - target.armor);
        target.armor += amount;
        log({
          kind: "ability",
          text: `${u.name} repairs ${amount} armor on ${target.name} (Salvager).`,
          actor: u.uid,
          target: target.uid,
          amount,
        });
      }
    }
  };
  const chooseAction = (u: BUnit): { ch: Channel; power: number; target: BUnit } | null => {
    const enemies = living(1 - u.side),
      pos = posOf(u);
    if (!enemies.length) return null;
    for (const ch of CHANNELS) {
      if (u[ch] <= 0) continue;
      if (ch === "steel" && pos > 2 && !u.abil.has("flank") && !u.abil.has("hunt")) continue;
      if (ch === "shot" && pos === 1) continue;
      let power = u[ch];
      if (ch === "spell" && has("spell_scarcity"))
        power = Math.min(u.card.spell, 2) + (u.spell - u.card.spell);
      if (ch === "steel" && has("steel_tempest")) power++;
      if (ch === "shot" && has("distant_thunder")) {
        if (pos >= 5) power++;
        if (pos <= 2) power--;
      }
      if (has("red_hour") && round >= 6) power++;
      if (power <= 0) continue;
      let target = enemies[0]!;
      if (!(has("duel_at_dawn") && pos === 1)) {
        if (u.abil.has("wildshot") && ch !== "steel")
          target = enemies[rng.int(enemies.length, "wildshot")]!;
        else if (u.abil.has("flank") && ch === "steel") target = enemies.at(-1)!;
        else if (u.abil.has("spotter") && ch !== "steel")
          target =
            enemies.slice(1).find((e) => e.shot > 0 || e.spell > 0 || e.steel === 0) ?? target;
        else if (u.abil.has("hunt")) target = [...enemies].sort((a, b) => a.hp - b.hp)[0]!;
      }
      return { ch, power, target };
    }
    return null;
  };
  const overflowRound = [-1, -1];
  const applyHit = (target: BUnit, channel: Channel, power: number) => {
    if (target.abil.has("forgeheart") && !target.forgeUsed) {
      target.forgeUsed = true;
      log({
        kind: "ability",
        text: `${target.name} blocks the attack (Forgeheart).`,
        actor: target.uid,
      });
      return 0;
    }
    const reduction =
      channel === "spell"
        ? Math.max(target.magicResistance, target.abil.has("ancient_scale") ? 1 : 0)
        : (target.abil.has("brace") ? 1 : 0) +
          (adjacent(target).some((a) => a.abil.has("shieldwall")) ? 1 : 0);
    let damage = Math.max(1, power - reduction);
    if (channel !== "spell") {
      const armor = Math.min(target.armor, damage);
      target.armor -= armor;
      damage -= armor;
      const guard = Math.min(target.brace, damage);
      target.brace -= guard;
      damage -= guard;
    }
    const sharers = has("shared_burden") && damage >= 4 ? adjacent(target) : [];
    damage -= sharers.length;
    target.hp -= damage;
    for (const neighbor of sharers) directDamage(neighbor, 1, "Shared Burden");
    return damage;
  };
  const doAttack = (u: BUnit, action: NonNullable<ReturnType<typeof chooseAction>>, label = "") => {
    const target = action.target;
    let power = action.power + (u.abil.has("bloodscent") && target.hp < target.maxHp ? 1 : 0);
    if (action.ch === "spell" && has("spell_scarcity")) power = Math.min(power, 3);
    const accuracy =
      (has("open_flanks") && posOf(u) >= 4 ? 10 : 0) -
      (action.ch === "shot" && has("steel_tempest") ? 5 : 0);
    const chance = Math.max(
      10,
      Math.min(100, 90 + accuracy + 5 * (curSpeed(u) - curSpeed(target))),
    );
    if (rng.next("accuracy") * 100 >= chance) {
      log({
        kind: "miss",
        text: `${u.name}${label} misses ${target.name}.`,
        actor: u.uid,
        target: target.uid,
        channel: action.ch,
      });
      return false;
    }
    const line = living(target.side),
      behind = line[line.indexOf(target) + 1];
    if (has("open_flanks") && posOf(target) >= 4) power++;
    const damage = applyHit(target, action.ch, power);
    log({
      kind: "attack",
      text: `${u.name}${label} hits ${target.name} with ${action.ch} for ${power}${damage !== power ? ` (${damage} to health)` : ""}.`,
      actor: u.uid,
      target: target.uid,
      amount: power,
      channel: action.ch,
    });
    if (target.hp > 0) {
      if (u.abil.has("hexweave")) {
        target.healLock = round + 1;
        log({
          kind: "ability",
          text: `${u.name} blocks healing on ${target.name} through round ${round + 1} (Hexweave).`,
          actor: u.uid,
          target: target.uid,
        });
      }
      if (u.abil.has("crosswind")) {
        target.spdNext = Math.max(-2, target.spdNext - 1);
        log({
          kind: "ability",
          text: `${u.name} slows ${target.name} for the next round (Crosswind).`,
          actor: u.uid,
          target: target.uid,
          amount: 1,
        });
      }
    }
    if (target.hp <= 0) defeat(target);
    if (
      action.ch === "spell" &&
      has("runic_overflow") &&
      behind &&
      overflowRound[u.side] !== round
    ) {
      overflowRound[u.side] = round;
      directDamage(behind, 1, "Runic Overflow");
    }
    return !target.alive;
  };

  // Alternate the two formations so every opening unit on one side cannot act before the other side.
  const openingSide = Math.floor(hash(cfg.seed, "pounce") * 2);
  for (let index = 0; index < Math.max(teams[0].length, teams[1].length); index++) {
    for (const side of [openingSide, 1 - openingSide]) {
      const u = teams[side as 0 | 1][index];
      if (!u?.alive || u.skipRound === round || !u.abil.has("pounce")) continue;
      const action = chooseAction(u);
      if (action) doAttack(u, action, " (Pounce)");
    }
  }
  let winner = checkWin();
  while (winner === null && round < MAX_ROUNDS) {
    round++;
    for (const u of [...living(0), ...living(1)]) {
      u.spdRound = u.spdNext;
      u.spdNext = 0;
      u.brace = u.abil.has("_crown") ? 1 : 0;
    }
    if (has("fickle_fortune"))
      for (const side of [0, 1]) {
        const team = living(side);
        if (team.length) team[rng.int(team.length, "fickle")]!.spdRound++;
      }
    log({ kind: "round", text: `Round ${round}` });
    const queue = [...living(0), ...living(1)].sort(
      (a, b) =>
        curSpeed(b) - curSpeed(a) || hash(cfg.seed, round, a.uid) - hash(cfg.seed, round, b.uid),
    );
    for (const u of queue) {
      if (!u.alive || u.skipRound === round) continue;
      u.brace = 0;
      support(u);
      const action = chooseAction(u);
      if (action) {
        const killed = doAttack(u, action);
        if (killed && u.alive && u.abil.has("moonrush")) {
          const extra = chooseAction(u);
          if (extra) doAttack(u, extra, " (Moonrush)");
        }
      }
      winner = checkWin();
      if (winner !== null) break;
    }
    if (winner !== null) break;
    if (has("last_light"))
      for (const side of [0, 1]) {
        const rear = living(side).at(-1);
        if (rear) directDamage(rear, 1, "Last Light");
      }
    const fatigueStart = has("closing_chapter") ? 8 : 20;
    if (round > fatigueStart)
      for (const u of [...living(0), ...living(1)])
        directDamage(u, round - fatigueStart, "Fatigue");
    if (has("turning_wheel"))
      for (const side of [0, 1] as const) {
        const front = living(side)[0];
        if (front && living(side).length > 1)
          teams[side] = [...teams[side].filter((u) => u !== front), front];
      }
    winner = checkWin();
  }
  const result = winner ?? "draw";
  log({
    kind: "end",
    text: result === "draw" ? "The battle ends in a draw." : result === 0 ? "Victory!" : "Defeat.",
  });
  return { winner: result, rounds: round, events };
}
