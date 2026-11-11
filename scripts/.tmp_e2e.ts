import { createClient } from "@supabase/supabase-js";
import { CATALOG_VERSION } from "../src/game/catalogs";
import { openPack, PACK_ALGORITHM, PACK_IDS, randomSeed } from "../src/game/packs";
import { openChestTrusted } from "../src/lib/ranked/chests.server";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ok = <T,>(l: string, r: { data: T; error: any }) => { if (r.error) throw new Error(l + ": " + r.error.message); return r.data; };
const check = (l: string, c: boolean, extra?: unknown) => { console.log((c ? "PASS " : "FAIL ") + l, extra === undefined ? "" : JSON.stringify(extra)); if (!c) process.exitCode = 1; };
const TABLES = ["card_combinations","card_listings","currency_ledger","game_secrets","item_openings","player_cards","player_items","profiles","rental_contracts","treasury_flows","wallet_transfers","player_ratings","pack_openings","division_chests","market_listings","rental_listings","transactions_pending","transactions_processed"];
async function counts() { const o: Record<string, number> = {}; for (const t of TABLES) o[t] = (await db.from(t as never).select("*", { count: "exact", head: true })).count ?? -1; return o; }
const before = await counts();
const packSupply = ok("ps", await db.from("pack_supply").select("*"));
const cardSupply = ok("cs", await db.from("cards").select("id,total_printed,total_combined"));
const reserve = ok("rs", await db.from("legionnaire_reward_reserve").select("*"));
const ids: string[] = [];
try {
  const mk = async (n: string) => { const { data, error } = await db.auth.admin.createUser({ email: `e2e-${n}-${Date.now()}@example.com`, password: "Tmp-" + crypto.randomUUID(), email_confirm: true, user_metadata: { username: "e2e" + n } }); if (error) throw error; ids.push(data.user.id); return data.user.id; };
  const A = await mk("seller"), B = await mk("buyer");
  const grant = (p: string, cur: string, amt: number, k: string) => db.rpc("record_ledger_entry", { p_player_id: p, p_currency: cur, p_amount: amt, p_entry_type: "admin_adjustment", p_idempotency_key: "e2e:" + k + ":" + p, p_reference_type: "test", p_reference_id: "e2e", p_metadata: {} } as never);
  ok("grant A credits", await grant(A, "credits", 100000, "c")); ok("grant B coins", await grant(B, "coins", 100, "b")); ok("grant A coins", await grant(A, "coins", 50, "a"));
  const pack = PACK_IDS.find((p) => packSupply.some((s: any) => s.set_id === p))!;
  const buy = await db.rpc("purchase_packs", { p_player_id: A, p_set_id: pack, p_quantity: 2, p_idempotency_key: "e2e:buy:" + A });
  check("buy 2 packs", !buy.error, buy.error?.message ?? buy.data);
  for (let i = 0; i < 2; i++) {
    const c = ok("commit", await db.rpc("commit_pack_opening", { p_player_id: A, p_set_id: pack, p_server_seed: randomSeed(), p_algorithm: PACK_ALGORITHM, p_catalog_version: CATALOG_VERSION })) as any;
    const secret = ok("secret", await db.from("game_secrets").select("server_seed").eq("action_type", "pack_opening").eq("target_id", c.openingId).eq("status", "committed").single());
    const pulls = openPack(pack, secret.server_seed, "e2e-client-seed-" + i, c.openingId, PACK_ALGORITHM);
    const r = ok("reveal", await db.rpc("reveal_pack_opening", { p_player_id: A, p_opening_id: c.openingId, p_client_seed: "e2e-client-seed-" + i, p_results: pulls as never })) as any;
    check(`pack ${i + 1} reveals 5 cards`, r.results.length === 5);
  }
  const cards = ok("cards", await db.from("player_cards").select("id, card_id").eq("player_id", A));
  check("A owns 10 cards", cards.length === 10);
  const opens = ok("op", await db.from("item_openings").select("status").eq("player_id", A).eq("item_type", "pack"));
  check("2 pack openings revealed in item_openings", opens.length === 2 && opens.every((o: any) => o.status === "revealed"), opens);
  const items = ok("it", await db.from("player_items").select("item_type,item_id,balance").eq("player_id", A).eq("item_type", "pack"));
  check("no unopened packs left", items.every((i: any) => i.balance === 0), items);
  // sale
  ok("list sale", await db.rpc("market_list_card", { p_player_id: A, p_asset_id: cards[0].id, p_price: 5 }));
  const sale = ok("sl", await db.from("card_listings").select("id,status,listing_type").eq("asset_id", cards[0].id).single());
  check("sale listing in card_listings", sale.listing_type === "sale" && sale.status === "active", sale);
  ok("buy", await db.rpc("market_buy", { p_buyer_id: B, p_listing_id: sale.id }));
  const moved = ok("mv", await db.from("player_cards").select("player_id").eq("id", cards[0].id).single());
  const sold = ok("sd", await db.from("card_listings").select("status,buyer_id").eq("id", sale.id).single());
  check("card moved to buyer, listing sold", moved.player_id === B && sold.buyer_id === B, sold);
  // cancel
  ok("list2", await db.rpc("market_list_card", { p_player_id: A, p_asset_id: cards[1].id, p_price: 7 }));
  const l2 = ok("l2", await db.from("card_listings").select("id").eq("asset_id", cards[1].id).eq("status", "active").single());
  ok("cancel", await db.rpc("market_cancel_listing", { p_player_id: A, p_listing_id: l2.id }));
  const l2s = ok("l2s", await db.from("card_listings").select("status").eq("id", l2.id).single());
  check("cancelled sale listing", l2s.status !== "active", l2s);
  // rental
  ok("list rent", await db.rpc("rental_list_card", { p_player_id: A, p_asset_id: cards[2].id, p_price_per_day: 1, p_minimum_days: 1, p_maximum_days: 3 }));
  const rl = ok("rl", await db.from("card_listings").select("id,listing_type").eq("asset_id", cards[2].id).eq("status", "active").single());
  ok("rent", await db.rpc("rental_rent", { p_renter_id: B, p_listing_id: rl.id, p_days: 2 }));
  const rc = ok("rc", await db.from("rental_contracts").select("renter_id,owner_id").eq("listing_id", rl.id));
  check("rental contract created from card_listings", rl.listing_type === "rental" && rc.length === 1 && rc[0].renter_id === B, rc);
  const stacks = ok("st", await db.from("player_card_stacks").select("*").eq("player_id", B));
  check("buyer's playable cards include bought + rented", stacks.length >= 1, stacks.length);
  // chest
  const season = ok("se", await db.from("ranked_seasons").select("key").eq("status", "active").single());
  const chestId = ok("chest", await db.rpc("_new_division_chest", { p_season: season.key, p_player: A, p_division: "bronze-3", p_type: "scout", p_ordinal: 1, p_match: null } as never)) as string;
  const chestItem = ok("ci", await db.from("player_items").select("balance").eq("player_id", A).eq("item_type", "chest").eq("item_id", "scout").single());
  check("chest granted (item_openings + player_items)", !!chestId && chestItem.balance === 1, { chestId, chestItem });
  const opened = await openChestTrusted(db as never, A, chestId, "e2e-chest-seed");
  check("chest opens", opened.ok, opened.ok ? opened.chest.rolls.length : opened.error);
  const ch = ok("ch", await db.from("item_openings").select("status,server_seed").eq("id", chestId).single());
  const chestItem2 = ok("ci2", await db.from("player_items").select("balance").eq("player_id", A).eq("item_type", "chest").eq("item_id", "scout").single());
  check("chest revealed, seed public, inventory 0", ch.status !== "unopened" && !!ch.server_seed && chestItem2.balance === 0, { status: ch.status, bal: chestItem2.balance });
  // withdrawal
  const tx = crypto.randomUUID();
  const w = await db.rpc("request_withdrawal", { p_player_id: A, p_transaction_id: tx, p_amount: 2, p_address: "11111111111111111111111111111111", p_symbol: "COIN", p_test: true } as never);
  check("withdrawal request accepted", !w.error, w.error?.message);
  const wt = ok("wt", await db.from("wallet_transfers").select("type,status").eq("transaction_id", tx));
  const coins = ok("co", await db.from("player_items").select("balance").eq("player_id", A).eq("item_type", "currency").eq("item_id", "coins").single());
  check("withdrawal queued in wallet_transfers + coins debited", wt.length === 1, { wt, coins });
  const after = await counts();
  const legacy = ["pack_openings","division_chests","market_listings","rental_listings","transactions_pending","transactions_processed"];
  check("old tables untouched", legacy.every((t) => after[t] === before[t]), Object.fromEntries(legacy.map((t) => [t, after[t]])));
} catch (e) { console.log("FAIL exception", String(e)); process.exitCode = 1; }
finally {
  for (const id of ids) {
    await db.from("rental_contracts").delete().or(`renter_id.eq.${id},owner_id.eq.${id}`);
    await db.from("card_listings").delete().or(`owner_id.eq.${id},buyer_id.eq.${id}`);
    await db.from("card_combinations").delete().eq("player_id", id);
  }
  for (const id of ids) { await db.from("player_cards").update({ combined_to: null } as never).eq("player_id", id); }
  for (const id of ids) {
    const r1 = await db.from("player_cards").delete().eq("player_id", id); if (r1.error) console.log("cleanup cards", r1.error.message);
    const r2 = await db.from("currency_ledger").delete().eq("player_id", id); if (r2.error) console.log("cleanup ledger", r2.error.message);
    await db.from("treasury_flows").delete().or(`reference_id.eq.e2e,metadata->>player_id.eq.${id}`);
    const r3 = await db.auth.admin.deleteUser(id); if (r3.error) console.log("cleanup user", r3.error.message);
  }
  for (const s of packSupply as any[]) await db.from("pack_supply").update(s).eq("set_id", s.set_id);
  for (const c of cardSupply as any[]) await db.from("cards").update({ total_printed: c.total_printed, total_combined: c.total_combined } as never).eq("id", c.id);
  for (const r of reserve as any[]) await db.from("legionnaire_reward_reserve").update(r).eq("rarity", r.rarity);
  const end = await counts();
  console.log("leftover diffs:", JSON.stringify(Object.fromEntries(TABLES.filter((t) => end[t] !== before[t]).map((t) => [t, [before[t], end[t]]]))));
}
