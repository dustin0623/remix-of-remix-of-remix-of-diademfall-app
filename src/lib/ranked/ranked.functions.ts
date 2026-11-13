import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BattleInput } from "@/game/battle-contract";
import type { Database, Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lockedTeam, pickFromTeam, rankedConfig, validateRankedTeam } from "@/game/ranked";
import type { TeamPick } from "@/game/match";
import { SUMMONERS } from "@/game/catalog/summoners";

const SUMMONER_IDS = new Set(SUMMONERS.map((s) => s.id));

const MODE = "ranked";
const RATING_DELTA = 200;

const loadAdmin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** Key of the active ranked season (ratings are stored per season). */
async function activeSeasonKey(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.from("ranked_seasons").select("key").eq("status", "active").maybeSingle();
  return data?.key ?? "season-1";
}

export type QueueStatus = {
  ticket: { id: string; status: string; createdAt: string; expiresAt: string } | null;
  activeMatchId: string | null;
};

export const joinRankedQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Owned cards only: a ranked team needs at least one owned summoner and one owned troop.
    const { data: mine } = await context.supabase.from("player_card_stacks").select("card_id, copies").eq("player_id", context.userId).gt("copies", 0);
    const ids = (mine ?? []).flatMap((c) => (c.card_id ? [c.card_id] : []));
    if (!ids.some((id) => SUMMONER_IDS.has(id)) || !ids.some((id) => !SUMMONER_IDS.has(id)))
      return { ok: false as const, error: "You need at least one commander and one troop. Open packs from Items first." };
    const admin = await loadAdmin();
    const { expireStale } = await import("./ranked.server");
    const { rolloverSeasonIfDue } = await import("./chests.server");
    await expireStale(admin);
    await rolloverSeasonIfDue(admin);
    const { data, error } = await context.supabase.rpc("join_matchmaking", { p_mode: MODE, p_region: "global", p_rating_delta: RATING_DELTA });
    if (error) {
      const m = error.message ?? "";
      if (m.includes("current match")) return { ok: false as const, error: "Finish your current match first." };
      if (m.includes("Season is ending")) return { ok: false as const, error: "The season is ending. The next one starts in a moment, try again shortly." };
      return { ok: false as const, error: "Couldn't join the queue. Try again." };
    }
    const r = data as { matchId: string | null; status: string };
    return { ok: true as const, matchId: r.matchId, status: r.status };
  });

export const cancelRankedQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("cancel_matchmaking");
    if (error) console.error("[ranked] cancel failed", error);
    return { ok: !error };
  });

/** Poll: settle stale matches, retry matching a searching ticket, report ticket + active match. */
export const pollRankedQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QueueStatus> => {
    const { supabase, userId } = context;
    const admin = await loadAdmin();
    const { expireStale } = await import("./ranked.server");
    await expireStale(admin);
    await supabase.rpc("retry_matchmaking");
    const [{ data: t }, { data: active }] = await Promise.all([
      supabase.from("matchmaking_tickets").select("id, status, created_at, expires_at")
        .eq("player_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("matches").select("id").or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .in("status", ["team_selection", "resolving"]).limit(1).maybeSingle(),
    ]);
    return {
      ticket: t ? { id: t.id, status: t.status, createdAt: t.created_at, expiresAt: t.expires_at } : null,
      activeMatchId: active?.id ?? null,
    };
  });

export type MatchSide = { side: 1 | 2; playerId: string; username: string; ratingBefore: number; ratingAfter: number | null; result: string | null };
export type MatchState = {
  id: string;
  status: "team_selection" | "resolving" | "completed" | "cancelled" | "invalid";
  manaCap: number;
  rulesetIds: string[];
  deadline: string;
  serverNow: string;
  outcome: string | null;
  reason: string | null;
  me: MatchSide;
  opponent: MatchSide;
  myTeam: { summonerId: string; unitIds: string[] } | null;
  opponentLocked: boolean;
  owned: Record<string, number>;
  replayInput: BattleInput | null;
  resultHash: string | null;
  /** This player's reward outcome for a completed ranked match (null until finalized). */
  reward: { status: "earned" | "no_energy" | "wood_league" | "not_a_win" | "timeout"; shares: string; energySpent: boolean;
    leagueMultiplier: string; opponentFactor: string; streakBonus: string; foilBonus: string; goldCards: number } | null;
};

