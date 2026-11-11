import { describe, expect, it } from "vitest";
import economy from "../../docs/diademfall-complete-v4/economy/economy-config.json";
import { currentStreak, leagueIdFor, leagueOf, leagueProgress, LEAGUES, rewardMultiplierFor, STARTING_RATING, streakLabel, winRate } from "./ladder";

describe("v4 ladder leagues", () => {
  it("new players start at 1000, which is Bronze", () => { expect(STARTING_RATING).toBe(1000); expect(leagueIdFor(1000)).toBe("bronze"); });
  it("999 is Wood, 1000 is Bronze", () => { expect(leagueIdFor(999)).toBe("wood"); expect(leagueIdFor(1000)).toBe("bronze"); });
  it("1399 is Bronze, 1400 is Silver", () => { expect(leagueIdFor(1399)).toBe("bronze"); expect(leagueIdFor(1400)).toBe("silver"); });
  it("1799 is Silver, 1800 is Gold", () => { expect(leagueIdFor(1799)).toBe("silver"); expect(leagueIdFor(1800)).toBe("gold"); });
  it("2199 is Gold, 2200 is Diamond", () => { expect(leagueIdFor(2199)).toBe("gold"); expect(leagueIdFor(2200)).toBe("diamond"); });
  it("2599 is Diamond, 2600 is Champion", () => { expect(leagueIdFor(2599)).toBe("diamond"); expect(leagueIdFor(2600)).toBe("champion"); });
  it("rating 0 is Wood", () => expect(leagueIdFor(0)).toBe("wood"));
  it("win multipliers: Wood x0, Bronze x1, Silver x1.75, Gold x3, Diamond x5, Champion x8", () => {
    expect([0, 1000, 1400, 1800, 2200, 2600].map(rewardMultiplierFor)).toEqual([0, 1, 1.75, 3, 5, 8]);
  });
  it("matches docs/diademfall-complete-v4 economy-config.json", () => {
    const cfg = economy.leagues;
    expect(LEAGUES.map((l) => l.id)).toEqual(cfg.map((c) => c.id));
    LEAGUES.forEach((l, i) => {
      const c = cfg[i]!;
      expect(l.min).toBe(c.minimumRating);
      expect(l.max === null ? null : l.max - 1).toBe(c.maximumRating ?? null);
      expect(l.winMultiplier).toBe(c.winMultiplier);
      expect(l.dailyMultiplier).toBe(c.dailyMultiplier);
      expect(l.leaderboardPoolShare).toBe(c.leaderboardPoolShare);
    });
  });
  it("bands match leagueOf at every boundary", () => { for (const l of LEAGUES) expect(leagueOf(l.min).id).toBe(l.id); });
});

describe("win rate", () => {
  it("is null with no games", () => expect(winRate(0, 0, 0)).toBeNull());
  it("3 wins 1 loss is 75%", () => expect(winRate(3, 1)).toBe(75));
  it("draws count as games: 1W 0L 1D is 50%", () => expect(winRate(1, 0, 1)).toBe(50));
});

describe("current streak", () => {
  it("three wins in a row then a loss is W3", () => { expect(currentStreak(["win", "win", "win", "loss"])).toBe(3); expect(streakLabel(3)).toBe("W3"); });
  it("two losses in a row is L2", () => { expect(currentStreak(["loss", "loss", "win"])).toBe(-2); expect(streakLabel(-2)).toBe("L2"); });
  it("a draw breaks any streak", () => expect(currentStreak(["draw", "win", "win"])).toBe(0));
  it("no matches means no streak", () => expect(currentStreak([])).toBe(0));
});

describe("league progress", () => {
  it("a new player at 1000 needs 400 more rating to reach Silver", () => {
    const p = leagueProgress(1000);
    expect(p.league.id).toBe("bronze"); expect(p.next?.id).toBe("silver"); expect(p.toNext).toBe(400); expect(p.pct).toBe(0);
  });
  it("1600 is halfway through Silver, 200 from Gold", () => { const p = leagueProgress(1600); expect(p.pct).toBe(50); expect(p.toNext).toBe(200); });
  it("Champion is the top league with nothing left to climb", () => { const p = leagueProgress(3000); expect(p.next).toBeNull(); expect(p.toNext).toBe(0); expect(p.pct).toBe(100); });
});
