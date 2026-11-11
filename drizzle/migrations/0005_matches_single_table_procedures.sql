CREATE OR REPLACE FUNCTION public.is_match_player(p_match_id uuid, p_player_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.matches WHERE id = p_match_id AND p_player_id IN (player1_id, player2_id));
$function$;

CREATE OR REPLACE FUNCTION public.both_teams_locked(p_match_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce((SELECT p1_team IS NOT NULL AND p2_team IS NOT NULL FROM public.matches WHERE id = p_match_id), false);
$function$;

CREATE OR REPLACE FUNCTION public._try_match_ticket(p_ticket_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  t public.matchmaking_tickets%rowtype; opp public.matchmaking_tickets%rowtype; v_engine text;
  v_match uuid; v_rules text[] := '{}'; v_count integer; v_pick record; v_caps integer[] := ARRAY[13,15,17,19,21,24,27,30,35,40];
  v_wait numeric;
BEGIN
  SELECT * INTO t FROM public.matchmaking_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND OR t.status <> 'searching' OR t.expires_at <= now() THEN RETURN NULL; END IF;
  -- Rating window widens by 50 every 15 seconds of waiting (max 1000).
  v_wait := extract(epoch FROM (now() - t.created_at));
  SELECT * INTO opp FROM public.matchmaking_tickets o
   WHERE o.status = 'searching' AND o.id <> t.id AND o.player_id <> t.player_id
     AND o.game_version = t.game_version AND o.season_key = t.season_key AND o.mode = t.mode AND o.region = t.region
     AND o.expires_at > now()
     AND abs(o.rating - t.rating) <= least(1000, greatest(o.rating_delta, t.rating_delta) + floor(v_wait / 15) * 50)
   ORDER BY abs(o.rating - t.rating), o.created_at
   FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT g.engine_version INTO v_engine FROM public.game_version_table() g WHERE g.version = t.game_version;
  IF v_engine IS NULL THEN RETURN NULL; END IF;

  -- Battle rules per match come from the lower-rated player's division (Wood 0, Bronze/Silver III 1, higher 2).
  SELECT d.rulesets INTO v_count FROM public.ranked_division_table() d
   WHERE d.min_rating <= least(t.rating, opp.rating) ORDER BY d.min_rating DESC LIMIT 1;
  v_count := coalesce(v_count, 0);
  WHILE cardinality(v_rules) < v_count LOOP
    SELECT r.id INTO v_pick FROM public.ranked_ruleset_pool() r
     WHERE r.selection_weight > 0
       AND NOT (r.id = ANY (v_rules)) AND NOT (r.incompatible_with && v_rules)
       AND NOT EXISTS (SELECT 1 FROM public.ranked_ruleset_pool() x WHERE x.id = ANY (v_rules) AND r.id = ANY (x.incompatible_with))
     ORDER BY -ln(greatest(random(), 1e-12)) / r.selection_weight LIMIT 1;
    EXIT WHEN NOT FOUND;
    v_rules := v_rules || v_pick.id::text;
  END LOOP;

  INSERT INTO public.matches (game_version, engine_version, mode, region, mana_cap, seed, ruleset_ids, season_key,
      player1_id, p1_rating_before, player2_id, p2_rating_before)
    VALUES (t.game_version, v_engine, t.mode, t.region, v_caps[1 + floor(random() * cardinality(v_caps))::int],
            encode(extensions.gen_random_bytes(16), 'hex'), v_rules, t.season_key,
            opp.player_id, opp.rating, t.player_id, t.rating)
    RETURNING id INTO v_match;
  UPDATE public.matchmaking_tickets SET status = 'matched', match_id = v_match, matched_at = now() WHERE id IN (t.id, opp.id);
  RETURN v_match;
END $function$;

CREATE OR REPLACE FUNCTION public.join_matchmaking(p_mode text DEFAULT 'ranked'::text, p_region text DEFAULT 'global'::text, p_rating_delta integer DEFAULT 150)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_user uuid := auth.uid(); v_version text; s public.ranked_seasons%rowtype; v_rating integer; v_ticket uuid; v_match uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_rating_delta NOT BETWEEN 0 AND 1000 THEN RAISE EXCEPTION 'Invalid rating delta'; END IF;
  IF EXISTS (SELECT 1 FROM public.matches m
              WHERE v_user IN (m.player1_id, m.player2_id) AND m.status IN ('team_selection','resolving')) THEN
    RAISE EXCEPTION 'Finish your current match first';
  END IF;
  SELECT g.version INTO v_version FROM public.game_version_table() g WHERE g.status = 'active';
  IF v_version IS NULL THEN RAISE EXCEPTION 'No active game version'; END IF;
  s := public.current_ranked_season();
  IF s.ends_at <= now() THEN RAISE EXCEPTION 'Season is ending'; END IF;

  INSERT INTO public.player_ratings (player_id, season_key, mode) VALUES (v_user, s.key, p_mode) ON CONFLICT DO NOTHING;
  SELECT rating INTO v_rating FROM public.player_ratings WHERE player_id = v_user AND season_key = s.key AND mode = p_mode;
  UPDATE public.matchmaking_tickets SET status = 'cancelled' WHERE player_id = v_user AND status = 'searching';
  INSERT INTO public.matchmaking_tickets (player_id, game_version, season_key, mode, region, rating, rating_delta)
    VALUES (v_user, v_version, s.key, p_mode, p_region, v_rating, p_rating_delta) RETURNING id INTO v_ticket;
  v_match := public._try_match_ticket(v_ticket);
  RETURN jsonb_build_object('ticketId', v_ticket, 'matchId', v_match, 'status', CASE WHEN v_match IS NULL THEN 'searching' ELSE 'matched' END);
END $function$;

CREATE OR REPLACE FUNCTION public.lock_match_submission(p_match_id uuid, p_player_id uuid, p_summoner_card_id text, p_summoner_level smallint, p_formation jsonb, p_calculated_mana smallint, p_submission_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m public.matches%rowtype; v_team jsonb;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match_id AND status = 'team_selection' FOR UPDATE;
  IF NOT FOUND OR m.selection_deadline < now() THEN RETURN false; END IF;
  IF jsonb_typeof(p_formation) IS DISTINCT FROM 'array' OR NOT EXISTS (SELECT 1 FROM public.cards WHERE id = p_summoner_card_id) THEN RETURN false; END IF;
  v_team := jsonb_build_object('summonerCardId', p_summoner_card_id, 'summonerLevel', p_summoner_level, 'formation', p_formation,
    'calculatedMana', p_calculated_mana, 'submissionHash', p_submission_hash, 'lockedAt', now());
  IF p_player_id = m.player1_id AND m.p1_team IS NULL THEN
    UPDATE public.matches SET p1_team = v_team WHERE id = p_match_id; m.p1_team := v_team;
  ELSIF p_player_id = m.player2_id AND m.p2_team IS NULL THEN
    UPDATE public.matches SET p2_team = v_team WHERE id = p_match_id; m.p2_team := v_team;
  ELSE
    RETURN false;  -- not a player here, or this side already locked
  END IF;
  IF m.p1_team IS NOT NULL AND m.p2_team IS NOT NULL THEN
    UPDATE public.matches SET status = 'resolving', started_at = now() WHERE id = p_match_id AND status = 'team_selection';
  END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_match(p_match_id uuid, p_outcome text, p_winner_player_id uuid, p_result jsonb, p_replay jsonb, p_input_hash text, p_result_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM 1 FROM public.matches WHERE id = p_match_id AND status = 'resolving' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_outcome NOT IN ('side_1','side_2','draw') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;

  UPDATE public.matches SET status = 'completed', outcome = p_outcome, winner_player_id = p_winner_player_id, result = p_result,
    replay = p_replay, input_hash = p_input_hash, result_hash = p_result_hash, completed_at = now(),
    p1_result = CASE p_outcome WHEN 'side_1' THEN 'win' WHEN 'draw' THEN 'draw' ELSE 'loss' END,
    p2_result = CASE p_outcome WHEN 'side_2' THEN 'win' WHEN 'draw' THEN 'draw' ELSE 'loss' END
  WHERE id = p_match_id;

  PERFORM public.apply_ranked_result(p_match_id);
  PERFORM public.accrue_match_rewards(p_match_id);
  RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_ranked_result(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m public.matches%rowtype; v_side integer; v_pid uuid; v_res text; v_before integer;
  r public.player_ratings%rowtype; ch record; v_season text;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_season := coalesce(m.season_key, (public.current_ranked_season()).key);
  -- Lock ratings in player-id order (same order every time, no deadlocks).
  FOR v_side, v_pid IN SELECT x.side, x.pid FROM (VALUES (1, m.player1_id), (2, m.player2_id)) AS x(side, pid) ORDER BY x.pid LOOP
    v_res := CASE v_side WHEN 1 THEN m.p1_result ELSE m.p2_result END;
    v_before := CASE v_side WHEN 1 THEN m.p1_rating_before ELSE m.p2_rating_before END;
    INSERT INTO public.player_ratings (player_id, season_key, mode, rating) VALUES (v_pid, v_season, m.mode, v_before)
      ON CONFLICT DO NOTHING;
    SELECT * INTO r FROM public.player_ratings WHERE player_id = v_pid AND season_key = v_season AND mode = m.mode FOR UPDATE;
    SELECT * INTO ch FROM public.ranked_rating_change(r.rating, v_res, r.win_streak);
    UPDATE public.player_ratings SET rating = ch.rating_after, win_streak = ch.streak_after,
        wins = wins + CASE WHEN v_res = 'win' THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN v_res = 'loss' THEN 1 ELSE 0 END,
        draws = draws + CASE WHEN v_res = 'draw' THEN 1 ELSE 0 END,
        updated_at = now()
      WHERE player_id = v_pid AND season_key = v_season AND mode = m.mode;
    IF v_side = 1 THEN UPDATE public.matches SET p1_rating_after = ch.rating_after WHERE id = p_match_id;
    ELSE UPDATE public.matches SET p2_rating_after = ch.rating_after WHERE id = p_match_id; END IF;
    IF m.mode = 'ranked' THEN PERFORM public.grant_division_chests(v_pid, v_season, r.rating, ch.rating_after, p_match_id); END IF;
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.expire_stale_matches()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m public.matches%rowtype; v_side smallint; v_sub uuid; v_n integer := 0;
BEGIN
  UPDATE public.matchmaking_tickets SET status = 'expired' WHERE status = 'searching' AND expires_at <= now();
  FOR m IN SELECT * FROM public.matches WHERE status = 'team_selection' AND selection_deadline < now() ORDER BY selection_deadline
           FOR UPDATE SKIP LOCKED LOOP
    IF (m.p1_team IS NULL) <> (m.p2_team IS NULL) THEN
      -- Only one side locked a team in time: that side wins by timeout.
      v_side := CASE WHEN m.p1_team IS NOT NULL THEN 1 ELSE 2 END;
      v_sub := CASE WHEN v_side = 1 THEN m.player1_id ELSE m.player2_id END;
      UPDATE public.matches SET status = 'completed', outcome = CASE WHEN v_side = 1 THEN 'side_1' ELSE 'side_2' END,
        winner_player_id = v_sub, result = jsonb_build_object('outcome', CASE WHEN v_side = 1 THEN 'side_1' ELSE 'side_2' END,
          'winnerPlayerId', v_sub, 'reason', 'timeout'), completed_at = now(),
        p1_result = CASE WHEN v_side = 1 THEN 'win' ELSE 'loss' END,
        p2_result = CASE WHEN v_side = 2 THEN 'win' ELSE 'loss' END
        WHERE id = m.id;
      PERFORM public.apply_ranked_result(m.id);
      PERFORM public.accrue_match_rewards(m.id);
    ELSE
      UPDATE public.matches SET status = 'cancelled', outcome = 'cancelled', result = jsonb_build_object('outcome', 'cancelled', 'reason', 'timeout'),
        completed_at = now(), p1_rating_after = p1_rating_before, p2_rating_after = p2_rating_before,
        p1_result = 'cancelled', p2_result = 'cancelled'
        WHERE id = m.id;
    END IF;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $function$;

CREATE OR REPLACE FUNCTION public.accrue_match_rewards(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_m public.matches%rowtype; v_side integer; v_pid uuid; v_res text; v_before integer; v_opp_before integer; v_team jsonb;
  v_timeout boolean; v_day date; v_at timestamptz; lg record; v_spent boolean; v_status text;
  v_opp numeric; v_streak integer; v_streak_bonus numeric; v_gold integer; v_foil numeric; v_shares numeric;
  v_ids text[]; v_banner text; v_low boolean; rr record; v_rw jsonb;
BEGIN
  SELECT * INTO v_m FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR v_m.mode <> 'ranked' OR v_m.status <> 'completed' THEN RETURN; END IF;
  IF v_m.p1_reward IS NOT NULL OR v_m.p2_reward IS NOT NULL THEN RETURN; END IF;
  v_timeout := coalesce(v_m.result->>'reason', '') = 'timeout';
  v_at := coalesce(v_m.completed_at, now());
  v_day := (v_at AT TIME ZONE 'UTC')::date;

  FOR v_side IN 1..2 LOOP
    IF v_side = 1 THEN
      v_pid := v_m.player1_id; v_res := v_m.p1_result; v_before := v_m.p1_rating_before; v_opp_before := v_m.p2_rating_before; v_team := v_m.p1_team;
    ELSE
      v_pid := v_m.player2_id; v_res := v_m.p2_result; v_before := v_m.p2_rating_before; v_opp_before := v_m.p1_rating_before; v_team := v_m.p2_team;
    END IF;
    SELECT * INTO lg FROM public.reward_league(v_before);
    v_spent := false; v_opp := 1; v_streak_bonus := 0; v_gold := 0; v_foil := 0; v_shares := 0; v_banner := NULL; v_low := false;
    IF NOT v_timeout THEN v_spent := public.spend_reward_energy(v_pid, v_at); END IF;
    v_status := CASE
      WHEN v_timeout AND v_res = 'win' THEN 'timeout'
      WHEN v_res IS DISTINCT FROM 'win' THEN 'not_a_win'
      WHEN lg.win_multiplier = 0 THEN 'wood_league'
      WHEN NOT v_spent THEN 'no_energy'
      ELSE 'earned' END;

    IF v_status = 'earned' THEN
      v_opp := greatest(0.75, least(1.25, 1 + (v_opp_before - v_before)::numeric / 1600));
      v_streak := 0;
      FOR rr IN SELECT CASE WHEN mm.player1_id = v_pid THEN mm.p1_result ELSE mm.p2_result END AS result
                  FROM public.matches mm
                 WHERE (mm.player1_id = v_pid OR mm.player2_id = v_pid) AND mm.id <> p_match_id AND mm.status = 'completed' AND mm.mode = 'ranked'
                   AND coalesce(mm.result->>'reason', '') <> 'timeout' AND mm.completed_at <= v_at
                 ORDER BY mm.completed_at DESC LIMIT 5 LOOP
        EXIT WHEN rr.result IS DISTINCT FROM 'win';
        v_streak := v_streak + 1;
      END LOOP;
      v_streak_bonus := least(0.15, 0.03 * v_streak);

      v_ids := ARRAY[v_team ->> 'summonerCardId'] || coalesce(ARRAY(SELECT f->>'cardId' FROM jsonb_array_elements(v_team -> 'formation') f), '{}');
      SELECT count(DISTINCT x.card_id) INTO v_gold FROM (
        SELECT a.card_id FROM public.player_cards a
         WHERE a.player_id = v_pid AND a.foil = 'gold' AND a.status = 'available' AND a.card_id = ANY (v_ids)
        UNION
        SELECT rc.card_id FROM public.rental_contracts rc
         WHERE rc.renter_id = v_pid AND rc.foil = 'gold' AND rc.status = 'active' AND rc.card_id = ANY (v_ids)
      ) x;
      v_gold := least(7, v_gold);
      v_foil := least(0.14, 0.02 * v_gold);
      v_shares := round(100 * lg.win_multiplier * v_opp * (1 + v_streak_bonus) * (1 + v_foil), 6);
      SELECT c.banner_id INTO v_banner FROM public.cards c WHERE c.id = v_team ->> 'summonerCardId';
      SELECT EXISTS (SELECT 1 FROM public.cards c WHERE c.id = ANY (v_ids[2:]) AND c.card_type = 'unit' AND c.mana <= 2) INTO v_low;
    END IF;

    v_rw := jsonb_build_object('rewardDay', v_day, 'status', v_status, 'energySpent', v_spent, 'leagueId', lg.league_id,
      'leagueMultiplier', lg.win_multiplier, 'opponentFactor', round(v_opp, 6), 'streakBonus', v_streak_bonus, 'foilBonus', v_foil,
      'goldCards', v_gold, 'shares', v_shares, 'banner', v_banner, 'lowMana', coalesce(v_low, false), 'dailyMultiplier', lg.daily_multiplier);
    IF v_side = 1 THEN UPDATE public.matches SET p1_reward = v_rw WHERE id = p_match_id;
    ELSE UPDATE public.matches SET p2_reward = v_rw WHERE id = p_match_id; END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ladder_recent_results(p_player_ids uuid[], p_per_player integer DEFAULT 20)
 RETURNS TABLE(player_id uuid, result text, completed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT x.player_id, x.result, x.completed_at FROM (
    SELECT s.player_id, s.result, m.completed_at,
           row_number() OVER (PARTITION BY s.player_id ORDER BY m.completed_at DESC) AS rn
      FROM public.matches m
      CROSS JOIN LATERAL (VALUES (m.player1_id, m.p1_result), (m.player2_id, m.p2_result)) AS s(player_id, result)
     WHERE (m.player1_id = ANY (p_player_ids) OR m.player2_id = ANY (p_player_ids))
       AND s.player_id = ANY (p_player_ids) AND m.status = 'completed' AND m.mode = 'ranked' AND s.result IS NOT NULL
  ) x
  WHERE x.rn <= least(greatest(coalesce(p_per_player, 20), 1), 50)
  ORDER BY x.player_id, x.completed_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.ladder_summoner_stats()
 RETURNS TABLE(summoner_card_id text, games bigint, wins bigint, draws bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT s.summoner_card_id, count(*) AS games,
         count(*) FILTER (WHERE s.result = 'win') AS wins,
         count(*) FILTER (WHERE s.result = 'draw') AS draws
    FROM public.matches m
    CROSS JOIN LATERAL (VALUES (m.p1_team ->> 'summonerCardId', m.p1_result), (m.p2_team ->> 'summonerCardId', m.p2_result)) AS s(summoner_card_id, result)
   WHERE m.status = 'completed' AND m.mode = 'ranked' AND s.summoner_card_id IS NOT NULL
   GROUP BY s.summoner_card_id;
$function$;