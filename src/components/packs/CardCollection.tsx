import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { SegmentTabs } from "@/components/portal/PageHero";
import { EssenceBar } from "./CardEssence";
import { CombineDialog } from "./CombineDialog";
import { OwnedCard, cardName, isSummoner } from "./OwnedCard";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/stores/auth.store";
import { RARITY_ORDER, type Foil } from "@/game/packs";
import { CE_REQUIREMENTS } from "@/game/combining";
import {
  cardSuppliesQuery,
  cardSupplyQuery,
  myCardsQuery,
  type CardSupplyRow,
  type OwnedAsset,
} from "@/lib/packs/packs.queries";
const fmt = (n: number) => n.toLocaleString("en-US");
export function CardCollection() {
  return (
    <div className="space-y-10">
      <Collection />
      <LevelsTable />
    </div>
  );
}
function LevelsTable() {
  const supply = useQuery(cardSupplyQuery());
  const levels = Array.from({ length: 10 }, (_, i) => i + 1);
  return (
    <div className="panel-ornate mx-auto max-w-3xl p-5">
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">
        Card levels &amp; combining
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Total Card Essence (CE) needed for each level. Every opened copy is 1 CE. Combining is
        permanent.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {(["regular", "gold"] as const).map((foil) => (
          <table key={foil} className="w-full text-xs">
            <caption className="mb-1 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {foil === "gold" ? "Gold" : "Regular"}
            </caption>
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="py-0.5 text-left">Lv</th>
                {RARITY_ORDER.map((r) => (
                  <th key={r} className="py-0.5 text-right" style={{ color: `var(--rarity-${r})` }}>
                    {r.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {levels.map((lv) => (
                <tr key={lv} className="border-t border-border/50">
                  <td className="py-0.5">{lv}</td>
                  {RARITY_ORDER.map((r) => (
                    <td key={r} className="py-0.5 text-right">
                      {CE_REQUIREMENTS[foil][r][lv - 1] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      {supply.data && (
        <p className="mt-3 text-xs text-muted-foreground">
          {fmt(supply.data.minted)} cards opened so far · {fmt(supply.data.activeAssets)} separate
          cards today · {fmt(supply.data.combinedAssets)} combined into others ·{" "}
          {fmt(supply.data.existingEssence)} CE in play
          {supply.data.burnedEssence > 0 && <> · {fmt(supply.data.burnedEssence)} CE burned</>}
        </p>
      )}
    </div>
  );
}

/** How many copies of a card exist across all players (printed minus combined). */
function SupplyLine({ supply }: { supply: CardSupplyRow | undefined }) {
  if (!supply) return null;
  return (
    <div
      className="text-center text-[10px] text-muted-foreground"
      title={`${fmt(supply.printed)} printed · ${fmt(supply.combined)} combined`}
    >
      {fmt(supply.circulating)} in circulation
      {supply.maxSupply !== null && <> / {fmt(supply.maxSupply)} max</>}
    </div>
  );
}

type Group = {
  key: string;
  cardId: string;
  foil: Foil;
  assets: OwnedAsset[];
  best: OwnedAsset;
  free: number;
};

function Collection() {
  const userId = useAuthStore((s) => s.user?.id);
  const cards = useQuery(myCardsQuery(userId));
  const supplies = useQuery(cardSuppliesQuery());
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
      .sort(
        (a, b) =>
          cardName(a.cardId).localeCompare(cardName(b.cardId)) || a.foil.localeCompare(b.foil),
      );
  }, [cards.data, filter]);
  const combineAssets = combining
    ? (cards.data ?? []).filter((a) => a.cardId === combining.cardId && a.foil === combining.foil)
    : [];

  if (cards.isLoading)
    return <p className="text-center text-sm text-muted-foreground">Loading your cards…</p>;
  if (cards.isError)
    return (
      <div className="commerce-empty" role="alert">
        <p>Couldn't load your cards.</p>
        <button type="button" className="play-small-button" onClick={() => void cards.refetch()}>
          Try again
        </button>
      </div>
    );
  if (!cards.data?.length)
    return (
      <div className="commerce-empty">
        <p>You don't own any cards yet.</p>
        <div className="flex gap-3">
          <Link to="/market" search={{ section: "packs" }} className="play-small-button">
            Buy Packs
          </Link>
          <Link to="/items" search={{ section: "others" }} className="play-small-button">
            Open Owned Packs
          </Link>
        </div>
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {fmt(cards.data.length)} cards · {fmt(new Set(cards.data.map((c) => c.cardId)).size)}{" "}
          different
        </p>
        <SegmentTabs
          label="Card type"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", name: "All" },
            { id: "summoners", name: "Commanders" },
            { id: "troops", name: "Troops" },
          ]}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Combine copies of the same card to level it up. Each copy adds its Card Essence (CE).
        Regular and Gold copies level up separately. Gold cards need fewer copies.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {groups.map((g) => (
          <div key={g.key} className="flex w-[9.5rem] flex-col items-center gap-1.5">
            <OwnedCard cardId={g.cardId} gold={g.foil === "gold"} size="sm" />
            <EssenceBar cardId={g.cardId} foil={g.foil} essence={g.best.essence} />
            <div className="text-center text-[11px] text-muted-foreground">
              ×{g.assets.length}{" "}
              {g.foil === "gold" ? <span className="font-bold text-primary">Gold</span> : "Regular"}
            </div>
            <SupplyLine supply={supplies.data?.[g.cardId]} />
            {g.free >= 2 && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 w-full text-xs"
                onClick={() => setCombining({ cardId: g.cardId, foil: g.foil })}
              >
                <Layers className="size-3.5" /> Combine
              </Button>
            )}
          </div>
        ))}
      </div>
      <CombineDialog
        cardId={combining?.cardId ?? null}
        foil={combining?.foil ?? "regular"}
        assets={combineAssets}
        onClose={() => setCombining(null)}
      />
    </div>
  );
}
