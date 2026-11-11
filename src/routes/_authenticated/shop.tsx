import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layers, Loader2, Minus, PackageOpen, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GameHeader } from "@/components/game/GameHeader";
import { PageHero, SegmentTabs } from "@/components/portal/PageHero";
import { EssenceBar } from "@/components/packs/CardEssence";
import { CombineDialog } from "@/components/packs/CombineDialog";
import { OpenPackDialog } from "@/components/packs/OpenPackDialog";
import { Button } from "@/components/ui/button";
import { OwnedCard, cardName, isSummoner } from "@/components/packs/OwnedCard";
import { PACK_ART } from "@/components/packs/packArt";
import { useAuthStore } from "@/features/stores/auth.store";
import { PACK_IDS, PACK_INFO, PACK_RULES, RARITY_ORDER, type Foil, type PackId } from "@/game/packs";
import { CE_REQUIREMENTS } from "@/game/combining";
import { formatAmount } from "@/lib/economy/currency";
import { walletQuery } from "@/lib/economy/wallet.queries";
import { buyPacks } from "@/lib/packs/packs.functions";
import { cardSupplyQuery, myCardsQuery, myPacksQuery, packSupplyQuery, type OwnedAsset } from "@/lib/packs/packs.queries";
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

function LevelsTable() {
  const supply = useQuery(cardSupplyQuery());
  const levels = Array.from({ length: 10 }, (_, i) => i + 1);
  return (
    <div className="panel-ornate mx-auto max-w-3xl p-5">
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">Card levels &amp; combining</h2>
      <p className="mt-1 text-xs text-muted-foreground">Total Card Essence (CE) needed for each level. Every opened copy is 1 CE. Combining is permanent.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {(["regular", "gold"] as const).map((foil) => (
          <table key={foil} className="w-full text-xs">
            <caption className="mb-1 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{foil === "gold" ? "Gold" : "Regular"}</caption>
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr><th className="py-0.5 text-left">Lv</th>{RARITY_ORDER.map((r) => <th key={r} className="py-0.5 text-right" style={{ color: `var(--rarity-${r})` }}>{r.slice(0, 3)}</th>)}</tr>
            </thead>
            <tbody className="tabular-nums">
              {levels.map((lv) => (
                <tr key={lv} className="border-t border-border/50">
                  <td className="py-0.5">{lv}</td>
                  {RARITY_ORDER.map((r) => <td key={r} className="py-0.5 text-right">{CE_REQUIREMENTS[foil][r][lv - 1] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      {supply.data && (
        <p className="mt-3 text-xs text-muted-foreground">
          {fmt(supply.data.minted)} cards opened so far · {fmt(supply.data.activeAssets)} separate cards today · {fmt(supply.data.combinedAssets)} combined into others · {fmt(supply.data.existingEssence)} CE in play
          {supply.data.burnedEssence > 0 && <> · {fmt(supply.data.burnedEssence)} CE burned</>}
        </p>
      )}
    </div>
  );
}

type Group = { key: string; cardId: string; foil: Foil; assets: OwnedAsset[]; best: OwnedAsset; free: number };

function Collection() {
  const userId = useAuthStore((s) => s.user?.id);
  const cards = useQuery(myCardsQuery(userId));
  const [filter, setFilter] = useState<"all" | "summoners" | "troops">("all");
  const [combining, setCombining] = useState<{ cardId: string; foil: Foil } | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const a of cards.data ?? []) {
      const key = `${a.cardId}:${a.foil}`;
      const g = m.get(key) ?? { key, cardId: a.cardId, foil: a.foil, assets: [], best: a, free: 0 };
      g.assets.push(a);
      if (a.essence > g.best.essence) g.best = a;
      if (a.status === "available") g.free++;
      m.set(key, g);
    }
    return [...m.values()]
      .filter((g) => filter === "all" || (filter === "summoners") === isSummoner(g.cardId))
      .sort((a, b) => cardName(a.cardId).localeCompare(cardName(b.cardId)) || a.foil.localeCompare(b.foil));
  }, [cards.data, filter]);
  const combineAssets = combining ? (cards.data ?? []).filter((a) => a.cardId === combining.cardId && a.foil === combining.foil) : [];

  if (cards.isLoading) return <p className="text-center text-sm text-muted-foreground">Loading your cards…</p>;
  if (!cards.data?.length) return <p className="text-center text-muted-foreground">You don't own any cards yet. Buy and open a pack to start your collection.</p>;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{fmt(cards.data.length)} cards · {fmt(new Set(cards.data.map((c) => c.cardId)).size)} different</p>
        <SegmentTabs label="Card type" value={filter} onChange={setFilter} options={[{ id: "all", name: "All" }, { id: "summoners", name: "Summoners" }, { id: "troops", name: "Troops" }]} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Combine copies of the same card to level it up. Each copy adds its Card Essence (CE). Regular and Gold copies level up separately. Gold cards need fewer copies.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {groups.map((g) => (
          <div key={g.key} className="flex w-[9.5rem] flex-col items-center gap-1.5">
            <OwnedCard cardId={g.cardId} gold={g.foil === "gold"} size="sm" />
            <EssenceBar cardId={g.cardId} foil={g.foil} essence={g.best.essence} />
            <div className="text-center text-[11px] text-muted-foreground">
              ×{g.assets.length} {g.foil === "gold" ? <span className="font-bold text-primary">Gold</span> : "Regular"}
            </div>
            {g.free >= 2 && (
              <Button size="sm" variant="secondary" className="h-7 w-full text-xs" onClick={() => setCombining({ cardId: g.cardId, foil: g.foil })}>
                <Layers className="size-3.5" /> Combine
              </Button>
            )}
          </div>
        ))}
      </div>
      <CombineDialog cardId={combining?.cardId ?? null} foil={combining?.foil ?? "regular"} assets={combineAssets} onClose={() => setCombining(null)} />
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
            <LevelsTable />
          </>
        ) : <Collection />}
      </main>
      <OpenPackDialog pack={opening} open={!!opening} onOpenChange={(o) => { if (!o) setOpening(null); }} />
    </div>
  );
}
