/**
 * Pack rules + the public, verifiable opening algorithm (docs/diademfall-complete-v5/economy).
 * Pure and deterministic: given the revealed server seed, the player's seed and the opening id,
 * anyone can recompute the five cards. A test keeps the numbers in sync with economy-config.json.
 * Algorithm versions: v1 = the 138-card pools before Wayfarers, v2 = v1 + 4 Wayfarers per pack.
 * Each opening stores its algorithm, so openings committed before an update still reveal and verify.
 */
import { SUMMONERS } from "./catalog/summoners";
import { TROOPS } from "./catalog/troops";
import { SETS } from "./catalog/sets";
import { sha256Hex } from "./sha256";

export type PackId = "ancient" | "oath" | "legionnaire";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type Foil = "regular" | "gold";

export const PACK_ALGORITHM = "diademfall-pack-v2";
export const PACK_ALGORITHMS = ["diademfall-pack-v1", "diademfall-pack-v2"] as const;
export type PackAlgorithm = (typeof PACK_ALGORITHMS)[number];
export const isPackAlgorithm = (a: string): a is PackAlgorithm => (PACK_ALGORITHMS as readonly string[]).includes(a);
export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const PACK_RULES = {
  cardsPerPack: 5,
  priceCredits: 1000,
  goldFoilChance: 0.02,
  maxPerPurchase: 50,
  /** Slots 0-3. */
  standardSlot: { common: 0.65, uncommon: 0.22, rare: 0.09, epic: 0.03, legendary: 0.01 } as Record<Rarity, number>,
  /** Slot 4: Uncommon or better. */
  guaranteedSlot: { common: 0, uncommon: 0.7, rare: 0.22, epic: 0.06, legendary: 0.02 } as Record<Rarity, number>,
  editions: [
    { id: "ancient", maximumPacks: 500_000, publicSale: 450_000, reserve: 50_000 },
    { id: "oath", maximumPacks: 500_000, publicSale: 450_000, reserve: 50_000 },
    { id: "legionnaire", maximumPacks: 500_000, publicSale: 450_000, reserve: 50_000 },
  ] as { id: PackId; maximumPacks: number; publicSale: number; reserve: number }[],
} as const;

export const PACK_IDS: PackId[] = ["ancient", "oath", "legionnaire"];
export const PACK_INFO = Object.fromEntries(SETS.map((s) => [s.id, s])) as Record<PackId, (typeof SETS)[number]>;

export interface PackCard { id: string; name: string; rarity: Rarity; kind: "summoner" | "troop" }

type Pools = Record<PackId, Record<Rarity, PackCard[]>>;
function buildPools(withWayfarers: boolean): Pools {
  const pools = Object.fromEntries(PACK_IDS.map((p) => [p, Object.fromEntries(RARITY_ORDER.map((r) => [r, [] as PackCard[]]))])) as Pools;
  for (const s of SUMMONERS) pools[s.set as PackId][s.rarity as Rarity].push({ id: s.id, name: s.name, rarity: s.rarity as Rarity, kind: "summoner" });
  for (const t of TROOPS) {
    if (!withWayfarers && t.affiliation === "wayfarer") continue;
    pools[t.set as PackId][t.rarity as Rarity].push({ id: t.id, name: t.name, rarity: t.rarity as Rarity, kind: "troop" });
  }
  for (const p of PACK_IDS) for (const r of RARITY_ORDER) pools[p][r].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return pools;
}

/** Cards each pack can produce, by algorithm, grouped by rarity and sorted by id (the order is part of the algorithm). */
export const PACK_POOLS_BY_ALGORITHM: Record<PackAlgorithm, Pools> = {
  "diademfall-pack-v1": buildPools(false),
  "diademfall-pack-v2": buildPools(true),
};
/** Pools for new openings. */
export const PACK_POOLS: Pools = PACK_POOLS_BY_ALGORITHM[PACK_ALGORITHM];

/** Uniform number in [0,1) from 8 hex chars (32 bits). */
const unit = (hex8: string) => parseInt(hex8, 16) / 0x1_0000_0000;

export function pickRarity(roll: number, table: Record<Rarity, number>): Rarity {
  let acc = 0;
  for (const r of RARITY_ORDER) { acc += table[r]; if (roll < acc) return r; }
  // Floating sums can land just under 1: fall back to the rarest rarity with weight.
  return [...RARITY_ORDER].reverse().find((r) => table[r] > 0)!;
}

export interface PulledCard { slot: number; cardId: string; rarity: Rarity; foil: Foil }

/**
 * The opening algorithm. Slot i hash = sha256("{serverSeed}:{clientSeed}:{openingId}:{i}");
 * hex[0..8] picks rarity, hex[8..16] picks the card in that rarity, hex[16..24] rolls Gold (< 2%).
 */
export function openPack(pack: PackId, serverSeed: string, clientSeed: string, openingId: string, algorithm: PackAlgorithm = PACK_ALGORITHM): PulledCard[] {
  const pools = PACK_POOLS_BY_ALGORITHM[algorithm];
  const out: PulledCard[] = [];
  for (let slot = 0; slot < PACK_RULES.cardsPerPack; slot++) {
    const h = sha256Hex(`${serverSeed}:${clientSeed}:${openingId}:${slot}`);
    const table = slot === PACK_RULES.cardsPerPack - 1 ? PACK_RULES.guaranteedSlot : PACK_RULES.standardSlot;
    const rarity = pickRarity(unit(h.slice(0, 8)), table);
    const pool = pools[pack][rarity];
    const card = pool[Math.floor(unit(h.slice(8, 16)) * pool.length)]!;
    const foil: Foil = unit(h.slice(16, 24)) < PACK_RULES.goldFoilChance ? "gold" : "regular";
    out.push({ slot, cardId: card.id, rarity, foil });
  }
  return out;
}

/** Commitment shown before the reveal: sha256 of the hidden server seed. */
export const commitmentFor = (serverSeed: string) => sha256Hex(serverSeed);

/** Player-side check after the reveal: the seed matches the commitment and the cards match the algorithm. */
export function verifyOpening(o: { pack: PackId; algorithm?: string; commitHash: string; serverSeed: string; clientSeed: string; openingId: string; cards: { cardId: string; foil: Foil }[] }): boolean {
  if (commitmentFor(o.serverSeed) !== o.commitHash) return false;
  const algorithm = o.algorithm ?? PACK_ALGORITHM;
  if (!isPackAlgorithm(algorithm)) return false;
  const expected = openPack(o.pack, o.serverSeed, o.clientSeed, o.openingId, algorithm);
  return expected.length === o.cards.length && expected.every((e, i) => e.cardId === o.cards[i]!.cardId && e.foil === o.cards[i]!.foil);
}

/** Random 32-byte hex seed (Web Crypto; works in the browser and on the server). */
export function randomSeed(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
