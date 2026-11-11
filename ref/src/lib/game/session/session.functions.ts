import { createServerFn } from "@tanstack/react-start";
import type { PlayerSession, SyncResult } from "./types";
import { validateClaims } from "./validate";
import { damageBudget, validateDamage } from './damage';
import { loadHeroes, loadPlayer, loadStageMap, newSeed, toSession, type PlayerRow, type StageMapRow } from "./player.server";

const sessionInput = (input: { playerId?: string; token?: string }) => {
  if (typeof input?.playerId !== "string" || typeof input?.token !== "string")
    throw new Error("Invalid input");
  return { playerId: input.playerId, token: input.token };
};

/**
 * Loads the signed-in player's saved game: coins, stage, map seed, cleared
 * blocks and roster. The token proves this browser owns the player.
 */
export const loadGameSession = createServerFn({ method: "POST" })
  .inputValidator(sessionInput)
  .handler(async ({ data }): Promise<PlayerSession> => {
    const row = await loadPlayer(data.playerId, data.token);
    if (!row) throw new Error("Invalid session — sign in again");
    const [map, heroes] = await Promise.all([loadStageMap(row.id), loadHeroes(row.id)]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Opening the game closes any other open game for this player.
    const { data: sessionToken, error } = await supabaseAdmin.rpc("start_or_renew_game_session", { p_player_id: row.id });
    if (error || !sessionToken) throw new Error("Could not start game session");
    // Listed heroes are on the marketplace and can't play.
    return { ...toSession(row, map, heroes.filter((h) => !h.listed && !h.houseId)), sessionToken: String(sessionToken) };
  });

/** Credits verified destroyed blocks; advances the stage when the last chest is gone. */
export const syncProgress = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId: string; token: string; sessionToken: string; seed: number; keys: string[]; damaged?: Record<string, number> }) => {
    if (typeof input?.playerId !== "string" || typeof input.token !== "string" || typeof input.sessionToken !== "string")
      throw new Error("Invalid input");
    const keys = Array.isArray(input.keys)
      ? input.keys.filter((k) => typeof k === "string" && /^\d{1,3},\d{1,3}$/.test(k)).slice(0, 400)
      : [];
    const damaged = Object.fromEntries(Object.entries(input.damaged ?? {}).slice(0, 400)
      .filter(([key, hp]) => /^\d{1,3},\d{1,3}$/.test(key) && Number.isInteger(hp) && hp > 0));
    return { playerId: input.playerId, token: input.token, sessionToken: input.sessionToken, seed: Number(input.seed), keys, damaged };
  })
  .handler(async ({ data }): Promise<SyncResult> => {
    const row = await loadPlayer(data.playerId, data.token);
    if (!row) throw new Error("Unknown player");
    const map = await loadStageMap(row.id);
    const current = (r: PlayerRow, m: StageMapRow, accepted = 0, rejected = 0): SyncResult => ({
      ok: true,
      coins: Number(r.coins),
      stage: m.stage,
      seed: Number(m.seed),
      destroyedNodes: m.destroyed_nodes,
      damagedNodes: m.damaged_nodes ?? {},
      accepted,
      rejected,
    });
    // Claims for an old map are ignored; the client resyncs to the current one.
    if (Number(map.seed) !== data.seed) return current(row, map, 0, data.keys.length);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The damage budget uses every playable hero: a hero's last bomb can detonate after it has run
    // out of energy and left the map, and that final hit must still count.
    const { data: roster } = await supabaseAdmin
      .from("heroes")
      .select("skills, bomb_number, bomb_range, power, on_map, is_listed, house_id")
      .eq("player_id", row.id)
      .eq("is_burned", false);
    const playable = (roster ?? []).filter((h) => !h.is_listed && !h.house_id);
    const damage = validateDamage({ stage: map.stage, seed: Number(map.seed), destroyed: map.destroyed_nodes,
      stored: map.damaged_nodes ?? {}, reported: data.damaged, lethal: data.keys,
      budget: damageBudget(playable, Date.now() - new Date(map.last_sync_at).getTime()) });
    const outcome = validateClaims({
      stage: map.stage,
      seed: Number(map.seed),
      destroyed: map.destroyed_nodes,
      claimed: damage.lethal,
      elapsedMs: Date.now() - new Date(map.last_sync_at).getTime(),
      deployedBombs: playable.map((h) => Number(h.bomb_number)),
    });
    // One atomic DB call: credits only keys not already saved, so retries and
    // overlapping saves can never double-pay or lose progress.
    const { data: saved, error } = await supabaseAdmin.rpc("save_progress_with_damage", {
      p_player_id: row.id,
      p_seed: Number(map.seed),
      p_rewards: outcome.rewards,
      p_total_chests: 0,
      p_new_seed: outcome.cleared ? newSeed() : 0,
      p_session_token: data.sessionToken,
      p_chests: outcome.chests,
      p_damaged: damage.damaged,
      p_expected_sync_at: map.last_sync_at,
    });
    if (error?.message?.includes("SESSION_SUPERSEDED")) throw new Error("SESSION_SUPERSEDED");
    if (error || !saved) throw new Error("Save failed");
    const s = saved as unknown as { coins: number; stage: number; seed: number; destroyed: string[]; damaged: Record<string, number>; accepted: number; conflict: boolean };
    return {
      ok: true,
      coins: Number(s.coins),
      stage: s.stage,
      seed: Number(s.seed),
      destroyedNodes: s.destroyed,
      damagedNodes: s.damaged,
      conflict: s.conflict,
      accepted: s.accepted,
      rejected: outcome.rejected + damage.rejected,
    };
  });

export interface SessionStatus {
  active: boolean;
  activePlayers: number;
}

/** Heartbeat: keeps this game's session alive, reports whether it was superseded, and counts live miners. */
export const checkGameSession = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId?: string; token?: string; sessionToken?: string }) => {
    const base = sessionInput(input);
    if (typeof input.sessionToken !== "string") throw new Error("Invalid input");
    return { ...base, sessionToken: input.sessionToken };
  })
  .handler(async ({ data }): Promise<SessionStatus> => {
    const row = await loadPlayer(data.playerId, data.token);
    if (!row) throw new Error("Invalid session — sign in again");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mine } = await supabaseAdmin
      .from("game_sessions")
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("player_id", row.id)
      .eq("session_token", data.sessionToken)
      .eq("status", "active")
      .select("id");
    const since = new Date(Date.now() - 2 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("game_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("last_heartbeat_at", since);
    return { active: (mine ?? []).length > 0, activePlayers: count ?? 0 };
  });
