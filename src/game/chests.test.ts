import { describe, expect, it } from "vitest";
import { CHESTS, medianShares, REWARD_CARDS, reserveComposition, rollChest, verifyChest, type Reserve } from "./chests";
import { sha256Hex } from "./sha256";

const FULL: Reserve = { common: 50000, uncommon: 30000, rare: 12000, epic: 5000, legendary: 3000 };
const EMPTY: Reserve = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };

describe("chest odds", () => {
  it("Scout 1 roll, War 2, Crown 3", () => expect([CHESTS.scout.rolls, CHESTS.war.rolls, CHESTS.crown.rolls]).toEqual([1, 2, 3]));
  it("card / Coin shares / Credits: Scout 35/45/20, War 45/40/15, Crown 55/35/10", () => {
    expect(CHESTS.scout.outcomes).toEqual({ legionnaireCard: 35, coinShares: 45, credits: 20 });
    expect(CHESTS.war.outcomes).toEqual({ legionnaireCard: 45, coinShares: 40, credits: 15 });
    expect(CHESTS.crown.outcomes).toEqual({ legionnaireCard: 55, coinShares: 35, credits: 10 });
  });
  it("Gold chance 1% / 2% / 3%", () => expect([CHESTS.scout, CHESTS.war, CHESTS.crown].map((c) => c.goldFoilChancePercent)).toEqual([1, 2, 3]));
  it("median Coin shares: Scout 25, War 100, Crown 500", () => expect([medianShares("scout"), medianShares("war"), medianShares("crown")]).toEqual([25, 100, 500]));
  it("reward cards are the 52 Legionnaire cards", () => expect(Object.values(REWARD_CARDS).flat()).toHaveLength(52));
});

describe("chest rolls", () => {
  it("are deterministic and give one result per roll", () => {
    const a = rollChest("crown", "s", "c", "chest-1", FULL);
    expect(a).toHaveLength(3);
    expect(rollChest("crown", "s", "c", "chest-1", FULL)).toEqual(a);
  });
  it("values stay inside the chest's tables", () => {
    for (let i = 0; i < 300; i++) for (const r of rollChest("war", "seed", String(i), "x", FULL)) {
      if (r.type === "coin_shares") expect([50, 100, 250]).toContain(r.shares);
      if (r.type === "credits") expect([25, 50, 100]).toContain(r.credits);
      if (r.type === "card") expect(REWARD_CARDS[r.rarity].some((c) => c.id === r.cardId)).toBe(true);
    }
  });
  it("Scout chests never give a Legendary card", () => {
    for (let i = 0; i < 500; i++) for (const r of rollChest("scout", "seed", String(i), "x", FULL)) if (r.type === "card") expect(r.rarity).not.toBe("legendary");
  });
  it("a depleted rarity rolls up to a remaining higher rarity", () => {
    const onlyLegendary = { ...EMPTY, legendary: 5 };
    for (let i = 0; i < 200; i++) for (const r of rollChest("crown", "seed", String(i), "x", onlyLegendary)) if (r.type === "card") expect(r.rarity).toBe("legendary");
  });
  it("with no cards left a card result becomes the median Coin-share result", () => {
    let converted = 0;
    for (let i = 0; i < 100; i++) for (const r of rollChest("crown", "seed", String(i), "x", EMPTY)) {
      expect(r.type).not.toBe("card");
      if (r.type === "coin_shares" && r.fromDepletedCard) { expect(r.shares).toBe(500); converted++; }
    }
    expect(converted).toBeGreaterThan(0);
  });
  it("never takes more cards of a rarity than the reserve holds", () => {
    const oneEpic = { ...EMPTY, epic: 1 };
    for (let i = 0; i < 300; i++) expect(rollChest("crown", "seed", String(i), "x", oneEpic).filter((r) => r.type === "card").length).toBeLessThanOrEqual(1);
  });
  it("verifies against the commitment", () => {
    const rolls = rollChest("war", "server", "client", "id", FULL);
    expect(verifyChest({ chest: "war", commitHash: sha256Hex("server"), serverSeed: "server", clientSeed: "client", chestId: "id", reserve: FULL, rolls })).toBe(true);
    expect(verifyChest({ chest: "war", commitHash: sha256Hex("other"), serverSeed: "server", clientSeed: "client", chestId: "id", reserve: FULL, rolls })).toBe(false);
  });
});

describe("Legionnaire reward reserve", () => {
  it("20,000 packs give exactly 100,000 reward cards", () => {
    const r = reserveComposition();
    expect(Object.values(r).reduce((s, n) => s + n, 0)).toBe(100_000);
    expect(r.legendary).toBeGreaterThan(0);
  });
});

describe("Verifying a stored chest", () => {
  it("still verifies when the database returns the rolls with reordered keys and an assetId", () => {
    const serverSeed = "stored-server-seed";
    const rolls = rollChest("crown", serverSeed, "client-seed", "chest-1", FULL);
    const stored = rolls.map((r) => ({ assetId: "a", ...Object.fromEntries(Object.entries(r).reverse()) }) as unknown as typeof r);
    expect(verifyChest({ chest: "crown", commitHash: sha256Hex(serverSeed), serverSeed, clientSeed: "client-seed", chestId: "chest-1", reserve: FULL, rolls: stored })).toBe(true);
  });
});
