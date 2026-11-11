/** Trusted ranked-match helpers. Only call with the service client, after the caller is authenticated. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { BattleInput, FormationCard, LockedTeam } from "@/game/battle-contract";
import { resolveBattle } from "@/game/ranked";

type Admin = SupabaseClient<Database>;

/** Expire stale tickets, settle team-selection matches past their deadline (timeout wins / cancels) and hand back ended rentals. */
export async function expireStale(admin: Admin) {
  const [{ error }, { error: rentErr }] = await Promise.all([admin.rpc("expire_stale_matches"), admin.rpc("expire_rentals")]);
  if (error) console.error("[ranked] expire_stale_matches failed", error);
  if (rentErr) console.error("[ranked] expire_rentals failed", rentErr);
}

/** Resolve a match already in `resolving`: run the pure engine, then finalize (idempotent). */
export async function resolveMatch(admin: Admin, matchId: string): Promise<boolean> {
  const { data: m, error } = await admin
    .from("matches")
    .select("id, status, seed, mana_cap, ruleset_ids, engine_version, game_versions(version, catalog_hash)")
    .eq("id", matchId)
    .maybeSingle();
  if (error || !m || m.status !== "resolving") return false;

  const [{ data: players }, { data: subs }] = await Promise.all([
    admin.from("match_players").select("player_id, side").eq("match_id", matchId),
    admin.from("match_submissions").select("*").eq("match_id", matchId),
  ]);
  if (!players || players.length !== 2 || !subs || subs.length !== 2) return false;

  const teamFor = (side: 1 | 2): LockedTeam => {
    const pid = players.find((p) => p.side === side)!.player_id;
    const s = subs.find((x) => x.player_id === pid)!;
    return {
      playerId: pid,
      summonerCardId: s.summoner_card_id,
      summonerLevel: s.summoner_level,
      formation: s.formation as unknown as FormationCard[],
      calculatedMana: s.calculated_mana,
      submissionHash: s.submission_hash,
    };
  };
  const gv = m.game_versions as { version: string; catalog_hash: string | null } | null;
  const input: BattleInput = {
    matchId: m.id,
    gameVersion: gv?.version ?? "unknown",
    engineVersion: m.engine_version,
    seed: m.seed,
    manaCap: m.mana_cap,
    rulesetIds: m.ruleset_ids,
    side1: teamFor(1),
    side2: teamFor(2),
    catalogHash: gv?.catalog_hash ?? "",
  };

  const out = resolveBattle(input);
  const result = { outcome: out.outcome, winnerPlayerId: out.winnerPlayerId, rounds: out.rounds, finalState: out.finalState };
  const { data: ok, error: finErr } = await admin.rpc("finalize_match", {
    p_match_id: matchId,
    p_outcome: out.outcome,
    p_winner_player_id: out.winnerPlayerId as string,
    p_result: result as unknown as Json,
    p_replay: { input, events: out.events } as unknown as Json,
    p_input_hash: out.inputHash,
    p_result_hash: out.resultHash,
  });
  if (finErr) { console.error("[ranked] finalize_match failed", finErr); return false; }
  return !!ok;
}
