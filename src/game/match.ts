import { RULESETS } from "./catalog/rulesets";
import { SUMMONERS } from "./catalog/summoners";
import type { BannerId, SummonerDefinition } from "./catalog/types";
import { BANNERS } from "./banners";
import { TEAM_COMPOSITION } from "./catalog/team-composition";
import { UNITS, UNIT_BY_ID, isWayfarer, type UnitCard } from "./units";
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
    if (rulesets.some((r) => def.incompatibleWith.includes(r) || RULE_BY_ID[r]!.incompatibleWith.includes(id))) continue;
    rulesets.push(id);
  }
  const bannerIds = BANNERS.map((b) => b.id);
  const inactive = rng.int(3, "inactive");
  const banners = bannerIds.filter((_, i) => !(inactive > 0 && (i === (seed % 6) || (inactive > 1 && i === ((seed >> 3) % 6)))));
  return { seed, manaCap, rulesets, banners };
}

export function cardCost(base: number, rules: string[], isFirstUnit = false) {
  let c = base;
  if (rules.includes("lean_campaign")) c = Math.min(12, c + 1);
  if (isFirstUnit && rules.includes("royal_stipend")) c = Math.max(0, c - 2);
  return c;
}

export function maxUnits(rules: string[]) { return rules.includes("narrow_gate") ? 4 : 6; }

/** Wayfarer team limit: 2 normally, 0 under Closed Ranks, 4 under Open Contract. */
export function maxWayfarers(rules: string[]): number {
  const o = TEAM_COMPOSITION.rulesetOverrides;
  if (rules.includes("closed_ranks")) return o.closed_ranks;
  if (rules.includes("open_contract")) return o.open_contract;
  return TEAM_COMPOSITION.standardMaximumWayfarers;
}

export const wayfarerCount = (unitIds: string[]) => unitIds.filter((id) => { const u = UNIT_BY_ID[id]; return !!u && isWayfarer(u); }).length;

/** A troop a summoner may recruit: its own Banner, or any Wayfarer. */
export const recruitable = (u: UnitCard, summonerBanner: BannerId) => isWayfarer(u) || u.banner === summonerBanner;

/** Pack and rarity limits from the match rules (e.g. Ancient Blood = Ancient Pack only; Humble Origins = no Legendary). */
export function cardLegal(card: { set: string; rarity: string }, rules: string[]) {
  for (const id of rules) {
    const v = RULE_BY_ID[id]?.values as { allowedSets?: string[]; bannedRarities?: string[] } | undefined;
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
  if (!s) return "Choose a summoner.";
  if (pick.unitIds.length === 0) return "Add at least one unit.";
  if (pick.unitIds.some((id) => !UNIT_BY_ID[id])) return "Unknown unit in formation.";
  if (pick.unitIds.length > maxUnits(cfg.rulesets)) return `At most ${maxUnits(cfg.rulesets)} units.`;
  if (teamMana(pick, cfg.rulesets) > cfg.manaCap) return "Over the mana cap.";
  const wf = wayfarerCount(pick.unitIds), wfMax = maxWayfarers(cfg.rulesets);
  if (wf > wfMax) return wfMax === 0 ? "Closed Ranks: no Wayfarers this match." : `At most ${wfMax} Wayfarers.`;
  if (cfg.rulesets.includes("humble_origins")) {
    const epics = [s, ...pick.unitIds.map((id) => UNIT_BY_ID[id]!)].filter((c) => c.rarity === "epic").length;
    if (epics > 2) return "Humble Origins: at most 2 Epic cards.";
  }
  return null;
}

/** Simple AI drafter: pick a summoner that fits, then greedily add the best value units. */
export function aiDraft(cfg: MatchConfig, seed: number): TeamPick {
  const rng = new Rng(seed);
  const summoners = SUMMONERS.filter((s) => cfg.banners.includes(s.banner) && cardLegal(s, cfg.rulesets) && cardCost(s.mana, cfg.rulesets) <= cfg.manaCap - 2);
  const s: SummonerDefinition = summoners[rng.int(summoners.length, "ai-summoner")] ?? SUMMONERS[0]!;
  const pool = UNITS.filter((u) => recruitable(u, s.banner) && cardLegal(u, cfg.rulesets));
  const value = (u: UnitCard) => (u.steel * 2 + u.shot * 2 + u.spell * 2.2 + u.armor + u.health * 0.8 + u.speed * 0.5 + u.abilities.length) / Math.max(1, u.mana) + rng.next("ai-jitter") * 0.4;
  const sorted = [...pool].sort((a, b) => value(b) - value(a));
  const pick: TeamPick = { summonerId: s.id, unitIds: [] };
  for (const u of sorted) {
    if (pick.unitIds.length >= maxUnits(cfg.rulesets)) break;
    const trial = { ...pick, unitIds: [...pick.unitIds, u.id] };
    if (validateTeam(trial, cfg) === null) pick.unitIds = trial.unitIds;
  }
  // formation: tanky steel in front, ranged/spell behind
  const front = (u: UnitCard) => (u.steel > 0 ? 10 : 0) + u.armor * 2 + u.health;
  pick.unitIds.sort((a, b) => front(UNIT_BY_ID[b]!) - front(UNIT_BY_ID[a]!));
  return pick;
}
