import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && key);
const db = enabled ? createClient(url ?? "", key ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key?.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    if (key) headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } },
}) : null;
const playerId = crypto.randomUUID();
const otherId = crypto.randomUUID();
const wallet = `test-${playerId}`;
let heroId = "";

describe.skipIf(!enabled)("Game database integration", () => {
  beforeAll(async () => {
    if (!db) throw new Error("Database unavailable");
    const { error } = await db.from("players").insert([
      { id: playerId, wallet_address: wallet, is_test: true, coins: 1000000 },
      { id: otherId, wallet_address: null, is_test: true, coins: 0 },
    ]);
    expect(error).toBeNull();
    const map = await db.from("stage_maps").insert({ player_id: playerId, seed: 12345 });
    expect(map.error).toBeNull();
  });
  afterAll(async () => {
    if (db) await db.from("players").delete().in("id", [playerId, otherId]).eq("is_test", true);
  });
  it("credits each destroyed node once and ignores stale map saves", async () => {
    if (!db) throw new Error("Database unavailable");
    const started = await db.rpc("start_or_renew_game_session", { p_player_id: playerId });
    expect(started.error).toBeNull();
    const args = { p_player_id: playerId, p_seed: 12345, p_rewards: { "1,1": 50 }, p_total_chests: 0, p_new_seed: 0, p_session_token: started.data };
    const first = await db.rpc("save_progress", args);
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ coins: 1000050, accepted: 1, destroyed: ["1,1"] });
    const retry = await db.rpc("save_progress", args);
    expect(retry.data).toMatchObject({ coins: 1000050, accepted: 0 });
    const next = await db.rpc("save_progress", { ...args, p_rewards: { "2,1": 0 }, p_new_seed: 54321 });
    expect(next.data).toMatchObject({ stage: 2, seed: 54321, destroyed: [] });
    const stale = await db.rpc("save_progress", args);
    expect(stale.data).toMatchObject({ coins: 1000050, stage: 2, accepted: 0 });
  });
  it("closes the old game when a second one opens and rejects its saves", async () => {
    if (!db) throw new Error("Database unavailable");
    const a = await db.rpc("start_or_renew_game_session", { p_player_id: playerId });
    const b = await db.rpc("start_or_renew_game_session", { p_player_id: playerId });
    expect(a.data).not.toBe(b.data);
    const active = await db.from("game_sessions").select("session_token").eq("player_id", playerId).eq("status", "active");
    expect(active.data).toEqual([{ session_token: b.data }]);
    const stale = await db.rpc("save_progress", { p_player_id: playerId, p_seed: 1, p_rewards: {}, p_total_chests: 0, p_new_seed: 0, p_session_token: a.data });
    expect(stale.error?.message).toContain("SESSION_SUPERSEDED");
    const heroes = await db.rpc("save_heroes_state", { p_player_id: playerId, p_heroes: [], p_session_token: a.data });
    expect(heroes.error?.message).toContain("SESSION_SUPERSEDED");
    const noToken = await db.rpc("save_heroes_state", { p_player_id: playerId, p_heroes: [] });
    expect(noToken.error?.message).toContain("SESSION_ACTIVE_ELSEWHERE");
    const ok = await db.rpc("save_heroes_state", { p_player_id: playerId, p_heroes: [], p_session_token: b.data });
    expect(ok.error).toBeNull();
    await db.from("game_sessions").update({ status: "closed" }).eq("player_id", playerId);
  });
  it("mints for the existing 500000 coin price atomically", async () => {
    if (!db) throw new Error("Database unavailable");
    const hero = { type: "Timmy", rarity: "common", power: 1, speed: 1, stamina: 1, bombNumber: 1, bombRange: 1, maxEnergy: 100, skills: [] };
    const mint = await db.rpc("mint_heroes", { p_player_id: playerId, p_cost: 500000, p_heroes: [hero] });
    expect(mint.error).toBeNull();
    expect(mint.data.coins).toBe(500050);
    expect(mint.data.heroes).toHaveLength(1);
    heroId = mint.data.heroes[0].id;
    const rejected = await db.rpc("mint_heroes", { p_player_id: otherId, p_cost: 500000, p_heroes: [hero] });
    expect(rejected.error?.message).toContain("not_enough_coins");
    const rows = await db.from("heroes").select("id").eq("player_id", otherId);
    expect(rows.data).toEqual([]);
  });
  it("buys with coins atomically and burns a 5% market fee", async () => {
    if (!db) throw new Error("Database unavailable");
    const hero = { type: "Timmy", rarity: "common", power: 1, speed: 1, stamina: 1, bombNumber: 1, bombRange: 1, maxEnergy: 100, skills: [] };
    await db.from("players").update({ coins: 500000 }).eq("id", playerId);
    const mint = await db.rpc("mint_heroes", { p_player_id: playerId, p_cost: 500000, p_heroes: [hero] });
    const id = mint.data.heroes[0].id;
    expect((await db.rpc("list_hero", { p_player_id: playerId, p_hero_id: id, p_price: 250 })).error).toBeNull();
    expect((await db.rpc("buy_market_hero", { p_buyer_id: playerId, p_hero_id: id, p_expected_price: 250 })).error?.message).toContain("self_purchase");
    expect((await db.rpc("buy_market_hero", { p_buyer_id: otherId, p_hero_id: id, p_expected_price: 250 })).error?.message).toContain("not_enough_coins");
    await db.from("players").update({ coins: 1000 }).eq("id", otherId);
    const purchase = await db.rpc("buy_market_hero", { p_buyer_id: otherId, p_hero_id: id, p_expected_price: 250 });
    expect(purchase.error).toBeNull();
    expect(purchase.data).toMatchObject({ coins: 750, fee: 13, proceeds: 237 });
    const seller = await db.from("players").select("coins").eq("id", playerId).single();
    expect(seller.data?.coins).toBe(237);
    const ledger = await db.from("token_ledger").select("player_id,amount,balance_before,balance_after,metadata").eq("reference_id", purchase.data.reference);
    expect(ledger.data).toHaveLength(2);
    expect(ledger.data?.find((l) => l.player_id === otherId)).toMatchObject({ amount: -250, balance_before: 1000, balance_after: 750, metadata: { feeBurned: 13 } });
    expect(ledger.data?.find((l) => l.player_id === playerId)).toMatchObject({ amount: 237, balance_before: 0, balance_after: 237 });
    const row = await db.from("heroes").select("player_id, is_listed").eq("id", id).single();
    expect(row.data).toEqual({ player_id: otherId, is_listed: false });
    await db.from("transactions_pending").delete().eq("player_id", otherId);
    await db.from("heroes").delete().eq("id", id);
    await db.from("players").update({ coins: 500050 }).eq("id", playerId);
  }, 30000);
  it("persists hero state only for the owning player", async () => {
    if (!db) throw new Error("Database unavailable");
    const state = [{ id: heroId, energy: 80, onMap: true, recoveryAt: Date.now() }];
    expect((await db.rpc("save_heroes_state", { p_player_id: playerId, p_heroes: state })).error).toBeNull();
    await db.rpc("save_heroes_state", { p_player_id: otherId, p_heroes: [{ ...state[0], energy: 0 }] });
    const row = await db.from("heroes").select("energy,on_map").eq("id", heroId).single();
    expect(row.data).toEqual({ energy: 80, on_map: true });
  });
  it("stores and returns the hero name directly without a minted-number suffix", async () => {
    if (!db) throw new Error("Database unavailable");
    const row = await db.from("heroes").select("id,name,level").eq("id", heroId).single();
    expect(row.error).toBeNull();
    expect(row.data?.name).toBe("Timmy");
    expect(row.data?.level).toBe(1);
    expect(row.data?.id).toMatch(/^hero_[0-9a-f]{12}$/);
  });
  it("queues a withdrawal and rejects overdrafts without extra queue rows", async () => {
    if (!db) throw new Error("Database unavailable");
    const args = { p_player_id: playerId, p_amount: 50, p_address: wallet };
    const withdrawal = await db.rpc("request_withdrawal", args);
    expect(withdrawal.error).toBeNull();
    expect(withdrawal.data.coins).toBe(500000);
    const rejected = await db.rpc("request_withdrawal", { ...args, p_amount: 500001 });
    expect(rejected.error?.message).toContain("not_enough_coins");
    const queue = await db.from("transactions_pending").select("payload").eq("player_id", playerId);
    expect(queue.data).toEqual([{ payload: { address: wallet, amount: 50 } }]);
  });
  it("denies direct browser access to private rows and mutation functions", async () => {
    if (!url) throw new Error("Database unavailable");
    const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!publicKey) throw new Error("Publishable key unavailable");
    const anon = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (publicKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${publicKey}`) headers.delete("Authorization");
        headers.set("apikey", publicKey);
        return fetch(input, { ...init, headers });
      } },
    });
    const read = await anon.from("players").select("id");
    expect(read.data ?? []).toEqual([]);
    if (read.error) expect(read.error.code).toBe("42501");
    const write = await anon.rpc("request_withdrawal", { p_player_id: playerId, p_amount: 1, p_address: wallet });
    expect(write.error?.code).toBe("42501");
    const sessions = await anon.from("game_sessions").select("session_token");
    expect(sessions.data ?? []).toEqual([]);
    const takeover = await anon.rpc("start_or_renew_game_session", { p_player_id: playerId });
    expect(takeover.error?.code).toBe("42501");
  });
});