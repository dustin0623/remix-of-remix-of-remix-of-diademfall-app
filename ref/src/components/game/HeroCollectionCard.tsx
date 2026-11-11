import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { SKILL_ICONS } from "./HeroCard";
import { HERO_STATS, HeroStatIcon } from "./HeroStatIcon";
import { SKILL_INFO, type SkillId } from "@/lib/game/heroes/skills";
import { energyColorVar, energyPct } from "@/lib/game/heroes/display";
import { HeroArtwork } from "./HeroArtwork";
import type { SessionHero } from "@/lib/game/session/types";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SkillTooltip } from "./SkillTooltipContent";


const RARITIES = new Set(["common", "uncommon", "rare", "epic", "legendary"]);
const cardRarity = (rarity: string) => (RARITIES.has(rarity) ? rarity : "common");

export function HeroPortrait({ hero, large = false }: { hero: SessionHero; large?: boolean }) {
  return (
    <div className={cn("hc-portrait", large && "hc-portrait-large")}>
      <HeroArtwork hero={hero} />
    </div>
  );
}

export function HeroEnergy({ hero, className }: { hero: SessionHero; className?: string }) {
  const energy = Math.floor(hero.energy ?? hero.maxEnergy);
  const pct = energyPct(energy, hero.maxEnergy);
  return (
    <span
      className={cn("hc-energy", className)}
      style={{ "--hc-energy-color": energyColorVar(pct) } as CSSProperties}
      title="Energy"
      aria-label={`Energy: ${energy} of ${hero.maxEnergy}`}
    >
      <strong>
        {energy}/{hero.maxEnergy}
      </strong>
    </span>
  );
}

export function HeroStats({ hero, showEnergy = true }: { hero: SessionHero; showEnergy?: boolean }) {
  return (
    <div className="hc-stats">
      {HERO_STATS.map(({ index, key, label }) => (
        <span key={key} title={label} aria-label={`${label}: ${hero[key]}`}>
          <HeroStatIcon index={index} size={14} />
          <span className="hc-stat-label" aria-hidden="true">
            {key === "bombNumber"
              ? "BOMBS"
              : key === "bombRange"
                ? "RNG"
                : label.slice(0, 3).toUpperCase()}
          </span>
          <strong>{hero[key]}</strong>
        </span>
      ))}
      {showEnergy && <HeroEnergy hero={hero} />}
    </div>
  );
}


export function HeroCollectionCard({
  hero,
  selected,
  onSelect,
  popoverOpen,
}: {
  hero: SessionHero;
  selected: boolean;
  onSelect: () => void;
  popoverOpen?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      className="hc-card"
      data-rarity={cardRarity(hero.rarity)}
      aria-pressed={selected}
      aria-label={`Select ${hero.name}`}
      aria-haspopup={popoverOpen === undefined ? undefined : "dialog"}
      aria-expanded={popoverOpen}
      onClick={onSelect}
    >
      <HeroCardFace hero={hero} />
    </Button>
  );
}

/** Shared card face (artwork, status, edge stats, skills, name, level, energy) for collection cards and summon reveals. */
export function HeroCardFace({ hero, showFlag = true }: { hero: SessionHero; showFlag?: boolean }) {
  const energy = Math.floor(hero.energy ?? hero.maxEnergy);
  const flag = hero.houseId
    ? { key: "h", letter: "H", label: "In House" }
    : hero.onMap
      ? { key: "w", letter: "W", label: "Working" }
      : energy >= hero.maxEnergy
        ? { key: "i", letter: "I", label: "Idle" }
        : { key: "r", letter: "R", label: "Resting" };
  return (
    <>
      <HeroArtwork hero={hero} className="hc-card-artwork" />
      {showFlag && <span className={cn("hc-flag", `hc-flag-${flag.key}`)}>{flag.label}</span>}
      <span className="hc-card-edge-stats">
        {HERO_STATS.map(({ index, key, label }) => (
          <span key={key} className={`hc-card-edge-stat hc-card-edge-stat-${key}`} title={`${label}: ${hero[key]}`} aria-label={`${label}: ${hero[key]}`}>
            <HeroStatIcon index={index} />
            <strong>{hero[key]}</strong>
          </span>
        ))}
      </span>
      <span className="hc-card-skills" aria-label="Hero skills">
        <TooltipProvider delayDuration={150}>
        {((hero.skills ?? []) as SkillId[]).slice(0, 4).map((id, i) => (
          SKILL_ICONS[id] && SKILL_INFO[id] && <SkillTooltip key={`${id}-${i}`} id={id} icon={SKILL_ICONS[id]} />
        ))}
        </TooltipProvider>
      </span>
      <span className="hc-card-info">
        <span className="hc-card-title">
          <strong className="hc-card-name">{hero.name.replace(/\s*#\d+\s*$/, "").trim()}</strong>
          <span className="hc-card-level">Lv. {hero.level ?? 1}</span>
        </span>
        <span
          className="hc-card-energybar"
          role="progressbar"
          aria-label={`Energy: ${energy} of ${hero.maxEnergy}`}
          aria-valuenow={energy}
          aria-valuemin={0}
          aria-valuemax={hero.maxEnergy}
          style={{ "--hc-energy-color": energyColorVar(energyPct(energy, hero.maxEnergy)) } as CSSProperties}
        >
          <span className="hc-card-energyfill" style={{ width: `${energyPct(energy, hero.maxEnergy)}%` }} />
        </span>
      </span>
    </>
  );
}
