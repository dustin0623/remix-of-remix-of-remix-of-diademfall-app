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

describe.skipIf(!db)('leaderboard snapshot', () => {
  beforeAll(async () => {
    if (!db) throw new Error('Database unavailable');
    expect((await db.from('players').insert({ id: playerId, is_test: true, username: 'lb_test_player' })).error).toBeNull();
    expect((await db.from('player_milestones').insert({ player_id: playerId, xp: 999999 })).error).toBeNull();
    expect((await db.from('heroes').insert({
      id: `lb_test_${playerId.slice(0, 8)}`, player_id: playerId, name: 'Ricky', rarity: 'legendary',
      power: 16, speed: 16, stamina: 16, bomb_number: 6, bomb_range: 11, max_energy: 800, energy: 800,
    })).error).toBeNull();
  });
  afterAll(async () => {
    if (db) await db.from('players').delete().eq('id', playerId).eq('is_test', true);
  });

  it('ranks real players and excludes test accounts', async () => {
    if (!db) throw new Error('Database unavailable');
    const { data, error } = await db.rpc('leaderboard_snapshot');
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    // The test player has huge XP and a legendary hero — it must NOT appear.
    expect(rows.some((r) => r.player_id === playerId)).toBe(false);
    for (const row of rows) {
      expect(Number(row.score)).toBe(Number(row.xp) + Number(row.hero_points));
      expect(Number(row.level)).toBe(Math.floor(Math.sqrt(Number(row.xp) / 1000)) + 1);
    }
    // Ranks are dense from 1 and sorted by score descending.
    const scores = rows.map((r) => Number(r.score));
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    if (rows.length > 0) expect(Number(rows[0].rank)).toBe(1);
  });
});
