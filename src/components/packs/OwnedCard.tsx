import { SummonerCardView, UnitCardView } from "@/components/game/cards";
import { SUMMONERS } from "@/game/catalog/summoners";
import { UNIT_BY_ID } from "@/game/units";
import { cn } from "@/lib/utils";

const SUMMONER_BY_ID = Object.fromEntries(SUMMONERS.map((s) => [s.id, s]));

/** Any catalog card (summoner or troop) by id, optionally with the Gold foil treatment. */
export function OwnedCard({ cardId, gold, size = "md" }: { cardId: string; gold?: boolean; size?: "sm" | "md" }) {
  const s = SUMMONER_BY_ID[cardId];
  const u = UNIT_BY_ID[cardId];
  return (
    <div className={cn("relative w-fit", gold && "foil-gold")}>
      {s ? <SummonerCardView s={s} size={size} /> : u ? <UnitCardView u={u} size={size} /> : <div className="rounded border border-border p-4 text-xs">{cardId}</div>}
      {gold && <span className="absolute bottom-1.5 right-1.5 z-10 rounded bg-gold px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary-foreground">Gold</span>}
    </div>
  );
}

export const cardName = (id: string) => SUMMONER_BY_ID[id]?.name ?? UNIT_BY_ID[id]?.name ?? id;
export const isSummoner = (id: string) => !!SUMMONER_BY_ID[id];
