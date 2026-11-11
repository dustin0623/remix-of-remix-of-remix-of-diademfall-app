import { canDeployEnergy } from "@/lib/config/constants/game";

/** Energy as a 0-100 percentage; heroes without a live value count as full. */
export function energyPct(energy: number | undefined, maxEnergy: number): number {
  if (maxEnergy <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((energy ?? maxEnergy) / maxEnergy) * 100)));
}

/** Number color matching the progress-bar thresholds. */
export function energyColorClass(pct: number): string {
  if (pct <= 20) return "text-destructive";
  if (pct <= 50) return "text-warning";
  return "text-success";
}

/** Same thresholds as energyColorClass, as a CSS custom-property reference. */
export function energyColorVar(pct: number): string {
  if (pct <= 20) return "var(--destructive)";
  if (pct <= 50) return "var(--warning)";
  return "var(--success)";
}


/** Progress-bar fill color, same thresholds as energyColorClass. */
export function energyBarClass(pct: number): string {
  if (pct <= 20) return "bg-destructive";
  if (pct <= 50) return "bg-warning";
  return "bg-success";
}

export interface HeroStatus {
  letter: "W" | "R" | "S";
  label: string;
  className: string;
}

/**
 * One-letter status shown beside the rarity badge:
 * W = working (on the map), S = sleeping (depleted), R = resting or ready.
 */
export function heroStatus(hero: { onMap?: boolean; energy?: number; maxEnergy: number }): HeroStatus {
  if (hero.onMap) return { letter: "W", label: "Working", className: "text-success" };
  const energy = hero.energy ?? hero.maxEnergy;
  if (energy < 1) return { letter: "S", label: "Sleeping", className: "text-destructive" };
  if (!canDeployEnergy(energy, hero.maxEnergy)) return { letter: "R", label: "Resting", className: "text-warning" };
  return { letter: "R", label: "Ready", className: "text-warning" };
}
