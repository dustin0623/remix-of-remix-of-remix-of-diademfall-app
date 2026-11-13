import { useState } from "react";
import { BANNERS } from "@/game/banners";
import { SUMMONERS } from "@/game/catalog/summoners";
import { UNITS } from "@/game/units";
import { SummonerCardView, UnitCardView } from "@/components/game/cards";
import { BannerCrest } from "@/components/game/CardSymbols";

const STYLE: Record<string, string> = {
  bastion_orders: "Armored frontlines and shields that outlast any rush.",
  wild_courts: "Fast hunters, poison and relentless pressure.",
  veil_covenant: "Magic, curses and tricks that unravel formations.",
  hollow_legions: "Undying ranks that rise again and drain the living.",
  skybound_houses: "Flying archers striking the backline from above.",
  wyrm_clans: "Heavy fire, brute damage and old-blood toughness.",
};

export function BannerReel() {
  const [active, setActive] = useState(BANNERS[0]!.id);
  const b = BANNERS.find((x) => x.id === active)!;
  const summoner = SUMMONERS.find((s) => s.banner === active);
  const units = UNITS.filter((u) => u.banner === active)
    .sort((a, c) => c.mana - a.mana)
    .slice(0, 4);
  return (
    <div className="space-y-10">
      <div className="mx-auto grid max-w-5xl grid-cols-3 gap-4 sm:grid-cols-6">
        {BANNERS.map((x) => {
          const on = x.id === active;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setActive(x.id)}
              aria-pressed={on}
              className={`group flex flex-col items-center gap-2 transition ${on ? "" : "opacity-60 hover:opacity-100"}`}
            >
              <span
                className={`relative block h-20 w-20 transition ${on ? "scale-110" : "group-hover:scale-105"}`}
              >
                <BannerCrest banner={x.id} className="h-full w-full" />
              </span>
              <span
                className={`font-display text-sm font-bold uppercase tracking-wider ${on ? "text-primary" : "text-foreground"}`}
              >
                {x.name}
              </span>
            </button>
          );
        })}
      </div>
      <div className="text-center">
        <p className="font-display text-xl" style={{ color: b.color }}>
          “{b.motto}”
        </p>
        <p className="mt-1 text-muted-foreground">{STYLE[b.id]}</p>
      </div>
      <div
        key={active}
        className="flex flex-wrap items-start justify-center gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        {summoner && <SummonerCardView s={summoner} />}
        {units.map((u) => (
          <UnitCardView key={u.id} u={u} />
        ))}
      </div>
    </div>
  );
}
