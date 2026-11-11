import { generateStageMap } from '@/lib/game/dungeon/generate';
import { keyOf } from '@/lib/game/dungeon/simulation';
import { BOMB_FUSE_MS } from '@/lib/game/dungeon/rules';
import { HEAVY_IMPACT_DAMAGE } from '@/lib/game/heroes/skills';
import { MAX_BUDGET_ELAPSED_MS } from './validate';

export interface DamageHero { power: number; bomb_number: number; bomb_range: number; skills?: string[] | null }

/** Upper physical bound, not proof of individual bomb placement. Shared by partial and lethal hits. */
export function damageBudget(heroes: DamageHero[], elapsedMs: number): number {
  const cycles = 1 + Math.floor(Math.min(MAX_BUDGET_ELAPSED_MS, Math.max(0, elapsedMs)) / BOMB_FUSE_MS);
  return heroes.reduce((sum, h) => sum + cycles * Math.max(1, h.bomb_number) *
    (1 + 4 * Math.max(1, h.bomb_range)) *
    (Math.max(1, h.power) + (h.skills?.includes('heavy_impact') ? HEAVY_IMPACT_DAMAGE : 0)), 0);
}

export function validateDamage(input: {
  stage: number; seed: number; destroyed: string[]; stored: Record<string, number>;
  reported: Record<string, number>; lethal: string[]; budget: number;
}): { damaged: Record<string, number>; lethal: string[]; rejected: number } {
  const nodes = new Map(generateStageMap(input.stage, input.seed).map(n => [keyOf(n), n]));
  const gone = new Set(input.destroyed);
  const damaged: Record<string, number> = {};
  const lethal: string[] = [];
  let remaining = input.budget;
  let rejected = 0;
  const deaths = new Set(input.lethal);
  for (const key of new Set([...input.lethal, ...Object.keys(input.reported)])) {
    const node = nodes.get(key);
    if (!node || gone.has(key)) { rejected++; continue; }
    if (deaths.has(key)) {
      const cost = input.stored[key] ?? node.maxHp;
      if (cost > remaining) { rejected++; continue; }
      remaining -= cost;
      lethal.push(key);
      continue;
    }
    const hp = input.reported[key];
    if (node.kind !== 'chest' || !Number.isInteger(hp) || hp === undefined || hp < 1 || hp >= node.maxHp) {
      rejected++; continue;
    }
    const previous = input.stored[key] ?? node.maxHp;
    const cost = Math.max(0, previous - hp);
    if (cost > remaining) { rejected++; continue; }
    remaining -= cost;
    damaged[key] = Math.min(previous, hp);
  }
  return { damaged, lethal, rejected };
}