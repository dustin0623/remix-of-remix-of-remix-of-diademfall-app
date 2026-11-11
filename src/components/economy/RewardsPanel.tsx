import { queryOptions, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Coins, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { DAILY_ACTIVITY, MISSIONS, REWARD_ENERGY } from "@/game/rewards";
import { formatAmount } from "@/lib/economy/currency";
import { getRewardsToday, type RewardsToday } from "@/lib/rewards/rewards.functions";

export const rewardsTodayQuery = (fetch: () => Promise<RewardsToday | null>) =>
  queryOptions({ queryKey: ["rewards", "today"], queryFn: fetch, refetchInterval: 60_000 });

export function useRewardsToday() {
  const fetch = useServerFn(getRewardsToday);
  return useQuery(rewardsTodayQuery(() => fetch()));
}

function untilLabel(iso: string | null, now: number) {
  if (!iso) return null;
  const s = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Compact Reward Energy meter (used next to the Battle button). */
export function EnergyMeter({ r }: { r: RewardsToday | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const energy = r?.energy ?? REWARD_ENERGY.maximum;
  const max = r?.maxEnergy ?? REWARD_ENERGY.maximum;
  const next = untilLabel(r?.nextEnergyAt ?? null, now);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-primary"><Zap className="size-3.5" /> Reward Energy</span>
        <span className="tabular-nums"><span className="font-bold">{energy}</span>/{max}{next && <span className="text-muted-foreground"> · +1 in {next}</span>}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${(energy / max) * 100}%` }} /></div>
      {energy === 0 && <p className="text-[11px] text-muted-foreground">Out of energy: you can still play for rating, but wins earn no Coins until it refills.</p>}
    </div>
  );
}

/** Today's ranked rewards: shares, estimated Coins and the daily mission checklist. */
export function RewardsPanel({ r }: { r: RewardsToday | null | undefined }) {
  if (!r) return null;
  const progress = { eligibleWins: r.eligibleWins, bannersUsed: r.bannersUsed, rulesetsWon: r.rulesetsWon, lowManaWin: r.lowManaWin };
  const qualifies = r.eligibleWins >= DAILY_ACTIVITY.minimumWins;
  const coins = (v: string) => formatAmount(v, "coins", { maxDecimals: 4 });
  return (
    <section className="rounded-2xl border border-primary/30 bg-card/60 p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Today's rewards</h2>
        <span className="text-xs text-muted-foreground">Paid in Coins shortly after midnight UTC</span>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-border bg-night/60 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Rewarded wins</div>
              <div className="font-display text-2xl font-black">{r.eligibleWins}</div>
              <div className="text-xs text-muted-foreground">{formatAmount(r.matchShares, "coins", { maxDecimals: 2 })} shares</div>
            </div>
            <div className="rounded-lg border border-border bg-night/60 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Mission points</div>
              <div className="font-display text-2xl font-black">{r.activityPoints}<span className="text-sm text-muted-foreground">/{DAILY_ACTIVITY.maximumPoints}</span></div>
              <div className="text-xs text-muted-foreground">{qualifies ? `${formatAmount(r.activityShares, "coins", { maxDecimals: 2 })} shares` : `Needs ${DAILY_ACTIVITY.minimumWins} rewarded wins`}</div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-night/60 p-3 text-sm">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-primary"><Coins className="size-4" /> Estimated Coins today</div>
            {r.funded ? (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Ranked wins</span><span className="tabular-nums font-bold">{coins(r.estimatedMatchCoins)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Daily missions</span><span className="tabular-nums font-bold">{coins(r.estimatedActivityCoins)}</span></div>
                <p className="mt-1 text-[11px] text-muted-foreground">Estimate changes as other players win today. One player can receive at most 0.5% of the win pool and 0.25% of the mission pool.</p>
              </>
            ) : (
              <p className="text-muted-foreground">Coin payouts start once this month's reward budget is published. Your wins still collect shares today. <Link to="/treasury" className="font-semibold text-primary hover:underline">Treasury report</Link></p>
            )}
            {r.lastPayout && (
              <p className="mt-2 border-t border-border pt-2 text-xs">Last payout ({r.lastPayout.day}): <span className="font-bold text-primary">{coins(String(Number(r.lastPayout.matchCoins) + Number(r.lastPayout.activityCoins)))}</span> Coins</p>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Only ranked wins in Bronze or higher that use Reward Energy count. Practice battles and wins by timeout earn nothing.</p>
        </div>
        <ul className="space-y-1.5">
          {MISSIONS.map((m) => {
            const done = m.done(progress);
            return (
              <li key={m.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${done ? "border-primary/50 bg-primary/10" : "border-border bg-night/40"}`}>
                {done ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                <span className="flex-1">{m.label}</span>
                <span className="tabular-nums text-xs text-muted-foreground">{m.progress(progress)}</span>
                <span className="w-10 text-right font-bold tabular-nums text-primary">{m.points}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
