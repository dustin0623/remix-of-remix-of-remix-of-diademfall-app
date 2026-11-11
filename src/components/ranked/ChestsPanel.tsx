import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Coins, Gift, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { OwnedCard } from "@/components/packs/OwnedCard";
import { CHESTS, verifyChest, type ChestRoll } from "@/game/chests";
import { divisionById } from "@/game/divisions";
import { randomSeed } from "@/game/packs";
import { formatAmount } from "@/lib/economy/currency";
import { getSeasonStatus, openDivisionChest, type ChestRow, type SeasonStatus } from "@/lib/ranked/chests.functions";
import { cn } from "@/lib/utils";

export const seasonStatusQuery = (fetch: () => Promise<SeasonStatus | null>) =>
  queryOptions({ queryKey: ["ranked", "season"], queryFn: fetch, refetchInterval: 60_000 });

export function useSeasonStatus() {
  const fetch = useServerFn(getSeasonStatus);
  return useQuery(seasonStatusQuery(() => fetch()));
}

const CHEST_TONE: Record<ChestRow["type"], string> = {
  scout: "border-border",
  war: "border-primary/50",
  crown: "border-gold/70",
};

function RollView({ r }: { r: ChestRoll & { assetId?: string } }) {
  if (r.type === "card") {
    return (
      <div className="flex flex-col items-center gap-1">
        <OwnedCard cardId={r.cardId} gold={r.foil === "gold"} size="sm" />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `var(--rarity-${r.rarity})` }}>
          {r.rarity}{r.foil === "gold" ? " · Gold" : ""}{r.rolledRarity !== r.rarity ? " (rolled up)" : ""}
        </span>
      </div>
    );
  }
  return (
    <div className="flex min-w-28 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-night/60 p-3 text-center">
      {r.type === "coin_shares" ? <Coins className="size-5 text-gold" /> : <Gift className="size-5 text-primary" />}
      <strong className="font-display text-xl">{r.type === "coin_shares" ? r.shares : r.credits}</strong>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {r.type === "coin_shares" ? (r.fromDepletedCard ? "Coin shares (no cards left)" : "Coin shares") : "Credits"}
      </span>
    </div>
  );
}

function verified(c: ChestRow) {
  if (!c.serverSeed || !c.clientSeed || !c.reserve || !c.rolls) return null;
  const rolls = c.rolls.map(({ assetId: _a, ...r }) => r as ChestRoll);
  return verifyChest({ chest: c.type, commitHash: c.commitHash, serverSeed: c.serverSeed, clientSeed: c.clientSeed, chestId: c.id, reserve: c.reserve, rolls });
}

/** Division advancement chests for the active season: open them (provably fair) and see results. */
export function ChestsPanel({ s }: { s: SeasonStatus | null | undefined }) {
  const open = useServerFn(openDivisionChest);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [justOpened, setJustOpened] = useState<string | null>(null);
  if (!s) return null;
  const unopened = s.chests.filter((c) => c.status === "unopened");
  const opened = s.chests.filter((c) => c.status !== "unopened").reverse();

  const openOne = async (c: ChestRow) => {
    setBusy(c.id);
    try {
      const r = await open({ data: { chestId: c.id, clientSeed: randomSeed(16) } });
      if (!r.ok) { toast.error(r.error); return; }
      setJustOpened(c.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ranked", "season"] }),
        qc.invalidateQueries({ queryKey: ["account"] }),
        qc.invalidateQueries({ queryKey: ["wallet"] }),
      ]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-primary/30 bg-card/60 p-5" aria-label="Division chests">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Division chests</h2>
        <span className="text-xs text-muted-foreground">
          Season {s.season.number} · {formatAmount(s.seasonCoinShares, "coins", { maxDecimals: 0 })} Coin shares, paid when the season closes
        </span>
      </div>
      {s.chests.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Reach a new division this season to earn chests. The first one comes at Bronze II (1135 rating).
        </p>
      )}
      {unopened.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {unopened.map((c) => (
            <div key={c.id} className={cn("flex items-center justify-between gap-3 rounded-lg border-2 bg-night/60 p-3", CHEST_TONE[c.type])}>
              <div>
                <div className="font-display font-bold uppercase">{CHESTS[c.type].name}</div>
                <div className="text-xs text-muted-foreground">
                  {divisionById(c.divisionId)?.name ?? c.divisionId} · {CHESTS[c.type].rolls} roll{CHESTS[c.type].rolls > 1 ? "s" : ""}
                </div>
              </div>
              <button type="button" className="btn-ornate btn-ornate-verdant" onClick={() => openOne(c)} disabled={!!busy}>
                {busy === c.id && <Loader2 className="size-4 animate-spin" />} Open
              </button>
            </div>
          ))}
        </div>
      )}
      {opened.length > 0 && (
        <div className="space-y-3">
          {opened.map((c) => {
            const ok = verified(c);
            return (
              <div key={c.id} className={cn("rounded-lg border bg-night/40 p-3", c.id === justOpened ? "border-primary" : "border-border")}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold uppercase tracking-wider">
                    {CHESTS[c.type].name} · {divisionById(c.divisionId)?.name ?? c.divisionId}
                    {c.status === "auto_opened" && <span className="text-muted-foreground"> · opened at season close</span>}
                  </span>
                  {ok === null ? null : ok ? (
                    <span className="flex items-center gap-1 text-primary"><ShieldCheck className="size-3.5" /> Fair roll verified</span>
                  ) : (
                    <span className="flex items-center gap-1 text-destructive"><XCircle className="size-3.5" /> Verification failed</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {(c.rolls ?? []).map((r) => <RollView key={r.roll} r={r} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
        Each chest locks in a hidden seed when you earn it; your own seed is added when you open it, so neither side can pick the result.
        Cards come from a fixed reserve of 100,000 Legionnaire cards. Unopened chests open automatically when the season ends.
      </p>
    </section>
  );
}
