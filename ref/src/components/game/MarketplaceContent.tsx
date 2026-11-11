import { optimizedImage } from "@/lib/assets/optimized-images";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Coins, Filter, Loader2, RotateCcw, ShoppingCart, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HERO_STATS, HeroStatIcon } from "@/components/game/HeroStatIcon";
import { HeroCollectionCard } from "@/components/game/HeroCollectionCard";
import { HeroActionsPopover } from "@/components/game/HeroActionsPopover";
import { sortHeroes, type HeroSort } from "@/lib/game/heroes/ranking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SessionHero } from "@/lib/game/session/types";
import { maxEnergyFor } from "@/lib/config/constants/game";
import type { MarketListing, MarketPurchase } from "@/lib/game/heroes/market.functions";
import { marketQuote } from "@/lib/game/heroes/market-economy";
import { Link } from "@tanstack/react-router";
import "@/styles/heroes-collection.css";
import "@/styles/marketplace.css";
import "@/styles/filter-modal.css";

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
const SORTS: [string, string][] = [
  ["priceLow", "Lowest Price"], ["priceHigh", "Highest Price"], ["newest", "Newest"],
  ["strongest", "Strongest"], ["rarity", "Rarity"], ["power", "Power"], ["speed", "Speed"], ["stamina", "Stamina"],
];
const fmt = (n: number) => n.toLocaleString("en-US");

export const toHero = (l: MarketListing): SessionHero => ({
  id: l.id, name: l.name, type: l.name, level: l.level, rarity: l.rarity, power: l.power, speed: l.speed,
  stamina: l.stamina, bombNumber: l.bombNumber, bombRange: l.bombRange, maxEnergy: maxEnergyFor(l.stamina), skills: l.skills,
});

