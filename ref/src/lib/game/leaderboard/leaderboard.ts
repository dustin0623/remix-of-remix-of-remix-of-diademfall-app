/**
 * Leaderboard scoring (Model A: direct cumulative points).
 *   score = player XP + hero roster points
 * XP comes from destroyed chest HP (server-side in save_progress).
 * Roster points reward collection: each owned hero is worth points by rarity.
 * The same point values are mirrored in the leaderboard_snapshot() database
 * function — keep both in sync when rebalancing.
 */
import { HeroRarity } from "@/game/data/HeroRarity";

export const HERO_RARITY_POINTS: Record<HeroRarity, number> = {
  common: 250,
  uncommon: 750,
  rare: 2500,
  epic: 10000,
  legendary: 50000,
};

export const LEADERBOARD_PAGE_SIZE = 100;

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  avatarId: number;
  xp: number;
  level: number;
  heroCount: number;
  heroPoints: number;
  score: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  page: number;
  pageCount: number;
  totalPlayers: number;
  asOf: string;
  self: LeaderboardEntry | null;
}

/** Total roster points for a list of hero rarities. */
export function heroRosterPoints(rarities: string[]): number {
  return rarities.reduce((sum, rarity) => sum + (HERO_RARITY_POINTS[rarity as HeroRarity] ?? 0), 0);
}

/** Combined leaderboard score: experience plus collection points. */
export function leaderboardScore(xp: number, heroPoints: number): number {
  return Math.max(0, xp) + Math.max(0, heroPoints);
}

/** Page the complete ranked snapshot without truncating players after rank 100. */
export function paginateLeaderboard(
  entries: LeaderboardEntry[],
  page: number,
): { entries: LeaderboardEntry[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(entries.length / LEADERBOARD_PAGE_SIZE));
  const clamped = Math.min(Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1), pageCount);
  return {
    entries: entries.slice((clamped - 1) * LEADERBOARD_PAGE_SIZE, clamped * LEADERBOARD_PAGE_SIZE),
    page: clamped,
    pageCount,
  };
}
