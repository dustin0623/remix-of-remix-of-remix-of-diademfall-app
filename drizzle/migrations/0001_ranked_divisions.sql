-- v6 ranked divisions: 14-day seasons, ±20 rating with win streak, division chests, Legionnaire reward reserve.

CREATE TABLE public.ranked_divisions (
  id text PRIMARY KEY,
  league text NOT NULL,
  tier smallint CHECK (tier BETWEEN 1 AND 3),
  min_rating integer NOT NULL UNIQUE CHECK (min_rating >= 0),
  rulesets smallint NOT NULL CHECK (rulesets BETWEEN 0 AND 2),
  reward_chest text CHECK (reward_chest IN ('scout','war','crown')),
  reward_count smallint NOT NULL DEFAULT 0 CHECK (reward_count >= 0),
  bonus_chest text CHECK (bonus_chest IN ('scout','war','crown')),
  bonus_count smallint NOT NULL DEFAULT 0 CHECK (bonus_count >= 0),
  reset_rating integer NOT NULL CHECK (reset_rating >= 0)
);
GRANT SELECT ON public.ranked_divisions TO anon, authenticated;
GRANT ALL ON public.ranked_divisions TO service_role;
ALTER TABLE public.ranked_divisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ranked_divisions_read ON public.ranked_divisions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.ranked_seasons (
  key text PRIMARY KEY,
  number integer NOT NULL UNIQUE CHECK (number >= 1),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  chest_coin_pool numeric NOT NULL DEFAULT 0,
  chest_coin_shares numeric NOT NULL DEFAULT 0,
  chest_coins_paid numeric NOT NULL DEFAULT 0,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE UNIQUE INDEX ranked_seasons_one_active ON public.ranked_seasons ((true)) WHERE status = 'active';
GRANT SELECT ON public.ranked_seasons TO anon, authenticated;
GRANT ALL ON public.ranked_seasons TO service_role;
ALTER TABLE public.ranked_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY ranked_seasons_read ON public.ranked_seasons FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.player_ratings ADD COLUMN win_streak integer NOT NULL DEFAULT 0 CHECK (win_streak >= 0);
ALTER TABLE public.matches ADD COLUMN season_key text;

CREATE TABLE public.division_chests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_key text NOT NULL REFERENCES public.ranked_seasons(key),
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  division_id text NOT NULL REFERENCES public.ranked_divisions(id),
  chest_type text NOT NULL CHECK (chest_type IN ('scout','war','crown')),
  ordinal smallint NOT NULL CHECK (ordinal >= 1),
  match_id uuid REFERENCES public.matches(id),
  status text NOT NULL DEFAULT 'unopened' CHECK (status IN ('unopened','opened','auto_opened')),
  algorithm text NOT NULL,
  commit_hash text NOT NULL,
  server_seed text,
  client_seed text,
  reserve_snapshot jsonb,
  results jsonb,
  coin_shares numeric NOT NULL DEFAULT 0 CHECK (coin_shares >= 0),
  credits bigint NOT NULL DEFAULT 0 CHECK (credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  UNIQUE (season_key, player_id, division_id, chest_type, ordinal)
);
CREATE INDEX division_chests_player_season ON public.division_chests (player_id, season_key);
GRANT SELECT ON public.division_chests TO authenticated;
GRANT ALL ON public.division_chests TO service_role;
ALTER TABLE public.division_chests ENABLE ROW LEVEL SECURITY;
CREATE POLICY division_chests_read_own ON public.division_chests FOR SELECT TO authenticated USING (player_id = auth.uid());

CREATE TABLE public.division_chest_secrets (
  chest_id uuid PRIMARY KEY REFERENCES public.division_chests(id) ON DELETE CASCADE,
  server_seed text NOT NULL
);
REVOKE ALL ON public.division_chest_secrets FROM anon, authenticated;
GRANT ALL ON public.division_chest_secrets TO service_role;
ALTER TABLE public.division_chest_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.legionnaire_reward_reserve (
  rarity text PRIMARY KEY CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  original_units integer NOT NULL CHECK (original_units >= 0),
  remaining_units integer NOT NULL CHECK (remaining_units >= 0),
  seeded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (remaining_units <= original_units)
);
GRANT SELECT ON public.legionnaire_reward_reserve TO anon, authenticated;
GRANT ALL ON public.legionnaire_reward_reserve TO service_role;
ALTER TABLE public.legionnaire_reward_reserve ENABLE ROW LEVEL SECURITY;
CREATE POLICY legionnaire_reward_reserve_read ON public.legionnaire_reward_reserve FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.card_assets ADD COLUMN chest_id uuid REFERENCES public.division_chests(id);
ALTER TABLE public.card_assets ADD CONSTRAINT card_assets_chest_id_slot_key UNIQUE (chest_id, slot);

ALTER TABLE public.matchmaking_tickets ALTER COLUMN season_key DROP DEFAULT;

-- Season 1 starts now; current ratings carry over as-is, records start fresh.
INSERT INTO public.ranked_seasons (key, number, starts_at, ends_at) VALUES ('season-1', 1, now(), now() + interval '14 days');
INSERT INTO public.player_ratings (player_id, season_key, mode, rating)
  SELECT player_id, 'season-1', mode, rating FROM public.player_ratings WHERE season_key = 'preseason'
  ON CONFLICT DO NOTHING;
COMMENT ON COLUMN public.player_ratings.season_key IS 'Ranked season key (ranked_seasons.key). Rows with season_key = ''preseason'' are DEPRECATED: replaced by season-1 and later seasons.';

-- ---------- Functions ----------

CREATE OR REPLACE FUNCTION public.current_ranked_season()
RETURNS public.ranked_seasons LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.ranked_seasons%rowtype; v_n integer;
BEGIN
  SELECT * INTO s FROM public.ranked_seasons WHERE status = 'active';
  IF FOUND THEN RETURN s; END IF;
  SELECT coalesce(max(number), 0) + 1 INTO v_n FROM public.ranked_seasons;
  INSERT INTO public.ranked_seasons (key, number, starts_at, ends_at)
    VALUES ('season-' || v_n, v_n, now(), now() + interval '14 days') ON CONFLICT DO NOTHING;
  SELECT * INTO s FROM public.ranked_seasons WHERE status = 'active';
  RETURN s;
END $$;

-- Mirrors ratingChange in src/game/divisions.ts.
CREATE OR REPLACE FUNCTION public.ranked_rating_change(p_rating integer, p_result text, p_streak integer,
  OUT rating_after integer, OUT streak_after integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_champion integer;
BEGIN
  SELECT min(min_rating) INTO v_champion FROM public.ranked_divisions WHERE league = 'champion';
  v_champion := coalesce(v_champion, 2600);
  IF p_result = 'win' THEN
    streak_after := coalesce(p_streak, 0) + 1;
    rating_after := p_rating + 20 + CASE WHEN streak_after >= 3 AND p_rating < v_champion THEN 10 ELSE 0 END;
  ELSIF p_result = 'loss' THEN
    streak_after := 0; rating_after := greatest(0, p_rating - 20);
  ELSE
    streak_after := 0; rating_after := p_rating;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._new_division_chest(p_season text, p_player uuid, p_division text, p_type text, p_ordinal integer, p_match uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_seed text := encode(extensions.gen_random_bytes(32), 'hex'); v_id uuid;
BEGIN
  INSERT INTO public.division_chests (season_key, player_id, division_id, chest_type, ordinal, match_id, algorithm, commit_hash)
    VALUES (p_season, p_player, p_division, p_type, p_ordinal, p_match, 'diademfall-chest-v1',
            encode(extensions.digest(v_seed, 'sha256'), 'hex'))
    ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN INSERT INTO public.division_chest_secrets (chest_id, server_seed) VALUES (v_id, v_seed); END IF;
  RETURN v_id;
END $$;

-- Chests for every division threshold crossed upwards (before < min <= after); once per division per season.
CREATE OR REPLACE FUNCTION public.grant_division_chests(p_player uuid, p_season text, p_before integer, p_after integer, p_match uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.ranked_divisions%rowtype; i integer; v_n integer := 0;
BEGIN
  FOR d IN SELECT * FROM public.ranked_divisions WHERE min_rating > p_before AND min_rating <= p_after ORDER BY min_rating LOOP
    FOR i IN 1..d.reward_count LOOP
      IF public._new_division_chest(p_season, p_player, d.id, d.reward_chest, i, p_match) IS NOT NULL THEN v_n := v_n + 1; END IF;
    END LOOP;
    FOR i IN 1..d.bonus_count LOOP
      IF public._new_division_chest(p_season, p_player, d.id, d.bonus_chest, i, p_match) IS NOT NULL THEN v_n := v_n + 1; END IF;
    END LOOP;
  END LOOP;
  RETURN v_n;
END $$;

-- Applies the fixed rating change + streak to both players (match_players.result must be set) and grants chests.
CREATE OR REPLACE FUNCTION public.apply_ranked_result(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.matches%rowtype; p public.match_players%rowtype; r public.player_ratings%rowtype; ch record; v_season text;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_season := coalesce(m.season_key, (public.current_ranked_season()).key);
  FOR p IN SELECT * FROM public.match_players WHERE match_id = p_match_id ORDER BY player_id LOOP
    INSERT INTO public.player_ratings (player_id, season_key, mode, rating) VALUES (p.player_id, v_season, m.mode, p.rating_before)
      ON CONFLICT DO NOTHING;
    SELECT * INTO r FROM public.player_ratings WHERE player_id = p.player_id AND season_key = v_season AND mode = m.mode FOR UPDATE;
    SELECT * INTO ch FROM public.ranked_rating_change(r.rating, p.result, r.win_streak);
    UPDATE public.player_ratings SET rating = ch.rating_after, win_streak = ch.streak_after,
        wins = wins + CASE WHEN p.result = 'win' THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN p.result = 'loss' THEN 1 ELSE 0 END,
        draws = draws + CASE WHEN p.result = 'draw' THEN 1 ELSE 0 END,
        updated_at = now()
      WHERE player_id = p.player_id AND season_key = v_season AND mode = m.mode;
    UPDATE public.match_players SET rating_after = ch.rating_after WHERE match_id = p_match_id AND player_id = p.player_id;
    IF m.mode = 'ranked' THEN PERFORM public.grant_division_chests(p.player_id, v_season, r.rating, ch.rating_after, p_match_id); END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.open_division_chest(p_player_id uuid, p_chest_id uuid, p_client_seed text, p_results jsonb, p_reserve jsonb, p_auto boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.division_chests%rowtype; v_seed text; r jsonb; v_rar text; v_left integer; v_asset uuid; v_card text;
  v_out jsonb := '[]'::jsonb; v_shares numeric := 0; v_credits bigint := 0; v_amt numeric;
BEGIN
  SELECT * INTO c FROM public.division_chests WHERE id = p_chest_id AND player_id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chest not found'; END IF;
  IF c.status <> 'unopened' THEN
    RETURN jsonb_build_object('results', c.results, 'serverSeed', c.server_seed, 'clientSeed', c.client_seed, 'reserve', c.reserve_snapshot, 'duplicate', true);
  END IF;
  SELECT server_seed INTO v_seed FROM public.division_chest_secrets WHERE chest_id = c.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chest not found'; END IF;
  IF jsonb_typeof(p_results) <> 'array' OR jsonb_array_length(p_results) < 1 OR jsonb_array_length(p_results) > 3 THEN
    RAISE EXCEPTION 'Invalid results';
  END IF;

  -- The roll used the reserve capped at 3 per rarity; it must still be the same.
  FOR v_rar, v_left IN SELECT rarity, least(remaining_units, 3) FROM public.legionnaire_reward_reserve ORDER BY rarity FOR UPDATE LOOP
    IF coalesce((p_reserve ->> v_rar)::integer, -1) <> v_left THEN RAISE EXCEPTION 'Reward reserve changed'; END IF;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    IF r ->> 'type' = 'card' THEN
      v_rar := r ->> 'rarity'; v_card := r ->> 'cardId';
      IF coalesce(r ->> 'foil', '') NOT IN ('regular','gold') THEN RAISE EXCEPTION 'Invalid results'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.cards WHERE id = v_card AND rarity = v_rar) THEN RAISE EXCEPTION 'Invalid results'; END IF;
      UPDATE public.legionnaire_reward_reserve SET remaining_units = remaining_units - 1 WHERE rarity = v_rar AND remaining_units > 0;
      IF NOT FOUND THEN RAISE EXCEPTION 'Reward reserve changed'; END IF;
      INSERT INTO public.card_assets (owner_id, card_id, foil, chest_id, slot)
        VALUES (p_player_id, v_card, r ->> 'foil', c.id, (r ->> 'roll')::smallint) RETURNING id INTO v_asset;
      PERFORM public.refresh_player_card(p_player_id, v_card);
      v_out := v_out || jsonb_build_array(r || jsonb_build_object('assetId', v_asset));
    ELSIF r ->> 'type' = 'coin_shares' THEN
      v_amt := (r ->> 'shares')::numeric;
      IF v_amt IS NULL OR v_amt <= 0 THEN RAISE EXCEPTION 'Invalid results'; END IF;
      v_shares := v_shares + v_amt;
      v_out := v_out || jsonb_build_array(r);
    ELSIF r ->> 'type' = 'credits' THEN
      v_amt := (r ->> 'credits')::numeric;
      IF v_amt IS NULL OR v_amt <= 0 THEN RAISE EXCEPTION 'Invalid results'; END IF;
      v_credits := v_credits + v_amt::bigint;
      PERFORM public.record_ledger_entry(p_player_id, 'credits', v_amt, 'chest_credits',
        'chest:credits:' || c.id || ':' || (r ->> 'roll'), 'division_chest', c.id::text, '{}'::jsonb);
      v_out := v_out || jsonb_build_array(r);
    ELSE
      RAISE EXCEPTION 'Invalid results';
    END IF;
  END LOOP;

  UPDATE public.division_chests SET status = CASE WHEN p_auto THEN 'auto_opened' ELSE 'opened' END,
      server_seed = v_seed, client_seed = p_client_seed, reserve_snapshot = p_reserve, results = v_out,
      coin_shares = v_shares, credits = v_credits, opened_at = now()
    WHERE id = c.id;
  DELETE FROM public.division_chest_secrets WHERE chest_id = c.id;
  UPDATE public.ranked_seasons SET chest_coin_shares = chest_coin_shares + v_shares WHERE key = c.season_key;
  RETURN jsonb_build_object('results', v_out, 'serverSeed', v_seed, 'clientSeed', p_client_seed, 'reserve', p_reserve, 'duplicate', false);
END $$;

-- One-time: records the 20,000 committed Legionnaire reserve packs as reward-card units per rarity.
CREATE OR REPLACE FUNCTION public.seed_legionnaire_reserve(p_counts jsonb, p_packs integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_total integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.legionnaire_reward_reserve) THEN RETURN false; END IF;
  SELECT sum(value::integer) INTO v_total FROM jsonb_each_text(p_counts);
  IF p_packs <= 0 OR v_total IS DISTINCT FROM p_packs * 5 THEN RAISE EXCEPTION 'Reserve must hold exactly 5 cards per pack'; END IF;
  INSERT INTO public.legionnaire_reward_reserve (rarity, original_units, remaining_units)
    SELECT key, value::integer, value::integer FROM jsonb_each_text(p_counts);
  UPDATE public.pack_supply SET reserve_issued = reserve_issued + p_packs, opened_packs = opened_packs + p_packs
    WHERE set_id = 'legionnaire';
  IF NOT FOUND THEN RAISE EXCEPTION 'Legionnaire pack supply missing'; END IF;
  RETURN true;
END $$;

-- Settles an ended season: pays chest Coin shares from its slice of the League Season pool, closes it,
-- starts the next season and inserts reset ratings. Chests must be opened (or auto-opened) first.
CREATE OR REPLACE FUNCTION public.close_ranked_season(p_key text, p_pool_share numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.ranked_seasons%rowtype; v_month date; v_league numeric; v_days integer; v_pool numeric := 0;
  v_total numeric; v_paid numeric := 0; v_amt numeric; pl record; v_next integer; v_start timestamptz;
BEGIN
  SELECT * INTO s FROM public.ranked_seasons WHERE key = p_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF s.status = 'closed' THEN RETURN jsonb_build_object('season', p_key, 'duplicate', true); END IF;
  IF s.ends_at > now() THEN RAISE EXCEPTION 'Season has not ended'; END IF;
  IF p_pool_share IS NULL OR p_pool_share < 0 OR p_pool_share > 1 THEN RAISE EXCEPTION 'Invalid pool share'; END IF;
  IF EXISTS (SELECT 1 FROM public.division_chests WHERE season_key = p_key AND status = 'unopened') THEN
    RAISE EXCEPTION 'Unopened chests remain';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matches WHERE season_key = p_key AND status IN ('team_selection','resolving')) THEN
    RAISE EXCEPTION 'Season has unfinished matches';
  END IF;

  v_month := date_trunc('month', s.ends_at AT TIME ZONE 'UTC')::date;
  SELECT league_pool INTO v_league FROM public.monthly_reward_budgets WHERE month = v_month AND status = 'published';
  v_days := extract(day FROM (v_month + interval '1 month' - interval '1 day'))::integer;
  v_pool := trunc(coalesce(v_league, 0) * p_pool_share * 14 / v_days, 8);
  SELECT coalesce(sum(coin_shares), 0) INTO v_total FROM public.division_chests WHERE season_key = p_key;

  IF v_pool > 0 AND v_total > 0 THEN
    FOR pl IN SELECT player_id, sum(coin_shares) AS sh FROM public.division_chests WHERE season_key = p_key
              GROUP BY player_id HAVING sum(coin_shares) > 0 ORDER BY player_id LOOP
      v_amt := trunc(v_pool * pl.sh / v_total, 8);
      IF v_amt > 0 THEN
        PERFORM public.record_ledger_entry(pl.player_id, 'coins', v_amt, 'chest_reward', 'reward:chest:' || p_key || ':' || pl.player_id,
          'ranked_season', p_key, jsonb_build_object('shares', pl.sh::text));
        v_paid := v_paid + v_amt;
      END IF;
    END LOOP;
    IF v_paid > 0 THEN
      INSERT INTO public.treasury_flows (flow_type, account, amount, reference_type, reference_id)
        VALUES ('reward_payout', 'reward_vault', -v_paid, 'ranked_season', 'chests:' || p_key);
    END IF;
  END IF;

  UPDATE public.ranked_seasons SET status = 'closed', closed_at = now(), chest_coin_pool = v_pool,
      chest_coin_shares = v_total, chest_coins_paid = v_paid
    WHERE key = p_key;
  v_next := s.number + 1;
  v_start := greatest(now(), s.ends_at);
  INSERT INTO public.ranked_seasons (key, number, starts_at, ends_at)
    VALUES ('season-' || v_next, v_next, v_start, v_start + interval '14 days');
  INSERT INTO public.player_ratings (player_id, season_key, mode, rating)
    SELECT r.player_id, 'season-' || v_next, r.mode,
           coalesce((SELECT d.reset_rating FROM public.ranked_divisions d WHERE d.min_rating <= r.rating ORDER BY d.min_rating DESC LIMIT 1), 1000)
      FROM public.player_ratings r WHERE r.season_key = p_key
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('season', p_key, 'nextSeason', 'season-' || v_next, 'pool', v_pool::text, 'shares', v_total::text, 'paid', v_paid::text, 'duplicate', false);
END $$;

-- ---------- Season-aware rewrites ----------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_base text; v_name text; v_display text; v_try integer := 0;
BEGIN
  v_base := regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^A-Za-z0-9_]', '', 'g');
  IF char_length(v_base) < 3 THEN v_base := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8); END IF;
  v_base := left(v_base, 20);
  v_name := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_name)) LOOP
    v_try := v_try + 1;
    v_name := left(v_base, 15) || '_' || lpad((floor(random() * 10000))::int::text, 4, '0');
    IF v_try > 20 THEN v_name := 'player_' || substr(replace(new.id::text, '-', ''), 1, 12); EXIT; END IF;
  END LOOP;
  v_display := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 32), '');
  IF v_display IS NULL OR v_display = v_base THEN v_display := v_name; END IF;

  INSERT INTO public.profiles (id, username, display_name) VALUES (new.id, v_name, v_display);
  INSERT INTO public.player_ratings (player_id, season_key, mode) VALUES (new.id, (public.current_ranked_season()).key, 'ranked') ON CONFLICT DO NOTHING;
  INSERT INTO public.currency_balances (player_id, currency) VALUES (new.id, 'credits'), (new.id, 'coins') ON CONFLICT DO NOTHING;
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.join_matchmaking(p_mode text DEFAULT 'ranked', p_region text DEFAULT 'global', p_rating_delta integer DEFAULT 150)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v public.game_versions%rowtype; s public.ranked_seasons%rowtype; v_rating integer; v_ticket uuid; v_match uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_rating_delta NOT BETWEEN 0 AND 1000 THEN RAISE EXCEPTION 'Invalid rating delta'; END IF;
  IF EXISTS (SELECT 1 FROM public.match_players mp JOIN public.matches m ON m.id = mp.match_id
              WHERE mp.player_id = v_user AND m.status IN ('team_selection','resolving')) THEN
    RAISE EXCEPTION 'Finish your current match first';
  END IF;
  SELECT * INTO v FROM public.game_versions WHERE status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'No active game version'; END IF;
  s := public.current_ranked_season();
  IF s.ends_at <= now() THEN RAISE EXCEPTION 'Season is ending'; END IF;

  INSERT INTO public.player_ratings (player_id, season_key, mode) VALUES (v_user, s.key, p_mode) ON CONFLICT DO NOTHING;
  SELECT rating INTO v_rating FROM public.player_ratings WHERE player_id = v_user AND season_key = s.key AND mode = p_mode;
  UPDATE public.matchmaking_tickets SET status = 'cancelled' WHERE player_id = v_user AND status = 'searching';
  INSERT INTO public.matchmaking_tickets (player_id, game_version_id, season_key, mode, region, rating, rating_delta)
    VALUES (v_user, v.id, s.key, p_mode, p_region, v_rating, p_rating_delta) RETURNING id INTO v_ticket;
  v_match := public._try_match_ticket(v_ticket);
  RETURN jsonb_build_object('ticketId', v_ticket, 'matchId', v_match, 'status', CASE WHEN v_match IS NULL THEN 'searching' ELSE 'matched' END);
