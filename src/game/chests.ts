/**
 * Division advancement chests (docs/diademfall-complete-v6/ranked) — odds and the public, verifiable roll.
 * Each chest commits to a hidden server seed when it is granted; opening combines it with the player's seed.
 * Roll i hash = sha256("{serverSeed}:{clientSeed}:{chestId}:{i}"):
 *   hex[0..8] outcome (card / Coin shares / Credits), hex[8..16] rarity or value, hex[16..24] card,
 *   hex[24..32] Gold foil, hex[32..40] roll-up rarity when the rolled rarity is used up in the reserve.
 * Cards come only from the Legionnaire reward reserve (counts per rarity). A depleted rarity rolls up to a
 * remaining higher rarity; with none left the roll becomes the chest's median Coin-share result.
 */
import { RANKED_CONFIG } from "./catalog/ranked-divisions";
import type { ChestType } from "./divisions";
import { openPack, PACK_POOLS_BY_ALGORITHM, RARITY_ORDER, type Foil, type PackCard, type Rarity } from "./packs";
import { sha256Hex } from "./sha256";

export const CHEST_ALGORITHM = "diademfall-chest-v1";

interface Weighted { weight: number; value: number }
export interface ChestDef {
  id: ChestType;
  name: string;
  rolls: number;
  outcomes: { legionnaireCard: number; coinShares: number; credits: number };
  coinShares: Weighted[];
  credits: Weighted[];
  cardRarity: Record<Rarity, number>;
  goldFoilChancePercent: number;
}
export const CHESTS = Object.fromEntries(RANKED_CONFIG.chests.map((c) => [c.id, c as unknown as ChestDef])) as Record<ChestType, ChestDef>;
export const CHEST_TYPES: ChestType[] = ["scout", "war", "crown"];

/** Reward cards: the Legionnaire pack pool by rarity, sorted by id (the order is part of the algorithm). */
export const REWARD_CARDS: Record<Rarity, PackCard[]> = PACK_POOLS_BY_ALGORITHM["diademfall-pack-v2"].legionnaire;

/** Remaining reward-card units per rarity. */
export type Reserve = Record<Rarity, number>;

export type ChestRoll =
  | { roll: number; type: "card"; cardId: string; rarity: Rarity; foil: Foil; rolledRarity: Rarity }
  | { roll: number; type: "coin_shares"; shares: number; fromDepletedCard?: boolean }
  | { roll: number; type: "credits"; credits: number };

const unit = (hex8: string) => parseInt(hex8, 16) / 0x1_0000_0000;
function weighted<T>(u: number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [v, w] of items) { acc += w / total; if (w > 0 && u < acc) return v; }
  return [...items].reverse().find(([, w]) => w > 0)![0];
}
/** Median Coin-share value (the middle tier) — used when no reward card is left. */
export const medianShares = (chest: ChestType) => {
  const v = CHESTS[chest].coinShares.map((x) => x.value).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)]!;
};

/**
 * Reserve availability capped at 3 per rarity (the most cards one chest can take). The roll only depends on this
 * capped view, so concurrent openings rarely invalidate each other; the database re-checks it on reveal.
 */
export const reserveView = (reserve: Reserve): Reserve =>
  Object.fromEntries(RARITY_ORDER.map((r) => [r, Math.max(0, Math.min(3, reserve[r] ?? 0))])) as Reserve;

export function rollChest(chest: ChestType, serverSeed: string, clientSeed: string, chestId: string, reserve: Reserve): ChestRoll[] {
  const def = CHESTS[chest];
  const left = reserveView(reserve);
  const out: ChestRoll[] = [];
  for (let roll = 0; roll < def.rolls; roll++) {
    const h = sha256Hex(`${serverSeed}:${clientSeed}:${chestId}:${roll}`);
    const outcome = weighted(unit(h.slice(0, 8)), [["card", def.outcomes.legionnaireCard], ["coin_shares", def.outcomes.coinShares], ["credits", def.outcomes.credits]] as const);
    if (outcome === "coin_shares") { out.push({ roll, type: "coin_shares", shares: weighted(unit(h.slice(8, 16)), def.coinShares.map((w) => [w.value, w.weight])) }); continue; }
    if (outcome === "credits") { out.push({ roll, type: "credits", credits: weighted(unit(h.slice(8, 16)), def.credits.map((w) => [w.value, w.weight])) }); continue; }
    const rolledRarity = weighted(unit(h.slice(8, 16)), RARITY_ORDER.map((r) => [r, def.cardRarity[r]]));
    let rarity: Rarity | null = left[rolledRarity] > 0 ? rolledRarity : null;
    if (!rarity) {
      const higher = RARITY_ORDER.slice(RARITY_ORDER.indexOf(rolledRarity) + 1).filter((r) => left[r] > 0);
      rarity = higher.length ? higher[Math.floor(unit(h.slice(32, 40)) * higher.length)]! : null;
    }
    if (!rarity) { out.push({ roll, type: "coin_shares", shares: medianShares(chest), fromDepletedCard: true }); continue; }
    left[rarity]--;
    const pool = REWARD_CARDS[rarity];
    const card = pool[Math.floor(unit(h.slice(16, 24)) * pool.length)]!;
    const foil: Foil = unit(h.slice(24, 32)) < def.goldFoilChancePercent / 100 ? "gold" : "regular";
    out.push({ roll, type: "card", cardId: card.id, rarity, foil, rolledRarity });
  }
  return out;
}

/** Player-side check after opening: the seed matches the commitment and the rolls match the algorithm. */
export function verifyChest(c: { chest: ChestType; commitHash: string; serverSeed: string; clientSeed: string; chestId: string; reserve: Reserve; rolls: ChestRoll[] }) {
  if (sha256Hex(c.serverSeed) !== c.commitHash) return false;
  const expected = rollChest(c.chest, c.serverSeed, c.clientSeed, c.chestId, c.reserve);
  return JSON.stringify(expected) === JSON.stringify(c.rolls);
}

/**
 * The Legionnaire reward reserve: 20,000 reserve packs opened with the normal pack algorithm and a public seed,
 * giving exactly 100,000 reward-card units, counted per rarity (Gold is rolled when a chest gives the card).
 */
export const RESERVE_PACKS = RANKED_CONFIG.legionnaireRewardReserve.packsCommitted;
export const RESERVE_SEED = "diademfall-legionnaire-reward-reserve-1";
export function reserveComposition(packs = RESERVE_PACKS): Reserve {
  const counts = Object.fromEntries(RARITY_ORDER.map((r) => [r, 0])) as Reserve;
  for (let i = 0; i < packs; i++) for (const c of openPack("legionnaire", RESERVE_SEED, "reward-reserve", `pack-${i}`)) counts[c.rarity]++;
  return counts;
}
