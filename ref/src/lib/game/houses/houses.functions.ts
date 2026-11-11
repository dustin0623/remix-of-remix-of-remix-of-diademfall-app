import { createServerFn } from "@tanstack/react-start";
import { requirePlayer } from "@/lib/game/session/player.server";
import { energyAfterRest } from "@/lib/game/dungeon/rules";
import { demoNftId, HOUSE_TIERS, houseBonusFor, isHouseRarity, type HouseRarity, type PlayerHouse } from "./houses";

const base = (input: { playerId?: unknown; token?: unknown }) => {
  if (typeof input?.playerId !== "string" || typeof input?.token !== "string") throw new Error("Invalid input");
  return { playerId: input.playerId, token: input.token };
};

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** Lists the player's registered houses. */
export const listHouses = createServerFn({ method: "POST" })
  .inputValidator(base)
  .handler(async ({ data }): Promise<PlayerHouse[]> => {
    const row = await requirePlayer(data.playerId, data.token);
    const { data: rows, error } = await (await admin())
      .from("player_houses").select("*").eq("player_id", row.id).order("registered_at");
    if (error) throw new Error("Could not load houses");
    return (rows ?? []).map((h) => ({
      id: h.id, nftId: h.nft_id, rarity: h.rarity as HouseRarity, isDemo: h.is_demo, registeredAt: h.registered_at,
    }));
  });

/** Demo: registers a test house of the chosen tier (real XRPL NFT check comes later). */
export const registerDemoHouse = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId?: unknown; token?: unknown; rarity?: unknown }) => {
    if (!isHouseRarity(input?.rarity)) throw new Error("Unknown house");
    return { ...base(input), rarity: input.rarity };
  })
  .handler(async ({ data }) => {
    const row = await requirePlayer(data.playerId, data.token);
    const { error } = await (await admin()).rpc("register_house", {
      p_player_id: row.id, p_nft_id: demoNftId(row.id, data.rarity), p_rarity: data.rarity, p_is_demo: true,
    });
    if (error) throw new Error(
      error.message.includes("house_taken") ? "That house belongs to someone else"
        : error.message.includes("one_house_only") ? "You can only have one active house — remove yours first"
        : "Could not register house",
    );
    return { ok: true };
  });

export const unregisterHouse = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId?: unknown; token?: unknown; houseId?: unknown }) => {
    if (typeof input?.houseId !== "string") throw new Error("Invalid input");
    return { ...base(input), houseId: input.houseId };
  })
  .handler(async ({ data }) => {
    const row = await requirePlayer(data.playerId, data.token);
    const { error } = await (await admin()).rpc("unregister_house", { p_player_id: row.id, p_house_id: data.houseId });
    if (error) throw new Error("Could not remove house");
    return { ok: true };
  });

/**
 * Puts a resting hero into a house (houseId) or takes it out (null). Energy
 * earned so far is settled at the old rate before the rate changes.
 */
export const setHeroHouse = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId?: unknown; token?: unknown; heroId?: unknown; houseId?: unknown }) => {
    if (typeof input?.heroId !== "string") throw new Error("Invalid input");
    if (input.houseId !== null && typeof input.houseId !== "string") throw new Error("Invalid input");
    return { ...base(input), heroId: input.heroId, houseId: input.houseId as string | null };
  })
  .handler(async ({ data }): Promise<{ energy: number }> => {
    const row = await requirePlayer(data.playerId, data.token);
    const db = await admin();
    const { data: hero } = await db.from("heroes")
      .select("energy, max_energy, skills, on_map, recovery_at, house:player_houses(rarity)")
      .eq("id", data.heroId).eq("player_id", row.id).eq("is_burned", false).maybeSingle();
    if (!hero) throw new Error("Hero not found");
    let capacity = 0;
    if (data.houseId) {
      const { data: house } = await db.from("player_houses").select("rarity").eq("id", data.houseId).eq("player_id", row.id).maybeSingle();
      if (!house || !isHouseRarity(house.rarity)) throw new Error("House not found");
      capacity = HOUSE_TIERS[house.rarity].slots;
    }
    const energy = hero.on_map ? hero.energy : Math.floor(energyAfterRest(
      hero.energy, hero.max_energy, Date.now() - new Date(hero.recovery_at).getTime(),
      (hero.skills ?? []).includes("quick_rest"), houseBonusFor(hero.house?.rarity),
    ));
    const { error } = await db.rpc("set_hero_house", {
      p_player_id: row.id, p_hero_id: data.heroId, p_house_id: data.houseId as string, p_capacity: capacity, p_energy: energy,
    });
    if (error) {
      const m = error.message;
      throw new Error(m.includes("house_full") ? "This house is full" : m.includes("hero_on_map") ? "Recall the hero first"
        : m.includes("hero_listed") ? "Cancel the sale first" : "Could not move hero");
    }
    return { energy };
  });
