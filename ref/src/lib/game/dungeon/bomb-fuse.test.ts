import { describe, expect, it } from 'vitest';
import { createDemoState } from '@/game/demo/demo';
import { BOMB_FUSE_MS } from './rules';
import { stepSimulation } from './simulation';

describe('two-second bomb fuse', () => {
  it('plants with a 2,000 ms fuse and damages a target only at detonation', () => {
    expect(BOMB_FUSE_MS).toBe(2000);
    const state = createDemoState(0);
    const hero = Object.values(state.heroes)[0];
    if (!hero) throw new Error('Missing demo hero');
    for (const other of Object.values(state.heroes)) other.onMap = false;
    hero.onMap = true;
    hero.x = 1;
    hero.y = 1;
    hero.path = [];
    hero.target = '2,1';
    hero.energy = hero.maxEnergy;
    state.nodes = {
      '2,1': { x: 2, y: 1, kind: 'chest', hp: 1000, maxHp: 1000, coins: 1, destroyed: false },
    };
    state.bombs = {};
    stepSimulation(state, 100, 100);
    const bomb = Object.values(state.bombs)[0];
    if (!bomb) throw new Error('Hero did not plant a bomb');
    expect(bomb.dueAt - state.time).toBe(2000);
    hero.onMap = false;
    const initialHp = state.nodes['2,1']?.hp;
    for (let i = 0; i < 19; i++) stepSimulation(state, 100, state.time + 100);
    const early = stepSimulation(state, 99, state.time + 99);
    expect(state.bombs[bomb.id]).toBeDefined();
    expect(state.nodes['2,1']?.hp).toBe(initialHp);
    expect(early.resolvedBombs).toEqual([]);
    const detonation = stepSimulation(state, 1, state.time + 1);
    expect(detonation.resolvedBombs).toEqual([bomb.id]);
    expect(state.bombs[bomb.id]).toBeUndefined();
    expect(state.nodes['2,1']?.hp).toBe(1000 - bomb.power - (bomb.heavy ?? 0));
  });
});