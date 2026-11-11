// Only a fresh disposable localhost database; never use production data.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env["FUSION_TEST_DATABASE_URL"];
if (url && !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Use a disposable localhost database");

const PLAYER = "00000000-0000-0000-0000-0000000000f1";
const NEW_HERO = { type: "Moss", level: 2, rarity: "uncommon", power: 4, speed: 4, stamina: 4, bombNumber: 2, bombRange: 2, maxEnergy: 60 };

describe.skipIf(!url)("hero soft-burn fusion", () => {
  const sql = postgres(url ?? "postgresql://localhost/fusion_test", { max: 4 });
  let sequence = 0;

  async function hero(suffix?: string) {
    const id = `hero_fuse_${++sequence}${suffix ?? ""}`;
    await sql`INSERT INTO heroes(id,player_id,name,rarity,power,speed,stamina,bomb_number,bomb_range,max_energy,energy)
      VALUES(${id},${PLAYER},'Bolt','common',2,2,2,1,1,40,40)`;
    return id;
  }
  const fuse = (ids: string[], success: boolean, burnId: string, dailyLimit = 10) =>
    sql`SELECT fuse_heroes(${PLAYER}::uuid,${ids},'common',200::bigint,${dailyLimit},${success},${burnId},${sql.json(NEW_HERO)}) AS result`;
  const states = (ids: string[]) =>
    sql`SELECT id,is_burned,burned_at IS NOT NULL AS has_burned_at,on_map,house_id,is_listed FROM heroes WHERE id = ANY(${ids}) ORDER BY id`;

  beforeAll(async () => {
    await sql.unsafe("DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
    await sql.unsafe(readFileSync("scripts/schema.sql", "utf8"));
    await sql`INSERT INTO players(id,coins,username) VALUES(${PLAYER},100000,'Fuser')`;
  });
  afterAll(async () => { await sql.end(); });

  it("soft-burns only the sacrificed hero on failure and logs it to the ledger", async () => {
    const ids = [await hero(), await hero(), await hero()];
    const [out] = await fuse(ids, false, ids[1]!);
    expect(out?.["result"]).toMatchObject({ success: false, burnedId: ids[1] });
    const rows = await states(ids);
    expect(rows.map((r) => r["is_burned"])).toEqual([false, true, false]);
    const burned = rows.find((r) => r["id"] === ids[1])!;
    expect(burned).toMatchObject({ has_burned_at: true, on_map: false, house_id: null, is_listed: false });
    const [entry] = await sql`SELECT action,amount,status,reference_id,metadata FROM token_ledger WHERE reference_id=${ids[1]!}`;
    expect(entry).toMatchObject({ action: "fusion", amount: "-200", status: "completed",
      metadata: { rarity: "common", success: false, burnedHeroId: ids[1], burnedHeroName: "Bolt" } });
  });

  it("soft-burns all three inputs on success and creates one active hero", async () => {
    const ids = [await hero(), await hero(), await hero()];
    const [out] = await fuse(ids, true, ids[0]!);
    const result = out?.["result"] as { success: boolean; hero: { id: string; rarity: string } };
    expect(result.success).toBe(true);
    const rows = await states(ids);
    expect(rows.every((r) => r["is_burned"] && r["has_burned_at"])).toBe(true);
    const [created] = await sql`SELECT is_burned,rarity,level FROM heroes WHERE id=${result.hero.id}`;
    expect(created).toMatchObject({ is_burned: false, rarity: "uncommon", level: 2 });
    const [entry] = await sql`SELECT metadata FROM token_ledger WHERE reference_id=${result.hero.id}`;
    expect(entry?.["metadata"]).toMatchObject({ success: true, newHeroId: result.hero.id, burnedHeroIds: ids });
  });

  it("excludes burned heroes from active roster queries", async () => {
    const active = await sql`SELECT id FROM heroes WHERE player_id=${PLAYER} AND NOT is_burned`;
    const burned = await sql`SELECT id FROM heroes WHERE player_id=${PLAYER} AND is_burned`;
    expect(burned.length).toBeGreaterThan(0);
    expect(active.some((r) => burned.some((b) => b["id"] === r["id"]))).toBe(false);
  });

  it("rejects a fusion that resubmits an already burned hero", async () => {
    const ids = [await hero(), await hero(), await hero()];
    await fuse(ids, false, ids[0]!);
    const before = await sql`SELECT coins FROM players WHERE id=${PLAYER}`;
    await expect(fuse([ids[0]!, await hero(), await hero()], true, ids[0]!)).rejects.toThrow("heroes_unavailable");
    const after = await sql`SELECT coins FROM players WHERE id=${PLAYER}`;
    expect(after[0]!["coins"]).toBe(before[0]!["coins"]);
  });

  it("enforces the daily limit from the token ledger", async () => {
    const player = "00000000-0000-0000-0000-0000000000f2";
    await sql`INSERT INTO players(id,coins,username) VALUES(${player},100000,'Limited')`;
    const run = async (n: number) => {
      const ids = [] as string[];
      for (let i = 0; i < 3; i++) {
        const id = `hero_limit_${n}_${i}`;
        await sql`INSERT INTO heroes(id,player_id,name,rarity,power,speed,stamina,bomb_number,bomb_range,max_energy,energy)
          VALUES(${id},${player},'Bolt','common',2,2,2,1,1,40,40)`;
        ids.push(id);
      }
      return sql`SELECT fuse_heroes(${player}::uuid,${ids},'common',200::bigint,2,true,${ids[0]!},${sql.json(NEW_HERO)})`;
    };
    await run(1);
    await run(2);
    await expect(run(3)).rejects.toThrow("fusion_limit");
    const [count] = await sql`SELECT count(*)::int AS n FROM token_ledger WHERE player_id=${player} AND action='fusion'`;
    expect(count?.["n"]).toBe(2);
  });

  it("blocks burned heroes from leveling, listing, houses and the leaderboard", async () => {
    const ids = [await hero(), await hero(), await hero()];
    await fuse(ids, false, ids[0]!);
    await expect(sql`SELECT level_up_hero(${PLAYER}::uuid,${ids[0]!},5000::bigint,1,'{"level":2,"power":3,"speed":2,"stamina":2,"bombNumber":1,"bombRange":1,"maxEnergy":40}'::jsonb)`).rejects.toThrow("unknown_hero");
    await expect(sql`SELECT list_hero(${PLAYER}::uuid,${ids[0]!},500)`).rejects.toThrow("cannot_list");
    const [house] = await sql`SELECT register_house(${PLAYER}::uuid,'nft_fuse_test','rare',true) AS id`;
    await expect(sql`SELECT set_hero_house(${PLAYER}::uuid,${ids[0]!},${house!["id"]}::uuid,4,40)`).rejects.toThrow("unknown_hero");
    const board = await sql`SELECT hero_count FROM leaderboard_snapshot() WHERE player_id=${PLAYER}`;
    const activeCount = await sql`SELECT count(*)::int AS n FROM heroes WHERE player_id=${PLAYER} AND NOT is_burned`;
    expect(Number(board[0]?.["hero_count"])).toBe(activeCount[0]!["n"]);
  });
});
