import { ABILITIES } from "@/game/catalog/abilities";
import { SUMMONERS } from "@/game/catalog/summoners";
import { allowedTroopLevel, essenceProgress } from "@/game/combining";
import { PACK_INFO, type Foil, type PackId, type Rarity } from "@/game/packs";
import { UNIT_BY_ID, unitAtLevel } from "@/game/units";
import { cn } from "@/lib/utils";

const SUMMONER_BY_ID = Object.fromEntries(SUMMONERS.map((s) => [s.id, s]));
const ABILITY_NAME = Object.fromEntries(ABILITIES.map((a) => [a.id, a.name]));

/** Rarity, level cap and pack edition of any catalog card. */
export function cardMeta(cardId: string): { rarity: Rarity; levelCap: number; set: PackId | null; kind: "summoner" | "troop" } | null {
  const s = SUMMONER_BY_ID[cardId];
  if (s) return { rarity: s.rarity as Rarity, levelCap: s.levelCap, set: s.set as PackId, kind: "summoner" };
  const u = UNIT_BY_ID[cardId];
  if (u) return { rarity: u.rarity as Rarity, levelCap: u.levelCap, set: (u.set ?? null) as PackId | null, kind: "troop" };
  return null;
}

/** Troop abilities unlocked at a level (summoners have none). */
export function unlockedAbilities(cardId: string, level: number): string[] {
  const u = UNIT_BY_ID[cardId];
  return u ? unitAtLevel(u, level).abilities.map((a) => ABILITY_NAME[a] ?? a) : [];
}

/** Level badge + CE progress bar ("Lv 3 · 6 / 7 CE"). */
export function EssenceBar({ cardId, foil, essence, className }: { cardId: string; foil: Foil; essence: number; className?: string }) {
  const meta = cardMeta(cardId);
  if (!meta) return null;
  const p = essenceProgress(meta.rarity, foil, essence);
  const pct = p.atMax ? 100 : (essence / p.nextLevelEssence!) * 100;
  return (
    <div className={cn("w-full space-y-1 text-[11px]", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-black uppercase text-primary">Lv {p.level}<span className="text-muted-foreground">/{p.maxLevel}</span></span>
        <span className="tabular-nums text-muted-foreground">{p.atMax ? `${essence} CE · max` : `${essence} / ${p.nextLevelEssence} CE`}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <div className={cn("h-full", foil === "gold" ? "bg-gold" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Full listing details: edition, foil, unlocked abilities and (optionally) the level it plays at under a summoner. */
export function EssenceDetails({ cardId, foil, essence, level, summonerId, summonerLevel }: {
  cardId: string; foil: Foil; essence: number; level: number; summonerId?: string | null; summonerLevel?: number;
}) {
  const meta = cardMeta(cardId);
  if (!meta) return null;
  const abilities = unlockedAbilities(cardId, level);
  const s = summonerId ? SUMMONER_BY_ID[summonerId] : undefined;
  const allowed = s && meta.kind === "troop" ? Math.min(level, allowedTroopLevel(summonerLevel ?? 1, s.levelCap, meta.levelCap)) : null;
  return (
    <div className="w-full space-y-1 text-left text-[11px] text-muted-foreground">
      <EssenceBar cardId={cardId} foil={foil} essence={essence} />
      <div>{meta.set ? PACK_INFO[meta.set]?.name ?? meta.set : "—"} · {foil === "gold" ? <span className="font-bold text-primary">Gold</span> : "Regular"}</div>
      {meta.kind === "troop" && <div className="line-clamp-2">{abilities.length ? abilities.join(", ") : "No abilities yet"}</div>}
      {allowed !== null && (
        <div className={cn(allowed < level && "font-semibold text-destructive")}>
          Plays at Lv {allowed} with {s!.name} (Lv {summonerLevel ?? 1})
        </div>
      )}
    </div>
  );
}
