import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_RENTAL_DAYS, MIN_PRICE_COINS } from "@/game/market";

const loadAdmin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const price = z.number().min(MIN_PRICE_COINS).max(1_000_000_000).refine((v) => Math.round(v * 1e8) === v * 1e8, "At most 8 decimals");

export type Foil = "regular" | "gold";
export type SaleListing = { id: string; assetId: string; cardId: string; foil: Foil; essence: number; level: number; price: string; seller: string; sellerId: string; createdAt: string };
export type RentalListing = { id: string; assetId: string; cardId: string; foil: Foil; essence: number; level: number; pricePerDay: string; minDays: number; maxDays: number; owner: string; ownerId: string; status: string };
export type RentalContract = { id: string; cardId: string; foil: Foil; essence: number; level: number; days: number; endsAt: string; gross: string; counterparty: string };
export type MyAsset = { id: string; cardId: string; foil: Foil; essence: number; level: number; status: string };
export type MarketState = {
  sales: SaleListing[];
  rentals: RentalListing[];
  mine: { assets: MyAsset[]; sales: SaleListing[]; rentals: RentalListing[]; renting: RentalContract[]; rentedOut: RentalContract[] };
};
type Result = { ok: true } | { ok: false; error: string };

/** CE and level of the listed asset (embedded player_cards row). */
const ce = (a: unknown) => {
  const v = (Array.isArray(a) ? a[0] : a) as { essence: number; level: number } | null;
  return { essence: v?.essence ?? 1, level: v?.level ?? 1 };
};

const name = (p: unknown) => {
  const v = p as { username: string; display_name: string | null } | null;
  return v?.display_name ?? v?.username ?? "Unknown";
};

/** Everything the Market page shows; hands back ended rentals first. */
export const getMarketState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MarketState> => {
    const { supabase, userId } = context;
    const admin = await loadAdmin();
    const { error: expErr } = await admin.rpc("expire_rentals");
    if (expErr) console.error("[market] expire_rentals failed", expErr);
    const saleCols = "id, asset_id, card_id, foil, price_coins::text, seller_id, created_at, asset:player_cards(essence, level), profiles!market_listings_seller_id_fkey(username, display_name)";
    const rentCols = "id, asset_id, card_id, foil, price_coins_per_day::text, minimum_days, maximum_days, owner_id, status, asset:player_cards(essence, level), profiles!rental_listings_owner_id_fkey(username, display_name)";
    const contractCols = "id, card_id, foil, days, ends_at, gross_coins::text, asset:player_cards(essence, level), owner:profiles!rental_contracts_owner_id_fkey(username, display_name), renter:profiles!rental_contracts_renter_id_fkey(username, display_name)";
    const [sales, rentals, assets, mySales, myRentals, renting, rentedOut] = await Promise.all([
      supabase.from("market_listings").select(saleCols).eq("status", "active").neq("seller_id", userId).order("created_at", { ascending: false }).limit(200),
      supabase.from("rental_listings").select(rentCols).eq("status", "active").neq("owner_id", userId).order("created_at", { ascending: false }).limit(200),
      supabase.from("player_cards").select("id, card_id, foil, essence, level, status").eq("player_id", userId).eq("is_combined", false).neq("status", "burned").order("created_at", { ascending: false }).limit(1000),
      supabase.from("market_listings").select(saleCols).eq("status", "active").eq("seller_id", userId).order("created_at", { ascending: false }),
      supabase.from("rental_listings").select(rentCols).in("status", ["active", "rented"]).eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("rental_contracts").select(contractCols).eq("status", "active").eq("renter_id", userId).order("ends_at"),
      supabase.from("rental_contracts").select(contractCols).eq("status", "active").eq("owner_id", userId).order("ends_at"),
    ]);
    for (const r of [sales, rentals, assets, mySales, myRentals, renting, rentedOut]) if (r.error) console.error("[market] read failed", r.error);
    type SaleRow = { id: string; asset_id: string; card_id: string; foil: Foil; price_coins: string; seller_id: string; created_at: string; asset: unknown; profiles: unknown };
    type RentRow = { id: string; asset_id: string; card_id: string; foil: Foil; price_coins_per_day: string; minimum_days: number; maximum_days: number; owner_id: string; status: string; asset: unknown; profiles: unknown };
    type ContractRow = { id: string; card_id: string; foil: Foil; days: number; ends_at: string; gross_coins: string; asset: unknown; owner: unknown; renter: unknown };
    const toSale = (r: SaleRow): SaleListing => ({ id: r.id, assetId: r.asset_id, cardId: r.card_id, foil: r.foil, ...ce(r.asset), price: r.price_coins, seller: name(r.profiles), sellerId: r.seller_id, createdAt: r.created_at });
    const toRent = (r: RentRow): RentalListing => ({ id: r.id, assetId: r.asset_id, cardId: r.card_id, foil: r.foil, ...ce(r.asset), pricePerDay: r.price_coins_per_day,
      minDays: r.minimum_days, maxDays: r.maximum_days, owner: name(r.profiles), ownerId: r.owner_id, status: r.status });
    const toContract = (r: ContractRow, who: "owner" | "renter"): RentalContract => ({ id: r.id, cardId: r.card_id, foil: r.foil, ...ce(r.asset), days: r.days, endsAt: r.ends_at, gross: r.gross_coins, counterparty: name(r[who]) });
    return {
      sales: ((sales.data ?? []) as unknown as SaleRow[]).map(toSale),
      rentals: ((rentals.data ?? []) as unknown as RentRow[]).map(toRent),
      mine: {
        assets: (assets.data ?? []).map((a) => ({ id: a.id, cardId: a.card_id, foil: a.foil as Foil, essence: a.essence, level: a.level, status: a.status })),
        sales: ((mySales.data ?? []) as unknown as SaleRow[]).map(toSale),
        rentals: ((myRentals.data ?? []) as unknown as RentRow[]).map(toRent),
        renting: ((renting.data ?? []) as unknown as ContractRow[]).map((r) => toContract(r, "owner")),
        rentedOut: ((rentedOut.data ?? []) as unknown as ContractRow[]).map((r) => toContract(r, "renter")),
      },
    };
  });

