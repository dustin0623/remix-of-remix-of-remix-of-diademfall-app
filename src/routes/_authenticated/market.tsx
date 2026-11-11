import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GameHeader } from "@/components/game/GameHeader";
import { PageHero, SegmentTabs } from "@/components/portal/PageHero";
import { EssenceBar, EssenceDetails } from "@/components/packs/CardEssence";
import { OwnedCard, cardName, isSummoner } from "@/components/packs/OwnedCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/features/stores/auth.store";
import { pricePerEssence } from "@/game/combining";
import { isValidPrice, MAX_RENTAL_DAYS, rentalTotal, splitTradingFee } from "@/game/market";
import { formatAmount } from "@/lib/economy/currency";
import { myCardsQuery } from "@/lib/packs/packs.queries";
import {
  buyCard, cancelRentalListing, cancelSaleListing, getMarketState, listCardForRent, listCardForSale, rentCard,
  type MyAsset, type RentalListing, type SaleListing,
} from "@/lib/market/market.functions";
import gate from "@/assets/portal/gate.jpg";

export const Route = createFileRoute("/_authenticated/market")({
  head: () => ({
    meta: [
      { title: "Market — Diademfall" },
      { name: "description", content: "Buy, sell and rent Diademfall cards with Coins. Sellers keep 95%; the 5% fee feeds the reward vault, a burn and operations." },
      { property: "og:title", content: "Market — Diademfall" },
      { property: "og:description", content: "Trade and rent cards with Coins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketPage,
});

type Tab = "buy" | "rent" | "sell" | "rentals";
const coins = (v: string | number) => formatAmount(String(v), "coins", { maxDecimals: 4 });
const until = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function useMarket() {
  const fetch = useServerFn(getMarketState);
  return useQuery({ queryKey: ["market"], queryFn: () => fetch(), refetchInterval: 30_000 });
}

function useAction() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(id);
    try {
      const r = await fn();
      if (!r.ok) { toast.error((r as { error: string }).error); return false; }
      toast.success(success);
      await Promise.all([qc.invalidateQueries({ queryKey: ["market"] }), qc.invalidateQueries({ queryKey: ["wallet"] }), qc.invalidateQueries({ queryKey: ["packs"] })]);
      return true;
    } finally { setBusy(null); }
  };
  return { busy, run };
}

function CardTile({ cardId, gold, children }: { cardId: string; gold: boolean; children: React.ReactNode }) {
  return (
    <div className="panel-ornate flex w-[11.5rem] flex-col items-center gap-2 p-3 text-center">
      <OwnedCard cardId={cardId} gold={gold} size="sm" />
      {children}
    </div>
  );
}

type SummonerPick = { id: string; level: number } | null;

/** The buyer's own summoners (highest level owned), to preview what level a troop would play at. */
function useMySummoners() {
  const userId = useAuthStore((s) => s.user?.id);
  const cards = useQuery(myCardsQuery(userId));
  return useMemo(() => {
    const best = new Map<string, number>();
    for (const a of cards.data ?? []) if (isSummoner(a.cardId) && a.status === "available") best.set(a.cardId, Math.max(best.get(a.cardId) ?? 1, a.level));
    return [...best.entries()].map(([id, level]) => ({ id, level })).sort((a, b) => cardName(a.id).localeCompare(cardName(b.id)));
  }, [cards.data]);
}

function Filters({ q, setQ, foil, setFoil, summoner, setSummoner }: {
  q: string; setQ: (v: string) => void; foil: "all" | "gold"; setFoil: (v: "all" | "gold") => void; summoner: SummonerPick; setSummoner: (v: SummonerPick) => void;
}) {
  const mine = useMySummoners();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards…" className="max-w-xs" aria-label="Search cards" />
      <Select value={summoner?.id ?? "none"} onValueChange={(v) => setSummoner(mine.find((m) => m.id === v) ?? null)}>
        <SelectTrigger className="w-56" aria-label="Check levels with a summoner"><SelectValue placeholder="Check with a summoner" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{mine.length ? "No summoner check" : "You own no summoners yet"}</SelectItem>
          {mine.map((m) => <SelectItem key={m.id} value={m.id}>{cardName(m.id)} · Lv {m.level}</SelectItem>)}
        </SelectContent>
      </Select>
      <SegmentTabs label="Foil" value={foil} onChange={setFoil} options={[{ id: "all", name: "All foils" }, { id: "gold", name: "Gold only" }]} />
    </div>
  );
}

function useFiltered<T extends { cardId: string; foil: string }>(rows: T[]) {
  const [q, setQ] = useState("");
  const [foil, setFoil] = useState<"all" | "gold">("all");
  const [summoner, setSummoner] = useState<SummonerPick>(null);
  const list = useMemo(() => rows.filter((r) => (foil === "all" || r.foil === "gold") && cardName(r.cardId).toLowerCase().includes(q.trim().toLowerCase())), [rows, q, foil]);
  return { list, summoner, filters: <Filters q={q} setQ={setQ} foil={foil} setFoil={setFoil} summoner={summoner} setSummoner={setSummoner} /> };
}

function BuyTab({ sales }: { sales: SaleListing[] }) {
  const buy = useServerFn(buyCard);
  const { busy, run } = useAction();
  const { list, filters, summoner } = useFiltered(sales);
  return (
    <div className="space-y-5">
      {filters}
      {list.length === 0 ? <p className="text-center text-muted-foreground">No cards for sale right now.</p> : (
        <div className="flex flex-wrap justify-center gap-4">
          {list.map((l) => (
            <CardTile key={l.id} cardId={l.cardId} gold={l.foil === "gold"}>
              <div className="font-display text-lg font-black text-primary">{coins(l.price)} <span className="text-xs font-bold">Coins</span></div>
              <div className="-mt-1.5 text-[11px] text-muted-foreground">{coins(pricePerEssence(Number(l.price), l.essence))} Coins per CE</div>
              <EssenceDetails cardId={l.cardId} foil={l.foil} essence={l.essence} level={l.level} summonerId={summoner?.id} summonerLevel={summoner?.level} />
              <div className="text-[11px] text-muted-foreground">Seller: {l.seller}</div>
              <Button size="sm" className="w-full" disabled={!!busy} onClick={() => run(l.id, () => buy({ data: { listingId: l.id } }), `Bought ${cardName(l.cardId)}.`)}>
                {busy === l.id ? <Loader2 className="animate-spin" /> : "Buy"}
              </Button>
            </CardTile>
          ))}
        </div>
      )}
    </div>
  );
}

function RentTile({ l, summoner }: { l: RentalListing; summoner: SummonerPick }) {
  const rent = useServerFn(rentCard);
  const { busy, run } = useAction();
  const [days, setDays] = useState(l.minDays);
  const total = rentalTotal(Number(l.pricePerDay), days);
  return (
    <CardTile cardId={l.cardId} gold={l.foil === "gold"}>
      <div className="font-display text-lg font-black text-primary">{coins(l.pricePerDay)} <span className="text-xs font-bold">Coins / day</span></div>
      <EssenceDetails cardId={l.cardId} foil={l.foil} essence={l.essence} level={l.level} summonerId={summoner?.id} summonerLevel={summoner?.level} />
      <div className="text-[11px] text-muted-foreground">Owner: {l.owner} · {l.minDays}–{l.maxDays} days</div>
      <div className="flex w-full items-center gap-2">
        <Label htmlFor={`days-${l.id}`} className="text-xs">Days</Label>
        <Input id={`days-${l.id}`} type="number" min={l.minDays} max={l.maxDays} value={days} className="h-8"
          onChange={(e) => setDays(Math.min(l.maxDays, Math.max(l.minDays, Math.trunc(Number(e.target.value) || l.minDays))))} />
      </div>
      <Button size="sm" className="w-full" disabled={!!busy} onClick={() => run(l.id, () => rent({ data: { listingId: l.id, days } }), `Rented ${cardName(l.cardId)} for ${days} day${days > 1 ? "s" : ""}.`)}>
        {busy === l.id ? <Loader2 className="animate-spin" /> : `Rent · ${coins(total)} Coins`}
      </Button>
    </CardTile>
  );
}

function RentTab({ rentals }: { rentals: RentalListing[] }) {
  const { list, filters, summoner } = useFiltered(rentals);
  return (
    <div className="space-y-5">
      {filters}
      <p className="text-center text-xs text-muted-foreground">You rent the whole card at its current level. It's yours to battle with until the rental ends, and it counts for ranked rewards (Gold cards included). Rented cards can't be combined, sold or passed on.</p>
      {list.length === 0 ? <p className="text-center text-muted-foreground">No cards for rent right now.</p> : (
        <div className="flex flex-wrap justify-center gap-4">{list.map((l) => <RentTile key={l.id} l={l} summoner={summoner} />)}</div>
      )}
    </div>
  );
}

function ListDialog({ asset, onClose }: { asset: MyAsset | null; onClose: () => void }) {
  const sell = useServerFn(listCardForSale);
  const lend = useServerFn(listCardForRent);
  const { busy, run } = useAction();
  const [mode, setMode] = useState<"sell" | "lend">("sell");
  const [price, setPrice] = useState("");
  const [minDays, setMinDays] = useState(1);
  const [maxDays, setMaxDays] = useState(7);
  const p = Number(price);
  const valid = isValidPrice(p) && (mode === "sell" || (minDays >= 1 && maxDays >= minDays && maxDays <= MAX_RENTAL_DAYS));
  const net = valid ? splitTradingFee(p).net : 0;
  const submit = async () => {
    if (!asset || !valid) return;
    const ok = mode === "sell"
      ? await run("list", () => sell({ data: { assetId: asset.id, price: p } }), `${cardName(asset.cardId)} is now for sale.`)
      : await run("list", () => lend({ data: { assetId: asset.id, pricePerDay: p, minDays, maxDays } }), `${cardName(asset.cardId)} is now for rent.`);
    if (ok) { setPrice(""); onClose(); }
  };
  return (
    <Dialog open={!!asset} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asset ? cardName(asset.cardId) : ""}{asset?.foil === "gold" ? " (Gold)" : ""}{asset ? ` · Lv ${asset.level} · ${asset.essence} CE` : ""}</DialogTitle>
          <DialogDescription>While a card is listed you can't battle with it. You can cancel any time it isn't rented out.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <SegmentTabs label="Listing type" value={mode} onChange={setMode} options={[{ id: "sell", name: "Sell" }, { id: "lend", name: "Rent out" }]} />
          <div className="space-y-1.5">
            <Label htmlFor="price">{mode === "sell" ? "Price (Coins)" : "Price per day (Coins)"}</Label>
            <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 25" />
          </div>
          {mode === "lend" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="min">Shortest rental (days)</Label><Input id="min" type="number" min={1} max={MAX_RENTAL_DAYS} value={minDays} onChange={(e) => setMinDays(Math.trunc(Number(e.target.value) || 1))} /></div>
              <div className="space-y-1.5"><Label htmlFor="max">Longest rental (days)</Label><Input id="max" type="number" min={1} max={MAX_RENTAL_DAYS} value={maxDays} onChange={(e) => setMaxDays(Math.trunc(Number(e.target.value) || 1))} /></div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {valid ? <>You receive <span className="font-bold text-primary">{coins(net)} Coins</span>{mode === "lend" ? " per day rented" : ""} (95%). The 5% fee goes 2% to the reward vault, 2% burned, 1% to operations.</> : "Minimum price is 0.01 Coins."}
          </p>
          <Button className="w-full" disabled={!valid || !!busy} onClick={submit}>{busy ? <Loader2 className="animate-spin" /> : mode === "sell" ? "List for sale" : "List for rent"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SellTab({ mine }: { mine: NonNullable<ReturnType<typeof useMarket>["data"]>["mine"] }) {
  const cancelSale = useServerFn(cancelSaleListing);
  const cancelRent = useServerFn(cancelRentalListing);
  const { busy, run } = useAction();
  const [picked, setPicked] = useState<MyAsset | null>(null);
  const available = mine.assets.filter((a) => a.status === "available");
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">Your listings</h2>
        {mine.sales.length + mine.rentals.length === 0 ? <p className="text-sm text-muted-foreground">Nothing listed yet. Pick a card below to sell it or rent it out.</p> : (
          <div className="flex flex-wrap gap-4">
            {mine.sales.map((l) => (
              <CardTile key={l.id} cardId={l.cardId} gold={l.foil === "gold"}>
                <EssenceBar cardId={l.cardId} foil={l.foil} essence={l.essence} />
                <div className="text-sm">For sale · <span className="font-bold text-primary">{coins(l.price)}</span></div>
                <Button size="sm" variant="secondary" className="w-full" disabled={!!busy} onClick={() => run(l.id, () => cancelSale({ data: { listingId: l.id } }), "Listing cancelled.")}>
                  {busy === l.id ? <Loader2 className="animate-spin" /> : "Cancel"}
                </Button>
              </CardTile>
            ))}
            {mine.rentals.map((l) => (
              <CardTile key={l.id} cardId={l.cardId} gold={l.foil === "gold"}>
                <EssenceBar cardId={l.cardId} foil={l.foil} essence={l.essence} />
                <div className="text-sm">For rent · <span className="font-bold text-primary">{coins(l.pricePerDay)}</span>/day</div>
                {l.status === "rented" ? <div className="text-[11px] text-muted-foreground">Rented out now</div> : (
                  <Button size="sm" variant="secondary" className="w-full" disabled={!!busy} onClick={() => run(l.id, () => cancelRent({ data: { listingId: l.id } }), "Rental listing cancelled.")}>
                    {busy === l.id ? <Loader2 className="animate-spin" /> : "Cancel"}
                  </Button>
                )}
              </CardTile>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">Your cards</h2>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">No free cards to list. <Link to="/shop" className="font-semibold text-primary hover:underline">Open packs in the Shop</Link>.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {available.map((a) => (
              <CardTile key={a.id} cardId={a.cardId} gold={a.foil === "gold"}>
                <EssenceBar cardId={a.cardId} foil={a.foil} essence={a.essence} />
                <Button size="sm" className="w-full" onClick={() => setPicked(a)}>Sell or rent out</Button>
              </CardTile>
            ))}
          </div>
        )}
      </section>
      <ListDialog asset={picked} onClose={() => setPicked(null)} />
    </div>
  );
}

function RentalsTab({ mine }: { mine: NonNullable<ReturnType<typeof useMarket>["data"]>["mine"] }) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {([["Cards you're renting", mine.renting, "From"], ["Cards you've rented out", mine.rentedOut, "To"]] as const).map(([title, rows, who]) => (
        <section key={title} className="space-y-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">{title}</h2>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">None right now.</p> : (
            <div className="flex flex-wrap gap-4">
              {rows.map((c) => (
                <CardTile key={c.id} cardId={c.cardId} gold={c.foil === "gold"}>
                  <EssenceBar cardId={c.cardId} foil={c.foil} essence={c.essence} />
                  <div className="text-[11px] text-muted-foreground">{who} {c.counterparty} · {c.days} day{c.days > 1 ? "s" : ""} · {coins(c.gross)} Coins</div>
                  <div className="text-xs">Ends {until(c.endsAt)}</div>
                </CardTile>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function MarketPage() {
  const [tab, setTab] = useState<Tab>("buy");
  const market = useMarket();
  const m = market.data;
  return (
    <div className="min-h-screen">
      <GameHeader />
      <PageHero art={gate} eyebrow="Buy · Sell · Rent" title="Market" subtitle="Trade and rent cards with Coins. Sellers and owners keep 95%; the 5% fee refills the reward vault, burns Coins and funds operations.">
        <div className="flex flex-col items-center gap-3">
          <SegmentTabs label="Market section" value={tab} onChange={setTab}
            options={[{ id: "buy" as Tab, name: "Buy" }, { id: "rent" as Tab, name: "Rent" }, { id: "sell" as Tab, name: "Sell & rent out" }, { id: "rentals" as Tab, name: "My rentals" }]} />
          <Link to="/treasury" className="text-xs font-semibold text-primary hover:underline">See where fees go in the treasury report</Link>
        </div>
      </PageHero>
      <main className="mx-auto max-w-6xl px-4 py-10">
        {!m ? <p className="text-center text-sm text-muted-foreground">{market.isError ? "Couldn't load the market." : "Loading the market…"}</p>
          : tab === "buy" ? <BuyTab sales={m.sales} />
          : tab === "rent" ? <RentTab rentals={m.rentals} />
          : tab === "sell" ? <SellTab mine={m.mine} />
          : <RentalsTab mine={m.mine} />}
      </main>
    </div>
  );
}
