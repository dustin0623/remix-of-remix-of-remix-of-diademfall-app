import { describe, expect, it } from "vitest";
import { generateStageMap } from "@/lib/game/dungeon/generate";
import { keyOf } from "@/lib/game/dungeon/simulation";
import { validateClaims } from "./validate";

const STAGE = 3;
const SEED = 123456;
const ELAPSED_MS = 600_000;

/** Claim everything on the map (bushes are free, chests pay). */
function claimAll(exceptChestKeys: string[] = []) {
  const nodes = generateStageMap(STAGE, SEED);
  const claimed = nodes
    .filter((n) => !(n.kind === "chest" && exceptChestKeys.includes(keyOf(n))))
    .map(keyOf);
  return { nodes, claimed };
}

describe("validateClaims stage clearing", () => {
  it("reports cleared when every chest of the map is destroyed", () => {
    const { claimed } = claimAll();
    const outcome = validateClaims({
      stage: STAGE,
      seed: SEED,
      destroyed: [],
      claimed,
      elapsedMs: ELAPSED_MS,
    });
    expect(outcome.cleared).toBe(true);
    expect(outcome.rejected).toBe(0);
  });

  it("does not report cleared while any chest remains", () => {
    const { nodes, claimed } = claimAll();
    const chest = nodes.find((n) => n.kind === "chest")!;
    const outcome = validateClaims({
      stage: STAGE,
      seed: SEED,
      destroyed: [],
      claimed: claimed.filter((k) => k !== keyOf(chest)),
      elapsedMs: ELAPSED_MS,
    });
    expect(outcome.cleared).toBe(false);
  });

  it("credits coins only for chests, never for bushes", () => {
    const { nodes, claimed } = claimAll();
    const outcome = validateClaims({
      stage: STAGE,
      seed: SEED,
      destroyed: [],
      claimed,
      elapsedMs: ELAPSED_MS,
    });
    const bushKeys = new Set(nodes.filter((n) => n.kind === "bush").map(keyOf));
    for (const key of bushKeys) expect(outcome.rewards[key]).toBe(0);
    const chestCoins = nodes.filter((n) => n.kind === "chest").reduce((s, n) => s + n.coins, 0);
    expect(outcome.coins).toBe(chestCoins);
  });
});

describe("validateClaims dynamic chest budget", () => {
  const chests = generateStageMap(STAGE, SEED).filter((n) => n.kind === "chest").map(keyOf);
  it("with no deployed heroes only the small burst of 4 chests is accepted", () => {
    const o = validateClaims({ stage: STAGE, seed: SEED, destroyed: [], claimed: chests, elapsedMs: ELAPSED_MS, deployedBombs: [] });
    expect(Object.values(o.rewards).filter((c) => c > 0).length).toBe(Math.min(4, chests.length));
  });
  it("one 1-bomb Common for 2 seconds allows 4 + 2 chests", () => {
    const o = validateClaims({ stage: STAGE, seed: SEED, destroyed: [], claimed: chests, elapsedMs: 2000, deployedBombs: [1] });
    expect(Object.values(o.rewards).filter((c) => c > 0).length).toBe(Math.min(6, chests.length));
  });
  it("a 6-bomb Legendary for 1 second allows 4 + 6 chests", () => {
    const o = validateClaims({ stage: STAGE, seed: SEED, destroyed: [], claimed: chests, elapsedMs: 1000, deployedBombs: [6] });
    expect(Object.values(o.rewards).filter((c) => c > 0).length).toBe(Math.min(10, chests.length));
  });
});
