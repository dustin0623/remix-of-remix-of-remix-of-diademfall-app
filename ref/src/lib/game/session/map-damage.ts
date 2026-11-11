import type { GameState } from '@/lib/game/dungeon/types';

export function collectDamage(nodes: GameState['nodes']): Record<string, number> {
  return Object.fromEntries(Object.entries(nodes).filter(([, n]) => n.kind === 'chest' &&
    !n.destroyed && n.hp > 0 && n.hp < n.maxHp).map(([key, n]) => [key, n.hp]));
}

/** Acknowledgements must not overwrite hits that happened while the request was in flight. */
export function reconcileDamage(nodes: GameState['nodes'], sent: Record<string, number>, saved: Record<string, number>): void {
  for (const [key, hp] of Object.entries(sent)) {
    const node = nodes[key];
    if (!node || node.destroyed || node.hp !== hp) continue;
    nodes[key] = { ...node, hp: saved[key] ?? node.maxHp };
  }
}