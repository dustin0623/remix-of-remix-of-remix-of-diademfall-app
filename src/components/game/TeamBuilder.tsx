import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { SummonerCardView, UnitCardView } from "@/components/game/cards";
import { RULESETS as BATTLE_RULESETS } from "@/game/catalog/rulesets";
import { SUMMONERS } from "@/game/catalog/summoners";
import { BANNER_BY_ID } from "@/game/banners";
import { cardCost, cardLegal, maxUnits, maxWayfarers, recruitable, teamMana, wayfarerCount, type MatchConfig, type TeamPick } from "@/game/match";
import { isWayfarer, UNITS, UNIT_BY_ID } from "@/game/units";
import { cn } from "@/lib/utils";

export function RulesetPills({ ids }: { ids: string[] }) {
  const list = ids.length ? ids : ["open_chronicle"];
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {list.map((id) => {
        const r = BATTLE_RULESETS.find((x) => x.id === id);
        if (!r) return null;
        return (
          <div key={id} className="max-w-xs rounded-lg border border-border bg-card/70 p-3 text-left">
            <div className="font-display text-sm font-bold text-primary">{r.name}</div>
            <div className="text-xs text-muted-foreground">{r.text}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Draft UI shared by practice and ranked: pick a summoner, recruit units, order the formation. */
export function TeamBuilder({ cfg, pick, setPick, error, action, owned, topBar, extra }: {
  cfg: MatchConfig;
  pick: TeamPick;
  setPick: Dispatch<SetStateAction<TeamPick>>;
  error: string | null;
  action: ReactNode;
  /** When set, only these card ids can be picked (ranked: the player's collection). */
  owned?: Record<string, number> | undefined;
  topBar?: ReactNode;
  /** Extra panel in the sidebar (e.g. saved teams). */
  extra?: ReactNode;
}) {
  const [bannerFilter, setBannerFilter] = useState<string>("all");
  const summoner = SUMMONERS.find((s) => s.id === pick.summonerId);
  const mana = teamMana(pick, cfg.rulesets);
  const isOwned = (id: string) => !owned || owned[id] !== undefined;
  const wfCount = wayfarerCount(pick.unitIds), wfMax = maxWayfarers(cfg.rulesets);
  const units = useMemo(() => (summoner ? UNITS.filter((u) => recruitable(u, summoner.banner) && cardLegal(u, cfg.rulesets) && isOwned(u.id)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summoner, cfg, owned]);

  const toggleUnit = (id: string) => setPick((p) => (p.unitIds.includes(id) ? { ...p, unitIds: p.unitIds.filter((x) => x !== id) } : p.unitIds.length < maxUnits(cfg.rulesets) ? { ...p, unitIds: [...p.unitIds, id] } : p));
  const move = (i: number, d: -1 | 1) => setPick((p) => { const u = [...p.unitIds]; const j = i + d; if (j < 0 || j >= u.length) return p; const tmp = u[i]!; u[i] = u[j]!; u[j] = tmp; return { ...p, unitIds: u }; });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/60 p-3 text-sm">
          <span className="font-display font-bold text-primary">Mana cap {cfg.manaCap}</span>
          <span className="text-muted-foreground">·</span>
          {(cfg.rulesets.length ? cfg.rulesets : ["open_chronicle"]).map((id) => (
            <span key={id} title={BATTLE_RULESETS.find((r) => r.id === id)?.text} className="cursor-help rounded border border-border px-2 py-0.5 text-xs">{BATTLE_RULESETS.find((r) => r.id === id)?.name}</span>
          ))}
          {topBar && <div className="ml-auto">{topBar}</div>}
        </div>
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold">1. Choose a Summoner</h2>
            <div className="flex flex-wrap gap-1">
              {["all", ...cfg.banners].map((b) => (
                <button key={b} onClick={() => setBannerFilter(b)} className={cn("rounded px-2 py-1 text-xs font-semibold", bannerFilter === b ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                  {b === "all" ? "All" : BANNER_BY_ID[b as keyof typeof BANNER_BY_ID].name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {SUMMONERS.filter((s) => cfg.banners.includes(s.banner) && (bannerFilter === "all" || s.banner === bannerFilter)).map((s) => {
              const legal = cardLegal(s, cfg.rulesets) && cardCost(s.mana, cfg.rulesets) <= cfg.manaCap && isOwned(s.id);
              return <SummonerCardView key={s.id} s={s} size="sm" manaOverride={cardCost(s.mana, cfg.rulesets)} disabled={!legal} selected={pick.summonerId === s.id}
                onClick={() => setPick((p) => ({ summonerId: s.id, unitIds: SUMMONERS.find((x) => x.id === p.summonerId)?.banner === s.banner ? p.unitIds : p.unitIds.filter((id) => { const u = UNIT_BY_ID[id]; return !!u && isWayfarer(u); }) }))} />;
            })}
          </div>
        </section>
        {summoner && (
          <section>
            <h2 className="mb-1 font-display text-xl font-bold">2. Recruit {BANNER_BY_ID[summoner.banner].name} Units{wfMax > 0 ? " and Wayfarers" : ""}</h2>
            <p className="mb-3 text-xs text-muted-foreground">{wfMax === 0 ? "Closed Ranks: no Wayfarers this match." : `Wayfarers are shared troops any summoner can hire, up to ${wfMax} per team.`}</p>
            <div className="flex flex-wrap gap-3">
              {units.map((u) => {
                const sel = pick.unitIds.includes(u.id);
                const cost = cardCost(u.mana, cfg.rulesets, pick.unitIds.length === 0 || pick.unitIds[0] === u.id);
                const fits = sel || (mana + cost <= cfg.manaCap && pick.unitIds.length < maxUnits(cfg.rulesets) && (!isWayfarer(u) || wfCount < wfMax));
                return <UnitCardView key={u.id} u={u} size="sm" manaOverride={cost} selected={sel} disabled={!fits} onClick={() => toggleUnit(u.id)} />;
              })}
            </div>
          </section>
        )}
      </div>
      <aside className="h-fit space-y-4 rounded-xl border border-border bg-card/70 p-4 lg:sticky lg:top-20">
        <div>
          <div className="flex justify-between text-sm"><span className="font-display font-bold">Mana</span><span className={cn("font-bold", mana > cfg.manaCap ? "text-destructive" : "text-primary")}>{mana} / {cfg.manaCap}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-gold transition-all" style={{ width: `${Math.min(100, (mana / cfg.manaCap) * 100)}%` }} /></div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg border border-border p-2 text-sm">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Summoner</div>
            <div className="font-display font-bold">{summoner?.name ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-border p-2 text-sm" title={wfMax === 0 ? "Closed Ranks: no Wayfarers" : `At most ${wfMax} Wayfarers`}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Wayfarers</div>
            <div className={cn("font-display font-bold", wfCount > wfMax ? "text-destructive" : "text-primary")}>{wfCount} / {wfMax}</div>
          </div>
        </div>
        <ol className="space-y-1.5">
          {Array.from({ length: maxUnits(cfg.rulesets) }).map((_, i) => {
            const id = pick.unitIds[i]; const u = id ? UNIT_BY_ID[id] : null;
            return (
              <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-2 py-1.5 text-sm">
                <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                {u ? (
                  <>
                    <span className="flex-1 truncate font-semibold">{u.name}</span>
                    {isWayfarer(u) && <span className="rounded border border-border px-1 text-[9px] uppercase tracking-wider text-muted-foreground">Wayfarer</span>}
                    <button onClick={() => move(i, -1)} aria-label="Move up" className="text-muted-foreground hover:text-foreground"><ArrowUp className="size-3.5" /></button>
                    <button onClick={() => move(i, 1)} aria-label="Move down" className="text-muted-foreground hover:text-foreground"><ArrowDown className="size-3.5" /></button>
                    <button onClick={() => toggleUnit(u.id)} aria-label="Remove" className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
                  </>
                ) : <span className="flex-1 text-xs italic text-muted-foreground">{i === 0 ? "Front line" : "Empty"}</span>}
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-muted-foreground">Position 1 takes the hits. Steel attacks only from positions 1–2; Shot can't fire from position 1; Spell works anywhere and ignores armor.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {action}
        {extra}
      </aside>
    </div>
  );
}
