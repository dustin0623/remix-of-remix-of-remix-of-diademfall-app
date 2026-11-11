import { createServerFn } from "@tanstack/react-start";
import { requirePlayer } from "@/lib/game/session/player.server";
import type { SessionHero } from "@/lib/game/session/types";
import { FUSION_DAILY_LIMIT, fusionRecipe, levelUpCost, rollFusedHero, rollStatUpgrade, type UpgradeStat } from "./leveling";
import { heroStrength } from "./ranking";

const str = (v: unknown) => { if (typeof v !== "string" || !v || v.length > 128) throw new Error("Invalid input"); return v; };

export const levelUpHero = createServerFn({ method: "POST" })
  .inputValidator((i: { playerId?: string; token?: string; heroId?: string }) => ({ playerId: str(i?.playerId), token: str(i?.token), heroId: str(i?.heroId) }))
  .handler(async ({ data }): Promise<{ coins: number; stat: UpgradeStat; hero: Partial<SessionHero> }> => {
    const row = await requirePlayer(data.playerId, data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: h } = await supabaseAdmin.from("heroes").select("*").eq("id", data.heroId).eq("player_id", row.id).eq("is_burned", false).maybeSingle();
    if (!h) throw new Error("Hero not found");
    const cost = levelUpCost(h.level);
    if (cost === null) throw new Error("Hero is already max level");
    const rolled = rollStatUpgrade(h.rarity, {
      level: h.level, power: h.power, speed: h.speed, stamina: h.stamina,
      bombNumber: h.bomb_number, bombRange: h.bomb_range, maxEnergy: h.max_energy,
    });
    if (!rolled) throw new Error("All stats are already maxed");
    const { data: result, error } = await supabaseAdmin.rpc("level_up_hero", {
      p_player_id: row.id, p_hero_id: h.id, p_cost: cost, p_expected_level: h.level, p_stats: rolled.stats as never,
    });
    if (error) {
      if (error.message.includes("not_enough_coins")) throw new Error("Not enough coins");
      if (error.message.includes("hero_listed")) throw new Error("Cancel the sale before leveling up");
      if (error.message.includes("level_changed")) throw new Error("Hero changed — refresh and try again");
      throw new Error("Level up failed — try again");
    }
    const r = result as unknown as { coins: number; energy: number };
    return { coins: Number(r.coins), stat: rolled.stat, hero: { ...rolled.stats, energy: r.energy } };
  });

export interface FusionResult { coins: number; success: boolean; hero?: SessionHero | undefined; burnedIds: string[] }

export const fuseHeroes = createServerFn({ method: "POST" })
  .inputValidator((i: { playerId?: string; token?: string; heroIds?: unknown }) => {
    if (!Array.isArray(i?.heroIds) || i.heroIds.length !== 3) throw new Error("Pick 3 heroes");
    return { playerId: str(i.playerId), token: str(i.token), heroIds: i.heroIds.map(str) };
  })
  .handler(async ({ data }): Promise<FusionResult> => {
    if (new Set(data.heroIds).size !== 3) throw new Error("Pick 3 different heroes");
    const row = await requirePlayer(data.playerId, data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("heroes").select("*").in("id", data.heroIds).eq("player_id", row.id).eq("is_burned", false);
    if (!rows || rows.length !== 3) throw new Error("Hero not found");
    const rarity = rows[0]!.rarity;
    if (rows.some((h) => h.rarity !== rarity)) throw new Error("Heroes must share a rarity");
    const recipe = fusionRecipe(rarity);
    if (!recipe) throw new Error("This rarity can't be fused");
    const success = Math.random() < recipe.chance;
    const strength = (h: (typeof rows)[number]) => heroStrength({ id: h.id, name: h.name, rarity: h.rarity, level: h.level, power: h.power, speed: h.speed, stamina: h.stamina, bombNumber: h.bomb_number, bombRange: h.bomb_range });
    const weakest = [...rows].sort((a, b) => strength(a) - strength(b) || a.id.localeCompare(b.id))[0]!;
    const newHero = rollFusedHero(recipe, rows.map((h) => h.level));
    const { data: result, error } = await supabaseAdmin.rpc("fuse_heroes", {
      p_player_id: row.id, p_hero_ids: data.heroIds, p_rarity: rarity, p_fee: recipe.fee,
      p_daily_limit: FUSION_DAILY_LIMIT, p_success: success, p_burn_id: weakest.id, p_new_hero: newHero as never,
    });
    if (error) {
      if (error.message.includes("not_enough_coins")) throw new Error("Not enough coins");
      if (error.message.includes("fusion_limit")) throw new Error(`Daily limit reached (${FUSION_DAILY_LIMIT} fusions per day)`);
      if (error.message.includes("heroes_unavailable")) throw new Error("Recall, unlist and take heroes out of houses first");
      throw new Error("Fusion failed — try again");
    }
    const r = result as unknown as { coins: number; success: boolean; hero?: SessionHero; burnedId?: string };
    return { coins: Number(r.coins), success: r.success, hero: r.hero, burnedIds: r.success ? data.heroIds : [r.burnedId!] };
  });
