import { CardFace, StatIcon } from "./CardFace";
import { AbilityIcon } from "./AbilityIcon";
import type { ReactNode } from "react";
import { ABILITIES } from "@/game/catalog/abilities";
import type { SummonerDefinition } from "@/game/catalog/types";
import type { UnitCard } from "@/game/units";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

export function AbilityChip({ id }: { id: string }) {
  const a = ABILITY_BY_ID[id];
  if (!a) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex cursor-help items-center gap-1 rounded border border-border bg-background/80 pr-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
          >
            <AbilityIcon id={id} decorative className="size-7" />
            {a.name}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <strong>{a.name}</strong>
          <p>{a.mechanics}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Stat({ icon, value, className }: { icon: ReactNode; value: number; className: string }) {
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-bold", className)}>
      {icon}
      {value}
    </span>
  );
}

export function UnitStats({
  u,
}: {
  u: Pick<UnitCard, "steel" | "shot" | "spell" | "armor" | "health" | "speed">;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {u.steel > 0 && (
        <Stat
          icon={<StatIcon stat="steel" className="size-3.5" />}
          value={u.steel}
          className="text-stat-steel"
        />
      )}
      {u.shot > 0 && (
        <Stat
          icon={<StatIcon stat="shot" className="size-3.5" />}
          value={u.shot}
          className="text-stat-shot"
        />
      )}
      {u.spell > 0 && (
        <Stat
          icon={<StatIcon stat="spell" className="size-3.5" />}
          value={u.spell}
          className="text-stat-spell"
        />
      )}
      {u.armor > 0 && (
        <Stat
          icon={<StatIcon stat="armor" className="size-3.5" />}
          value={u.armor}
          className="text-stat-armor"
        />
      )}
      <Stat
        icon={<StatIcon stat="health" className="size-3.5" />}
        value={u.health}
        className="text-stat-health"
      />
      <Stat
        icon={<StatIcon stat="speed" className="size-3.5" />}
        value={u.speed}
        className="text-stat-speed"
      />
    </div>
  );
}

function Frame({
  children,
  onClick,
  selected,
  disabled,
  size = "md",
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        "game-card group relative block shrink-0 bg-transparent text-left transition",
        size === "sm" ? "w-36" : "w-44",
        onClick && !disabled && "hover:-translate-y-1 hover:shadow-glow",
        selected && "ring-2 ring-primary shadow-glow",
        disabled && "opacity-40 grayscale",
      )}
    >
      {children}
    </button>
  );
}

export function UnitCardView({
  u,
  manaOverride,
  ...rest
}: {
  u: UnitCard;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  manaOverride?: number;
  size?: "sm" | "md";
}) {
  return (
    <Frame {...rest} label={u.name + ", " + u.rarity + ", level " + (u.level ?? 1)}>
      <CardFace card={u} unit={u} mana={manaOverride ?? u.mana} />
    </Frame>
  );
}

export function summonerEffectText(s: Pick<SummonerDefinition, "effects">) {
  return s.effects.map((e) => {
    const who = e.target === "all_allies" ? "Allies" : e.target === "all_enemies" ? "Enemies" : e.target.replace(/_/g, " ");
    if (e.stat === "magicResistance") return "Allies take 1 less magic damage";
    if (e.kind === "grantAbility")
      return `${who}: gain ${ABILITY_BY_ID[e.abilityId!]?.name ?? e.abilityId}`;
    const sign = (e.value ?? 0) > 0 ? "+" : "";
    const label = ({ steel: "melee damage", shot: "ranged damage", spell: "magic damage", health: "health", armor: "armor", speed: "speed" } as Record<string,string>)[e.stat ?? ""] ?? e.stat;
    return `${who}: ${sign}${e.value} ${label}`;
  });
}

export function SummonerCardView({
  s,
  manaOverride,
  ...rest
}: {
  s: SummonerDefinition;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  manaOverride?: number;
  size?: "sm" | "md";
}) {
  return (
    <Frame {...rest} label={s.name + ", " + s.rarity + " commander"}>
      <CardFace
        card={s}
        mana={manaOverride ?? s.mana}
        effects={s.effects}
        effectText={summonerEffectText(s)}
      />
    </Frame>
  );
}
