/**
 * Ranked reward rules (docs/diademfall-complete-v5/economy/economy-config.json; a test keeps them in sync).
 * The database is authoritative: accrue_match_rewards / settle_reward_day apply the same formula in SQL.
 * This module mirrors it for display (mission checklist, energy timer) and tests.
 */
import { leagueOf } from "./ladder";

export const REWARD_ENERGY = { maximum: 24, regenerationMinutes: 60, costPerRankedBattle: 1 } as const;

export const SHARE_FORMULA = {
  baseWinShares: 100,
  opponentFactorMin: 0.75,
  opponentFactorMax: 1.25,
  opponentRatingDivisor: 1600,
  streakBonusPerWin: 0.03,
  streakBonusMaximum: 0.15,
  goldFoilBonusPerCard: 0.02,
  goldFoilBonusMaximum: 0.14,
  dailyAccountPoolCap: 0.005,
} as const;

export const DAILY_ACTIVITY = { maximumPoints: 100, minimumWins: 3, accountPoolCap: 0.0025 } as const;

/** Monthly treasury budget split (treasury-config.json monthlyRewards.distribution). */
export const BUDGET_SPLIT = { matchWins: 0.625, dailyActivity: 0.1875, leagueSeason: 0.125, leaderboards: 0.0625 } as const;

export const opponentFactor = (myRating: number, opponentRating: number) =>
  Math.min(SHARE_FORMULA.opponentFactorMax, Math.max(SHARE_FORMULA.opponentFactorMin, 1 + (opponentRating - myRating) / SHARE_FORMULA.opponentRatingDivisor));

/** Bonus for consecutive ranked wins before this one (timeouts ignored). */
export const streakBonus = (previousWins: number) => Math.min(SHARE_FORMULA.streakBonusMaximum, SHARE_FORMULA.streakBonusPerWin * Math.max(0, previousWins));

/** Bonus per distinct Gold foil card used in the team (max 7 cards). */
export const foilBonus = (goldCards: number) => Math.min(SHARE_FORMULA.goldFoilBonusMaximum, SHARE_FORMULA.goldFoilBonusPerCard * Math.max(0, goldCards));

/** Reward shares for one rewarded ranked win (rounded to 6 decimals like the database). */
export function winShares(i: { rating: number; opponentRating: number; previousWins: number; goldCards: number }): number {
  const raw = SHARE_FORMULA.baseWinShares * leagueOf(i.rating).winMultiplier * opponentFactor(i.rating, i.opponentRating)
    * (1 + streakBonus(i.previousWins)) * (1 + foilBonus(i.goldCards));
  return Math.round(raw * 1e6) / 1e6;
}

export interface MissionProgress { eligibleWins: number; bannersUsed: number; rulesetsWon: number; lowManaWin: boolean }

export interface Mission { id: string; label: string; points: number; done: (p: MissionProgress) => boolean; progress: (p: MissionProgress) => string }

/** Daily missions (max 100 points). Only rewarded wins count (ranked, Bronze+, with Reward Energy). */
export const MISSIONS: Mission[] = [
  { id: "first_win", label: "Win 1 rewarded battle", points: 20, done: (p) => p.eligibleWins >= 1, progress: (p) => `${Math.min(p.eligibleWins, 1)}/1` },
  { id: "third_win", label: "Win 3 rewarded battles", points: 20, done: (p) => p.eligibleWins >= 3, progress: (p) => `${Math.min(p.eligibleWins, 3)}/3` },
  { id: "fifth_win", label: "Win 5 rewarded battles", points: 20, done: (p) => p.eligibleWins >= 5, progress: (p) => `${Math.min(p.eligibleWins, 5)}/5` },
  { id: "two_banners", label: "Win with commanders from 2 Banners", points: 15, done: (p) => p.bannersUsed >= 2, progress: (p) => `${Math.min(p.bannersUsed, 2)}/2` },
  { id: "three_rules", label: "Win under 3 different battle rules", points: 15, done: (p) => p.rulesetsWon >= 3, progress: (p) => `${Math.min(p.rulesetsWon, 3)}/3` },
  { id: "low_mana", label: "Win with a troop costing 2 mana or less", points: 10, done: (p) => p.lowManaWin, progress: (p) => (p.lowManaWin ? "1/1" : "0/1") },
];

export const activityPoints = (p: MissionProgress) => MISSIONS.reduce((s, m) => s + (m.done(p) ? m.points : 0), 0);

/** Daily activity shares: points × league daily multiplier, only after the minimum number of rewarded wins. */
export const activityShares = (p: MissionProgress, dailyMultiplier: number) =>
  p.eligibleWins >= DAILY_ACTIVITY.minimumWins ? activityPoints(p) * dailyMultiplier : 0;

/** Energy now from a stored value + anchor time: +1 per full hour, capped. nextAt is null when full. */
export function energyAt(stored: number, anchorMs: number, nowMs: number): { energy: number; nextAt: number | null } {
  const hour = REWARD_ENERGY.regenerationMinutes * 60_000;
  const ticks = Math.max(0, Math.floor((nowMs - anchorMs) / hour));
  const energy = Math.min(REWARD_ENERGY.maximum, stored + ticks);
  return { energy, nextAt: energy >= REWARD_ENERGY.maximum ? null : anchorMs + (ticks + 1) * hour };
}

export type MatchRewardStatus = "earned" | "no_energy" | "wood_league" | "not_a_win" | "timeout";