export const getRankedMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<MatchState | null> => {
    const { supabase, userId } = context;
    const admin = await loadAdmin();
    const { expireStale, resolveMatch } = await import("./ranked.server");
    await expireStale(admin);

    const load = () => supabase.from("matches")
      .select(`id, status, mana_cap, ruleset_ids, selection_deadline, outcome, result, result_hash, replay_input:replay->input,
        player1_id, player2_id, p1_rating_before, p1_rating_after, p1_result, p2_rating_before, p2_rating_after, p2_result,
        p1:profiles!matches_player1_id_fkey(username, display_name), p2:profiles!matches_player2_id_fkey(username, display_name)`)
      .eq("id", data.matchId).maybeSingle();
    let { data: m } = await load();
    if (!m) return null; // not a participant (RLS) or missing
    if (m.status === "resolving") { await resolveMatch(admin, m.id); m = (await load()).data ?? m; }

    // Locked teams and reward rows are hidden from players (no column grant): read them with the service client.
    const { data: hidden } = await admin.from("matches").select("p1_team, p2_team, p1_reward, p2_reward").eq("id", m.id).maybeSingle();
    const mySide: 1 | 2 | null = m.player1_id === userId ? 1 : m.player2_id === userId ? 2 : null;
    if (!mySide || !m.player1_id || !m.player2_id) return null;
    type Team = { summonerCardId: string; formation: { cardId: string; position: number }[] } | null;
    const mySub = (mySide === 1 ? hidden?.p1_team : hidden?.p2_team) as unknown as Team;
    const oppSub = (mySide === 1 ? hidden?.p2_team : hidden?.p1_team) as unknown as Team;
    const rw = (mySide === 1 ? hidden?.p1_reward : hidden?.p2_reward) as unknown as {
      status: NonNullable<MatchState["reward"]>["status"]; shares: number | string; energySpent: boolean; leagueMultiplier: number | string;
      opponentFactor: number | string; streakBonus: number | string; foilBonus: number | string; goldCards: number } | null;
    const name = (p: unknown) => {
      const prof = p as { username: string; display_name: string | null } | null;
      return prof?.display_name ?? prof?.username ?? "Unknown";
    };
    const sides: Record<1 | 2, MatchSide> = {
      1: { side: 1, playerId: m.player1_id, username: name(m.p1), ratingBefore: m.p1_rating_before ?? 0, ratingAfter: m.p1_rating_after, result: m.p1_result },
      2: { side: 2, playerId: m.player2_id, username: name(m.p2), ratingBefore: m.p2_rating_before ?? 0, ratingAfter: m.p2_rating_after, result: m.p2_result },
    };

    let owned: Record<string, number> = {};
    if (m.status === "team_selection" && !mySub) {
      const { data: cards } = await supabase.from("player_card_stacks").select("card_id, level, copies").eq("player_id", userId);
      owned = Object.fromEntries((cards ?? []).filter((c) => c.card_id && (c.copies ?? 0) > 0).map((c) => [c.card_id!, c.level ?? 1]));
    }
    const formation = mySub?.formation ?? [];
    const result = (m.result ?? null) as { reason?: string } | null;
    return {
      id: m.id,
      status: m.status as MatchState["status"],
      manaCap: m.mana_cap,
      rulesetIds: m.ruleset_ids,
      deadline: m.selection_deadline,
      serverNow: new Date().toISOString(),
      outcome: m.outcome,
      reason: result?.reason ?? null,
      me: sides[mySide],
      opponent: sides[mySide === 1 ? 2 : 1],
      myTeam: mySub ? { summonerId: mySub.summonerCardId, unitIds: [...formation].sort((a, b) => a.position - b.position).map((f) => f.cardId) } : null,
      opponentLocked: !!oppSub,
      owned,
      replayInput: (m.replay_input ?? null) as unknown as BattleInput | null,
      resultHash: m.result_hash,
      reward: rw ? { status: rw.status, shares: String(rw.shares), energySpent: rw.energySpent, leagueMultiplier: String(rw.leagueMultiplier),
        opponentFactor: String(rw.opponentFactor), streakBonus: String(rw.streakBonus), foilBonus: String(rw.foilBonus), goldCards: Number(rw.goldCards) } : null,
    };
  });

