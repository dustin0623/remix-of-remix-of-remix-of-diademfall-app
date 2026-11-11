import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Shape returned by the my_rewards_today() SQL function (Coin amounts are exact decimal strings). */
export type RewardsToday = {
  day: string;
  energy: number;
  maxEnergy: number;
  nextEnergyAt: string | null;
  eligibleWins: number;
  matchShares: string;
  bannersUsed: number;
  rulesetsWon: number;
  lowManaWin: boolean;
  activityPoints: number;
  activityShares: string;
  dailyMultiplier: string;
  funded: boolean;
  matchPool: string;
  activityPool: string;
  totalMatchShares: string;
  totalActivityShares: string;
  estimatedMatchCoins: string;
  estimatedActivityCoins: string;
  lastPayout: { day: string; matchCoins: string; activityCoins: string } | null;
};

export const getRewardsToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RewardsToday | null> => {
    const { data, error } = await context.supabase.rpc("my_rewards_today");
    if (error) { console.error("[rewards] my_rewards_today failed", error); return null; }
    return data as unknown as RewardsToday;
  });
