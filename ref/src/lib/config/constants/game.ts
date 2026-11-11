/**
 * Shared game constants — safe to import from both server routes and
 * 'use client' modules. No React, no Zustand, no browser globals.
 */

/** $BMCOIN cost per minted hero. */
export const MINT_COST = 100_000;

/** Maximum number of heroes a player can have on the map at once. */
export const MAX_ON_MAP = 10;

/** Energy points per 1 Stamina attribute point (BombCrypto-style pool). */
export const ENERGY_PER_STAMINA = 50;

/**
 * Flat natural rest recovery, the same for every rarity (BombCrypto model):
 * 50 energy per hour. Because max energy = stamina × 50, a full natural
 * rest takes one hour per stamina point (5 stamina = 5 hours).
 * Houses add bonus recovery on top.
 */
export const ENERGY_RECOVERY_PER_HOUR = 50;

export function maxEnergyFor(stamina: number): number {
  return stamina * ENERGY_PER_STAMINA;
}

/**
 * Minimum energy (as a fraction of a hero's max) required to deploy it.
 * A recalled or slept hero must recover to at least this level before it can
 * be sent back onto the map — a hero at 0 energy must wait until it regens to
 * 50% before it's deployable again.
 */
export const MIN_DEPLOY_ENERGY_FRACTION = 0.5;

/** Absolute energy a hero needs before it can be deployed. */
export function minDeployEnergyFor(maxEnergy: number): number {
  return Math.ceil(maxEnergy * MIN_DEPLOY_ENERGY_FRACTION);
}

/** Whether a hero currently has enough energy to be deployed. */
export function canDeployEnergy(currentEnergy: number, maxEnergy: number): boolean {
  return currentEnergy >= minDeployEnergyFor(maxEnergy);
}
