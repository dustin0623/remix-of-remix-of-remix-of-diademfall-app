/** Browser-safe shapes exchanged between the play screen and the game server functions. */
export interface SessionHero {
  id: string;
  /** Random id, e.g. hero_a8f3b9c1d0e4. */
  /** @deprecated unused; kept for the game engine. */
  mintedNumber?: number;
  name: string;
  /** Sprite kind; always equal to name. */
  type: string;
  level?: number;
  rarity: string;
  power: number;
  speed: number;
  stamina: number;
  bombNumber: number;
  bombRange: number;
  maxEnergy: number;
  /** Skill ids rolled at mint (see heroes/skills.ts). */
  skills?: string[];
  /** Live state, persisted server-side in the heroes table. */
  energy?: number;
  onMap?: boolean;
  recoveryAt?: number;
  /** Marketplace: listed heroes cannot be deployed. */
  listed?: boolean;
  marketPrice?: number | undefined;
  /** Registered house the hero rests in; such heroes can't be deployed. */
  houseId?: string | undefined;
  houseRarity?: string | undefined;
  /** Soft-burned by fusion: kept for provenance, never playable. Mock/Test UI only — the server never returns burned heroes. */
  burned?: boolean;
}

export interface PlayerSession {
  playerId: string;
  /** Single-session lock: only the newest opened game may save. */
  sessionToken?: string;
  coins: number;
  stage: number;
  seed: number;
  destroyedNodes: string[];
  damagedNodes?: Record<string, number>;
  heroes: SessionHero[];
}

export interface SyncResult {
  ok: boolean;
  coins: number;
  stage: number;
  seed: number;
  destroyedNodes: string[];
  damagedNodes?: Record<string, number>;
  conflict?: boolean;
  accepted: number;
  rejected: number;
}
