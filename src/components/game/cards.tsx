import { Crosshair, Heart, Shield, Sparkles, Sword, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { ABILITIES } from "@/game/catalog/abilities";
import type { SummonerDefinition } from "@/game/catalog/types";
import { BANNER_BY_ID } from "@/game/banners";
import type { UnitCard } from "@/game/units";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { regularCardArt } from "@/lib/card-art";

export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

const rarityVar: Record<string, string> = {
  common: "var(--rarity-common)", uncommon: "var(--rarity-uncommon)", rare: "var(--rarity-rare)", epic: "var(--rarity-epic)", legendary: "var(--rarity-legendary)",
};

export function AbilityChip({ id }: { id: string }) {
  const a = ABILITY_BY_ID[id];
  if (!a) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help rounded border border-border bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {a.name}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{a.mechanics}</TooltipContent>
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

export function UnitStats({ u }: { u: Pick<UnitCard, "steel" | "shot" | "spell" | "armor" | "health" | "speed"> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {u.steel > 0 && <Stat icon={<Sword className="size-3" />} value={u.steel} className="text-stat-steel" />}
      {u.shot > 0 && <Stat icon={<Crosshair className="size-3" />} value={u.shot} className="text-stat-shot" />}
      {u.spell > 0 && <Stat icon={<Sparkles className="size-3" />} value={u.spell} className="text-stat-spell" />}
      {u.armor > 0 && <Stat icon={<Shield className="size-3" />} value={u.armor} className="text-stat-armor" />}
      <Stat icon={<Heart className="size-3" />} value={u.health} className="text-stat-health" />
      <Stat icon={<Zap className="size-3" />} value={u.speed} className="text-stat-speed" />
    </div>
  );
}

function Frame({ rarity, banner, art, crop, mana, children, onClick, selected, disabled, size = "md" }: {
  rarity: string; banner: string; art: string; crop?: string; mana: number; children: ReactNode;
  onClick?: () => void; selected?: boolean; disabled?: boolean; size?: "sm" | "md";
}) {
  const b = BANNER_BY_ID[banner as keyof typeof BANNER_BY_ID];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border-2 bg-card text-left transition",
        size === "sm" ? "w-36" : "w-44",
        onClick && !disabled && "hover:-translate-y-1 hover:shadow-glow",
        selected && "ring-2 ring-primary shadow-glow",
        disabled && "opacity-40 grayscale",
      )}
      style={{ borderColor: rarityVar[rarity] }}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img src={art} alt="" loading="lazy" width={768} height={1024} className="h-full w-full object-cover transition group-hover:scale-105" style={{ objectPosition: crop ?? "50% 25%" }} />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card to-transparent" />
        <span className="absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-gold font-display text-sm font-black text-primary-foreground shadow">{mana}</span>
        <span className="absolute right-1.5 top-1.5 size-3 rounded-full border border-background" style={{ background: b?.color ?? "var(--color-muted-foreground)" }} title={b?.name ?? "Wayfarer"} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">{children}</div>
    </button>
  );
}

export function UnitCardView({ u, ...rest }: { u: UnitCard; onClick?: () => void; selected?: boolean; disabled?: boolean; manaOverride?: number; size?: "sm" | "md" }) {
  return (
    <Frame rarity={u.rarity} banner={u.banner ?? "wayfarer"} art={regularCardArt(u)} crop="50% 20%" mana={rest.manaOverride ?? u.mana} {...rest}>
      <div className="font-display text-[13px] font-bold leading-tight text-foreground">{u.name}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{u.banner ? "" : "Wayfarer · "}{u.set} · {u.rarity}</div>
      <UnitStats u={u} />
      {u.abilities.length > 0 && <div className="flex flex-wrap gap-1">{u.abilities.map((a) => <AbilityChip key={a} id={a} />)}</div>}
    </Frame>
  );
}

export function summonerEffectText(s: SummonerDefinition) {
  return s.effects.map((e) => {
    const who = e.target.replace(/_/g, " ");
    if (e.kind === "grantAbility") return `${who}: gain ${ABILITY_BY_ID[e.abilityId!]?.name ?? e.abilityId}`;
    const sign = (e.value ?? 0) > 0 ? "+" : "";
    return `${who}: ${sign}${e.value} ${e.stat}${e.condition ? ` (${e.condition.replace(/([A-Z0-9]+)/g, " $1").toLowerCase()})` : ""}`;
  });
}

export function SummonerCardView({ s, ...rest }: { s: SummonerDefinition; onClick?: () => void; selected?: boolean; disabled?: boolean; manaOverride?: number; size?: "sm" | "md" }) {
  return (
    <Frame rarity={s.rarity} banner={s.banner} art={regularCardArt(s)} crop="50% 20%" mana={rest.manaOverride ?? s.mana} {...rest}>
      <div className="font-display text-[13px] font-bold leading-tight text-foreground">{s.name}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Summoner · {s.set} · {s.rarity}</div>
      <ul className="space-y-0.5 text-[11px] text-foreground/90">
        {summonerEffectText(s).map((t) => <li key={t}>• {t}</li>)}
      </ul>
    </Frame>
  );
}
