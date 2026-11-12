import { writeFileSync } from 'node:fs';
import { SUMMONERS } from '../src/game/catalog/summoners';
import { UNITS } from '../src/game/units';
import { CATALOG_VERSION } from '../src/game/catalogs';
import { lockedTeam, resolveBattle, ENGINE_VERSION } from '../src/game/ranked';
import { openPack, PACK_IDS } from '../src/game/packs';
import { rollChest, CHEST_TYPES } from '../src/game/chests';
import type { BattleInput } from '../src/game/battle-contract';

writeFileSync('src/game/legacy/wayfarers-1.0.0.json', JSON.stringify({ summoners: SUMMONERS, units: UNITS }, null, 2) + '\n');
const replays = [];
for (let i = 0; i < SUMMONERS.length; i++) for (const max of [false, true]) {
  const matchId = `00000000-0000-4000-8000-${String(i * 2 + Number(max)).padStart(12, '0')}`;
  const sides = [SUMMONERS[i]!, SUMMONERS[(i + 7) % SUMMONERS.length]!].map((s, side) => {
    const pool = UNITS.filter(u => u.banner === s.banner);
    const units = [pool[(i + side) % pool.length]!, pool[(i + side + 4) % pool.length]!, pool[(i + side + 8) % pool.length]!, pool[(i + side + 13) % pool.length]!, ...UNITS.filter(u => u.affiliation === 'wayfarer').filter((_, j) => j === (i % 12) || j === ((i + 5) % 12))];
    const pick = { summonerId: s.id, unitIds: units.map(u => u.id) };
    const levels = Object.fromEntries([[s.id, max ? s.levelCap : 1], ...units.map(u => [u.id, max ? u.levelCap : 1])]);
    return lockedTeam({ matchId, playerId: side ? '22222222-2222-4222-8222-222222222222' : '11111111-1111-4111-8111-111111111111', side: side ? 2 : 1, pick, levels, rulesets: [] });
  });
  const input: BattleInput = { matchId, gameVersion: CATALOG_VERSION, engineVersion: ENGINE_VERSION, seed: `${(i * 73471 + 17).toString(16).padStart(8, '0')}deadbeefcafef00d1234567890`, manaCap: 60, rulesetIds: [], side1: sides[0]!, side2: sides[1]!, catalogHash: '' };
  replays.push({ input, resultHash: resolveBattle(input).resultHash });
}
writeFileSync('src/game/legacy/wayfarers-replays.fixture.json', JSON.stringify(replays) + '\n');
const packs = PACK_IDS.flatMap(pack => ['diademfall-pack-v1', 'diademfall-pack-v2'].flatMap(algorithm => Array.from({ length: 20 }, (_, i) => ({ pack, algorithm, serverSeed: 'frozen-server', clientSeed: `client-${i}`, openingId: `frozen-${i}`, cards: openPack(pack, 'frozen-server', `client-${i}`, `frozen-${i}`, algorithm as 'diademfall-pack-v1') }))));
const reserve = { common: 3, uncommon: 3, rare: 3, epic: 3, legendary: 3 };
const chests = CHEST_TYPES.flatMap(chest => Array.from({ length: 15 }, (_, i) => ({ chest, serverSeed: 'frozen-chest-server', clientSeed: `client-${i}`, chestId: `chest-${i}`, reserve, rolls: rollChest(chest, 'frozen-chest-server', `client-${i}`, `chest-${i}`, reserve) })));
writeFileSync('src/game/legacy/openings.fixture.json', JSON.stringify({ packs, chests }) + '\n');
console.log(JSON.stringify({ version: CATALOG_VERSION, summoners: SUMMONERS.length, troops: UNITS.length, replays: replays.length, packs: packs.length, chests: chests.length }));
