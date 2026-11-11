import { createServerFn } from "@tanstack/react-start";
import { requirePlayer } from "@/lib/game/session/player.server";

import type { SessionHero } from "@/lib/game/session/types";

export interface MarketListing {
  id: string;
  name: string;
  rarity: string;
  level: number;
  power: number;
  speed: number;
  stamina: number;
  bombNumber: number;
  bombRange: number;
  skills: string[];
  price: number;
  /** Seller display name. */
  seller: string;
  listedAt: number;
  mine: boolean;
}

type Auth = { playerId: string; token: string };
const auth = (i: { playerId?: unknown; token?: unknown }): Auth => {
  if (typeof i?.playerId !== "string" || typeof i?.token !== "string") throw new Error("Invalid input");
  return { playerId: i.playerId, token: i.token };
};
const heroId = (v: unknown) => {
  if (typeof v !== "string" || !/^[\w-]{1,64}$/.test(v)) throw new Error("Invalid hero");
  return v;
};
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

export const listMarket = createServerFn({ method: "POST" })
  .inputValidator(auth)
  .handler(async ({ data }): Promise<MarketListing[]> => {
    const me = await requirePlayer(data.playerId, data.token);
    const { data: rows, error } = await (await admin())
      .from("heroes")
      .select("id, player_id, name, rarity, level, power, speed, stamina, bomb_number, bomb_range, skills, market_price, listed_at")
      .eq("is_listed", true)
      .eq("is_burned", false)
      .is("purchase_tx", null)
      .order("listed_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Could not load the marketplace");
    const ids = [...new Set((rows ?? []).map((r) => r.player_id))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: sellers } = await (await admin()).from("players").select("id, username").in("id", ids);
      for (const p of sellers ?? []) names.set(p.id, p.username ?? "");
    }
    return (rows ?? []).map((r) => {
      return {
        id: r.id, name: r.name, rarity: r.rarity, level: r.level ?? 1,
        power: r.power, speed: r.speed, stamina: r.stamina,
        bombNumber: r.bomb_number, bombRange: r.bomb_range, skills: r.skills ?? [],
        price: Number(r.market_price ?? 0),
        seller: names.get(r.player_id) || "Unknown",
        listedAt: r.listed_at ? new Date(r.listed_at).getTime() : 0,
        mine: r.player_id === me.id,
      };
    });
  });

export const listHeroForSale = createServerFn({ method: "POST" })
  .inputValidator((i: { playerId?: unknown; token?: unknown; heroId?: unknown; price?: unknown }) => {
    const price = Number(i?.price);
    if (!Number.isSafeInteger(price) || price <= 0) throw new Error("Enter a whole price above 0");
    return { ...auth(i), heroId: heroId(i.heroId), price };
  })
  .handler(async ({ data }) => {
    const me = await requirePlayer(data.playerId, data.token);
    const { error } = await (await admin()).rpc("list_hero", { p_player_id: me.id, p_hero_id: data.heroId, p_price: data.price });
    if (error) throw new Error(error.message.includes("cannot_list") ? "Recall the hero before selling it" : "Could not list hero");
    return { ok: true };
  });

export const cancelHeroListing = createServerFn({ method: "POST" })
  .inputValidator((i: { playerId?: unknown; token?: unknown; heroId?: unknown }) => ({ ...auth(i), heroId: heroId(i.heroId) }))
  .handler(async ({ data }) => {
    const me = await requirePlayer(data.playerId, data.token);
    const { error } = await (await admin()).rpc("cancel_hero_listing", { p_player_id: me.id, p_hero_id: data.heroId });
    if (error) throw new Error("This listing is no longer available to cancel");
    return { ok: true };
  });

export type MarketPurchase = { coins: number; hero: SessionHero; fee: number; proceeds: number; reference: string };

export const buyMarketHero = createServerFn({ method: "POST" })
  .inputValidator((i: { playerId?: unknown; token?: unknown; heroId?: unknown; price?: unknown }) => {
    if (!Number.isSafeInteger(i.price) || Number(i.price) <= 0) throw new Error("Invalid price");
    return { ...auth(i), heroId: heroId(i.heroId), price: Number(i.price) };
  })
  .handler(async ({ data }): Promise<MarketPurchase> => {
    const me = await requirePlayer(data.playerId, data.token);
    const { data: result, error } = await (await admin()).rpc("buy_market_hero", { p_buyer_id: me.id, p_hero_id: data.heroId, p_expected_price: data.price });
    if (error) {
      if (error.message.includes("not_enough_coins")) throw new Error("Insufficient coins");
      if (error.message.includes("price_changed")) throw new Error("The price changed — refresh the market before buying");
      if (error.message.includes("self_purchase")) throw new Error("You cannot buy your own listing");
      if (error.message.includes("hero_unavailable")) throw new Error("This hero is no longer available");
      throw new Error("Could not buy hero — no coins were charged");
    }
    return result as unknown as MarketPurchase;
  });
