/** Trusted ranked-match helpers. Only call with the service client, after the caller is authenticated. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { BattleInput, FormationCard, LockedTeam } from "@/game/battle-contract";
import { resolveBattle } from "@/game/ranked";
import { CATALOG_VERSION, catalogHash } from "@/game/catalogs";
import { rulesetSelectionWeight } from "@/game/rule-support";

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
    .select("id, status, seed, mana_cap, ruleset_ids, engine_version, game_version, player1_id, player2_id, p1_team, p2_team")
    .eq("id", matchId)
    .maybeSingle();
  if (error || !m || m.status !== "resolving" || !m.player1_id || !m.player2_id || !m.p1_team || !m.p2_team) return false;

  type StoredTeam = { summonerCardId: string; summonerLevel: number; formation: FormationCard[]; calculatedMana: number; submissionHash: string };
  const teamFor = (playerId: string, stored: Json): LockedTeam => {
    const s = stored as unknown as StoredTeam;
    return {
      playerId,
      summonerCardId: s.summonerCardId,
      summonerLevel: s.summonerLevel,
      formation: s.formation,
      calculatedMana: s.calculatedMana,
      submissionHash: s.submissionHash,
    };
  };
  const gameVersion = m.game_version ?? "unknown";
  const input: BattleInput = {
    matchId: m.id,
    gameVersion,
    engineVersion: m.engine_version,
    seed: m.seed,
    manaCap: m.mana_cap,
    rulesetIds: m.ruleset_ids,
    side1: teamFor(m.player1_id, m.p1_team),
    side2: teamFor(m.player2_id, m.p2_team),
    // Only the active version carries a catalog fingerprint (same value as game_version_table()).
    catalogHash: gameVersion === CATALOG_VERSION ? catalogHash(rulesetSelectionWeight) : "",
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
