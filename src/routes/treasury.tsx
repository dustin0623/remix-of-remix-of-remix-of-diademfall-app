import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { z } from "zod";
import { GameHeader } from "@/components/game/GameHeader";
import { PageHero } from "@/components/portal/PageHero";
import { formatAmount } from "@/lib/economy/currency";
import { getIsAdmin, getTreasuryReport, type TreasuryReport } from "@/lib/treasury/treasury.functions";
import { useAuthStore } from "@/features/stores/auth.store";
import hero from "@/assets/portal/hero.jpg";

const reportQuery = (month: string | undefined) =>
  queryOptions({ queryKey: ["treasury", "report", month ?? "current"], queryFn: () => getTreasuryReport({ data: { month } }) });

export const Route = createFileRoute("/treasury")({
  validateSearch: z.object({ month: z.string().regex(/^\d{4}-\d{2}-01$/).optional() }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(reportQuery(deps.month)),
  head: () => ({
    meta: [
      { title: "Treasury Report — Diademfall" },
      { name: "description", content: "Public Diademfall treasury: reward vault balances, Coins acquired, burned and paid out, market fees and the monthly reward budget." },
      { property: "og:title", content: "Treasury Report — Diademfall" },
      { property: "og:description", content: "Where every reward Coin comes from and where every fee goes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TreasuryPage,
});

const c = (v: string | null | undefined, d = 2) => formatAmount(v ?? "0", "coins", { maxDecimals: d });
const monthLabel = (m: string) => new Date(`${m}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const TYPE_LABEL: Record<string, string> = { reward_vault: "Reward vault", operations: "Operations", liquidity: "Liquidity", reserve: "Reserve", burn: "Burn" };
const SOURCE_LABEL: Record<string, string> = { launch_purchase: "Launch purchase", pack_revenue_buyback: "Pack revenue buyback", creator_fee_buyback: "Creator fee buyback", coin_credit_recycle: "Coin → Credit recycling", other: "Other" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-night/60 p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-black tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel-ornate space-y-3 p-5">
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Pools({ b }: { b: { match: string; activity: string; league: string; leaderboard: string } }) {
  const rows = [["Ranked wins (62.5%)", b.match], ["Daily missions (18.75%)", b.activity], ["League seasons (12.5%)", b.league], ["Leaderboards (6.25%)", b.leaderboard]];
  return (
    <table className="w-full text-sm"><tbody className="divide-y divide-border">
      {rows.map(([k, v]) => <tr key={k}><td className="py-1.5 text-muted-foreground">{k}</td><td className="py-1.5 text-right font-semibold tabular-nums">{c(v, 0)}</td></tr>)}
    </tbody></table>
  );
}

function AdminLink() {
  const userId = useAuthStore((s) => s.user?.id);
  const check = useServerFn(getIsAdmin);
  const q = useQuery({ queryKey: ["treasury", "is-admin", userId], enabled: !!userId, queryFn: () => check() });
  if (!q.data?.admin) return null;
  return <Link to="/admin/treasury" className="text-xs font-semibold text-primary hover:underline">Manage treasury</Link>;
}

function TreasuryPage() {
  const { month } = Route.useSearch();
  const navigate = useNavigate();
  const { data: r } = useSuspenseQuery(reportQuery(month));
  if (!r) return <div className="min-h-screen"><GameHeader /><p className="p-10 text-center text-muted-foreground">The treasury report couldn't be loaded. Try again shortly.</p></div>;
  return <Report r={r} onMonth={(m) => navigate({ to: "/treasury", search: { month: m } })} />;
}

function Report({ r, onMonth }: { r: TreasuryReport; onMonth: (m: string) => void }) {
  const months = [...new Set([r.month, ...r.months])].sort().reverse();
  const f = r.flows;
  const vaultIn = Number(f.marketToVault) + Number(f.rentalToVault);
  const acquired = r.acquisitions.reduce((s, a) => s + Number(a.coins), 0);
  return (
    <div className="min-h-screen">
      <GameHeader />
      <PageHero art={hero} eyebrow="Public report" title="Treasury" subtitle="Rewards are paid from Coins the project actually holds. Every month we publish the reward vault, what came in, what was burned and what was paid out.">
        <div className="flex flex-col items-center gap-2">
          <select aria-label="Report month" value={r.month} onChange={(e) => onMonth(e.target.value)}
            className="rounded-md border border-primary/40 bg-night/90 px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wider">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <AdminLink />
        </div>
      </PageHero>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Reward vault at start" value={c(r.openingRewardVault, 0)} sub="Coins" />
          <Stat label="Reward vault now / at end" value={c(r.closingRewardVault, 0)} sub="Latest recorded balance" />
          <Stat label="Paid to players" value={c(f.distributed)} sub={`${r.rewards.days} settled day${r.rewards.days === 1 ? "" : "s"}`} />
          <Stat label="Coins burned" value={c(f.burned)} sub="From market & rental fees" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Panel title={`Reward budget · ${monthLabel(r.month)}`}>
            {r.budget ? (
              <>
                <div className="font-display text-3xl font-black text-primary">{c(r.budget.calculated_budget, 0)} <span className="text-sm">Coins</span></div>
                <p className="text-xs text-muted-foreground">min(50m, vault {c(r.budget.opening_reward_vault, 0)} ÷ 12 + 80% × {c(r.budget.prior_month_acquired, 0)} acquired last month)</p>
                <Pools b={{ match: r.budget.match_pool, activity: r.budget.activity_pool, league: r.budget.league_pool, leaderboard: r.budget.leaderboard_pool }} />
              </>
            ) : <p className="text-sm text-muted-foreground">No reward budget has been published for this month, so no Coins are promised or paid for it. Wins still collect reward shares.</p>}
          </Panel>
          <Panel title="Next month (calculated so far)">
            <div className="font-display text-3xl font-black">{c(r.nextMonth.budget, 0)} <span className="text-sm">Coins</span></div>
            <p className="text-xs text-muted-foreground">Vault {c(r.nextMonth.openingRewardVault, 0)} ÷ 12 + 80% × {c(r.nextMonth.priorMonthAcquired, 0)} acquired this month. A target, not a promise: it's recalculated from real balances when published.</p>
            <Pools b={{ match: r.nextMonth.matchPool, activity: r.nextMonth.activityPool, league: r.nextMonth.leaguePool, leaderboard: r.nextMonth.leaderboardPool }} />
          </Panel>
        </div>

        <Panel title="Treasury wallets">
          {r.wallets.length === 0 ? <p className="text-sm text-muted-foreground">No treasury wallets have been published yet.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-1">Wallet</th><th className="py-1">Type</th><th className="py-1">Address</th><th className="py-1 text-right">Coins</th><th className="py-1 text-right">As of</th></tr></thead>
              <tbody className="divide-y divide-border">
                {r.wallets.map((w) => (
                  <tr key={w.address}>
                    <td className="py-1.5 font-semibold">{w.label}</td>
                    <td className="py-1.5 text-muted-foreground">{TYPE_LABEL[w.type] ?? w.type}</td>
                    <td className="py-1.5"><a href={`https://solscan.io/account/${w.address}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">{short(w.address)} <ExternalLink className="size-3" /></a></td>
                    <td className="py-1.5 text-right tabular-nums">{w.balance === null ? "—" : c(w.balance, 0)}</td>
                    <td className="py-1.5 text-right text-xs text-muted-foreground">{w.capturedAt ? new Date(w.capturedAt).toLocaleDateString() : "—"}{w.source === "chain" ? " · on-chain" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Coins acquired this month">
            <div className="font-display text-2xl font-black">{c(String(acquired), 0)}</div>
            {r.acquisitions.length === 0 ? <p className="text-sm text-muted-foreground">No acquisitions recorded this month.</p> : (
              <ul className="divide-y divide-border text-sm">
                {r.acquisitions.map((a, i) => (
                  <li key={a.txHash ?? i} className="flex items-center justify-between gap-2 py-1.5">
                    <span>{SOURCE_LABEL[a.source] ?? a.source} <span className="text-xs text-muted-foreground">→ {a.wallet} · {new Date(a.at).toLocaleDateString()}</span></span>
                    <span className="flex items-center gap-2 tabular-nums">{c(a.coins, 0)}
                      {a.txHash && <a href={`https://solscan.io/tx/${a.txHash}`} target="_blank" rel="noreferrer" aria-label="View transaction" className="text-primary"><ExternalLink className="size-3" /></a>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Market & rental fees">
            <p className="text-xs text-muted-foreground">5% of every sale and rental: 2% back to the reward vault, 2% burned, 1% to operations.</p>
            <table className="w-full text-sm"><tbody className="divide-y divide-border">
              <tr><td className="py-1.5 text-muted-foreground">Sales · volume</td><td className="py-1.5 text-right tabular-nums">{r.market.sales} · {c(r.market.volume)}</td></tr>
              <tr><td className="py-1.5 text-muted-foreground">Rentals · volume</td><td className="py-1.5 text-right tabular-nums">{r.rentals.contracts} · {c(r.rentals.volume)}</td></tr>
              <tr><td className="py-1.5 text-muted-foreground">Back to reward vault</td><td className="py-1.5 text-right tabular-nums">{c(String(vaultIn), 4)}</td></tr>
              <tr><td className="py-1.5 text-muted-foreground">Burned</td><td className="py-1.5 text-right tabular-nums">{c(String(Number(f.marketBurned) + Number(f.rentalBurned)), 4)}</td></tr>
              <tr><td className="py-1.5 text-muted-foreground">Operations</td><td className="py-1.5 text-right tabular-nums">{c(String(Number(f.marketOperations) + Number(f.rentalOperations)), 4)}</td></tr>
            </tbody></table>
          </Panel>
        </div>

        <Panel title="Rewards paid">
          <table className="w-full text-sm"><tbody className="divide-y divide-border">
            <tr><td className="py-1.5 text-muted-foreground">Ranked wins</td><td className="py-1.5 text-right tabular-nums">{c(r.rewards.paidMatch)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Daily missions</td><td className="py-1.5 text-right tabular-nums">{c(r.rewards.paidActivity)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Carried into the next day (wins pool)</td><td className="py-1.5 text-right tabular-nums">{c(r.rewards.rolloverOutMatch)}</td></tr>
          </tbody></table>
          <p className="text-xs text-muted-foreground">Coins the project buys on the market are treasury inventory, not newly minted rewards. Unpaid pool Coins roll forward and are never created beyond what the vault holds.</p>
        </Panel>
      </main>
    </div>
  );
}
