import { RULESETS } from "./catalog/rulesets";
import { SUMMONERS } from "./catalog/summoners";
import type { BannerId, SummonerDefinition } from "./catalog/types";
import { BANNERS } from "./banners";
import { TEAM_COMPOSITION } from "./catalog/team-composition";
import { UNITS, UNIT_BY_ID, isWayfarer, unitAtLevel, type UnitCard } from "./units";
import { Rng } from "./rng";

import { SUPPORTED_RULESETS } from "./rule-support";
export { SUPPORTED_RULESETS, rulesetSelectionWeight } from "./rule-support";

const RULE_BY_ID = Object.fromEntries(RULESETS.map((r) => [r.id, r]));

export interface MatchConfig {
  seed: number;
  manaCap: number;
  rulesets: string[];
  banners: BannerId[];
}

export interface TeamPick {
  summonerId: string;
  unitIds: string[]; // formation order, index 0 = position 1
  /** card levels by card id (default 1) */
  levels?: Record<string, number> | undefined;
}

export function rollMatch(seed = Math.floor(Math.random() * 1e9)): MatchConfig {
  const rng = new Rng(seed);
  const caps = [13, 15, 17, 19, 21, 24, 27, 30, 35, 40];
  const manaCap = caps[rng.int(caps.length, "cap")]!;
  const count = rng.int(3, "rulecount");
  const rulesets: string[] = [];
  let guard = 0;
  while (rulesets.length < count && guard++ < 50) {
    const id = SUPPORTED_RULESETS[rng.int(SUPPORTED_RULESETS.length, "rule")]!;
    const def = RULE_BY_ID[id]!;
    if (rulesets.includes(id)) continue;
    if (
      rulesets.some(
        (r) => def.incompatibleWith.includes(r) || RULE_BY_ID[r]!.incompatibleWith.includes(id),
      )
    )
      continue;
    rulesets.push(id);
  }
  const bannerIds = BANNERS.map((b) => b.id);
  const inactive = rng.int(3, "inactive");
  const banners = bannerIds.filter(
    (_, i) => !(inactive > 0 && (i === seed % 6 || (inactive > 1 && i === (seed >> 3) % 6))),
  );
  return { seed, manaCap, rulesets, banners };
}

export function cardCost(base: number, rules: string[], isFirstUnit = false) {
  let c = base;
  if (rules.includes("lean_campaign")) c = Math.min(12, c + 1);
  if (isFirstUnit && rules.includes("royal_stipend")) c = Math.max(0, c - 2);
  return c;
}

export function maxUnits(rules: string[]) {
  return rules.includes("narrow_gate") ? 4 : 6;
}

/** Wayfarer team limit: 2 normally, 0 under Closed Ranks, 4 under Open Contract. */
export function maxWayfarers(rules: string[]): number {
  const o = TEAM_COMPOSITION.rulesetOverrides;
  if (rules.includes("closed_ranks")) return o.closed_ranks;
  if (rules.includes("open_contract")) return o.open_contract;
  return TEAM_COMPOSITION.standardMaximumWayfarers;
}

export const wayfarerCount = (unitIds: string[]) =>
  unitIds.filter((id) => {
    const u = UNIT_BY_ID[id];
    return !!u && isWayfarer(u);
  }).length;

/** A troop a summoner may recruit: its own Banner, or any Wayfarer. */
export const recruitable = (u: UnitCard, summonerBanner: BannerId) =>
  isWayfarer(u) || u.banner === summonerBanner;

/** Pack and rarity limits from the match rules (e.g. Ancient Blood = Ancient Pack only; Humble Origins = no Legendary). */
export function cardLegal(card: { set: string; rarity: string }, rules: string[]) {
  for (const id of rules) {
    const v = RULE_BY_ID[id]?.values as
      { allowedSets?: string[]; bannedRarities?: string[] } | undefined;
    if (v?.allowedSets && !v.allowedSets.includes(card.set)) return false;
    if (v?.bannedRarities?.includes(card.rarity)) return false;
  }
  return true;
}

export function teamMana(pick: TeamPick, rules: string[]) {
  const s = SUMMONERS.find((x) => x.id === pick.summonerId);
  let total = s ? cardCost(s.mana, rules) : 0;
  pick.unitIds.forEach((id, i) => {
    const u = UNIT_BY_ID[id];
    if (u) total += cardCost(u.mana, rules, i === 0);
  });
  return total;
}

export function validateTeam(pick: TeamPick, cfg: MatchConfig): string | null {
  const s = SUMMONERS.find((x) => x.id === pick.summonerId);
  if (!s) return "Choose a commander.";
  if (pick.unitIds.length === 0) return "Add at least one unit.";
  if (pick.unitIds.some((id) => !UNIT_BY_ID[id])) return "Unknown unit in formation.";
  if (pick.unitIds.length > maxUnits(cfg.rulesets))
    return `At most ${maxUnits(cfg.rulesets)} units.`;
  if (teamMana(pick, cfg.rulesets) > cfg.manaCap) return "Over the mana cap.";
  const wf = wayfarerCount(pick.unitIds),
    wfMax = maxWayfarers(cfg.rulesets);
  if (wf > wfMax)
    return wfMax === 0 ? "Closed Ranks: no Wayfarers this match." : `At most ${wfMax} Wayfarers.`;
  if (cfg.rulesets.includes("humble_origins")) {
    const epics = [s, ...pick.unitIds.map((id) => UNIT_BY_ID[id]!)].filter(
      (c) => c.rarity === "epic",
    ).length;
    if (epics > 2) return "Humble Origins: at most 2 Epic cards.";
  }
  return null;
}

