import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GameHeader } from "@/components/game/GameHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAmount } from "@/lib/economy/currency";
import {
  ACQUISITION_SOURCES, addTreasuryWallet, getIsAdmin, getTreasuryAdmin, publishRewardBudget, recordTokenAcquisition, recordTreasurySnapshot, WALLET_TYPES,
  type BudgetCalc, type TreasuryAdmin,
} from "@/lib/treasury/treasury.functions";

export const Route = createFileRoute("/_authenticated/admin/treasury")({
  head: () => ({
    meta: [
      { title: "Treasury Admin — Diademfall" },
      { name: "description", content: "Register treasury wallets, record balances and Coin acquisitions, and publish the monthly reward budget." },
      { property: "og:title", content: "Treasury Admin — Diademfall" },
      { property: "og:description", content: "Treasury operator tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTreasury,
});

const c = (v: string | null | undefined) => formatAmount(v ?? "0", "coins", { maxDecimals: 2 });
const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function useRun() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => {
    setBusy(id);
    try {
      const r = await fn();
      if (!r.ok) { toast.error((r as { error: string }).error); return false; }
      toast.success(msg);
      await qc.invalidateQueries({ queryKey: ["treasury"] });
      return true;
    } finally { setBusy(null); }
  };
  return { busy, run };
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel-ornate space-y-3 p-5"><h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">{title}</h2>{children}</section>;
}

function Budget({ b, title }: { b: BudgetCalc; title: string }) {
  const publish = useServerFn(publishRewardBudget);
  const { busy, run } = useRun();
  return (
    <div className="rounded-lg border border-border bg-night/50 p-4 text-sm">
      <div className="flex items-baseline justify-between"><span className="font-semibold">{title}</span>{b.published && <span className="text-xs font-bold text-primary">Published</span>}</div>
      <div className="mt-1 font-display text-2xl font-black">{c(b.budget)} Coins</div>
      <p className="text-xs text-muted-foreground">Vault {c(b.openingRewardVault)} ÷ 12 + 80% × ({c(b.acquisitionsOnChain)} acquired + {c(b.feeReturns)} fee returns) last month</p>
      <Button size="sm" className="mt-3" disabled={!!busy || Number(b.openingRewardVault) <= 0}
        onClick={() => run(b.month, () => publish({ data: { month: b.month } }), "Budget published.")}>
        {busy ? <Loader2 className="animate-spin" /> : b.published ? "Re-publish with current numbers" : "Publish this budget"}
      </Button>
    </div>
  );
}

function Wallets({ d }: { d: TreasuryAdmin }) {
  const add = useServerFn(addTreasuryWallet);
  const snap = useServerFn(recordTreasurySnapshot);
  const { busy, run } = useRun();
  const [form, setForm] = useState({ label: "", address: "", type: "reward_vault" as (typeof WALLET_TYPES)[number], public: true });
  const [bal, setBal] = useState<Record<string, string>>({});
  return (
    <Box title="Wallets & balances">
      <table className="w-full text-sm">
        <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-1">Wallet</th><th>Type</th><th className="text-right">Latest balance</th><th className="w-72 text-right">Record balance</th></tr></thead>
        <tbody className="divide-y divide-border">
          {d.wallets.map((w) => (
            <tr key={w.id}>
              <td className="py-2"><div className="font-semibold">{w.label}{!w.public && <span className="ml-1 text-xs text-muted-foreground">(hidden)</span>}</div><div className="font-mono text-[11px] text-muted-foreground">{w.address}</div></td>
              <td className="text-muted-foreground">{label(w.type)}</td>
              <td className="text-right tabular-nums">{w.balance === null ? "—" : c(w.balance)}<div className="text-[11px] text-muted-foreground">{w.capturedAt ? new Date(w.capturedAt).toLocaleString() : ""}</div></td>
              <td className="py-2">
                <div className="flex justify-end gap-2">
                  <Input className="h-8 w-32" inputMode="decimal" placeholder="Coins" aria-label={`Balance for ${w.label}`} value={bal[w.id] ?? ""} onChange={(e) => setBal({ ...bal, [w.id]: e.target.value })} />
                  <Button size="sm" variant="secondary" disabled={!!busy || !(Number(bal[w.id]) >= 0) || bal[w.id] === undefined || bal[w.id] === ""}
                    onClick={() => run(w.id, () => snap({ data: { walletId: w.id, coinBalance: Number(bal[w.id]) } }), "Balance recorded.")}>Save</Button>
                  <Button size="sm" variant="outline" disabled={!!busy || !d.chainReadsEnabled} title={d.chainReadsEnabled ? "Read the Coin balance from Solana" : "Set the Coin token address first"}
                    onClick={() => run(`${w.id}-chain`, () => snap({ data: { walletId: w.id, fromChain: true } }), "Balance read from Solana.")}>Read</Button>
                </div>
              </td>
            </tr>
          ))}
          {d.wallets.length === 0 && <tr><td colSpan={4} className="py-3 text-muted-foreground">No wallets yet. Add the reward vault first.</td></tr>}
        </tbody>
      </table>
      {!d.chainReadsEnabled && <p className="text-xs text-muted-foreground">Reading balances straight from Solana turns on once the Coin token address is set. Until then, enter balances by hand.</p>}
      <div className="grid gap-3 border-t border-border pt-3 md:grid-cols-[1fr_2fr_1fr_auto_auto] md:items-end">
        <div className="space-y-1"><Label htmlFor="w-label">Label</Label><Input id="w-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Reward vault" /></div>
        <div className="space-y-1"><Label htmlFor="w-addr">Solana address</Label><Input id="w-addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="font-mono" /></div>
        <div className="space-y-1"><Label htmlFor="w-type">Type</Label>
          <select id="w-type" className={selectCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>{WALLET_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={form.public} onChange={(e) => setForm({ ...form, public: e.target.checked })} /> Public</label>
        <Button disabled={!!busy || form.label.trim().length < 2 || form.address.trim().length < 32}
          onClick={async () => { if (await run("add", () => add({ data: form }), "Wallet added.")) setForm({ ...form, label: "", address: "" }); }}>Add wallet</Button>
      </div>
    </Box>
  );
}

function Acquisitions({ d }: { d: TreasuryAdmin }) {
  const rec = useServerFn(recordTokenAcquisition);
  const { busy, run } = useRun();
  const empty = { source: "launch_purchase" as (typeof ACQUISITION_SOURCES)[number], coins: "", walletId: d.wallets[0]?.id ?? "", quoteSpent: "", quoteAsset: "SOL" as "SOL" | "USDC" | "USD", txHash: "", date: "" };
  const [f, setF] = useState(empty);
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const submit = () => run("acq", () => rec({ data: {
    source: f.source, coins: Number(f.coins), walletId: f.walletId || d.wallets[0]!.id,
    quoteSpent: num(f.quoteSpent), quoteAsset: f.quoteSpent ? f.quoteAsset : undefined,
    averagePriceUsd: f.quoteAsset !== "SOL" && num(f.quoteSpent) !== undefined && Number(f.coins) > 0 ? Number(f.quoteSpent) / Number(f.coins) : undefined,
    txHash: f.txHash.trim() || undefined, acquiredAt: f.date ? new Date(`${f.date}T12:00:00Z`).toISOString() : undefined,
  } }), "Acquisition recorded.").then((ok) => { if (ok) setF({ ...empty, walletId: f.walletId }); });
  return (
    <Box title="Coin acquisitions">
      <p className="text-xs text-muted-foreground">Record every Coin the project buys or recycles. Coins into a reward vault last month raise this month's budget (80% counts).</p>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1"><Label htmlFor="a-src">Source</Label><select id="a-src" className={selectCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as typeof f.source })}>{ACQUISITION_SOURCES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="a-coins">Coins acquired</Label><Input id="a-coins" inputMode="decimal" value={f.coins} onChange={(e) => setF({ ...f, coins: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="a-wallet">Into wallet</Label><select id="a-wallet" className={selectCls} value={f.walletId} onChange={(e) => setF({ ...f, walletId: e.target.value })}>{d.wallets.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="a-date">Date (blank = today)</Label><Input id="a-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="a-spent">Spent (optional)</Label><Input id="a-spent" inputMode="decimal" value={f.quoteSpent} onChange={(e) => setF({ ...f, quoteSpent: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="a-asset">Paid in</Label><select id="a-asset" className={selectCls} value={f.quoteAsset} onChange={(e) => setF({ ...f, quoteAsset: e.target.value as typeof f.quoteAsset })}><option>SOL</option><option>USDC</option><option>USD</option></select></div>
        <div className="space-y-1 md:col-span-2"><Label htmlFor="a-tx">Transaction (optional)</Label><Input id="a-tx" className="font-mono" value={f.txHash} onChange={(e) => setF({ ...f, txHash: e.target.value })} /></div>
      </div>
      <Button disabled={!!busy || !(Number(f.coins) > 0) || d.wallets.length === 0} onClick={submit}>Record acquisition</Button>
      {d.acquisitions.length > 0 && (
        <ul className="divide-y divide-border border-t border-border text-sm">
          {d.acquisitions.map((a) => <li key={a.id} className="flex justify-between py-1.5"><span>{label(a.source)} → {a.wallet} <span className="text-xs text-muted-foreground">{new Date(a.at).toLocaleDateString()}</span></span><span className="tabular-nums">{c(a.coins)}</span></li>)}
        </ul>
      )}
    </Box>
  );
}

function AdminTreasury() {
  const isAdmin = useServerFn(getIsAdmin);
  const load = useServerFn(getTreasuryAdmin);
  const role = useQuery({ queryKey: ["treasury", "is-admin-page"], queryFn: () => isAdmin() });
  const data = useQuery({ queryKey: ["treasury", "admin"], enabled: !!role.data?.admin, queryFn: () => load() });
  return (
    <div className="min-h-screen">
      <GameHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="title-portal text-4xl">Treasury admin</h1>
          <Link to="/treasury" className="text-sm font-semibold text-primary hover:underline">View public report</Link>
        </div>
        {role.isLoading ? <p className="text-muted-foreground">Checking access…</p>
          : !role.data?.admin ? <p className="text-muted-foreground">Only treasury operators can open this page.</p>
          : !data.data ? <p className="text-muted-foreground">Loading…</p>
          : (
            <>
              <Box title="Monthly reward budget">
                <p className="text-xs text-muted-foreground">Budget = min(50m, reward vault ÷ 12 + 80% of Coins acquired into the vault last month). Publishing tells players how many Coins this month's rewards can pay; days in a month without a budget pay nothing.</p>
                <div className="grid gap-4 md:grid-cols-2"><Budget b={data.data.thisMonth} title="This month" /><Budget b={data.data.nextMonth} title="Next month" /></div>
              </Box>
              <Wallets d={data.data} />
              <Acquisitions d={data.data} />
            </>
          )}
      </main>
    </div>
  );
}
