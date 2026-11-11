import { canDeployEnergy } from "@/lib/config/constants/game";
import { energyAfterRest } from "@/lib/game/dungeon/rules";

export interface StoredHeroState {
  id: string;
  energy: number;
  maxEnergy: number;
  rarity: string;
  skills: string[];
  onMap: boolean;
  recoveryAt: number;
  /** Extra rest energy per hour from the house the hero sleeps in (0 if none). */
  houseBonusPerHour?: number;
}

export interface ClaimedHeroState {
  id: string;
  energy: number;
  onMap: boolean;
  recoveryAt: number;
}

/**
 * Server-side ceiling for a reported hero state. Energy can never exceed what
 * the last saved state allows: a working hero only loses energy, a resting
 * hero regains at most the rest rate (plus its house bonus) since its saved
 * rest stamp. Heroes in a house can't be deployed; deploying needs the usual
 * minimum energy; future rest stamps are clamped.
 */
export function clampHeroState(stored: StoredHeroState, claimed: ClaimedHeroState, now: number): ClaimedHeroState {
  const inHouse = (stored.houseBonusPerHour ?? 0) > 0;
  const ceiling = stored.onMap
    ? stored.energy
    : energyAfterRest(
        stored.energy,
        stored.maxEnergy,
        now - stored.recoveryAt,
        stored.skills.includes("quick_rest"),
        stored.houseBonusPerHour ?? 0,
      );
  const energy = Math.max(0, Math.floor(Math.min(claimed.energy, ceiling, stored.maxEnergy)));
  let onMap = claimed.onMap && energy >= 1 && !inHouse;
  if (onMap && !stored.onMap && !canDeployEnergy(energy, stored.maxEnergy)) onMap = false;
  return { id: stored.id, energy, onMap, recoveryAt: Math.min(Math.round(claimed.recoveryAt), now) };
}
