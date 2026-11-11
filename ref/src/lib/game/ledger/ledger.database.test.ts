// Isolated PostgreSQL only; never point this test at the game database.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env["LEDGER_TEST_DATABASE_URL"];
if (url && !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Ledger database tests require a disposable localhost database.");
}
describe.skipIf(!url)("atomic ledger database rules", () => {
  const sql = postgres(url ?? "postgresql://localhost/ledger_test", { max: 1 });
  const player = "00000000-0000-0000-0000-000000000001";
  beforeAll(async () => {
    await sql.unsafe("DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
    await sql.unsafe(readFileSync("scripts/schema.sql", "utf8"));
    await sql`INSERT INTO players (id,coins) VALUES (${player},10000)`;
  });
  afterAll(async () => { await sql.end(); });

  it("merges stage syncs but splits after an intervening withdrawal and ignores zero gain", async () => {
    await sql`SELECT ledger_stage_reward(${player}::uuid, 123::bigint, 1, 100::bigint, 10100::bigint, 50::bigint, '{"common":1}'::jsonb, false)`;
    await sql`SELECT ledger_stage_reward(${player}::uuid, 123::bigint, 1, 200::bigint, 10300::bigint, 100::bigint, '{"rare":1}'::jsonb, true)`;
    const [merged] = await sql`SELECT * FROM token_ledger WHERE player_id=${player}`;
    if (!merged) throw new Error("Missing merged row");
    expect(Number(merged["amount"])).toBe(300);
    expect(Number(merged["balance_before"])).toBe(10000);
    expect(Number(merged["balance_after"])).toBe(10300);
    expect(merged["metadata"]).toMatchObject({syncs:2,xp:150,cleared:true,chests:{common:1,rare:1}});
    await sql`UPDATE players SET coins=10300 WHERE id=${player}`;
    const [withdraw] = await sql`SELECT request_withdrawal(${player}::uuid, 500::bigint, 'test destination') AS result`;
    if (!withdraw) throw new Error("Missing withdrawal");
    expect(Number(withdraw["result"].coins)).toBe(9800);
    await sql`SELECT ledger_stage_reward(${player}::uuid, 123::bigint, 1, 100::bigint, 9900::bigint, 50::bigint, '{"common":1}'::jsonb, false)`;
    await sql`SELECT ledger_stage_reward(${player}::uuid, 123::bigint, 1, 0::bigint, 9900::bigint, 0::bigint, '{}'::jsonb, false)`;
    const rows = await sql`SELECT * FROM token_ledger ORDER BY id`;
    expect(rows).toHaveLength(3);
    expect(Number(rows[1]?.["amount"])).toBe(-500);
    expect(Number(rows[1]?.["balance_before"])).toBe(10300);
    expect(Number(rows[1]?.["balance_after"])).toBe(9800);
    expect(Number(rows[2]?.["balance_before"])).toBe(9800);
    expect(Number(rows[2]?.["balance_after"])).toBe(9900);
  });

  it("paginates, scopes players and tolerates non-UUID hero references", async () => {
    await sql`SELECT ledger_record(${player}::uuid,'economy','market_sale',0::bigint,9900::bigint,'hero_example')`;
    const [result] = await sql`SELECT list_ledger(${player}::uuid,NULL,NULL,2,0) AS page`;
    if (!result) throw new Error("Missing ledger page");
    expect(Number(result["page"].total)).toBe(4);
    expect(Number(result["page"].net)).toBe(-100);
    expect(result["page"].records).toHaveLength(2);
    expect(result["page"].records[0].amount).toBe(0);
    const [other] = await sql`SELECT list_ledger('00000000-0000-0000-0000-000000000002'::uuid,NULL,NULL,30,0) AS page`;
    if (!other) throw new Error("Missing other player page");
    expect(Number(other["page"].total)).toBe(0);
  });

  it("keeps direct browser reads and RPC execution unavailable", async () => {
    const [access] = await sql`SELECT has_table_privilege('anon','token_ledger','SELECT') AS read, has_function_privilege('authenticated','list_ledger(uuid,text,timestamptz,integer,integer)','EXECUTE') AS execute`;
    if (!access) throw new Error("Missing access check");
    expect(access["read"]).toBe(false);
    expect(access["execute"]).toBe(false);
  });
});