export const submitRankedTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    matchId: z.string().uuid(),
    summonerId: z.string().min(1).max(64),
    unitIds: z.array(z.string().min(1).max(64)).min(1).max(6),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const fail = (error: string) => ({ ok: false as const, error });

    const { data: m } = await supabase.from("matches").select("id, status, seed, mana_cap, ruleset_ids, selection_deadline, player1_id, player2_id").eq("id", data.matchId).maybeSingle();
    if (!m) return fail("Match not found.");
    if (m.status !== "team_selection") return fail("Team selection is over for this match.");
    if (new Date(m.selection_deadline).getTime() <= Date.now()) return fail("Time ran out for team selection.");

    const side: 1 | 2 | null = m.player1_id === userId ? 1 : m.player2_id === userId ? 2 : null;
    if (!side) return fail("You're not in this match.");

    const pick = { summonerId: data.summonerId, unitIds: data.unitIds };
    const cfg = rankedConfig({ seed: m.seed, manaCap: m.mana_cap, rulesetIds: m.ruleset_ids });
    const illegal = validateRankedTeam(pick, cfg);
    if (illegal) return fail(illegal);

    const admin = await loadAdmin();
    await admin.rpc("expire_rentals"); // ended rentals must not count as owned
    const ids = [pick.summonerId, ...pick.unitIds];
    const [{ data: cards }, { data: owned }] = await Promise.all([
      supabase.from("cards").select("id, card_type").in("id", ids),
      supabase.from("player_card_stacks").select("card_id, level, copies").eq("player_id", userId).in("card_id", ids),
    ]);
    const type = new Map((cards ?? []).map((c) => [c.id, c.card_type]));
    if (type.get(pick.summonerId) !== "summoner") return fail("That commander isn't available.");
    if (pick.unitIds.some((id) => type.get(id) !== "unit")) return fail("One of those units isn't available.");
    const levels = Object.fromEntries((owned ?? []).filter((c) => c.card_id && (c.copies ?? 0) > 0).map((c) => [c.card_id!, c.level ?? 1]));
    if (ids.some((id) => levels[id] === undefined)) return fail("You don't own every card in that team.");

    const team = lockedTeam({ matchId: m.id, playerId: userId, side, pick, levels, rulesets: m.ruleset_ids });
    const { data: locked, error } = await admin.rpc("lock_match_submission", {
      p_match_id: m.id, p_player_id: userId, p_summoner_card_id: team.summonerCardId, p_summoner_level: team.summonerLevel,
      p_formation: team.formation as unknown as Json, p_calculated_mana: team.calculatedMana, p_submission_hash: team.submissionHash,
    });
    if (error) { console.error("[ranked] lock failed", error); return fail("Couldn't lock your team. Try again."); }
    if (!locked) return fail("Your team is already locked, or time ran out.");

    const { resolveMatch } = await import("./ranked.server");
    const resolved = await resolveMatch(admin, m.id);
    return { ok: true as const, status: resolved ? "completed" : "waiting_for_opponent" };
  });

export type HistoryRow = {
  matchId: string; status: string; result: string | null; reason: string | null;
  ratingBefore: number; ratingAfter: number | null;
  opponent: string; opponentRating: number; manaCap: number; rulesetIds: string[]; at: string;
  player: string; teams: [TeamPick, TeamPick] | null; rounds: number | null;
};

