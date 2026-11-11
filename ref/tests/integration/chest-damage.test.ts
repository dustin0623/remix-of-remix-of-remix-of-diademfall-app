import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = url && key ? createClient(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => {
  const headers = new Headers(init?.headers);
  if (headers.get('Authorization') === `Bearer ${key}` && key.startsWith('sb_')) headers.delete('Authorization');
  headers.set('apikey', key);
  return fetch(input, { ...init, headers });
} } }) : null;
const playerId = crypto.randomUUID();
let sessionToken = '';

describe.skipIf(!db)('atomic chest damage persistence', () => {
  beforeAll(async () => {
    if (!db) throw new Error('Database unavailable');
    expect((await db.from('players').insert({ id: playerId, is_test: true, coins: 0 })).error).toBeNull();
    expect((await db.from('stage_maps').insert({ player_id: playerId, seed: 12345 })).error).toBeNull();
    const started = await db.rpc('start_or_renew_game_session', { p_player_id: playerId });
    expect(started.error).toBeNull();
    sessionToken = String(started.data);
  });
  afterAll(async () => {
    if (db) await db.from('players').delete().eq('id', playerId).eq('is_test', true);
  });
  async function save(damaged: Record<string, number>, rewards = {}, newSeed = 0, seed = 12345, stamp?: string) {
    if (!db) throw new Error('Database unavailable');
    const map = await db.from('stage_maps').select('last_sync_at').eq('player_id', playerId).single();
    const args = { p_player_id: playerId, p_seed: seed, p_rewards: rewards, p_total_chests: 0,
      p_new_seed: newSeed, p_session_token: sessionToken, p_chests: {}, p_damaged: damaged,
      p_expected_sync_at: stamp ?? map.data?.last_sync_at };
    const result = await db.rpc('save_progress_with_damage', args);
    expect(result.error).toBeNull();
    return { result: result.data, stamp: args.p_expected_sync_at };
  }
  it('saves damage-only requests and reads exact HP back', async () => {
    if (!db) throw new Error('Database unavailable');
    const first = await save({ '1,1': 25 });
    expect(first.result).toMatchObject({ damaged: { '1,1': 25 }, coins: 0, accepted: 0 });
    const row = await db.from('stage_maps').select('damaged_nodes').eq('player_id', playerId).single();
    expect(row.data?.damaged_nodes).toEqual({ '1,1': 25 });
    const duplicate = await save({ '1,1': 1 }, {}, 0, 12345, first.stamp);
    expect(duplicate.result).toMatchObject({ conflict: true, damaged: { '1,1': 25 } });
  });
  it('cannot heal stored damage and removes HP when destroyed', async () => {
    expect((await save({ '1,1': 30 })).result.damaged).toEqual({ '1,1': 25 });
    expect((await save({}, { '1,1': 75 })).result).toMatchObject({ damaged: {}, coins: 75, accepted: 1 });
    expect((await save({}, { '1,1': 75 })).result.coins).toBe(75);
  });
  it('clears damage on stage advance and ignores stale-map damage', async () => {
    await save({ '2,1': 10 });
    expect((await save({}, { '3,1': 0 }, 54321)).result).toMatchObject({ seed: 54321, stage: 2, damaged: {} });
    expect((await save({ '2,1': 1 })).result).toMatchObject({ seed: 54321, damaged: {}, conflict: true });
  });
});