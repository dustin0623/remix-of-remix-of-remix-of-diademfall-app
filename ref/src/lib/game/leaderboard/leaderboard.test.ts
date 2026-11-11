import { describe, expect, it } from "vitest";
import {
  HERO_RARITY_POINTS,
  LEADERBOARD_PAGE_SIZE,
  heroRosterPoints,
  leaderboardScore,
  paginateLeaderboard,
  type LeaderboardEntry,
} from "./leaderboard";

describe("hero roster points", () => {
  it("values each rarity at the approved point values", () => {
    expect(HERO_RARITY_POINTS.common).toBe(250);
    expect(HERO_RARITY_POINTS.uncommon).toBe(750);
    expect(HERO_RARITY_POINTS.rare).toBe(2500);
    expect(HERO_RARITY_POINTS.epic).toBe(10000);
    expect(HERO_RARITY_POINTS.legendary).toBe(50000);
  });

  it("sums a mixed roster and ignores unknown rarities", () => {
    expect(heroRosterPoints(["common", "common", "rare", "legendary"])).toBe(
      250 + 250 + 2500 + 50000,
    );
    expect(heroRosterPoints([])).toBe(0);
    expect(heroRosterPoints(["mythic"])).toBe(0);
  });
});

describe("leaderboard score", () => {
  it("adds experience and roster points", () => {
    expect(leaderboardScore(4000, 500)).toBe(4500);
  });

  it("never goes negative", () => {
    expect(leaderboardScore(-10, 0)).toBe(0);
  });
});

describe("paginateLeaderboard", () => {
  const entry = (rank: number): LeaderboardEntry => ({
    rank,
    playerId: `p${rank}`,
    username: `player${rank}`,
    avatarId: 0,
    xp: 0,
    level: 1,
    heroCount: 0,
    heroPoints: 0,
    score: 1000 - rank,
  });
  const full = Array.from({ length: 250 }, (_, i) => entry(i + 1));

  it("serves all players in consecutive pages of 100", () => {
    expect(LEADERBOARD_PAGE_SIZE).toBe(100);
    const first = paginateLeaderboard(full, 1);
    const second = paginateLeaderboard(full, 2);
    const third = paginateLeaderboard(full, 3);
    expect(first.entries).toHaveLength(100);
    expect(first.entries[0]?.rank).toBe(1);
    expect(first.entries.at(-1)?.rank).toBe(100);
    expect(first.pageCount).toBe(3);
    expect(second.entries).toHaveLength(100);
    expect(second.entries[0]?.rank).toBe(101);
    expect(second.entries.at(-1)?.rank).toBe(200);
    expect(third.entries).toHaveLength(50);
    expect(third.entries[0]?.rank).toBe(201);
    expect(third.entries.at(-1)?.rank).toBe(250);
  });
  it("clamps out-of-range and non-finite pages", () => {
    expect(paginateLeaderboard(full, 0).page).toBe(1);
    expect(paginateLeaderboard(full, 99).page).toBe(3);
    expect(paginateLeaderboard(full, NaN).page).toBe(1);
    expect(paginateLeaderboard(full, Infinity).page).toBe(1);
  });
  it("handles an empty board and exact page boundaries", () => {
    expect(paginateLeaderboard([], 2)).toEqual({ entries: [], page: 1, pageCount: 1 });
    expect(paginateLeaderboard(full.slice(0, 200), 3).pageCount).toBe(2);
    expect(paginateLeaderboard(full.slice(0, 200), 3).entries.at(-1)?.rank).toBe(200);
  });
  it("handles a small player base", () => {
    const result = paginateLeaderboard([entry(1), entry(2)], 1);
    expect(result.entries).toHaveLength(2);
    expect(result.pageCount).toBe(1);
  });
});
