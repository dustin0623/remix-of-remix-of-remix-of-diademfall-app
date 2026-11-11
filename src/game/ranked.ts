/**
 * Ranked match glue between the server contract (battle-contract.ts) and the local engine.
 * Pure and deterministic: no network, time or Math.random — safe on the server and in the browser.
 */
import { BANNERS, BANNER_BY_ID } from "./banners";
import type { BattleEvent as ContractEvent, BattleInput, BattleOutput, FormationCard, LockedTeam, MatchOutcome } from "./battle-contract";
import { SUMMONERS } from "./catalog/summoners";
import { catalogFor } from "./catalogs";
import { simulateBattle, type BattleResult, type SnapUnit } from "./engine";
import { playedTroopLevel } from "./combining";
import { cardLegal, recruitable, teamMana, validateTeam, type MatchConfig, type TeamPick } from "./match";
import { hash } from "./rng";
import { hashCanonical } from "./sha256";
import { UNIT_BY_ID } from "./units";

export const ENGINE_VERSION = "battle-engine-1.0.0";
/** Every Banner is open in ranked; the ruleset and mana cap provide the variety. */
export const RANKED_BANNERS = BANNERS.map((b) => b.id);

/** Database seeds are 32-char hex; the engine wants an unsigned 32-bit number. */
export function seedToNumber(seed: string): number {
  if (/^[0-9a-f]{8}/i.test(seed)) return parseInt(seed.slice(0, 8), 16);
  return Math.floor(hash(seed) * 4294967296);
}

export function rankedConfig(m: { seed: string; manaCap: number; rulesetIds: string[] }): MatchConfig {
  return { seed: seedToNumber(m.seed), manaCap: m.manaCap, rulesets: [...m.rulesetIds], banners: [...RANKED_BANNERS] };
}

/** Full ranked legality: base draft rules (incl. the Wayfarer limit) plus Banner, set, duplicate and unknown-card checks. */
export function validateRankedTeam(pick: TeamPick, cfg: MatchConfig): string | null {
  const s = SUMMONERS.find((x) => x.id === pick.summonerId);
  if (!s) return "Choose a summoner.";
  if (new Set(pick.unitIds).size !== pick.unitIds.length) return "Each unit can only be used once.";
  for (const id of pick.unitIds) if (!UNIT_BY_ID[id]) return "Unknown unit in formation.";
  const base = validateTeam(pick, cfg);
  if (base) return base;
  if (!cfg.banners.includes(s.banner)) return `${BANNER_BY_ID[s.banner].name} is not active this match.`;
  if (!cardLegal(s, cfg.rulesets)) return `${s.name} is not allowed by this match's rules.`;
  for (const id of pick.unitIds) {
    const u = UNIT_BY_ID[id]!;
    if (!recruitable(u, s.banner)) return `${u.name} is not from the ${BANNER_BY_ID[s.banner].name}.`;
    if (!cardLegal(u, cfg.rulesets)) return `${u.name} is not allowed by this match's rules.`;
  }
  return null;
}

export const instanceId = (side: 1 | 2, position: number) => `s${side}p${position}`;

/** Canonical formation: positions 1..n in order, levels from the player's owned cards. */
export function buildFormation(side: 1 | 2, unitIds: string[], levels: Record<string, number>): FormationCard[] {
  return unitIds.map((cardId, i) => ({
    instanceId: instanceId(side, i + 1), cardId, level: levels[cardId] ?? 1, position: (i + 1) as FormationCard["position"],
  }));
}

/**
 * Owned levels -> the levels a team actually plays at: the summoner at its owned level (capped), each troop
 * temporarily lowered to what that summoner can command (combining.ts allowedTroopLevel). Owned cards are unchanged.
 */
