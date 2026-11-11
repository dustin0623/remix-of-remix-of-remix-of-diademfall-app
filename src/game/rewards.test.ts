import { describe, expect, it } from "vitest";
import economy from "../../docs/diademfall-complete-v4/economy/economy-config.json";
import treasury from "../../docs/diademfall-complete-v4/economy/treasury-config.json";
import { activityPoints, activityShares, BUDGET_SPLIT, DAILY_ACTIVITY, energyAt, foilBonus, MISSIONS, opponentFactor, REWARD_ENERGY, SHARE_FORMULA, streakBonus, winShares } from "./rewards";

const none = { eligibleWins: 0, bannersUsed: 0, rulesetsWon: 0, lowManaWin: false };

describe("ranked reward rules", () => {
  it("match docs/diademfall-complete-v4 economy and treasury config", () => {
    expect(REWARD_ENERGY).toEqual(economy.rewardEnergy);
    expect(SHARE_FORMULA).toEqual(economy.rewardShareFormula);
    expect(DAILY_ACTIVITY).toEqual(economy.dailyActivity);
    expect(BUDGET_SPLIT).toEqual(treasury.monthlyRewards.distribution);
  });
  it("Bronze win vs an equal opponent = 100 shares", () => expect(winShares({ rating: 1000, opponentRating: 1000, previousWins: 0, goldCards: 0 })).toBe(100));
  it("Wood wins earn 0 shares", () => expect(winShares({ rating: 999, opponentRating: 1200, previousWins: 3, goldCards: 2 })).toBe(0));
  it("opponent factor is clamped to 0.75–1.25", () => {
    expect(opponentFactor(1400, 1000)).toBe(0.75);
    expect(opponentFactor(1000, 1800)).toBe(1.25);
    expect(opponentFactor(1000, 1160)).toBeCloseTo(1.1);
  });
  it("streak +3% per previous win, max +15%", () => { expect(streakBonus(1)).toBeCloseTo(0.03); expect(streakBonus(9)).toBe(0.15); });
  it("Gold foil +2% per card, max +14%", () => { expect(foilBonus(1)).toBe(0.02); expect(foilBonus(9)).toBe(0.14); });
  it("Silver vs Bronze with 1 Gold card: 133.875, then 137.89125 and 141.9075 on a streak (same as the database)", () => {
    const s = (previousWins: number) => winShares({ rating: 1400, opponentRating: 1000, previousWins, goldCards: 1 });
    expect([s(0), s(1), s(2)]).toEqual([133.875, 137.89125, 141.9075]);
  });
  it("missions add up to 100 points", () => expect(MISSIONS.reduce((n, m) => n + m.points, 0)).toBe(DAILY_ACTIVITY.maximumPoints));
  it("3 wins under 3 rules with a low-mana troop = 65 points", () => expect(activityPoints({ eligibleWins: 3, bannersUsed: 1, rulesetsWon: 3, lowManaWin: true })).toBe(65));
  it("every mission done = 100 points", () => expect(activityPoints({ eligibleWins: 5, bannersUsed: 2, rulesetsWon: 3, lowManaWin: true })).toBe(100));
  it("activity shares need at least 3 rewarded wins", () => {
    expect(activityShares({ ...none, eligibleWins: 2, lowManaWin: true }, 1.2)).toBe(0);
    expect(activityShares({ eligibleWins: 3, bannersUsed: 1, rulesetsWon: 3, lowManaWin: true }, 1.2)).toBeCloseTo(78);
  });
  it("energy regenerates 1 per hour up to 24", () => {
    const h = 3_600_000;
    expect(energyAt(20, 0, 2.5 * h)).toEqual({ energy: 22, nextAt: 3 * h });
    expect(energyAt(20, 0, 10 * h)).toEqual({ energy: 24, nextAt: null });
    expect(energyAt(0, 0, 59 * 60_000)).toEqual({ energy: 0, nextAt: h });
  });
});
