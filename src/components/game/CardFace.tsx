import { ABILITIES } from "@/game/catalog/abilities";
import type { UnitCard } from "@/game/units";
import type { SummonerEffect } from "@/game/catalog/types";
import { BANNER_BY_ID } from "@/game/banners";
import { regularCardArt } from "@/lib/card-art";
import { AbilityTooltip, TroopAbilityTooltip } from "./AbilityTooltip";

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
          <span className="card-face-vitals">
            <CardStat stat="speed" value={unit.speed} />
            {unit.armor > 0 && <CardStat stat="armor" value={unit.armor} />}
            <CardStat stat="health" value={unit.health} />
          </span>
          <span className="card-face-attacks">
            {attackStats.map((stat) => (
              <CardStat stat={stat} value={unit[stat]} key={stat} />
            ))}
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
        ) : null}
        <span className="card-face-abilities" aria-label="Abilities">
          {!unit &&
            effects.map((effect, index) => {
              if (effect.kind !== "stat" || !effect.stat || effect.value === undefined) return null;
              const ward = effect.stat === "magicResistance";
              const stat = ward ? "armor" : effect.stat;
              if (!(stat in STAT_LABELS)) return null;
              const value = ward ? -effect.value : effect.value;
              const description =
                effectText[index] ??
                `${effect.target === "all_enemies" ? "Enemies" : "Allies"}: ${value > 0 ? "+" : ""}${value} ${STAT_LABELS[stat as CardStatId]}`;
              return (
                <AbilityTooltip
                  key={index}
                  title={
                    ward
                      ? "Magic Ward"
                      : `${STAT_LABELS[stat as CardStatId]} ${effect.target === "all_enemies" ? "Reduction" : "Boost"}`
                  }
                  description={description}
                  label={description}
                  target={effect.target}
                  className="card-face-command-effect"
                  icon={
                    <span className="card-face-command-icon">
                      <StatIcon stat={stat as CardStatId} />
                      {ward && <StatIcon stat="spell" className="card-face-command-ward" />}
                    </span>
                  }
                >
                  <span className="card-face-command-icon" aria-hidden="true">
                    <StatIcon stat={stat as CardStatId} />
                    {ward && <StatIcon stat="spell" className="card-face-command-ward" />}
                  </span>
                  <strong aria-hidden="true">
                    {value > 0 ? "+" : "−"}
                    {Math.abs(value)}
                  </strong>
                </AbilityTooltip>
              );
            })}
          {abilities.map((id) => {
            const ability = ABILITIES.find((a) => a.id === id);
            if (!ability) return null;
            return <TroopAbilityTooltip key={id} id={id} className="card-face-ability" />;
          })}
        </span>
      </div>
    </div>
  );
}
