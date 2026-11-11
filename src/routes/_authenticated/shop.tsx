import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Minus, PackageOpen, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GameHeader } from "@/components/game/GameHeader";
import { PageHero, SegmentTabs } from "@/components/portal/PageHero";
import { OpenPackDialog } from "@/components/packs/OpenPackDialog";
import { OwnedCard, cardName, isSummoner } from "@/components/packs/OwnedCard";
import { PACK_ART } from "@/components/packs/packArt";
import { useAuthStore } from "@/features/stores/auth.store";
import { PACK_IDS, PACK_INFO, PACK_RULES, RARITY_ORDER, type PackId } from "@/game/packs";
import { formatAmount } from "@/lib/economy/currency";
import { walletQuery } from "@/lib/economy/wallet.queries";
import { buyPacks } from "@/lib/packs/packs.functions";
import { myCardsQuery, myPacksQuery, packSupplyQuery } from "@/lib/packs/packs.queries";
import arena from "@/assets/portal/arena.jpg";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Shop & Collection — Diademfall" },
      { name: "description", content: "Buy Ancient, Oath and Legionnaire packs with Credits, open them with provably fair reveals and browse the cards you own." },
      { property: "og:title", content: "Shop & Collection — Diademfall" },
      { property: "og:description", content: "Capped card packs, five cards each, provably fair openings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShopPage,
});

type Tab = "packs" | "cards";
const fmt = (n: number) => n.toLocaleString("en-US");

function PackTile({ pack, onOpen }: { pack: PackId; onOpen: (p: PackId) => void }) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const buy = useServerFn(buyPacks);
  const supply = useQuery(packSupplyQuery());
  const mine = useQuery(myPacksQuery(userId));
  const wallet = useQuery(walletQuery(userId));
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const row = supply.data?.find((s) => s.pack === pack);
  const left = row ? row.publicAllocation - row.soldPacks : null;
  const price = row?.priceCredits ?? PACK_RULES.priceCredits;
  const owned = mine.data?.unopened[pack] ?? 0;
  const pending = !!mine.data?.pending[pack];
  const credits = Math.trunc(Number(wallet.data?.credits ?? 0));
  const cost = price * qty;
  const canAfford = credits >= cost;
  const info = PACK_INFO[pack];

  const doBuy = async () => {
    setBusy(true);
    try {
      const r = await buy({ data: { pack, quantity: qty, requestId: crypto.randomUUID() } });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`Bought ${qty} ${info.name}${qty > 1 ? "s" : ""}.`);
      await Promise.all([qc.invalidateQueries({ queryKey: ["packs"] }), qc.invalidateQueries({ queryKey: ["wallet"] })]);
    } finally { setBusy(false); }
  };

  return (
    <div className="panel-ornate flex flex-col items-center gap-4 p-5 text-center">
      <img src={PACK_ART[pack]} alt={info.name} width={768} height={1024} loading="lazy" className="anim-drift w-40 rounded-lg shadow-glow" style={{ ["--r" as string]: "-2deg" }} />
      <div>
        <h2 className="font-display text-2xl font-black uppercase text-primary">{info.name}</h2>
        <p className="text-sm text-muted-foreground">{info.subtitle}</p>
        <p className="mt-1 text-xs text-foreground/70">{info.summoners} summoners · {info.troops} troops</p>
      </div>
      <div className="w-full rounded-md border border-border bg-background/40 p-2 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">In store</span><span className="tabular-nums">{left === null ? "…" : `${fmt(left)} / ${fmt(row!.publicAllocation)}`}</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-gold" style={{ width: `${row ? (left! / row.publicAllocation) * 100 : 100}%` }} /></div>
        <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Opened so far</span><span className="tabular-nums">{row ? fmt(row.openedPacks) : "…"}</span></div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Fewer packs" onClick={() => setQty((q) => Math.max(1, q - 1))} className="rounded border border-border p-1.5 hover:border-primary"><Minus className="size-4" /></button>
        <span className="w-10 font-display text-xl font-bold tabular-nums" aria-label="Quantity">{qty}</span>
        <button type="button" aria-label="More packs" onClick={() => setQty((q) => Math.min(PACK_RULES.maxPerPurchase, q + 1))} className="rounded border border-border p-1.5 hover:border-primary"><Plus className="size-4" /></button>
      </div>
      <button type="button" onClick={doBuy} disabled={busy || !canAfford || left === 0}
        className="btn-ornate w-full px-6 py-2.5 font-display font-black uppercase italic tracking-wider text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : `Buy · ${fmt(cost)} Credits`}
      </button>
      {!canAfford && wallet.data && <p className="-mt-2 text-[11px] text-muted-foreground">You have {formatAmount(wallet.data.credits, "credits")} Credits.</p>}
      <button type="button" onClick={() => onOpen(pack)} disabled={owned < 1}
        className="btn-ornate btn-ornate-verdant w-full px-6 py-2 font-display font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40">
        <PackageOpen className="mr-2 inline size-4" />{pending ? "Finish opening" : "Open"} ({owned})
      </button>
    </div>
  );
}