export function playedLevels(pick: TeamPick, owned: Record<string, number>): Record<string, number> {
  const s = SUMMONERS.find((x) => x.id === pick.summonerId);
  const sCap = s?.levelCap ?? 1;
  const sLevel = Math.max(1, Math.min(sCap, owned[pick.summonerId] ?? 1));
  const out: Record<string, number> = { [pick.summonerId]: sLevel };
  for (const id of pick.unitIds) {
    const cap = UNIT_BY_ID[id]?.levelCap ?? 1;
    out[id] = playedTroopLevel(owned[id] ?? 1, sLevel, sCap, cap);
  }
  return out;
}

export function lockedTeam(args: {
  matchId: string; playerId: string; side: 1 | 2; pick: TeamPick; levels: Record<string, number>; rulesets: string[];
}): LockedTeam {
  const levels = playedLevels(args.pick, args.levels);
  const team = {
    playerId: args.playerId,
    summonerCardId: args.pick.summonerId,
    summonerLevel: levels[args.pick.summonerId] ?? 1,
    formation: buildFormation(args.side, args.pick.unitIds, levels),
    calculatedMana: teamMana(args.pick, args.rulesets),
  };
  return { ...team, submissionHash: hashCanonical({ matchId: args.matchId, ...team }) };
}

export function pickFromTeam(team: Pick<LockedTeam, "summonerCardId" | "formation">): TeamPick {
  return {
    summonerId: team.summonerCardId,
    unitIds: [...team.formation].sort((a, b) => a.position - b.position).map((f) => f.cardId),
    levels: Object.fromEntries(team.formation.map((f) => [f.cardId, f.level])),
  };
}

export function configFromInput(input: BattleInput): MatchConfig {
  return rankedConfig({ seed: input.seed, manaCap: input.manaCap, rulesetIds: input.rulesetIds });
}

/** Re-run the battle for the replay viewer (same engine, same input and same game-version catalog => same events). */
export function replayBattle(input: BattleInput): { picks: [TeamPick, TeamPick]; result: BattleResult } {
  const picks: [TeamPick, TeamPick] = [pickFromTeam(input.side1), pickFromTeam(input.side2)];
  return { picks, result: simulateBattle(configFromInput(input), picks, catalogFor(input.gameVersion)) };
}

/** Engine uid "side-index-cardId" -> contract instance id. */
function toInstance(uid: string | undefined): string | undefined {
  if (!uid) return undefined;
  const [side, idx] = uid.split("-");
  return instanceId(Number(side) === 0 ? 1 : 2, Number(idx) + 1);
}

function finalSide(units: SnapUnit[]) {
  return units.map((u) => ({ instanceId: toInstance(u.uid)!, cardId: u.cardId, hp: Math.max(0, u.hp), maxHp: u.maxHp, armor: u.armor, alive: u.alive }));
}

/** The pure ResolveBattle contract: BattleInput -> BattleOutput with input/result hashes. */
export function resolveBattle(input: BattleInput): BattleOutput {
  const { result } = replayBattle(input);
  const events: ContractEvent[] = result.events.map((e, index) => {
    const ev: ContractEvent = { index, round: e.round, type: e.kind, payload: { text: e.text } };
    const src = toInstance(e.actor); const tgt = toInstance(e.target);
    if (src) ev.sourceInstanceId = src;
    if (tgt) ev.targetInstanceId = tgt;
    if (e.amount !== undefined) ev.payload["amount"] = e.amount;
    if (e.channel !== undefined) ev.payload["channel"] = e.channel;
    return ev;
  });
  const last = result.events.at(-1);
  const finalState = { side1: finalSide(last?.teams[0] ?? []), side2: finalSide(last?.teams[1] ?? []) };
  const outcome: MatchOutcome = result.winner === 0 ? "side_1" : result.winner === 1 ? "side_2" : "draw";
  const winnerPlayerId = outcome === "side_1" ? input.side1.playerId : outcome === "side_2" ? input.side2.playerId : null;
  const body = { outcome, winnerPlayerId, rounds: result.rounds, finalState, events };
  return { ...body, inputHash: hashCanonical(input), resultHash: hashCanonical(body) };
}
