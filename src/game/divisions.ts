/**
 * v6 ranked divisions (docs/diademfall-complete-v6/ranked): 16 divisions inside the league bands,
 * fixed ±20 rating with a win-streak bonus, rules per match, advancement chests and the season reset.
 * Pure; the SQL procedures (apply_ranked_result, grant_division_chests, close_ranked_season, _try_match_ticket)
 * mirror these rules and read the division rows that scripts/load-catalog.ts loads from DIVISIONS.
 */
import { RANKED_CONFIG } from "./catalog/ranked-divisions";
import { leagueById, leagueOf, type LeagueId, type MatchResult } from "./ladder";

export type ChestType = "scout" | "war" | "crown";
export type DivisionTier = 1 | 2 | 3;

export interface Division {
  id: string;
  league: LeagueId;
  tier: DivisionTier | null;
  /** "Silver II"; Wood has no tier. */
  name: string;
  minRating: number;
  /** Battle rules rolled per ranked match in this division. */
  rulesets: number;
  /** Chests granted the first time a player reaches this division in a season. */
  chests: { type: ChestType; count: number }[];
  /** Next-season rating for a player who finishes in this division's league. */
  resetRating: number;
}

export const RANKED_VERSION = RANKED_CONFIG.version;
export const SEASON_DAYS = RANKED_CONFIG.seasonDays;
export const RATING_RULES = RANKED_CONFIG.rating;
const ROMAN: Record<DivisionTier, string> = { 1: "I", 2: "II", 3: "III" };

/**
 * Share of a season's League Season pool (monthly league_pool × 14 / days in month) paid out for chest Coin shares.
 * Placeholder until the operator picks the real share — the v6 docs give no pool size.
 */
export const CHEST_COIN_POOL_SHARE = 0.2;

export const DIVISIONS: Division[] = RANKED_CONFIG.divisions.map((d) => {
  const league = d.league as LeagueId;
  const chests: Division["chests"] = [];
  if (d.rewardChest && d.rewardCount > 0) chests.push({ type: d.rewardChest as ChestType, count: d.rewardCount });
  if ("bonusChest" in d && d.bonusChest && d.bonusCount > 0) chests.push({ type: d.bonusChest as ChestType, count: d.bonusCount });
  const tier = d.tier as DivisionTier | null;
  return {
    id: d.id, league, tier, minRating: d.minRating, rulesets: d.rulesets, chests,
    name: tier ? `${leagueById(league).name} ${ROMAN[tier]}` : leagueById(league).name,
    resetRating: RANKED_CONFIG.seasonReset[league],
  };
});

export const divisionById = (id: string) => DIVISIONS.find((d) => d.id === id);

/** Division for a rating (anything below 0 counts as Wood). */
export function divisionOf(rating: number): Division {
  for (let i = DIVISIONS.length - 1; i >= 0; i--) if (rating >= DIVISIONS[i]!.minRating) return DIVISIONS[i]!;
  return DIVISIONS[0]!;
}
export const divisionFor = (rating: number) => divisionOf(rating).name;

/** Progress inside the current division towards the next one (Champion I is the top, 100%). */
export function divisionProgress(rating: number) {
  const division = divisionOf(rating);
  const next = DIVISIONS[DIVISIONS.indexOf(division) + 1] ?? null;
  if (!next) return { division, next: null, toNext: 0, pct: 100 };
  const pct = Math.round(((rating - division.minRating) / (next.minRating - division.minRating)) * 100);
  return { division, next, toNext: next.minRating - rating, pct: Math.min(100, Math.max(0, pct)) };
}

/** Divisions whose threshold a rating move crosses upwards (before < min ≤ after) — these grant chests once per season. */
export const divisionsCrossed = (before: number, after: number) =>
  DIVISIONS.filter((d) => d.minRating > before && d.minRating <= after);

/** Rules rolled for a ranked match; the lower-rated player's division decides. */
export const rulesetCountFor = (ratingA: number, ratingB = ratingA) => divisionOf(Math.min(ratingA, ratingB)).rulesets;

/**
 * Rating after one ranked result. Win +20, loss -20 (never below 0), draw 0; from the 3rd win in a row +10 more,
 * except in Champion. The streak counts consecutive wins and resets on a loss or draw.
 */
export function ratingChange(rating: number, result: MatchResult, winStreak: number) {
  if (result === "win") {
    const streakAfter = winStreak + 1;
    const bonusAllowed = RATING_RULES.championStreakBonus || leagueOf(rating).id !== "champion";
    const streakBonus = streakAfter >= RATING_RULES.winStreakStartsAt && bonusAllowed ? RATING_RULES.winStreakBonus : 0;
    const delta = RATING_RULES.win + streakBonus;
    return { after: rating + delta, delta, streakBonus, streakAfter };
  }
  if (result === "loss") {
    const after = Math.max(0, rating + RATING_RULES.loss);
    return { after, delta: after - rating, streakBonus: 0, streakAfter: 0 };
  }
  return { after: rating + RATING_RULES.draw, delta: RATING_RULES.draw, streakBonus: 0, streakAfter: 0 };
}

/** Next-season rating from the finishing rating (by league). */
export const seasonResetRating = (rating: number) => divisionOf(rating).resetRating;

/** Rows for public.ranked_divisions (loaded by scripts/load-catalog.ts). */
export function divisionRows() {
  return DIVISIONS.map((d) => ({
    id: d.id, league: d.league, tier: d.tier, min_rating: d.minRating, rulesets: d.rulesets,
    reward_chest: d.chests[0]?.type ?? null, reward_count: d.chests[0]?.count ?? 0,
    bonus_chest: d.chests[1]?.type ?? null, bonus_count: d.chests[1]?.count ?? 0,
    reset_rating: d.resetRating,
  }));
}

/** "4d 6h" / "3h 12m" / "ended". */
export function timeLeft(endsAt: string | Date, now = Date.now()) {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "ended";
  const m = Math.floor(ms / 60_000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
}