export const getRankedHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(50).default(20) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<HistoryRow[]> => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase.from("matches")
      .select(`id, status, created_at, completed_at, mana_cap, ruleset_ids, result, player1_id, replay_input:replay->input,
        p1_rating_before, p1_rating_after, p1_result, p2_rating_before, p2_rating_after, p2_result,
        p1:profiles!matches_player1_id_fkey(username, display_name), p2:profiles!matches_player2_id_fkey(username, display_name)`)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order("created_at", { ascending: false }).limit(data.limit);
    const name = (p: unknown) => {
      const prof = p as { username: string; display_name: string | null } | null;
      return prof?.display_name ?? prof?.username ?? "Unknown";
    };
    return (rows ?? []).map((r) => {
      const first = r.player1_id === userId;
      const result = r.result as { reason?: string; rounds?: number } | null;
      const input = r.status === "completed" ? r.replay_input as unknown as BattleInput | null : null;
      const teams: HistoryRow["teams"] = input?.side1?.formation && input.side2?.formation
        ? [pickFromTeam(first ? input.side1 : input.side2), pickFromTeam(first ? input.side2 : input.side1)]
        : null;
      return {
        matchId: r.id, status: r.status, result: first ? r.p1_result : r.p2_result, reason: result?.reason ?? null,
        ratingBefore: (first ? r.p1_rating_before : r.p2_rating_before) ?? 0, ratingAfter: first ? r.p1_rating_after : r.p2_rating_after,
        opponent: name(first ? r.p2 : r.p1), opponentRating: (first ? r.p2_rating_before : r.p1_rating_before) ?? 0,
        manaCap: r.mana_cap, rulesetIds: r.ruleset_ids ?? [], at: r.completed_at ?? r.created_at,
        player: name(first ? r.p1 : r.p2), teams, rounds: result?.rounds ?? null,
      };
    });
  });

export type LeaderRow = { rank: number; playerId: string; username: string; rating: number; wins: number; losses: number; draws: number; streak: number };
export type Leaderboard = { rows: LeaderRow[]; me: LeaderRow | null };

const LEAGUE_FILTERS = ["all", "wood", "bronze", "silver", "gold", "diamond", "champion"] as const;

export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ league: z.enum(LEAGUE_FILTERS).default("all") }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<Leaderboard> => {
    const { supabase, userId } = context;
    const { leagueById, currentStreak } = await import("@/game/ladder");
    const SEASON = await activeSeasonKey(supabase);
    const cols = "player_id, rating, wins, losses, draws, profiles(username, display_name)";
    let q = supabase.from("player_ratings").select(cols).eq("season_key", SEASON).eq("mode", MODE);
    if (data.league !== "all") {
      const band = leagueById(data.league);
      q = q.gte("rating", band.min);
      if (band.max !== null) q = q.lt("rating", band.max);
    }
    const [{ data: top }, { data: mine }] = await Promise.all([
      q.order("rating", { ascending: false }).order("wins", { ascending: false }).limit(50),
      supabase.from("player_ratings").select(cols).eq("season_key", SEASON).eq("mode", MODE).eq("player_id", userId).maybeSingle(),
    ]);
    const list = top ?? [];
    const ids = [...new Set([...list.map((r) => r.player_id), ...(mine ? [mine.player_id] : [])])];
    const { data: recent } = ids.length ? await supabase.rpc("ladder_recent_results", { p_player_ids: ids, p_per_player: 20 }) : { data: [] };
    const byPlayer = new Map<string, string[]>();
    for (const r of recent ?? []) byPlayer.set(r.player_id, [...(byPlayer.get(r.player_id) ?? []), r.result]);

    const toRow = (r: (typeof list)[number], rank: number): LeaderRow => {
      const p = r.profiles as { username: string; display_name: string | null } | null;
      return { rank, playerId: r.player_id, username: p?.display_name ?? p?.username ?? "Unknown", rating: r.rating,
        wins: r.wins, losses: r.losses, draws: r.draws, streak: currentStreak(byPlayer.get(r.player_id) ?? []) };
    };
    const rows = list.map((r, i) => toRow(r, i + 1));
    let me: LeaderRow | null = rows.find((r) => r.playerId === userId) ?? null;
    if (!me && mine) {
      // Overall ladder position (ties share the better rank).
      const { count } = await supabase.from("player_ratings").select("player_id", { count: "exact", head: true })
        .eq("season_key", SEASON).eq("mode", MODE).gt("rating", mine.rating);
      me = toRow(mine, (count ?? 0) + 1);
    }
    return { rows, me };
  });

export type SummonerStat = { summonerId: string; games: number; wins: number; draws: number };

export const getSummonerStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SummonerStat[]> => {
    const { data, error } = await context.supabase.rpc("ladder_summoner_stats");
    if (error) { console.error("[ranked] commander stats failed", error); return []; }
    return (data ?? []).map((r) => ({ summonerId: r.summoner_card_id, games: Number(r.games), wins: Number(r.wins), draws: Number(r.draws) }))
      .sort((a, b) => b.games - a.games || b.wins - a.wins);
  });
