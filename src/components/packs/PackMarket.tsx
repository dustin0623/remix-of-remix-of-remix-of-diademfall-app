import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Minus, Plus, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PACK_ART } from "@/components/packs/packArt";
import { useAuthStore } from "@/features/stores/auth.store";
import { PACK_IDS, PACK_INFO, PACK_RULES, RARITY_ORDER, type PackId } from "@/game/packs";
import { formatAmount } from "@/lib/economy/currency";
import { walletQuery } from "@/lib/economy/wallet.queries";
import { buyPacks } from "@/lib/packs/packs.functions";
import { packSupplyQuery } from "@/lib/packs/packs.queries";

const fmt = (n: number) => n.toLocaleString("en-US");

function PackTile({ pack }: { pack: PackId }) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const buy = useServerFn(buyPacks);
  const supply = useQuery(packSupplyQuery());
  const wallet = useQuery(walletQuery(userId));
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const row = supply.data?.find((s) => s.pack === pack);
  const left = row ? row.publicAllocation - row.soldPacks : null;
  const price = row?.priceCredits ?? PACK_RULES.priceCredits;
  const credits = Math.trunc(Number(wallet.data?.credits ?? 0));
  const cost = price * qty;
  const canAfford = credits >= cost;
  const info = PACK_INFO[pack];

  const doBuy = async () => {
    setBusy(true);
    try {
      const r = await buy({ data: { pack, quantity: qty, requestId: crypto.randomUUID() } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Bought ${qty} ${info.name}${qty > 1 ? "s" : ""}.`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["packs"] }),
        qc.invalidateQueries({ queryKey: ["wallet"] }),
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-ornate pack-shop-tile flex flex-col items-center gap-4 p-5 text-center">
      <span className="pack-edition-label">{pack} edition</span>
      <img
        src={PACK_ART[pack]}
        alt={info.name}
        width={768}
        height={1024}
        loading="lazy"
        className="anim-drift w-40 rounded-lg shadow-glow"
        style={{ ["--r" as string]: "-2deg" }}
      />
      <div>
        <h2 className="font-display text-2xl font-black uppercase text-primary">{info.name}</h2>
        <p className="text-sm text-muted-foreground">{info.subtitle}</p>
        <p className="mt-1 text-xs text-foreground/70">
          {info.summoners} commanders · {info.troops} troops
        </p>
      </div>
      <p className="pack-guarantee">5 cards · Uncommon or better guaranteed</p>
      <div className="w-full rounded-md border border-border bg-background/40 p-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">In store</span>
          <span className="tabular-nums">
            {left === null ? "…" : `${fmt(left)} / ${fmt(row!.publicAllocation)}`}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-gold"
            style={{ width: `${row ? (left! / row.publicAllocation) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted-foreground">Opened so far</span>
          <span className="tabular-nums">{row ? fmt(row.openedPacks) : "…"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Fewer packs"
          disabled={qty <= 1 || busy}
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="rounded border border-border p-1.5 hover:border-primary"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-10 font-display text-xl font-bold tabular-nums" aria-label="Quantity">
          {qty}
        </span>
        <button
          type="button"
          aria-label="More packs"
          disabled={qty >= PACK_RULES.maxPerPurchase || busy}
          onClick={() => setQty((q) => Math.min(PACK_RULES.maxPerPurchase, q + 1))}
          className="rounded border border-border p-1.5 hover:border-primary"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={doBuy}
        disabled={busy || !canAfford || !row?.active || left === null || left < qty}
        className="btn-ornate w-full px-6 py-2.5 font-display font-black uppercase italic tracking-wider text-primary-foreground disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="mx-auto size-5 animate-spin" />
        ) : supply.isError ? (
          "Availability unavailable"
        ) : !row ? (
          "Loading availability…"
        ) : left === 0 ? (
          "Sold out"
        ) : !row.active ? (
          "Not on sale"
        ) : (
          `Buy · ${fmt(cost)} Credits`
        )}
      </button>
      {!canAfford && wallet.data && (
        <p className="-mt-2 text-[11px] text-muted-foreground">
          You have {formatAmount(wallet.data.credits, "credits")} Credits.{" "}
          <Link to="/wallet" search={{ tab: "deposit" }} className="text-primary underline">
            Add Credits
          </Link>
        </p>
      )}
      {supply.isError && (
        <button type="button" className="play-small-button" onClick={() => void supply.refetch()}>
          Retry availability
        </button>
      )}
    </div>
  );
}

function OddsTable() {
  return (
    <div className="panel-ornate mx-auto max-w-3xl p-5">
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">
        Odds &amp; supply
      </h2>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-1">Rarity</th>
            <th className="py-1 text-right">Slots 1–4</th>
            <th className="py-1 text-right">Slot 5 (guaranteed)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {RARITY_ORDER.map((r) => (
            <tr key={r}>
              <td
                className="py-1.5 font-semibold capitalize"
                style={{ color: `var(--rarity-${r})` }}
              >
                {r}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {Math.round(PACK_RULES.standardSlot[r] * 100)}%
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {Math.round(PACK_RULES.guaranteedSlot[r] * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Every card rolls Gold foil independently at 2% (same combat stats as Regular). Each pack
        edition is hard-capped at 500,000: 450,000 in this store and 50,000 in a transparent
        reserve. No more can ever be made. Every opening commits to a hidden seed before you pick
        yours, so neither side can choose the result.
      </p>
    </div>
  );
}

export function PackMarket() {
  return (
    <main className="packs-store-main">
      <div className="commerce-intro">
        <p className="portal-eyebrow">Build your collection</p>
        <h2 className="title-portal">Choose Your Packs</h2>
        <p>
          Five cards. New possibilities. Purchase packs with Credits and open them from your Items.
        </p>
        <Link to="/items" search={{ section: "others" }} className="play-small-button">
          View Owned Packs <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="commerce-benefits">
        <span>
          <Layers /> Five cards per pack
        </span>
        <span>
          <Sparkles /> 2% Gold foil chance per card
        </span>
        <span>
          <ShieldCheck /> Verifiable openings
        </span>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {PACK_IDS.map((pack) => (
          <PackTile key={pack} pack={pack} />
        ))}
      </div>
      <OddsTable />
    </main>
  );
}
