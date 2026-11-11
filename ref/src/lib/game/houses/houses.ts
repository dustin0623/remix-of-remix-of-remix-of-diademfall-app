/**
 * House tiers. Houses are XRPL NFTs a player registers in the game; heroes
 * resting inside get the house's bonus on top of the flat rest rate.
 * Browser-safe: shared by the client sim, the UI and the server clamp.
 */
export type HouseRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface HouseTier {
  rarity: HouseRarity;
  name: string;
  /** How many heroes can rest inside at once. */
  slots: number;
  /** Extra energy per hour on top of ENERGY_RECOVERY_PER_HOUR. */
  bonusPerHour: number;
}

export const HOUSE_TIERS: Record<HouseRarity, HouseTier> = {
  common: { rarity: "common", name: "Tiny House", slots: 1, bonusPerHour: 15 },
  uncommon: { rarity: "uncommon", name: "Mini House", slots: 2, bonusPerHour: 30 },
  rare: { rarity: "rare", name: "Luxury House", slots: 5, bonusPerHour: 60 },
  epic: { rarity: "epic", name: "Mansion", slots: 8, bonusPerHour: 90 },
  legendary: { rarity: "legendary", name: "Villa", slots: 14, bonusPerHour: 120 },
};

export const HOUSE_RARITIES = Object.keys(HOUSE_TIERS) as HouseRarity[];

export const isHouseRarity = (v: unknown): v is HouseRarity =>
  typeof v === "string" && v in HOUSE_TIERS;

/** Demo NFT id per tier until real XRPL NFT verification is wired. */
export const demoNftId = (playerId: string, rarity: HouseRarity) => `demo-${rarity}-${playerId}`;

export const houseBonusFor = (rarity: string | null | undefined): number =>
  rarity && isHouseRarity(rarity) ? HOUSE_TIERS[rarity].bonusPerHour : 0;

export interface PlayerHouse {
  id: string;
  nftId: string;
  rarity: HouseRarity;
  isDemo: boolean;
  registeredAt: string;
}
