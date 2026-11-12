import { ABILITIES } from "@/game/catalog/abilities";
import type { UnitCard } from "@/game/units";
import type { SummonerEffect } from "@/game/catalog/types";
import { BANNER_BY_ID } from "@/game/banners";
import { regularCardArt } from "@/lib/card-art";
import { AbilityIcon } from "./AbilityIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type CardStatId = "mana" | "health" | "armor" | "speed" | "steel" | "shot" | "spell";
const STAT_LABELS: Record<CardStatId, string> = {
  mana: "Mana",
  health: "Health",
  armor: "Armor",
  speed: "Speed",
  steel: "Melee",
  shot: "Ranged",
  spell: "Magic",
};
export function StatIcon({ stat, className }: { stat: CardStatId; className?: string }) {
  return (
    <img
      src={"/assets/stats/" + stat + ".png"}
      width={96}
      height={96}
      alt=""
      className={className}
      loading="lazy"
    />
  );
}
function CardStat({
  stat,
  value,
  className,
}: {
  stat: CardStatId;
  value: number;
  className?: string;
}) {
  return (
    <span
      className={"card-face-stat " + (className ?? "")}
      data-stat={stat}
      role="img"
      aria-label={STAT_LABELS[stat] + ": " + value}
    >
      <StatIcon stat={stat} />
      <strong aria-hidden="true">{value}</strong>
    </span>
  );
}
type FaceCard = {
  id: string;
  name: string;
  banner: UnitCard["banner"];
  rarity: string;
  mana: number;
  cardType?: string;
};
export function CardFace({
  card,
  unit,
  mana,
  effects = [],
  effectText = [],
}: {
  card: FaceCard;
  unit?: UnitCard;
  mana: number;
  effects?: SummonerEffect[];
  effectText?: string[];
}) {
  const banner = card.banner ?? "wayfarer";
  const kind = card.cardType === "summoner" ? "summoner" : "normal";
  const portrait =
    "/assets/raw/portraits/" + banner + "/" + card.rarity + "/" + kind + "/" + card.id + ".png";
  const abilities = unit?.abilities ?? [
    ...new Set(effects.flatMap((e) => (e.abilityId ? [e.abilityId] : []))),
  ];
  const faction = card.banner ? BANNER_BY_ID[card.banner].name : "Wayfarer";
  const attackStats = unit
    ? (["steel", "shot", "spell"] as const).filter((stat) => unit[stat] > 0)
    : [];
  return (
    <div className="card-face" data-rarity={card.rarity}>
      <img
        className="card-face-layer card-face-interior"
        src={"/assets/raw/frames-background/" + banner + ".png"}
        width={300}
        height={420}
        alt=""
        loading="lazy"
      />
      <img
        className="card-face-layer card-face-portrait card-face-interior"
        src={portrait}
        width={300}
        height={420}
        alt=""
        loading="lazy"
        onError={(e) => {
          const fallback = regularCardArt(card);
          if (e.currentTarget.dataset["fallback"] !== "true") {
            e.currentTarget.dataset["fallback"] = "true";
            e.currentTarget.src = fallback;
          }
        }}
      />
      <span className="card-face-shade" />
      <img
        className="card-face-layer card-face-frame"
        src={"/assets/raw/frames/" + card.rarity + ".png"}
        width={300}
        height={420}
        alt=""
        loading="lazy"
      />
      <img
        className="card-face-crest"
        src={"/assets/banners/crests/" + banner + ".png"}
        width={96}
        height={96}
        alt={faction + " crest"}
        loading="lazy"
      />
      <CardStat stat="mana" value={mana} className="card-face-mana" />
      {unit && (
        <>
          <span className="card-face-attacks">
            {attackStats.map((stat) => (
              <CardStat stat={stat} value={unit[stat]} key={stat} />
            ))}
          </span>
          <span className="card-face-vitals">
            {unit.armor > 0 && <CardStat stat="armor" value={unit.armor} />}
            <CardStat stat="health" value={unit.health} />
            <CardStat stat="speed" value={unit.speed} />
          </span>
        </>
      )}
      <strong className="card-face-name">{card.name}</strong>
      <div className="card-face-footer">
        {unit ? (
          <span className="card-face-level" aria-label={"Level " + (unit.level ?? 1)}>
            <span />
            {unit.level ?? 1}
          </span>
        ) : (
          <span className="card-face-effects" title={effectText.join("\n")}>
            {effectText.slice(0, 2).map((text) => (
              <span key={text}>{text}</span>
            ))}
          </span>
        )}
        <span className="card-face-abilities" aria-label="Abilities">
          <TooltipProvider delayDuration={150}>
            {abilities.map((id) => {
              const ability = ABILITIES.find((a) => a.id === id);
              if (!ability) return null;
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <span role="img" aria-label={ability.name} className="card-face-ability">
                      <AbilityIcon id={id} decorative />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <strong>{ability.name}</strong>
                    <p>{ability.mechanics}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </span>
      </div>
    </div>
  );
}
