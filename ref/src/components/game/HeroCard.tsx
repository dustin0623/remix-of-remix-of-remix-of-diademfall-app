import type { ReactNode } from "react";
import { Heart } from "lucide-react";
import { HeroArtwork } from "@/components/game/HeroArtwork";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SkillTooltipContent } from "./SkillTooltipContent";
import type { SessionHero } from "@/lib/game/session/types";
import { HERO_STATS, HeroStatIcon } from "./HeroStatIcon";
import { cn } from "@/lib/utils";
import { SKILL_INFO, type SkillId } from "@/lib/game/heroes/skills";
import { energyBarClass, energyColorClass, energyPct, heroStatus } from "@/lib/game/heroes/display";
const heavyImpact = "/game/skills/heavy_impact.webp";
const staminaSaver = "/game/skills/stamina_saver.webp";
const quickRest = "/game/skills/quick_rest.webp";
const pierce = "/game/skills/pierce.webp";
const sprint = "/game/skills/sprint.webp";

export const SKILL_ICONS: Record<SkillId, string> = {
  heavy_impact: heavyImpact,
  stamina_saver: staminaSaver,
  quick_rest: quickRest,
  pierce,
  sprint,
};

/** Static class sets per rarity (kept literal so Tailwind keeps them). */
const COMMON_RARITY = {
  ring: "ring-rarity-common/40",
  bg: "bg-rarity-common/15",
  text: "text-rarity-common",
  border: "border-rarity-common/40",
};
const RARITY: Record<string, { ring: string; bg: string; text: string; border: string }> = {
  common: COMMON_RARITY,
  uncommon: {
    ring: "ring-rarity-uncommon/40",
    bg: "bg-rarity-uncommon/15",
    text: "text-rarity-uncommon",
    border: "border-rarity-uncommon/40",
  },
  rare: {
    ring: "ring-rarity-rare/40",
    bg: "bg-rarity-rare/15",
    text: "text-rarity-rare",
    border: "border-rarity-rare/40",
  },
  epic: {
    ring: "ring-rarity-epic/40",
    bg: "bg-rarity-epic/15",
    text: "text-rarity-epic",
    border: "border-rarity-epic/40",
  },
  legendary: {
    ring: "ring-rarity-legendary/50",
    bg: "bg-rarity-legendary/15",
    text: "text-rarity-legendary",
    border: "border-rarity-legendary/40",
  },
};

export function rarityClasses(rarity: string) {
  return RARITY[rarity] ?? COMMON_RARITY;
}

/** Energy progress bar. Only the live game (heroes drawer) renders it. */
export function EnergyBar({ pct }: { pct: number }) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded bg-muted"
      role="progressbar"
      aria-label={`Energy ${pct}%`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full transition-all", energyBarClass(pct))}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Hero card styled after the Chainframe equipment card: rarity rim, icon tile, badges and stat chips. */
export function HeroCard({
  hero,
  footer,
  children,
}: {
  hero: SessionHero;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const r = rarityClasses(hero.rarity);
  const pct = energyPct(hero.energy, hero.maxEnergy);
  const st = heroStatus(hero);
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card/80 p-4 shadow-sm ring-1 ring-inset backdrop-blur-md transition-transform hover:-translate-y-1",
        r.ring,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid w-16 shrink-0 place-items-center",
          )}
        >
          <HeroArtwork hero={hero} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-sm font-semibold">
            {hero.name.replace(/\s*#\d+\s*$/, "").trim()}
            <span className="ml-1.5 text-[10px] font-bold text-muted-foreground">
              Lv. {hero.level ?? 1}
            </span>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                r.border,
                r.text,
              )}
            >
              {hero.rarity}
            </span>
            {hero.houseId ? (
              <span
                title="Resting in a house"
                className="rounded-md border border-accent/60 bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground"
              >
                House
              </span>
            ) : hero.listed ? (
              <span
                title="Listed on the marketplace"
                className="rounded-md border border-primary/60 bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary"
              >
                Listed
              </span>
            ) : (
              <span
                title={st.label}
                aria-label={st.label}
                className={cn(
                  "rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-bold",
                  st.className,
                )}
              >
                {st.letter}
              </span>
            )}
          </div>
        </div>
        {!!hero.skills?.length && (
          <TooltipProvider delayDuration={150}>
            <div className="grid shrink-0 grid-cols-2 gap-1.5" aria-label="Hero skills">
              {hero.skills
                .filter((id): id is SkillId => Object.hasOwn(SKILL_INFO, id))
                .map((id) => (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={SKILL_INFO[id].name}
                        className="size-8 rounded-md bg-secondary/40 p-1"
                      >
                        <img
                          src={SKILL_ICONS[id]}
                          alt=""
                          width={24}
                          height={24}
                          loading="lazy"
                          className="size-6 object-contain [image-rendering:pixelated]"
                        />
                      </Button>
                    </TooltipTrigger>
                    <SkillTooltipContent id={id} icon={SKILL_ICONS[id]} />
                  </Tooltip>
                ))}
            </div>
          </TooltipProvider>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
        {HERO_STATS.map(({ index, key, label }) => (
          <span
            key={key}
            title={label}
            aria-label={`${label}: ${hero[key]}`}
            className="inline-flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md bg-secondary/60 px-1.5 py-1"
          >
            <HeroStatIcon index={index} size={20} />
            <span aria-hidden="true" className="font-semibold text-success">
              {hero[key]}
            </span>
          </span>
        ))}
        <span
          title="Energy"
          className="inline-flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md bg-secondary/60 px-1.5 py-1"
        >
          <Heart className="size-3 shrink-0 text-muted-foreground" />
          <span className={cn("font-semibold", energyColorClass(pct))}>
            {Math.floor(hero.energy ?? hero.maxEnergy)}/{hero.maxEnergy}
          </span>
        </span>
      </div>
      {children}
      {footer && <div className="mt-auto flex gap-2">{footer}</div>}
    </article>
  );
}