END $$;

CREATE OR REPLACE FUNCTION public._try_match_ticket(p_ticket_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t public.matchmaking_tickets%rowtype; opp public.matchmaking_tickets%rowtype; v public.game_versions%rowtype;
  v_match uuid; v_rules text[] := '{}'; v_count integer; v_pick record; v_caps integer[] := ARRAY[13,15,17,19,21,24,27,30,35,40];
  v_wait numeric;
BEGIN
  SELECT * INTO t FROM public.matchmaking_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND OR t.status <> 'searching' OR t.expires_at <= now() THEN RETURN NULL; END IF;
  -- Rating window widens by 50 every 15 seconds of waiting (max 1000).
  v_wait := extract(epoch FROM (now() - t.created_at));
  SELECT * INTO opp FROM public.matchmaking_tickets o
   WHERE o.status = 'searching' AND o.id <> t.id AND o.player_id <> t.player_id
     AND o.game_version_id = t.game_version_id AND o.season_key = t.season_key AND o.mode = t.mode AND o.region = t.region
     AND o.expires_at > now()
     AND abs(o.rating - t.rating) <= least(1000, greatest(o.rating_delta, t.rating_delta) + floor(v_wait / 15) * 50)
   ORDER BY abs(o.rating - t.rating), o.created_at
   FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v FROM public.game_versions WHERE id = t.game_version_id;

  -- Battle rules per match come from the lower-rated player's division (Wood 0, Bronze/Silver III 1, higher 2).
  SELECT d.rulesets INTO v_count FROM public.ranked_divisions d
   WHERE d.min_rating <= least(t.rating, opp.rating) ORDER BY d.min_rating DESC LIMIT 1;
  v_count := coalesce(v_count, 0);
  WHILE cardinality(v_rules) < v_count LOOP
    SELECT r.id INTO v_pick FROM public.rulesets r
     WHERE r.active AND r.selection_weight > 0 AND r.game_version_id = v.id
       AND NOT (r.id = ANY (v_rules)) AND NOT (r.incompatible_with && v_rules)
       AND NOT EXISTS (SELECT 1 FROM public.rulesets x WHERE x.id = ANY (v_rules) AND r.id = ANY (x.incompatible_with))
     ORDER BY -ln(greatest(random(), 1e-12)) / r.selection_weight LIMIT 1;
    EXIT WHEN NOT FOUND;
    v_rules := v_rules || v_pick.id::text;
  END LOOP;

  INSERT INTO public.matches (game_version_id, engine_version, mode, region, mana_cap, seed, ruleset_ids, season_key)
    VALUES (v.id, v.engine_version, t.mode, t.region, v_caps[1 + floor(random() * cardinality(v_caps))::int],
            encode(extensions.gen_random_bytes(16), 'hex'), v_rules, t.season_key)
    RETURNING id INTO v_match;
  INSERT INTO public.match_players (match_id, player_id, side, rating_before)
    VALUES (v_match, opp.player_id, 1, opp.rating), (v_match, t.player_id, 2, t.rating);
  UPDATE public.matchmaking_tickets SET status = 'matched', match_id = v_match, matched_at = now() WHERE id IN (t.id, opp.id);
  RETURN v_match;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_match(p_match_id uuid, p_outcome text, p_winner_player_id uuid, p_result jsonb, p_replay jsonb, p_input_hash text, p_result_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.matches WHERE id = p_match_id AND status = 'resolving' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_outcome NOT IN ('side_1','side_2','draw') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;

  UPDATE public.matches SET status = 'completed', outcome = p_outcome, winner_player_id = p_winner_player_id, result = p_result,
    replay = p_replay, input_hash = p_input_hash, result_hash = p_result_hash, completed_at = now()
  WHERE id = p_match_id;
  UPDATE public.match_players SET result = CASE p_outcome WHEN 'side_1' THEN 'win' WHEN 'draw' THEN 'draw' ELSE 'loss' END
    WHERE match_id = p_match_id AND side = 1;
  UPDATE public.match_players SET result = CASE p_outcome WHEN 'side_2' THEN 'win' WHEN 'draw' THEN 'draw' ELSE 'loss' END
    WHERE match_id = p_match_id AND side = 2;

  PERFORM public.apply_ranked_result(p_match_id);
  PERFORM public.accrue_match_rewards(p_match_id);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.expire_stale_matches()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.matches%rowtype; v_sub uuid; v_side smallint; v_n integer := 0;
BEGIN
  UPDATE public.matchmaking_tickets SET status = 'expired' WHERE status = 'searching' AND expires_at <= now();
  FOR m IN SELECT * FROM public.matches WHERE status = 'team_selection' AND selection_deadline < now() ORDER BY selection_deadline
           FOR UPDATE SKIP LOCKED LOOP
    IF (SELECT count(*) FROM public.match_submissions WHERE match_id = m.id) = 1 THEN
      SELECT s.player_id, mp.side INTO v_sub, v_side FROM public.match_submissions s
        JOIN public.match_players mp ON mp.match_id = s.match_id AND mp.player_id = s.player_id WHERE s.match_id = m.id;
      UPDATE public.matches SET status = 'completed', outcome = CASE WHEN v_side = 1 THEN 'side_1' ELSE 'side_2' END,
        winner_player_id = v_sub, result = jsonb_build_object('outcome', CASE WHEN v_side = 1 THEN 'side_1' ELSE 'side_2' END,
          'winnerPlayerId', v_sub, 'reason', 'timeout'), completed_at = now()
        WHERE id = m.id;
      UPDATE public.match_players SET result = CASE WHEN side = v_side THEN 'win' ELSE 'loss' END WHERE match_id = m.id;
      PERFORM public.apply_ranked_result(m.id);
      PERFORM public.accrue_match_rewards(m.id);
    ELSE
      UPDATE public.matches SET status = 'cancelled', outcome = 'cancelled', result = jsonb_build_object('outcome', 'cancelled', 'reason', 'timeout'),
        completed_at = now() WHERE id = m.id;
      UPDATE public.match_players SET rating_after = rating_before, result = 'cancelled' WHERE match_id = m.id;
    END IF;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

-- New procedures are server-only.
REVOKE ALL ON FUNCTION public.current_ranked_season() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ranked_rating_change(integer, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._new_division_chest(text, uuid, text, text, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_division_chests(uuid, text, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_ranked_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_division_chest(uuid, uuid, text, jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_legionnaire_reserve(jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_ranked_season(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_ranked_season(), public.ranked_rating_change(integer, text, integer),
  public._new_division_chest(text, uuid, text, text, integer, uuid), public.grant_division_chests(uuid, text, integer, integer, uuid),
  public.apply_ranked_result(uuid), public.open_division_chest(uuid, uuid, text, jsonb, jsonb, boolean),
  public.seed_legionnaire_reserve(jsonb, integer), public.close_ranked_season(text, numeric) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_match(uuid, text, uuid, jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_matches() FROM PUBLIC, anon, authenticated;