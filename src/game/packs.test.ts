import { describe, expect, it } from "vitest";
import economy from "../../docs/diademfall-complete-v5/economy/economy-config.json";
import { commitmentFor, openPack, PACK_IDS, PACK_POOLS, PACK_RULES, pickRarity, RARITY_ORDER, verifyOpening } from "./packs";

const seed = "a".repeat(64);

describe("pack rules", () => {
  it("every pack costs 1,000 Credits and holds 5 cards", () => { expect(PACK_RULES.priceCredits).toBe(1000); expect(PACK_RULES.cardsPerPack).toBe(5); });
  it("each edition is capped at 500,000 packs: 450,000 store + 50,000 reserve", () => {
    for (const e of PACK_RULES.editions) { expect(e.maximumPacks).toBe(500_000); expect(e.publicSale).toBe(450_000); expect(e.reserve).toBe(50_000); }
  });
  it("Gold foil chance is 2%", () => expect(PACK_RULES.goldFoilChance).toBe(0.02));
  it("matches docs/diademfall-complete-v5 economy-config.json", () => {
    const p = economy.packs;
    expect(PACK_RULES.cardsPerPack).toBe(p.cardsPerPack);
    expect(PACK_RULES.priceCredits).toBe(p.priceCredits);
    expect(PACK_RULES.goldFoilChance).toBe(p.goldFoilChance);
    for (const r of RARITY_ORDER) {
      expect(PACK_RULES.standardSlot[r]).toBe((p.standardSlot as Record<string, number>)[r] ?? 0);
      expect(PACK_RULES.guaranteedSlot[r]).toBe((p.guaranteedSlot as Record<string, number>)[r] ?? 0);
    }
    expect(PACK_RULES.editions.map((e) => [e.id, e.maximumPacks, e.publicSale, e.reserve]))
      .toEqual(p.editions.map((e) => [e.id, e.maximumPacks, e.publicSale, e.reserve]));
  });
  it("odds tables each sum to 100%", () => {
    const sum = (t: Record<string, number>) => Object.values(t).reduce((a, b) => a + b, 0);
    expect(sum(PACK_RULES.standardSlot)).toBeCloseTo(1, 10);
    expect(sum(PACK_RULES.guaranteedSlot)).toBeCloseTo(1, 10);
  });
  it("every pack has cards of every rarity", () => { for (const p of PACK_IDS) for (const r of RARITY_ORDER) expect(PACK_POOLS[p][r].length).toBeGreaterThan(0); });
  it("rarity roll boundaries: 0.649 Common, 0.65 Uncommon, 0.999 Legendary", () => {
    expect(pickRarity(0.649, PACK_RULES.standardSlot)).toBe("common");
    expect(pickRarity(0.65, PACK_RULES.standardSlot)).toBe("uncommon");
    expect(pickRarity(0.999, PACK_RULES.standardSlot)).toBe("legendary");
    expect(pickRarity(0, PACK_RULES.guaranteedSlot)).toBe("uncommon");
  });
});

describe("opening algorithm", () => {
  it("always gives exactly 5 cards, all from the opened pack", () => {
    for (const p of PACK_IDS) {
      const cards = openPack(p, seed, "player-seed", "opening-1");
      expect(cards).toHaveLength(5);
      const ids = new Set(Object.values(PACK_POOLS[p]).flat().map((c) => c.id));
      for (const c of cards) expect(ids.has(c.cardId)).toBe(true);
    }
  });
  it("is deterministic for the same seeds", () => expect(openPack("oath", seed, "x1234567", "o")).toEqual(openPack("oath", seed, "x1234567", "o")));
  it("the last slot is never Common", () => {
    for (let i = 0; i < 400; i++) expect(openPack("ancient", seed, `client-${i}`, "o")[4]!.rarity).not.toBe("common");
  });
  it("over many openings, Gold lands near 2% and Common near 65% of standard slots", () => {
    let gold = 0, common = 0, standard = 0, total = 0;
    for (let i = 0; i < 4000; i++) for (const c of openPack("legionnaire", seed, `c${i}`, "o")) {
      total++; if (c.foil === "gold") gold++;
      if (c.slot < 4) { standard++; if (c.rarity === "common") common++; }
    }
    expect(gold / total).toBeGreaterThan(0.015); expect(gold / total).toBeLessThan(0.025);
    expect(common / standard).toBeGreaterThan(0.62); expect(common / standard).toBeLessThan(0.68);
  });
  it("a player can verify a fair reveal and spot a tampered one", () => {
    const cards = openPack("oath", seed, "client-seed", "op-9");
    const base = { pack: "oath" as const, commitHash: commitmentFor(seed), serverSeed: seed, clientSeed: "client-seed", openingId: "op-9" };
    expect(verifyOpening({ ...base, cards })).toBe(true);
    expect(verifyOpening({ ...base, serverSeed: "b".repeat(64), cards })).toBe(false);
    expect(verifyOpening({ ...base, cards: cards.map((c, i) => (i === 0 ? { ...c, foil: c.foil === "gold" ? "regular" as const : "gold" as const } : c)) })).toBe(false);
  });
});
