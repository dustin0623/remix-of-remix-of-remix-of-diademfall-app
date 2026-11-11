// Isolated PostgreSQL only; never point this test at the game database.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env["BRIDGE_TEST_DATABASE_URL"];
if (url && !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Bridge database tests require a disposable localhost database.");
}
const TX_A = "A".repeat(64);
const TX_B = "B".repeat(64);

describe.skipIf(!url)("blockchain bridge database rules", () => {
  const sql = postgres(url ?? "postgresql://localhost/bridge_test", { max: 1 });
  const player = "00000000-0000-0000-0000-0000000000b1";
  beforeAll(async () => {
    await sql.unsafe("DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
    await sql.unsafe(readFileSync("scripts/schema.sql", "utf8"));
    await sql`INSERT INTO players (id,coins) VALUES (${player},10000)`;
  });
  afterAll(async () => { await sql.end(); });

  it("credits a deposit once and ignores a replayed tx hash", async () => {
    const [first] = await sql`SELECT process_deposit(${player}::uuid, 1500::bigint, ${TX_A}, '{"sender":"rSender"}'::jsonb) AS result`;
    expect(first?.["result"]).toMatchObject({ credited: true, coins: 11500, txHash: TX_A });
    const [replay] = await sql`SELECT process_deposit(${player}::uuid, 1500::bigint, ${TX_A}, '{}'::jsonb) AS result`;
    expect(replay?.["result"]).toMatchObject({ credited: false, coins: 11500 });
    const [row] = await sql`SELECT coins FROM players WHERE id=${player}`;
    expect(Number(row?.["coins"])).toBe(11500);
    const ledger = await sql`SELECT * FROM token_ledger WHERE player_id=${player} AND action='deposit'`;
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ status: "completed", reference_id: TX_A });
    expect(Number(ledger[0]?.["balance_before"])).toBe(10000);
    expect(Number(ledger[0]?.["balance_after"])).toBe(11500);
    const receipts = await sql`SELECT * FROM transactions_processed WHERE tx_hash=${TX_A}`;
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ action: "deposit", status: "completed" });
  });

  it("settles a queued withdrawal: receipt written, queue cleared, ledger completed", async () => {
    const [queued] = await sql`SELECT request_withdrawal(${player}::uuid, 2000::bigint, 'rPlayerWallet') AS result`;
    const pendingId = String(queued?.["result"].transaction_id);
    expect(Number(queued?.["result"].coins)).toBe(9500);
    const [settled] = await sql`SELECT settle_withdrawal(${pendingId}::uuid, 'completed', ${TX_B}, NULL, '{"ledgerIndex":90123456}'::jsonb) AS result`;
    expect(settled?.["result"]).toMatchObject({ status: "completed", coins: 9500, txHash: TX_B });
    const pending = await sql`SELECT * FROM transactions_pending WHERE id=${pendingId}::uuid`;
    expect(pending).toHaveLength(0);
    const [receipt] = await sql`SELECT * FROM transactions_processed WHERE tx_hash=${TX_B}`;
    expect(receipt).toMatchObject({ action: "withdrawal", status: "completed" });
    const [entry] = await sql`SELECT * FROM token_ledger WHERE reference_id=${pendingId} AND action='withdrawal'`;
    expect(entry?.["status"]).toBe("completed");
    expect(entry?.["metadata"]).toMatchObject({ txHash: TX_B, ledgerIndex: 90123456 });
  });

  it("refunds a failed payout and marks the ledger failed", async () => {
    const [queued] = await sql`SELECT request_withdrawal(${player}::uuid, 500::bigint, 'rPlayerWallet') AS result`;
    const pendingId = String(queued?.["result"].transaction_id);
    expect(Number(queued?.["result"].coins)).toBe(9000);
    const [settled] = await sql`SELECT settle_withdrawal(${pendingId}::uuid, 'failed', NULL, 'tecPATH_DRY', '{}'::jsonb) AS result`;
    expect(settled?.["result"]).toMatchObject({ status: "failed", coins: 9500, refunded: 500 });
    const [row] = await sql`SELECT coins FROM players WHERE id=${player}`;
    expect(Number(row?.["coins"])).toBe(9500);
    const [entry] = await sql`SELECT * FROM token_ledger WHERE reference_id=${pendingId} AND action='withdrawal'`;
    expect(entry?.["status"]).toBe("failed");
    expect(entry?.["metadata"]).toMatchObject({ error: "tecPATH_DRY", refunded: true });
  });

  it("rejects legacy queue actions and duplicate receipt hashes", async () => {
    await expect(sql`INSERT INTO transactions_pending (player_id, action, payload) VALUES (${player}, 'market_purchase', '{}'::jsonb)`).rejects.toThrow();
    await expect(sql`INSERT INTO transactions_processed (player_id, action, status, tx_hash) VALUES (${player}, 'deposit', 'completed', ${TX_A})`).rejects.toThrow();
    await expect(sql`SELECT settle_withdrawal('00000000-0000-0000-0000-0000000000ff'::uuid, 'completed', ${TX_B}, NULL, '{}'::jsonb)`).rejects.toThrow(/unknown_pending/);
    await expect(sql`SELECT settle_market_purchase('hero_x', 'tx', true)`).rejects.toThrow(/market_uses_coins/);
  });

  it("keeps the bridge RPCs service-role only", async () => {
    const [access] = await sql`SELECT
      has_function_privilege('authenticated','process_deposit(uuid,bigint,text,jsonb)','EXECUTE') AS dep_auth,
      has_function_privilege('service_role','process_deposit(uuid,bigint,text,jsonb)','EXECUTE') AS dep_svc,
      has_function_privilege('authenticated','settle_withdrawal(uuid,text,text,text,jsonb)','EXECUTE') AS wd_auth,
      has_function_privilege('service_role','settle_withdrawal(uuid,text,text,text,jsonb)','EXECUTE') AS wd_svc`;
    expect(access).toMatchObject({ dep_auth: false, dep_svc: true, wd_auth: false, wd_svc: true });
  });
});
