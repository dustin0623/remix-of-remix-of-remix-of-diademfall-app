import { describe, expect, it } from 'vitest';
import { generateStageMap } from '@/lib/game/dungeon/generate';
import { keyOf } from '@/lib/game/dungeon/simulation';
import { buildNodes, createSessionState } from '@/game/demo/demo';
import { damageBudget, validateDamage } from './damage';
import { collectDamage, reconcileDamage } from './map-damage';

const chest = generateStageMap(1, 12345).find(n => n.kind === 'chest');
if (!chest) throw new Error('Test map has no chest');
const key = keyOf(chest);
const maxHp = chest.maxHp;
const base = { stage: 1, seed: 12345, destroyed: [], stored: {}, reported: {}, lethal: [], budget: 10 };

describe('database-only partial HP', () => {
  it('restores exact partial HP without paying coins', () => {
    const state = createSessionState({ playerId: 'p', seed: 12345, stage: 1, coins: 0, heroes: [], destroyedNodes: [], damagedNodes: { [key]: 25 } });
    expect(state.nodes[key]?.hp).toBe(25);
    expect(state.coins).toBe(0);
    expect(collectDamage(state.nodes)).toEqual({ [key]: 25 });
  });
  it('destroyed nodes override partial HP', () => {
    expect(buildNodes(1, 12345, [key], { [key]: 25 })[key]).toMatchObject({ hp: 0, destroyed: true });
  });
  it('fresh stages have no inherited HP', () => {
    expect(buildNodes(1, 12345, [])[key]?.hp).toBe(maxHp);
  });
  it('rejects fabricated coordinates, zero, negative and fractional HP', () => {
    for (const hp of [0, -1, 1.5, maxHp]) expect(validateDamage({ ...base, reported: { [key]: hp, '999,999': 1 } }).damaged).toEqual({});
  });
  it('rejects tampered 1 HP when its damage exceeds the budget', () => {
    expect(validateDamage({ ...base, reported: { [key]: 1 }, budget: 1 }).damaged).toEqual({});
  });
  it('retries do not inflict damage twice or heal a saved chest', () => {
    const hp = maxHp - 5;
    expect(validateDamage({ ...base, stored: { [key]: hp }, reported: { [key]: hp }, budget: 0 }).damaged[key]).toBe(hp);
    expect(validateDamage({ ...base, stored: { [key]: hp - 1 }, reported: { [key]: hp }, budget: 0 }).damaged[key]).toBe(hp - 1);
  });
  it('lethal and partial reports share one damage allowance', () => {
    expect(validateDamage({ ...base, stored: { [key]: 11 }, lethal: [key], budget: 10 }).lethal).toEqual([]);
    expect(validateDamage({ ...base, stored: { [key]: 10 }, lethal: [key], budget: 10 }).lethal).toEqual([key]);
  });
  it('no deployed team has no new damage allowance', () => {
    expect(damageBudget([], 300000)).toBe(0);
  });
  it('adds a bomb cycle only at each two-second boundary, retaining the in-flight allowance', () => {
    const hero = { power: 1, bomb_number: 1, bomb_range: 1 };
    expect(damageBudget([hero], 1999)).toBe(5);
    expect(damageBudget([hero], 2000)).toBe(10);
    expect(damageBudget([hero], 3999)).toBe(10);
    expect(damageBudget([hero], 4000)).toBe(15);
  });
  it('caps elapsed time and includes server-known Heavy Impact', () => {
    const hero = { power: 1, bomb_number: 1, bomb_range: 1, skills: [] };
    expect(damageBudget([hero], 0)).toBe(5);
    expect(damageBudget([{ ...hero, skills: ['heavy_impact'] }], 0)).toBe(15);
    expect(damageBudget([hero], 600000)).toBe(damageBudget([hero], 300000));
  });
  it('does not overwrite hits made while a save is in flight', () => {
    const nodes = buildNodes(1, 12345, [], { [key]: 25 });
    reconcileDamage(nodes, { [key]: 30 }, { [key]: 30 });
    expect(nodes[key]?.hp).toBe(25);
    reconcileDamage(nodes, { [key]: 25 }, { [key]: 24 });
    expect(nodes[key]?.hp).toBe(24);
  });
});