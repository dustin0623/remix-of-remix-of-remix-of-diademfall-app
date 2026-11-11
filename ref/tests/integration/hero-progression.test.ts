import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { rollHero } from "@/lib/game/heroes/mint";
import { buildHeroAtLevel, rollStatUpgrade } from "@/lib/game/heroes/leveling";
import { HeroRarity } from "@/game/data/HeroRarity";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !key)("persisted hero progression", () => {
  it("persists a rolled level and rejects cheap upgrade quotes before charging 5,000 then 20,000", async () => {
    if (!url || !key) throw new Error("Test connection unavailable");
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const id = crypto.randomUUID();
    const created = await db.from("players").insert({ id, is_test: true, username: `rng_${id.slice(0, 8)}`, coins: 500_000 });
    expect(created.error).toBeNull();
    try {
      let i = 0;
      const values = [0, 0, 0.99, 0, 0, 0, 0];
      const lucky = rollHero(() => values[i++] ?? 0);
      const base = rollHero(() => 0);
      const mint = await db.rpc("mint_heroes", { p_player_id: id, p_cost: 200_000, p_heroes: [lucky, base] });
      expect(mint.error).toBeNull();
      expect(mint.data.heroes[0]).toMatchObject({ level: 3, power: 4 });
      const persisted = await db.from("heroes").select("level,power").eq("id", mint.data.heroes[0].id).single();
      expect(persisted.data).toEqual({ level: 3, power: 4 });
      const heroId = mint.data.heroes[1].id;
      const next = rollStatUpgrade(HeroRarity.Common, buildHeroAtLevel(HeroRarity.Common, 1), () => 0);
      if (!next) throw new Error("Expected upgrade");
      const args = { p_player_id: id, p_hero_id: heroId, p_expected_level: 1, p_stats: next.stats };
      const cheap = await db.rpc("level_up_hero", { ...args, p_cost: 2_500 });
      expect(cheap.error?.message).toContain("invalid_level_up_cost");
      const balance = await db.from("players").select("coins").eq("id", id).single();
      expect(balance.data?.coins).toBe(300_000);
      const first = await db.rpc("level_up_hero", { ...args, p_cost: 5_000 });
      expect(first.error).toBeNull();
      expect(first.data.coins).toBe(295_000);
      const nextAgain = rollStatUpgrade(HeroRarity.Common, next.stats, () => 0);
      if (!nextAgain) throw new Error("Expected second upgrade");
      const second = await db.rpc("level_up_hero", { ...args, p_expected_level: 2, p_stats: nextAgain.stats, p_cost: 20_000 });
      expect(second.error).toBeNull();
      expect(second.data.coins).toBe(275_000);
    } finally {
      await db.from("players").delete().eq("id", id).eq("is_test", true);
    }
  }, 30000);
});