export function MarketplaceContent({ listings, error, connected, renderBuy }: {
  listings: MarketListing[] | null;
  error: string | null;
  connected: boolean;
  renderBuy: (listing: MarketListing) => ReactNode;
}) {
  const [heroName, setHeroName] = useState("");
  const [rarities, setRarities] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("priceLow");
  const [mineOnly, setMineOnly] = useState(false);
  const [minStats, setMinStats] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<{ rarities: string[]; min: string; max: string; stats: Record<string, number> }>({ rarities: [], min: "", max: "", stats: {} });
  useEffect(() => { if (filtersOpen) setDraft({ rarities, min: minPrice, max: maxPrice, stats: minStats }); }, [filtersOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeFilters = rarities.length + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + Object.values(minStats).filter(Boolean).length;

  /** Distinct hero names available in the current listings (mint numbers stripped). */
  const nameOptions = useMemo(
    () => [...new Set((listings ?? []).map((l) => l.name.replace(/\s*#\d+\s*$/, "").trim()))].sort((a, b) => a.localeCompare(b)),
    [listings],
  );

  const shown = useMemo(() => {
    if (!listings) return [];
    const min = Number(minPrice), max = Number(maxPrice);
    const base = (n: string) => n.replace(/\s*#\d+\s*$/, "").trim().toLowerCase();
    const list = listings.filter((l) =>
      (!mineOnly || l.mine) &&
      (!heroName || base(l.name) === heroName.toLowerCase()) &&
      (!rarities.length || rarities.includes(l.rarity.toLowerCase())) &&
      (!minPrice || !(min >= 0) || l.price >= min) &&
      (!maxPrice || !(max >= 0) || l.price <= max) &&
      HERO_STATS.every(({ key }) => !minStats[key] || (l[key] as number) >= minStats[key]));
    if (sort === "priceLow") return list.sort((a, b) => a.price - b.price);
    if (sort === "priceHigh") return list.sort((a, b) => b.price - a.price);
    if (sort === "newest") return list.sort((a, b) => b.listedAt - a.listedAt);
    return sortHeroes(list, sort as HeroSort);
  }, [listings, heroName, rarities, minPrice, maxPrice, sort, mineOnly, minStats]);

  const clear = () => { setHeroName(""); setRarities([]); setMinPrice(""); setMaxPrice(""); setSort("priceLow"); setMineOnly(false); setMinStats({}); };

  return (
    <section className="hc-page mk-page panel-page" aria-label="Marketplace">
      <div className="hc-toolbar panel-head">
        <div className="hc-filters">
          <div className="hc-collection-controls mk-collection-controls">
            <Button className="mk-mine" aria-pressed={mineOnly} onClick={() => setMineOnly((v) => !v)}>
              <Tag /> {mineOnly ? "All Listings" : "My Listings"}
            </Button>
            <Button className="fm-btn fm-btn-collection" onClick={() => setFiltersOpen(true)}>
              <Filter /> Filters{activeFilters ? ` (${activeFilters})` : ""}
            </Button>
            <label className="hc-selector">
              <span>Sort by</span>
              <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="hc-selector">
              <span>Hero</span>
              <select aria-label="Filter by hero" value={heroName} onChange={(e) => setHeroName(e.target.value)}>
                <option value="">All Heroes</option>
                {nameOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>

      <section className="hc-results mk-grid-wrap panel-scroll" aria-label="Heroes for sale" tabIndex={0}>
        {error && <p role="alert" className="mk-msg">{error}</p>}
        {!connected ? <p className="mk-msg">Connect your wallet to browse the marketplace.</p>
        : !listings ? <div className="mk-msg"><Loader2 className="animate-spin" /></div>
        : shown.length === 0 ? (
          <div className="mk-empty">
            <h2>The <span>Market</span> Is Quiet!</h2>
            <p className="mk-empty-sub">{listings.length ? "No listings match these filters." : "No heroes listed for sale yet."}</p>
            <p className="mk-empty-hint">{listings.length ? "Try clearing some filters to see more heroes." : "Be the first merchant! List one of your heroes and let other players discover your collection."}</p>
            {listings.length
              ? <Button className="mk-empty-btn" onClick={clear}><RotateCcw /> Clear Filters</Button>
              : <Button asChild className="mk-empty-btn"><Link to="/heroes"><Tag /> List a Hero</Link></Button>}
          </div>
        )
        : <>
          <p className="sr-only" role="status">{shown.length} of {listings.length} heroes</p>
          <div className="hc-grid">
            {shown.map((l) => (
              <div key={l.id} className="mk-item">
                <div className="mk-price-strip">
                  <span className="mk-price-value" title={`${fmt(l.price)} coins`}>
                    <span className="mk-price-coin" aria-hidden="true"><Coins /></span>
                    <span className="mk-price-copy">
                      <strong className="mk-price-amount">{fmt(l.price)}<span className="sr-only"> coins</span></strong>
                    </span>
                  </span>
                  {l.mine && <span className="mk-item-tag" data-status="owned" title="Your listing">
                    <Tag aria-hidden="true" /> Yours
                  </span>}
                </div>
                <HeroActionsPopover hero={toHero(l)} open={selectedId === l.id}
                  onOpenChange={(open) => setSelectedId(open ? l.id : null)}
                  heading={<strong className="inline-flex items-center gap-1.5" aria-label={`Price ${fmt(l.price)} coins`}><Coins className="size-4" />{fmt(l.price)}</strong>}
                  actions={<>
                    <p className="mk-seller">Seller <strong>{l.mine ? "You" : l.seller}</strong></p>
                    {renderBuy(l)}
                  </>}>
                  <HeroCollectionCard hero={toHero(l)} selected={selectedId === l.id} popoverOpen={selectedId === l.id}
                    onSelect={() => setSelectedId((id) => id === l.id ? null : l.id)} />
                </HeroActionsPopover>
              </div>
            ))}
          </div>
        </>}
      </section>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="fm-modal" scrollBody={false}>
          <DialogHeader className="fm-head"><DialogTitle className="fm-title"><Filter /> Filters</DialogTitle></DialogHeader>
          <div className="fm-body">
          <div className="fm-section">
            <h3>Rarity</h3>
            <div className="fm-chips">
              <button type="button" className="fm-chip" aria-pressed={!draft.rarities.length} onClick={() => setDraft((d) => ({ ...d, rarities: [] }))}>All</button>
              {RARITIES.map((r) => (
                <button key={r} type="button" className="fm-chip" data-rarity={r} aria-pressed={draft.rarities.includes(r)}
                  onClick={() => setDraft((d) => ({ ...d, rarities: d.rarities.includes(r) ? d.rarities.filter((x) => x !== r) : [...d.rarities, r] }))}>
                  <img className="fm-emblem" src={optimizedImage(`/game/emblems/${r}_emblem.png`)} alt="" aria-hidden="true" />{r}
                </button>
              ))}
            </div>
          </div>
          <div className="fm-section">
            <h3>Price Range</h3>
            <div className="fm-price">
              <Input inputMode="numeric" placeholder="Min price" aria-label="Minimum price" value={draft.min} onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))} />
              <Input inputMode="numeric" placeholder="Max price" aria-label="Maximum price" value={draft.max} onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))} />
            </div>
          </div>
          <div className="fm-section">
            <h3>Hero Stats <span className="fm-sub">(Minimum)</span></h3>
            <div className="fm-stat-grid">
              {HERO_STATS.map(({ key, label, index }) => (
                <label key={key} className="fm-stat-row">
                  <HeroStatIcon index={index} size={22} /><span>{label}</span>
                  <select className="fm-select" aria-label={`Minimum ${label}`} value={draft.stats[key] ?? 0}
                    onChange={(e) => setDraft((d) => ({ ...d, stats: { ...d.stats, [key]: Number(e.target.value) } }))}>
                    <option value={0}>Any</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}+</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <div className="fm-actions">
            <Button variant="ghost" className="fm-clear" onClick={() => { setRarities([]); setMinPrice(""); setMaxPrice(""); setMinStats({}); setDraft({ rarities: [], min: "", max: "", stats: {} }); setFiltersOpen(false); }}><RotateCcw /> Clear Filters</Button>
            <Button className="fm-apply" onClick={() => { setRarities(draft.rarities); setMinPrice(draft.min); setMaxPrice(draft.max); setMinStats(draft.stats); setFiltersOpen(false); }}>Apply Filters</Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function BuyPanel({ listing, coins, buy, onPurchased, onUnavailable, onDeposit }: {
  listing: MarketListing;
  coins: number;
  buy: (listing: MarketListing) => Promise<MarketPurchase>;
  onPurchased: (result: MarketPurchase) => void;
  onUnavailable?: () => void;
  onDeposit?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const quote = Number.isSafeInteger(listing.price) && listing.price > 0 ? marketQuote(listing.price) : null;
  const affordable = coins >= listing.price;
  const confirm = async () => {
    if (busy || purchased || !affordable || listing.mine || !quote) return;
    setBusy(true); setErr(null);
    try {
      const result = await buy(listing);
      setPurchased(true); setReview(false); onPurchased(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not buy hero — no coins were charged");
      onUnavailable?.();
    } finally { setBusy(false); }
  };

  if (listing.mine) return <Button className="mk-buy-big" disabled><Tag /> Your listing</Button>;

  return (
    <>
      <Button className="mk-buy-big" disabled={busy || purchased || !affordable || !quote} onClick={() => { setErr(null); setReview(true); }}>
        <ShoppingCart /> {purchased ? "Purchased" : !quote ? "Unavailable" : !affordable ? "Insufficient coins" : `Buy for ${fmt(listing.price)} coins`}
      </Button>
      {!affordable && (onDeposit ? <Button variant="ghost" onClick={onDeposit}><Coins /> Deposit</Button> : <Button asChild variant="ghost"><Link to="/wallet" search={{ tab: "deposit" }}><Coins /> Deposit</Link></Button>)}
      <Dialog open={review} onOpenChange={(open) => { if (!busy) setReview(open); }}>
        <DialogContent className="mk-purchase-review">
          <DialogHeader>
            <DialogTitle>Buy {listing.name}?</DialogTitle>
            <DialogDescription>From {listing.seller} · {listing.rarity} · Lv. {listing.level}</DialogDescription>
          </DialogHeader>
          <dl className="mk-review-values">
            <div><dt>Price</dt><dd><Coins /> {fmt(listing.price)} coins</dd></div>
            <div><dt>Your balance</dt><dd>{fmt(coins)} coins</dd></div>
            <div><dt>Balance after purchase</dt><dd>{fmt(coins - listing.price)} coins</dd></div>
            <div><dt>Market fee burned (5%)</dt><dd>{fmt(quote?.fee ?? 0)} coins</dd></div>
            <div><dt>Seller receives</dt><dd>{fmt(quote?.proceeds ?? 0)} coins</dd></div>
          </dl>
          <p className="mk-note">Fee is included in the price and rounded up to a whole coin.</p>
          {err && <p role="alert" className="mk-err">{err}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setReview(false)}>Cancel</Button>
            <Button disabled={busy || purchased || !affordable || !quote} onClick={() => void confirm()}>{busy ? <Loader2 className="animate-spin" /> : <ShoppingCart />}{busy ? "Buying…" : "Confirm purchase"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
