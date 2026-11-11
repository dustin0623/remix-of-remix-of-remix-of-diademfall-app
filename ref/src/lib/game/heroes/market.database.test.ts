// Only a fresh disposable localhost database; never use production data.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env["MARKET_TEST_DATABASE_URL"];
if (url && !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Use a disposable localhost database");

describe.skipIf(!url)("atomic coin marketplace", () => {
  const sql = postgres(url ?? "postgresql://localhost/market_test", { max: 6 });
  const buyer = "00000000-0000-0000-0000-000000000010";
  const seller = "00000000-0000-0000-0000-000000000020";
  const rival = "00000000-0000-0000-0000-000000000030";
  let sequence = 0;
  async function listing(price = 500) {
    const id = `hero_trade_${++sequence}`;
    await sql`INSERT INTO heroes(id,player_id,name,rarity,power,speed,stamina,bomb_number,bomb_range,max_energy,energy,is_listed,market_price,listed_at)
      VALUES(${id},${seller},'Moss','common',2,2,2,1,1,40,23,true,${price},now())`;
    return id;
  }
  async function balances() {
    const rows = await sql`SELECT id,coins FROM players ORDER BY id`;
    return Object.fromEntries(rows.map((r) => [r["id"], Number(r["coins"])]));
  }
  beforeAll(async () => {
    await sql.unsafe("DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
    await sql.unsafe(readFileSync("scripts/schema.sql", "utf8"));
    await sql`INSERT INTO players(id,coins,username) VALUES(${buyer},10000,'Buyer'),(${seller},100,'Seller'),(${rival},10000,'Rival')`;
  });
  afterAll(async () => { await sql.end(); });

  it("debits full price, burns 5%, credits net and writes linked before/after entries", async () => {
    const id = await listing();
    const [out] = await sql`SELECT buy_market_hero(${buyer}::uuid,${id},500::bigint) AS result`;
    expect(out?.["result"]).toMatchObject({ coins: 9500, fee: 25, proceeds: 475, hero: { id, energy: 23, listed: false } });
    expect(await balances()).toMatchObject({ [buyer]: 9500, [seller]: 575 });
    const rows = await sql`SELECT * FROM token_ledger WHERE reference_id=${out?.["result"].reference} ORDER BY id`;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ player_id: buyer, action: "market_purchase", amount: "-500", balance_before: "10000", balance_after: "9500", metadata: { feeBurned: 25, sellerProceeds: 475, payment: "coins" } });
    expect(rows[1]).toMatchObject({ player_id: seller, action: "market_sale", amount: "475", balance_before: "100", balance_after: "575" });
    const [hero] = await sql`SELECT player_id,is_listed,reserved_by,reserved_until,purchase_tx FROM heroes WHERE id=${id}`;
    expect(hero).toMatchObject({player_id:buyer,is_listed:false,reserved_by:null,reserved_until:null,purchase_tx:null});
    await expect(sql`SELECT buy_market_hero(${rival}::uuid,${id},500::bigint)`).rejects.toThrow("hero_unavailable");
    expect(await balances()).toMatchObject({ [rival]:10000, [buyer]:9500 });
  });
  it("rounds fractional fees up to whole coins", async () => {
    const id = await listing(501);
    const [out] = await sql`SELECT buy_market_hero(${buyer}::uuid,${id},501::bigint) AS result`;
    expect(out?.["result"]).toMatchObject({fee:26,proceeds:475});
  });
  it("rejects own, unaffordable and changed-price purchases without balance or ledger changes", async () => {
    const id = await listing(20000);
    const before = await balances();
    const count = await sql`SELECT count(*) FROM token_ledger`;
    await expect(sql`SELECT buy_market_hero(${seller}::uuid,${id},20000::bigint)`).rejects.toThrow("self_purchase");
    await expect(sql`SELECT buy_market_hero(${buyer}::uuid,${id},20000::bigint)`).rejects.toThrow("not_enough_coins");
    await expect(sql`SELECT buy_market_hero(${buyer}::uuid,${id},1::bigint)`).rejects.toThrow("price_changed");
    expect(await balances()).toEqual(before);
    expect(await sql`SELECT count(*) FROM token_ledger`).toEqual(count);
  });
  it("allows only one of two concurrent buyers to pay for one hero", async () => {
    const id = await listing();
    const before = await balances();
    const results = await Promise.allSettled([
      sql`SELECT buy_market_hero(${buyer}::uuid,${id},500::bigint)`,
      sql`SELECT buy_market_hero(${rival}::uuid,${id},500::bigint)`,
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const after = await balances();
    expect(after[seller] - before[seller]).toBe(475);
    expect((before[buyer] - after[buyer]) + (before[rival] - after[rival])).toBe(500);
    const rows = await sql`SELECT id FROM token_ledger WHERE metadata->>'heroId'=${id}`;
    expect(rows).toHaveLength(2);
  });
  it("rolls back the purchase if a ledger write fails", async () => {
    const id = await listing();
    const before = await balances();
    await sql.unsafe("CREATE FUNCTION fail_trade_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.metadata->>'heroId'='" + id + "' THEN RAISE EXCEPTION 'test_ledger_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_trade_ledger BEFORE INSERT ON token_ledger FOR EACH ROW EXECUTE FUNCTION fail_trade_ledger();");
    try {
      await expect(sql`SELECT buy_market_hero(${buyer}::uuid,${id},500::bigint)`).rejects.toThrow("test_ledger_failure");
      expect(await balances()).toEqual(before);
      const [hero] = await sql`SELECT player_id,is_listed FROM heroes WHERE id=${id}`;
      expect(hero).toMatchObject({player_id:seller,is_listed:true});
    } finally { await sql.unsafe("DROP TRIGGER reject_trade_ledger ON token_ledger; DROP FUNCTION fail_trade_ledger();"); }
  });
  it("ignores old timed holds but protects already-submitted blockchain payments", async () => {
    const id = await listing();
    await sql`UPDATE heroes SET reserved_by=${rival},reserved_until=now()+interval '5 minutes' WHERE id=${id}`;
    await expect(sql`SELECT cancel_hero_listing(${seller}::uuid,${id})`).resolves.toBeDefined();
    await sql`SELECT list_hero(${seller}::uuid,${id},500::numeric)`;
    await sql`UPDATE heroes SET purchase_tx='legacy-payment' WHERE id=${id}`;
    await expect(sql`SELECT buy_market_hero(${buyer}::uuid,${id},500::bigint)`).rejects.toThrow("hero_unavailable");
    await expect(sql`SELECT reserve_market_hero(${buyer}::uuid,${id})`).rejects.toThrow("market_uses_coins");
    await expect(sql`SELECT submit_market_payment(${buyer}::uuid,${id},'new-payment')`).rejects.toThrow("market_uses_coins");
  });
  it("rejects fractional listings and keeps the purchase RPC service-role-only", async () => {
    const id = await listing();
    await sql`SELECT cancel_hero_listing(${seller}::uuid,${id})`;
    await expect(sql`SELECT list_hero(${seller}::uuid,${id},1.5::numeric)`).rejects.toThrow("cannot_list");
    const [permissions] = await sql`SELECT has_function_privilege('anon','buy_market_hero(uuid,text,bigint)','EXECUTE') AS anon, has_function_privilege('authenticated','buy_market_hero(uuid,text,bigint)','EXECUTE') AS authenticated, has_function_privilege('service_role','buy_market_hero(uuid,text,bigint)','EXECUTE') AS service`;
    expect(permissions).toMatchObject({anon:false,authenticated:false,service:true});
  });
});