import { generateStageMap } from "@/lib/game/dungeon/generate";
import { keyOf } from "@/lib/game/dungeon/simulation";

/** Chests a client may report in a sync: a small burst plus a steady rate per elapsed second. */
export const CHEST_BURST = 4;
export const CHESTS_PER_SECOND = 3;
/** Dynamic budget: chests one live bomb slot can break per second (bomb cycle ≈ walk + fuse). */
export const CHESTS_PER_BOMB_SECOND = 1;
/** Elapsed time counted toward the budget is capped so long gaps cannot bank chests. */
export const MAX_BUDGET_ELAPSED_MS = 5 * 60_000;

export interface ClaimInput {
  stage: number;
  seed: number;
  destroyed: string[];
  claimed: string[];
  elapsedMs: number;
  /** Server-seen deployed heroes' bomb counts; when given, the chest rate scales with total bombs. */
  deployedBombs?: number[];
}

export interface ClaimOutcome {
  destroyed: string[];
  coins: number;
  accepted: number;
  rejected: number;
  /** Newly accepted keys → coins (0 for bushes). */
  rewards: Record<string, number>;
  /** Newly accepted chest keys → server-map rarity and HP (1 HP = 1 XP). */
  chests: Record<string, { rarity: string; hp: number }>;
  /** True when every chest of this map is now destroyed. */
  cleared: boolean;
}

/** Team bomb capacity: sum of BOMBS stat over deployed heroes (each at least 1). */
export function teamBombCapacity(bombs: number[]): number {
  return bombs.reduce((s, b) => s + Math.max(1, Math.floor(Number(b) || 0)), 0);
}

/**
 * Server-side check of reported destroyed blocks. Only nodes that exist on the
 * seeded map and are not yet destroyed count; coins come from the map itself,
 * never from the client; chest count is limited by elapsed time × team bombs.
 */
export function validateClaims(input: ClaimInput): ClaimOutcome {
  const nodes = new Map(generateStageMap(input.stage, input.seed).map((n) => [keyOf(n), n]));
  const destroyed = new Set(input.destroyed);
  const rate =
    input.deployedBombs === undefined ? CHESTS_PER_SECOND : teamBombCapacity(input.deployedBombs) * CHESTS_PER_BOMB_SECOND;
  const elapsed = Math.min(MAX_BUDGET_ELAPSED_MS, Math.max(0, input.elapsedMs));
  const chestBudget = CHEST_BURST + Math.floor((elapsed / 1000) * rate);
  let coins = 0;
  let accepted = 0;
  let rejected = 0;
  let chests = 0;
  const rewards: Record<string, number> = {};
  const chestMeta: ClaimOutcome["chests"] = {};
  for (const key of new Set(input.claimed)) {
    const node = nodes.get(key);
    if (!node || destroyed.has(key)) {
      rejected++;
      continue;
    }
    if (node.kind === "chest") {
      if (chests >= chestBudget) {
        rejected++;
        continue;
      }
      chests++;
      coins += node.coins;
      chestMeta[key] = { rarity: String(node.rarity ?? "common"), hp: node.maxHp };
    }
    destroyed.add(key);
    rewards[key] = node.kind === "chest" ? node.coins : 0;
    accepted++;
  }
  const cleared = [...nodes.entries()].every(([k, n]) => n.kind !== "chest" || destroyed.has(k));
  return { destroyed: [...destroyed], coins, accepted, rejected, rewards, chests: chestMeta, cleared };
}