/** Simple AI drafter: pick a summoner that fits, then greedily add the best value units. */
export function aiDraft(
  cfg: MatchConfig,
  seed: number,
  levels?: Readonly<Record<string, number>>,
): TeamPick {
  const rng = new Rng(seed);
  const summoners = SUMMONERS.filter(
    (s) =>
      cfg.banners.includes(s.banner) &&
      cardLegal(s, cfg.rulesets) &&
      cardCost(s.mana, cfg.rulesets) <= cfg.manaCap - 2,
  );
  const s: SummonerDefinition =
    summoners[rng.int(summoners.length, "ai-summoner")] ?? SUMMONERS[0]!;
  const pool = UNITS.filter((u) => recruitable(u, s.banner) && cardLegal(u, cfg.rulesets)).map(
    (u) => (levels ? unitAtLevel(u, levels[u.id] ?? 1) : u),
  );
  const planningById = Object.fromEntries(pool.map((u) => [u.id, u])) as Record<string, UnitCard>;
  // Draft around the selected commander's actual team bonuses.
  const supportedStat = (u: UnitCard, stat: "steel" | "shot" | "spell" | "armor" | "health") => {
    const printed = u[stat];
    if ((stat === "steel" || stat === "shot" || stat === "spell") && printed === 0) return 0;
    const bonus = cfg.rulesets.includes("oathless_day")
      ? 0
      : s.effects.reduce(
          (total, effect) =>
            total +
            (effect.target === "all_allies" && effect.stat === stat ? (effect.value ?? 0) : 0),
          0,
        );
    return Math.max(stat === "armor" ? 0 : 1, printed + bonus);
  };
  // Roll once per candidate: random work inside a sort comparator is not a stable ranking.
  const jitter = new Map(pool.map((u) => [u.id, rng.next("ai-jitter") * 0.1]));
  const front = (u: UnitCard) =>
    (u.steel > 0 ? 10 : 0) + supportedStat(u, "armor") * 2 + supportedStat(u, "health");
  const formation = (ids: string[]) =>
    [...ids].sort((a, b) => front(planningById[b]!) - front(planningById[a]!));
  const strength = (ids: string[]) =>
    formation(ids).reduce((total, id, position) => {
      const u = planningById[id]!;
      const freeSteel = ["flank", "hunt"].some((ability) => u.abilities.includes(ability));
      const attack = Math.max(
        supportedStat(u, "spell") * 3.2,
        position > 0 ? supportedStat(u, "shot") * 3 : 0,
        position < 2 || freeSteel ? supportedStat(u, "steel") * 3 : 0,
      );
      const abilities = cfg.rulesets.includes("unwritten_deeds") ? [] : u.abilities;
      const support = abilities.reduce(
        (value, id) =>
          value +
          (id === "field_ration"
            ? 1.6
            : id === "salvager"
              ? 1.2
              : id === "primal_mend"
                ? position < 2
                  ? 1.4
                  : 0.5
                : 0.5),
        0,
      );
      // Price small marginal upgrades so a costly tank cannot crowd out an attacking back line.
      // A cheaper replacement can improve this score and release mana for the next upgrade.
      const healthWeight = position < 2 ? 0.7 : attack > 0 ? 0.4 : 0.15;
      const armorWeight = position < 2 ? 0.55 : attack > 0 ? 0.25 : 0.1;
      return (
        total +
        attack +
        supportedStat(u, "health") * healthWeight +
        supportedStat(u, "armor") * armorWeight +
        u.speed * 0.35 +
        support +
        jitter.get(id)! -
        u.mana * 0.8
      );
    }, 0);
  const sorted = [...pool].sort(
    (a, b) => strength([b.id]) / Math.max(1, b.mana) - strength([a.id]) / Math.max(1, a.mana),
  );
  const pick: TeamPick = {
    summonerId: s.id,
    unitIds: [],
    ...(levels ? { levels: { ...levels } } : {}),
  };
  for (const u of sorted) {
    if (pick.unitIds.length >= maxUnits(cfg.rulesets)) break;
    const trial = { ...pick, unitIds: [...pick.unitIds, u.id] };
    if (validateTeam(trial, cfg) === null) pick.unitIds = trial.unitIds;
  }
  // Upgrade the first affordable lineup instead of leaving a high mana cap mostly unspent.
  // Evaluate real attack positions so excess backline Steel units have an opportunity cost.
  for (;;) {
    const current = strength(pick.unitIds);
    let best = current;
    let upgrade: string[] | undefined;
    for (const candidate of pool) {
      if (pick.unitIds.includes(candidate.id)) continue;
      for (let index = 0; index < pick.unitIds.length; index++) {
        const ids = pick.unitIds.map((id, i) => (i === index ? candidate.id : id));
        if (validateTeam({ ...pick, unitIds: ids }, cfg) !== null) continue;
        const score = strength(ids);
        if (score > best + 0.001) {
          best = score;
          upgrade = ids;
        }
      }
    }
    if (!upgrade) break;
    pick.unitIds = upgrade;
  }
  pick.unitIds = formation(pick.unitIds);
  return pick;
}
