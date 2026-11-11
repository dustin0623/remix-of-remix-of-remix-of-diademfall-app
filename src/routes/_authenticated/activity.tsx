import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download, ExternalLink, Loader2 } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { GameHeader } from "@/components/game/GameHeader";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { TransfersList } from "@/components/wallet/TransfersList";
import { WalletSubnav } from "@/components/wallet/WalletSubnav";
import { useAuthStore } from "@/features/stores/auth.store";
import { useTransfers } from "@/hooks/use-transfers";
import { ACTIVITY_CATEGORIES, activityCsv, type ActivityCategory, type ActivityRow } from "@/lib/economy/activity";
import { activityQuery, fetchActivityPage, type ActivityFilter } from "@/lib/economy/activity.queries";
import { creditsToUsd, entryLabel, formatAmount, type Currency } from "@/lib/economy/currency";
import { walletQuery } from "@/lib/economy/wallet.queries";
import { solanaExplorerTx } from "@/lib/wallet/transfers";
import { cn } from "@/lib/utils";

type Tab = "balance" | "exchange";

export const Route = createFileRoute("/_authenticated/activity")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => (s["tab"] === "exchange" ? { tab: "exchange" } : {}),
  head: () => ({
    meta: [
      { title: "Currency Activity — Diademfall" },
      { name: "description", content: "Every Credit and Coin change on your account: rewards, packs, market trades, deposits and withdrawals, with CSV export." },
      { property: "og:title", content: "Currency Activity — Diademfall" },
      { property: "og:description", content: "Balance history and deposit/withdrawal history for your Diademfall account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
});

const CURRENCY_PILLS: { id: Currency | "all"; name: string }[] = [
  { id: "all", name: "All" },
  { id: "credits", name: "Credits" },
  { id: "coins", name: "Coins" },
];
const unit = (c: Currency) => (c === "credits" ? "CR" : "COIN");
const EXPORT_LIMIT = 10_000;

function ActivityPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = search.tab ?? "balance";
  const wallet = useQuery(walletQuery(userId));
  const transfers = useTransfers(userId);

  return (
    <div className="portal-page packs-purchase-page">
      <GameHeader />
      <WalletSubnav section="activity" />
      <main className="packs-store-main">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-stretch">
          <Balance label="Credits" value={formatAmount(wallet.data?.credits ?? "0", "credits")} sub={`≈ ${creditsToUsd(wallet.data?.credits ?? "0")}`} />
          <Balance label="Coins" value={formatAmount(wallet.data?.coins ?? "0", "coins")} sub="withdrawable" />
          <Link to="/wallet" className="btn-ornate flex items-center justify-center px-6 py-3 font-display font-black uppercase italic tracking-wider text-primary-foreground">
            Deposit / Withdraw
          </Link>
        </div>

        <section className="panel-ornate overflow-hidden">
          <div role="tablist" aria-label="History" className="market-section-tabs">
            {(
              [
                { id: "balance", name: "Balance History" },
                { id: "exchange", name: "Exchange History" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? "selected" : ""}
                onClick={() => void navigate({ search: t.id === "balance" ? {} : { tab: t.id }, replace: true })}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="p-4 sm:p-5" role="tabpanel">
            {tab === "balance" ? (
              <BalanceHistory userId={userId} />
            ) : (
              <>
                <p className="mb-3 text-xs text-muted-foreground">Deposits into and withdrawals out of your game balance.</p>
                <TransfersList rows={transfers.rows} loading={transfers.isLoading} />
              </>
            )}
          </div>
        </section>
      </main>
      <PortalFooter />
    </div>
  );
}

function Balance({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel-ornate px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="break-all font-display text-2xl font-black tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function BalanceHistory({ userId }: { userId: string | undefined }) {
  const [filter, setFilter] = useState<ActivityFilter>({ currency: "all", category: "all" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const q = useInfiniteQuery(activityQuery(userId, filter));
  const rows = q.data?.pages.flat() ?? [];

  const exportCsv = async () => {
    if (!userId) return;
    setExporting(true);
    try {
      const all: ActivityRow[] = [];
      for (let offset = 0; offset < EXPORT_LIMIT; offset += 1000) {
        const page = await fetchActivityPage(userId, filter, offset, 1000);
        all.push(...page);
        if (page.length < 1000) break;
      }
      const blob = new Blob([activityCsv(all)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `diademfall-activity-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Export failed. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Currency" className="flex gap-1">
          {CURRENCY_PILLS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={filter.currency === p.id}
              onClick={() => setFilter((f) => ({ ...f, currency: p.id }))}
              className={cn(
                "rounded-full border px-3.5 py-1 text-xs font-bold uppercase tracking-wider transition",
                filter.currency === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary hover:text-primary",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
        <select
          aria-label="Type"
          value={filter.category}
          onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value as ActivityCategory | "all" }))}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="all">All types</option>
          {Object.entries(ACTIVITY_CATEGORIES).map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
          <option value="other">Other</option>
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || rows.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Export CSV
        </button>
      </div>

      {q.isLoading ? (
        <div className="py-10 text-center"><Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" /></div>
      ) : q.isError ? (
        <p className="py-10 text-center text-sm text-destructive">Couldn't load your history. Refresh to try again.</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No activity for this filter yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="w-6" />
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Balance after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const open = expanded === r.id;
                const negative = r.amount.startsWith("-");
                return (
                  <Fragment key={r.id}>
                    <tr className="cursor-pointer hover:bg-card/60" onClick={() => setExpanded(open ? null : r.id)}>
                      <td className="pl-2 text-muted-foreground">
                        <button type="button" aria-expanded={open} aria-label={open ? "Hide details" : "Show details"} className="p-1">
                          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 font-semibold">{entryLabel(r.entryType)}</td>
                      <td className={cn("whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums", negative ? "text-destructive" : "text-verdant")}>
                        {formatAmount(r.amount, r.currency, { signed: true })} {unit(r.currency)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground/80">
                        {formatAmount(r.balanceAfter, r.currency)} {unit(r.currency)}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-background/40">
                        <td />
                        <td colSpan={4} className="px-3 py-3">
                          <Details row={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {q.hasNextPage && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => void q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="rounded-md border border-border px-5 py-2 text-xs font-bold uppercase hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {q.isFetchingNextPage ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

function Details({ row }: { row: ActivityRow }) {
  const meta = Object.entries(row.metadata).filter(([, v]) => v !== null && v !== "" && typeof v !== "object");
  const signature = typeof row.metadata["signature"] === "string" ? (row.metadata["signature"] as string) : null;
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
      <dt className="text-muted-foreground">Entry</dt>
      <dd className="break-all font-mono">{row.id}</dd>
      <dt className="text-muted-foreground">Time</dt>
      <dd>{new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 19)} UTC</dd>
      {row.referenceType && row.referenceId && (
        <>
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="break-all font-mono">{row.referenceType}: {row.referenceId}</dd>
        </>
      )}
      {meta.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="capitalize text-muted-foreground">{k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}</dt>
          <dd className="break-all">{String(v)}</dd>
        </Fragment>
      ))}
      {signature && (
        <>
          <dt className="text-muted-foreground">On Solana</dt>
          <dd>
            <a href={solanaExplorerTx(signature)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-arcane hover:underline">
              View transaction <ExternalLink className="size-3" />
            </a>
          </dd>
        </>
      )}
    </dl>
  );
}
