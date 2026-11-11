import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ChestType } from "@/game/divisions";
import type { ChestRoll, Reserve } from "@/game/chests";

const loadAdmin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

export interface ChestRow {
  id: string; type: ChestType; divisionId: string; status: "unopened" | "opened" | "auto_opened";
  commitHash: string; serverSeed: string | null; clientSeed: string | null; reserve: Reserve | null;
  rolls: (ChestRoll & { assetId?: string })[] | null; coinShares: string; credits: number; createdAt: string;
}
export interface SeasonStatus {
  season: { key: string; number: number; startsAt: string; endsAt: string };
  rating: number; wins: number; losses: number; draws: number; winStreak: number;
  chests: ChestRow[];
  seasonCoinShares: string;
}

/** Active season, the player's season rating/streak and their chests (rolls the season over first when it has ended). */
export const getSeasonStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeasonStatus | null> => {
    const { supabase, userId } = context;
    const admin = await loadAdmin();
    const { rolloverSeasonIfDue } = await import("./chests.server");
    await rolloverSeasonIfDue(admin);
    const { data: s } = await supabase.from("ranked_seasons").select("key, number, starts_at, ends_at").eq("status", "active").maybeSingle();
    if (!s) return null;
    const [{ data: r }, { data: chests }] = await Promise.all([
      supabase.from("player_ratings").select("rating, wins, losses, draws, win_streak")
        .eq("player_id", userId).eq("season_key", s.key).eq("mode", "ranked").maybeSingle(),
      supabase.from("item_openings")
        .select("id, chest_type:item_id, division_id, status, commit_hash, server_seed, client_seed, reserve_snapshot, results, coin_shares::text, credits, created_at")
        .eq("player_id", userId).eq("item_type", "chest").eq("season_key", s.key).order("created_at").order("ordinal"),
    ]);
    const rows: ChestRow[] = (chests ?? []).map((c) => ({
      id: c.id, type: c.chest_type as ChestType, divisionId: c.division_id ?? "", status: c.status as ChestRow["status"],
      commitHash: c.commit_hash, serverSeed: c.server_seed, clientSeed: c.client_seed,
      reserve: (c.reserve_snapshot ?? null) as unknown as Reserve | null,
      rolls: (c.results ?? null) as unknown as ChestRow["rolls"],
      coinShares: String(c.coin_shares ?? "0"), credits: Number(c.credits ?? 0), createdAt: c.created_at,
    }));
    const shares = rows.reduce((sum, c) => sum + Number(c.coinShares), 0);
    return {
      season: { key: s.key, number: s.number, startsAt: s.starts_at, endsAt: s.ends_at },
      rating: r?.rating ?? 1000, wins: r?.wins ?? 0, losses: r?.losses ?? 0, draws: r?.draws ?? 0, winStreak: r?.win_streak ?? 0,
      chests: rows, seasonCoinShares: String(shares),
    };
  });

/** Opens one of the player's chests with their own seed (provably fair: the server seed was committed when it was granted). */
export const openDivisionChest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chestId: z.string().uuid(), clientSeed: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const { openChestTrusted } = await import("./chests.server");
    return openChestTrusted(admin, context.userId, data.chestId, data.clientSeed);
  });
