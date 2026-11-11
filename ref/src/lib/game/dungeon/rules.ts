import { ENERGY_RECOVERY_PER_HOUR } from "@/lib/config/constants/game";
import { QUICK_REST_MULTIPLIER } from "@/lib/game/heroes/skills";
import type { GameHero, GameState } from "./types";

export const BOMB_FUSE_MS = 2000;
export const movementSpeed = (stat: number) => 5 + stat * 0.6;
export const utcDate = (now: number) => new Date(now).toISOString().slice(0, 10);

/**
 * Energy after resting `elapsedMs` at the flat hourly rate plus any house
 * bonus (Quick Rest multiplies the total), capped at max.
 */
export function energyAfterRest(
  energy: number,
  maxEnergy: number,
  elapsedMs: number,
  quickRest = false,
  houseBonusPerHour = 0,
): number {
  const perHour = (ENERGY_RECOVERY_PER_HOUR + Math.max(0, houseBonusPerHour)) * (quickRest ? QUICK_REST_MULTIPLIER : 1);
  return Math.min(maxEnergy, energy + (perHour * Math.max(0, elapsedMs)) / 3_600_000);
}

export function recoverEnergy(hero: GameHero, now: number, hasBombs: boolean): void {
  if (hero.onMap || hasBombs) return;
  hero.energy = energyAfterRest(hero.energy, hero.maxEnergy, now - hero.recoveryAt, !!hero.skills?.includes("quick_rest"));
  hero.recoveryAt = now;
}

export function materializeRecovery(state: GameState, now: number): void {
  for (const hero of Object.values(state.heroes)) {
    recoverEnergy(
      hero,
      now,
      Object.values(state.bombs).some((bomb) => bomb.heroId === hero.id),
    );
  }
}