const friendly = (m: string, fallback: string) =>
  m.includes("Insufficient balance") ? "Not enough Coins."
  : m.includes("no longer available") ? "Someone else got this card first."
  : m.includes("not available") ? "That card is already listed, rented out or in use."
  : m.includes("own card") ? "You can't buy or rent your own card."
  : m.includes("rented out") ? "This card is rented out. You can cancel the listing after the rental ends."
  : m.includes("Not your") ? "That isn't yours."
  : m.includes("Invalid rental days") ? "Pick a number of days the owner allows."
  : fallback;

async function call(fn: string, args: Record<string, unknown>, fallback: string): Promise<Result> {
  const admin = await loadAdmin();
  const { error } = await admin.rpc(fn as never, args as never);
  if (error) { console.error(`[market] ${fn} failed`, error); return { ok: false, error: friendly(error.message ?? "", fallback) }; }
  return { ok: true };
}

export const listCardForSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assetId: z.string().uuid(), price }).parse(d))
  .handler(({ data, context }) => call("market_list_card", { p_player_id: context.userId, p_asset_id: data.assetId, p_price: data.price }, "Couldn't list the card."));

export const cancelSaleListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(({ data, context }) => call("market_cancel_listing", { p_player_id: context.userId, p_listing_id: data.listingId }, "Couldn't cancel the listing."));

export const buyCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(({ data, context }) => call("market_buy", { p_buyer_id: context.userId, p_listing_id: data.listingId }, "Purchase failed. Try again."));

export const listCardForRent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    assetId: z.string().uuid(), pricePerDay: price, minDays: z.number().int().min(1).max(MAX_RENTAL_DAYS), maxDays: z.number().int().min(1).max(MAX_RENTAL_DAYS),
  }).refine((v) => v.maxDays >= v.minDays, "Longest rental must be at least the shortest").parse(d))
  .handler(({ data, context }) => call("rental_list_card", {
    p_player_id: context.userId, p_asset_id: data.assetId, p_price_per_day: data.pricePerDay, p_minimum_days: data.minDays, p_maximum_days: data.maxDays,
  }, "Couldn't list the card for rent."));

export const cancelRentalListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(({ data, context }) => call("rental_cancel_listing", { p_player_id: context.userId, p_listing_id: data.listingId }, "Couldn't cancel the rental listing."));

export const rentCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ listingId: z.string().uuid(), days: z.number().int().min(1).max(MAX_RENTAL_DAYS) }).parse(d))
  .handler(({ data, context }) => call("rental_rent", { p_renter_id: context.userId, p_listing_id: data.listingId, p_days: data.days }, "Rental failed. Try again."));
