/**
 * Pure ladder helpers: v4 league bands + reward multipliers, win rate and streaks.
 * Shared by the UI and server functions. Values come from
 * docs/diademfall-complete-v5/economy/economy-config.json (a test keeps them in sync).
 * Leagues are derived from the stored rating at read time — no league is ever stored.
 */
export type LeagueId = "wood" | "bronze" | "silver" | "gold" | "diamond" | "champion";
export type MatchResult = "win" | "loss" | "draw";

export interface League {
  id: LeagueId;
  name: string;
  /** Inclusive lower rating bound. */
  min: number;
  /** Exclusive upper rating bound; null for the top league. */
  max: number | null;
  /** Multiplies ranked-win reward shares (Wood earns none). */
  winMultiplier: number;
  /** Multiplies daily activity shares. */
  dailyMultiplier: number;
  /** This league's slice of the season leaderboard pool. */
  leaderboardPoolShare: number;
}

/** Every new account starts here (player_ratings.rating default). */
export const STARTING_RATING = 1000;

export const LEAGUES: League[] = [
  { id: "wood", name: "Wood", min: 0, max: 1000, winMultiplier: 0, dailyMultiplier: 0, leaderboardPoolShare: 0 },
  { id: "bronze", name: "Bronze", min: 1000, max: 1400, winMultiplier: 1, dailyMultiplier: 1, leaderboardPoolShare: 0.1 },
  { id: "silver", name: "Silver", min: 1400, max: 1800, winMultiplier: 1.75, dailyMultiplier: 1.2, leaderboardPoolShare: 0.15 },
  { id: "gold", name: "Gold", min: 1800, max: 2200, winMultiplier: 3, dailyMultiplier: 1.4, leaderboardPoolShare: 0.2 },
  { id: "diamond", name: "Diamond", min: 2200, max: 2600, winMultiplier: 5, dailyMultiplier: 1.7, leaderboardPoolShare: 0.25 },
  { id: "champion", name: "Champion", min: 2600, max: null, winMultiplier: 8, dailyMultiplier: 2, leaderboardPoolShare: 0.3 },
];
export const LEAGUE_IDS = LEAGUES.map((l) => l.id) as [LeagueId, ...LeagueId[]];

export const leagueById = (id: LeagueId) => LEAGUES.find((l) => l.id === id)!;

/** League for a rating; anything below 0 (never stored) counts as Wood. */
export function leagueOf(rating: number): League {
  for (let i = LEAGUES.length - 1; i >= 0; i--) if (rating >= LEAGUES[i]!.min) return LEAGUES[i]!;
  return LEAGUES[0]!;
}
export const leagueIdFor = (rating: number): LeagueId => leagueOf(rating).id;
export const leagueFor = (rating: number): string => leagueOf(rating).name;
export const rewardMultiplierFor = (rating: number): number => leagueOf(rating).winMultiplier;

/** "×1.75" style label. */
export const multiplierLabel = (m: number) => `×${Number(m.toFixed(2))}`;

/** Win rate in whole percent; draws count as games played. Null when no games. */
export function winRate(wins: number, losses: number, draws = 0): number | null {
  const games = wins + losses + draws;
  return games === 0 ? null : Math.round((wins / games) * 100);
}

/** Current streak from results ordered newest first: +n for n wins in a row, -n for losses, 0 otherwise. */
export function currentStreak(newestFirst: string[]): number {
  const first = newestFirst[0];
  if (first !== "win" && first !== "loss") return 0;
  let n = 0;
  for (const r of newestFirst) { if (r !== first) break; n++; }
  return first === "win" ? n : -n;
}

export const streakLabel = (s: number) => (s > 0 ? `W${s}` : s < 0 ? `L${-s}` : "—");

/** Progress inside the current league: rating still needed for the next one and % of the band covered (Champion is the top, 100%). */
export function leagueProgress(rating: number) {
  const league = leagueOf(rating);
  const next = LEAGUES[LEAGUES.indexOf(league) + 1] ?? null;
  if (!next || league.max === null) return { league, next: null, toNext: 0, pct: 100 };
  const pct = Math.round(((rating - league.min) / (league.max - league.min)) * 100);
  return { league, next, toNext: league.max - rating, pct: Math.min(100, Math.max(0, pct)) };
}
