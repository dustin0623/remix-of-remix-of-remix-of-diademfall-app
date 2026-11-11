import { createServerFn } from "@tanstack/react-start";
import { requirePlayer } from "@/lib/game/session/player.server";
import {
  paginateLeaderboard,
  type LeaderboardEntry,
  type LeaderboardResult,
} from "./leaderboard";

/** Snapshot cache: rankings are recomputed at most once per minute. */
const CACHE_MS = 60_000;
let cached: { at: number; entries: LeaderboardEntry[] } | null = null;
let pending: Promise<LeaderboardEntry[]> | null = null;

type SnapshotRow = {
  rank: number | string;
  player_id: string;
  username: string;
  avatar_id: number;
  xp: number | string;
  level: number;
  hero_count: number;
  hero_points: number | string;
  score: number | string;
};

function toEntry(r: SnapshotRow): LeaderboardEntry {
  return {
    rank: Number(r.rank),
    playerId: r.player_id,
    username: r.username,
    avatarId: r.avatar_id,
    xp: Number(r.xp),
    level: r.level,
    heroCount: r.hero_count,
    heroPoints: Number(r.hero_points),
    score: Number(r.score),
  };
}

async function snapshot(): Promise<LeaderboardEntry[]> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.entries;
  if (pending) return pending;
  pending = (async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("leaderboard_snapshot");
    if (error) throw new Error("Leaderboard unavailable");
    return ((data ?? []) as SnapshotRow[]).map(toEntry);
  })();
  try {
    const entries = await pending;
    cached = { at: Date.now(), entries };
    return entries;
  } finally {
    pending = null;
  }
}

/**
 * Ranked leaderboard for the signed-in player: 100 players per page from the
 * complete ranked snapshot. Requires a valid
 * wallet session token; scores are computed entirely server-side.
 */
export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((i: { playerId?: unknown; token?: unknown; page?: unknown }) => {
    if (typeof i?.playerId !== "string" || typeof i?.token !== "string") throw new Error("Invalid input");
    const page = typeof i.page === "number" && Number.isInteger(i.page) ? i.page : 1;
    return { playerId: i.playerId, token: i.token, page };
  })
  .handler(async ({ data }): Promise<LeaderboardResult> => {
    const row = await requirePlayer(data.playerId, data.token);
    const entries = await snapshot();
    const { entries: pageEntries, page, pageCount } = paginateLeaderboard(entries, data.page);
    return {
      entries: pageEntries,
      page,
      pageCount,
      totalPlayers: entries.length,
      asOf: new Date().toISOString(),
      self: entries.find((e) => e.playerId === row.id) ?? null,
    };
  });