function OddsTable() {
  return (
    <div className="panel-ornate mx-auto max-w-3xl p-5">
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">Odds &amp; supply</h2>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr><th className="py-1">Rarity</th><th className="py-1 text-right">Slots 1–4</th><th className="py-1 text-right">Slot 5 (guaranteed)</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {RARITY_ORDER.map((r) => (
            <tr key={r}>
              <td className="py-1.5 font-semibold capitalize" style={{ color: `var(--rarity-${r})` }}>{r}</td>
              <td className="py-1.5 text-right tabular-nums">{Math.round(PACK_RULES.standardSlot[r] * 100)}%</td>
              <td className="py-1.5 text-right tabular-nums">{Math.round(PACK_RULES.guaranteedSlot[r] * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Every card rolls Gold foil independently at 2% (same combat stats as Regular). Each pack edition is hard-capped at 500,000:
        450,000 in this store and 50,000 in a transparent reserve. No more can ever be made. Every opening commits to a hidden seed before you pick yours, so neither side can choose the result.
      </p>
    </div>
  );
}

function Collection() {
  const userId = useAuthStore((s) => s.user?.id);
  const cards = useQuery(myCardsQuery(userId));
  const [filter, setFilter] = useState<"all" | "summoners" | "troops">("all");
  const grouped = useMemo(() => {
    const m = new Map<string, { cardId: string; regular: number; gold: number }>();
    for (const a of cards.data ?? []) {
      const g = m.get(a.cardId) ?? { cardId: a.cardId, regular: 0, gold: 0 };
      if (a.foil === "gold") g.gold++; else g.regular++;
      m.set(a.cardId, g);
    }
    return [...m.values()]
      .filter((g) => filter === "all" || (filter === "summoners") === isSummoner(g.cardId))
      .sort((a, b) => cardName(a.cardId).localeCompare(cardName(b.cardId)));
  }, [cards.data, filter]);

  if (cards.isLoading) return <p className="text-center text-sm text-muted-foreground">Loading your cards…</p>;
  if (!cards.data?.length) return <p className="text-center text-muted-foreground">You don't own any cards yet. Buy and open a pack to start your collection.</p>;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{fmt(cards.data.length)} cards · {fmt(new Set(cards.data.map((c) => c.cardId)).size)} different</p>
        <SegmentTabs label="Card type" value={filter} onChange={setFilter} options={[{ id: "all", name: "All" }, { id: "summoners", name: "Summoners" }, { id: "troops", name: "Troops" }]} />
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {grouped.map((g) => (
          <div key={g.cardId} className="space-y-1">
            <OwnedCard cardId={g.cardId} gold={g.gold > 0 && g.regular === 0} size="sm" />
            <div className="text-center text-[11px] text-muted-foreground">
              ×{g.regular + g.gold}{g.gold > 0 && <span className="ml-1 font-bold text-primary">({g.gold} Gold)</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShopPage() {
  const [tab, setTab] = useState<Tab>("packs");
  const [opening, setOpening] = useState<PackId | null>(null);
  return (
    <div className="min-h-screen">
      <GameHeader />
      <PageHero art={arena} eyebrow="Ancient · Oath · Legionnaire" title="Shop" subtitle="Every pack costs 1,000 Credits and holds five cards. Cards you open are yours to battle with.">
        <div className="flex justify-center">
          <SegmentTabs label="Shop section" value={tab} onChange={setTab} options={[{ id: "packs" as Tab, name: "Packs" }, { id: "cards" as Tab, name: "My cards" }]} />
        </div>
      </PageHero>
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10">
        {tab === "packs" ? (
          <>
            <div className="grid gap-6 md:grid-cols-3">{PACK_IDS.map((p) => <PackTile key={p} pack={p} onOpen={setOpening} />)}</div>
            <OddsTable />
          </>
        ) : <Collection />}
      </main>
      <OpenPackDialog pack={opening} open={!!opening} onOpenChange={(o) => { if (!o) setOpening(null); }} />
    </div>
  );
}
