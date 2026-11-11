-- Phase 4: Reward Energy, ranked win shares, daily activity missions and daily Coin settlement.
-- Rules: docs/diademfall-complete-v4/economy (economy-config.json, treasury-funded-rewards.md).
-- Coins are only paid for days whose month has a published reward budget (noRewardPromiseBeforeFunding).

-- 1. Reward Energy: energy stored at anchor_at; +1 per hour since the anchor, max 24. Missing row = full.
CREATE TABLE public.reward_energy (
  player_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  energy smallint NOT NULL CHECK (energy BETWEEN 0 AND 24),
  anchor_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_energy TO authenticated;
GRANT ALL ON public.reward_energy TO service_role;
ALTER TABLE public.reward_energy ENABLE ROW LEVEL SECURITY;
CREATE POLICY reward_energy_read_own ON public.reward_energy FOR SELECT TO authenticated USING (player_id = auth.uid());

-- 2. Per-match reward record for both players.
CREATE TABLE public.match_rewards (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  reward_day date NOT NULL,
  status text NOT NULL CHECK (status IN ('earned','no_energy','wood_league','not_a_win','timeout')),
  energy_spent boolean NOT NULL DEFAULT false,
  league_id text NOT NULL,
  league_multiplier numeric(6,3) NOT NULL DEFAULT 0,
  opponent_factor numeric(8,6) NOT NULL DEFAULT 1,
  streak_bonus numeric(6,4) NOT NULL DEFAULT 0,
  foil_bonus numeric(6,4) NOT NULL DEFAULT 0,
  gold_cards smallint NOT NULL DEFAULT 0,
  shares numeric(20,6) NOT NULL DEFAULT 0 CHECK (shares >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);
CREATE INDEX match_rewards_player_idx ON public.match_rewards (player_id, created_at DESC);
GRANT SELECT ON public.match_rewards TO authenticated;
GRANT ALL ON public.match_rewards TO service_role;
ALTER TABLE public.match_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY match_rewards_read_own ON public.match_rewards FOR SELECT TO authenticated USING (player_id = auth.uid());

-- 3. Per-player per-UTC-day totals (match shares + mission progress) and settled payouts.
CREATE TABLE public.player_reward_days (
  reward_day date NOT NULL,
  player_id uuid NOT NULL,
  eligible_wins integer NOT NULL DEFAULT 0,
  match_shares numeric(20,6) NOT NULL DEFAULT 0,
  banners text[] NOT NULL DEFAULT '{}',
  rulesets text[] NOT NULL DEFAULT '{}',
  low_mana_win boolean NOT NULL DEFAULT false,
  daily_multiplier numeric(6,3) NOT NULL DEFAULT 0,
  activity_points integer NOT NULL DEFAULT 0,
  activity_shares numeric(20,6) NOT NULL DEFAULT 0,
  match_coins numeric(30,8) NOT NULL DEFAULT 0,
  activity_coins numeric(30,8) NOT NULL DEFAULT 0,
  settled_at timestamptz,
  PRIMARY KEY (reward_day, player_id)
);
CREATE INDEX player_reward_days_player_idx ON public.player_reward_days (player_id, reward_day DESC);
CREATE INDEX player_reward_days_open_idx ON public.player_reward_days (reward_day) WHERE settled_at IS NULL;
GRANT SELECT ON public.player_reward_days TO authenticated;
GRANT ALL ON public.player_reward_days TO service_role;
ALTER TABLE public.player_reward_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_reward_days_read_own ON public.player_reward_days FOR SELECT TO authenticated USING (player_id = auth.uid());

-- 4. Monthly reward budgets (treasury runway formula). Published rows are public.
CREATE TABLE public.monthly_reward_budgets (
  month date PRIMARY KEY CHECK (extract(day FROM month) = 1),
  opening_reward_vault numeric(30,8) NOT NULL CHECK (opening_reward_vault >= 0),
  prior_month_acquired numeric(30,8) NOT NULL DEFAULT 0 CHECK (prior_month_acquired >= 0),
  calculated_budget numeric(30,8) NOT NULL CHECK (calculated_budget >= 0),
  match_pool numeric(30,8) NOT NULL,
  activity_pool numeric(30,8) NOT NULL,
  league_pool numeric(30,8) NOT NULL,
  leaderboard_pool numeric(30,8) NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.monthly_reward_budgets TO anon, authenticated;
GRANT ALL ON public.monthly_reward_budgets TO service_role;
ALTER TABLE public.monthly_reward_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY monthly_reward_budgets_read_published ON public.monthly_reward_budgets FOR SELECT TO anon, authenticated USING (status = 'published');

-- 5. Settled reward days (public transparency).
CREATE TABLE public.reward_days (
  reward_day date PRIMARY KEY,
  budget_month date NOT NULL,
  match_pool numeric(30,8) NOT NULL,
  activity_pool numeric(30,8) NOT NULL,
  rollover_in_match numeric(30,8) NOT NULL DEFAULT 0,
  rollover_in_activity numeric(30,8) NOT NULL DEFAULT 0,
  total_match_shares numeric(24,6) NOT NULL DEFAULT 0,
  total_activity_shares numeric(24,6) NOT NULL DEFAULT 0,
  paid_match numeric(30,8) NOT NULL DEFAULT 0,
  paid_activity numeric(30,8) NOT NULL DEFAULT 0,
  rollover_out_match numeric(30,8) NOT NULL DEFAULT 0,
  rollover_out_activity numeric(30,8) NOT NULL DEFAULT 0,
  players_paid integer NOT NULL DEFAULT 0,
  settled_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_days TO anon, authenticated;
GRANT ALL ON public.reward_days TO service_role;
ALTER TABLE public.reward_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY reward_days_read ON public.reward_days FOR SELECT TO anon, authenticated USING (true);

-- 6. Pure helpers.
CREATE OR REPLACE FUNCTION public.reward_league(p_rating integer, OUT league_id text, OUT win_multiplier numeric, OUT daily_multiplier numeric)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT l.id, l.w, l.d
    FROM (VALUES ('champion', 2600, 8.0, 2.0), ('diamond', 2200, 5.0, 1.7), ('gold', 1800, 3.0, 1.4),
                 ('silver', 1400, 1.75, 1.2), ('bronze', 1000, 1.0, 1.0), ('wood', -2147483648, 0.0, 0.0)) AS l(id, lo, w, d)
   WHERE coalesce(p_rating, 0) >= l.lo ORDER BY l.lo DESC LIMIT 1
$$;

-- Missions: first/third/fifth win 20 each, 2+ Banners 15, 3+ battle rules 15, low-mana troop win 10 (max 100).
CREATE OR REPLACE FUNCTION public.reward_activity_points(p_wins integer, p_banners integer, p_rulesets integer, p_low_mana boolean)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (CASE WHEN p_wins >= 1 THEN 20 ELSE 0 END) + (CASE WHEN p_wins >= 3 THEN 20 ELSE 0 END)
       + (CASE WHEN p_wins >= 5 THEN 20 ELSE 0 END) + (CASE WHEN p_banners >= 2 THEN 15 ELSE 0 END)
       + (CASE WHEN p_rulesets >= 3 THEN 15 ELSE 0 END) + (CASE WHEN p_low_mana THEN 10 ELSE 0 END)
$$;

-- Spend 1 energy at p_at; returns false (nothing spent) when the player has 0 energy.
CREATE OR REPLACE FUNCTION public.spend_reward_energy(p_player_id uuid, p_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.reward_energy%rowtype; v_ticks integer; v_now integer; v_anchor timestamptz;
BEGIN
  INSERT INTO public.reward_energy (player_id, energy, anchor_at) VALUES (p_player_id, 24, p_at) ON CONFLICT (player_id) DO NOTHING;
  SELECT * INTO r FROM public.reward_energy WHERE player_id = p_player_id FOR UPDATE;
  v_ticks := greatest(0, floor(extract(epoch FROM (p_at - r.anchor_at)) / 3600))::integer;
  v_now := least(24, r.energy + v_ticks);
  v_anchor := CASE WHEN v_now >= 24 THEN p_at ELSE r.anchor_at + make_interval(hours => v_ticks) END;
  IF v_now < 1 THEN
    UPDATE public.reward_energy SET energy = 0, anchor_at = v_anchor WHERE player_id = p_player_id;
    RETURN false;
  END IF;
  UPDATE public.reward_energy SET energy = v_now - 1, anchor_at = v_anchor WHERE player_id = p_player_id;
  RETURN true;
END;
$$;

-- 7. Accrue rewards for both players of a just-finalized ranked match (called by finalize_match).
CREATE OR REPLACE FUNCTION public.accrue_match_rewards(p_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_m public.matches%rowtype; p public.match_players%rowtype; o public.match_players%rowtype;
  v_timeout boolean; v_day date; v_at timestamptz; lg record; v_spent boolean; v_status text;
  v_opp numeric; v_streak integer; v_streak_bonus numeric; v_gold integer; v_foil numeric; v_shares numeric;
  v_sub public.match_submissions%rowtype; v_ids text[]; v_banner text; v_low boolean; rr record; d public.player_reward_days%rowtype;
BEGIN
  SELECT * INTO v_m FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND OR v_m.mode <> 'ranked' OR v_m.status <> 'completed' THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.match_rewards WHERE match_id = p_match_id) THEN RETURN; END IF;
  v_timeout := coalesce(v_m.result->>'reason', '') = 'timeout';
  v_at := coalesce(v_m.completed_at, now());
  v_day := (v_at AT TIME ZONE 'UTC')::date;

  FOR p IN SELECT * FROM public.match_players WHERE match_id = p_match_id ORDER BY side LOOP
    SELECT * INTO o FROM public.match_players WHERE match_id = p_match_id AND player_id <> p.player_id;
    SELECT * INTO lg FROM public.reward_league(p.rating_before);
    v_spent := false; v_opp := 1; v_streak_bonus := 0; v_gold := 0; v_foil := 0; v_shares := 0;
    IF NOT v_timeout THEN v_spent := public.spend_reward_energy(p.player_id, v_at); END IF;
    v_status := CASE
      WHEN v_timeout AND p.result = 'win' THEN 'timeout'
      WHEN p.result IS DISTINCT FROM 'win' THEN 'not_a_win'
      WHEN lg.win_multiplier = 0 THEN 'wood_league'
      WHEN NOT v_spent THEN 'no_energy'
      ELSE 'earned' END;

    IF v_status = 'earned' THEN
      v_opp := greatest(0.75, least(1.25, 1 + (o.rating_before - p.rating_before)::numeric / 1600));
      v_streak := 0;
      FOR rr IN SELECT mp.result FROM public.match_players mp JOIN public.matches mm ON mm.id = mp.match_id
                 WHERE mp.player_id = p.player_id AND mm.id <> p_match_id AND mm.status = 'completed' AND mm.mode = 'ranked'
                   AND coalesce(mm.result->>'reason', '') <> 'timeout' AND mm.completed_at <= v_at
                 ORDER BY mm.completed_at DESC LIMIT 5 LOOP
        EXIT WHEN rr.result IS DISTINCT FROM 'win';
        v_streak := v_streak + 1;
      END LOOP;
      v_streak_bonus := least(0.15, 0.03 * v_streak);

      SELECT * INTO v_sub FROM public.match_submissions WHERE match_id = p_match_id AND player_id = p.player_id;
      v_ids := ARRAY[v_sub.summoner_card_id] || coalesce(ARRAY(SELECT f->>'cardId' FROM jsonb_array_elements(v_sub.formation) f), '{}');
      SELECT count(DISTINCT a.card_id) INTO v_gold FROM public.card_assets a
       WHERE a.owner_id = p.player_id AND a.foil = 'gold' AND a.status <> 'burned' AND a.card_id = ANY (v_ids);
      v_gold := least(7, v_gold);
      v_foil := least(0.14, 0.02 * v_gold);
      v_shares := round(100 * lg.win_multiplier * v_opp * (1 + v_streak_bonus) * (1 + v_foil), 6);

      SELECT c.banner_id INTO v_banner FROM public.cards c WHERE c.id = v_sub.summoner_card_id;
      SELECT EXISTS (SELECT 1 FROM public.cards c WHERE c.id = ANY (v_ids[2:]) AND c.card_type = 'unit' AND c.mana <= 2) INTO v_low;

      INSERT INTO public.player_reward_days (reward_day, player_id) VALUES (v_day, p.player_id) ON CONFLICT DO NOTHING;
      SELECT * INTO d FROM public.player_reward_days WHERE reward_day = v_day AND player_id = p.player_id FOR UPDATE;
      d.eligible_wins := d.eligible_wins + 1;
      d.match_shares := d.match_shares + v_shares;
      IF v_banner IS NOT NULL AND NOT (v_banner = ANY (d.banners)) THEN d.banners := d.banners || v_banner; END IF;
      d.rulesets := ARRAY(SELECT DISTINCT x FROM unnest(d.rulesets || coalesce(v_m.ruleset_ids, '{}')) x ORDER BY 1);
      d.low_mana_win := d.low_mana_win OR coalesce(v_low, false);
      d.daily_multiplier := lg.daily_multiplier;
      d.activity_points := public.reward_activity_points(d.eligible_wins, cardinality(d.banners), cardinality(d.rulesets), d.low_mana_win);
      d.activity_shares := CASE WHEN d.eligible_wins >= 3 THEN d.activity_points * d.daily_multiplier ELSE 0 END;
      UPDATE public.player_reward_days SET eligible_wins = d.eligible_wins, match_shares = d.match_shares, banners = d.banners,
        rulesets = d.rulesets, low_mana_win = d.low_mana_win, daily_multiplier = d.daily_multiplier,
        activity_points = d.activity_points, activity_shares = d.activity_shares
       WHERE reward_day = v_day AND player_id = p.player_id;
    END IF;

    INSERT INTO public.match_rewards (match_id, player_id, reward_day, status, energy_spent, league_id, league_multiplier,
      opponent_factor, streak_bonus, foil_bonus, gold_cards, shares)
    VALUES (p_match_id, p.player_id, v_day, v_status, v_spent, lg.league_id, lg.win_multiplier,
      round(v_opp, 6), v_streak_bonus, v_foil, v_gold, v_shares)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- 8. finalize_match: unchanged Elo update, then reward accrual in the same transaction.
CREATE OR REPLACE FUNCTION public.finalize_match(p_match_id uuid, p_outcome text, p_winner_player_id uuid, p_result jsonb, p_replay jsonb, p_input_hash text, p_result_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
declare
  p1 public.match_players%rowtype; p2 public.match_players%rowtype;
  e1 numeric; s1 numeric; n1 integer; n2 integer;
begin
  perform 1 from public.matches where id=p_match_id and status='resolving' for update;
  if not found then return false; end if;
  if p_outcome not in ('side_1','side_2','draw') then raise exception 'Invalid outcome'; end if;
  select * into p1 from public.match_players where match_id=p_match_id and side=1;
  select * into p2 from public.match_players where match_id=p_match_id and side=2;
  e1 := 1.0 / (1.0 + power(10.0, (p2.rating_before-p1.rating_before)/400.0));
  s1 := case p_outcome when 'side_1' then 1.0 when 'draw' then 0.5 else 0.0 end;
  n1 := greatest(0, round(p1.rating_before + 32*(s1-e1))::integer);
  n2 := greatest(0, round(p2.rating_before + 32*((1-s1)-(1-e1)))::integer);

  update public.matches set status='completed', outcome=p_outcome,
    winner_player_id=p_winner_player_id, result=p_result, replay=p_replay,
    input_hash=p_input_hash, result_hash=p_result_hash, completed_at=now()
  where id=p_match_id;

  update public.match_players set rating_after=n1,
    result=case p_outcome when 'side_1' then 'win' when 'draw' then 'draw' else 'loss' end
    where match_id=p_match_id and side=1;
  update public.match_players set rating_after=n2,
    result=case p_outcome when 'side_2' then 'win' when 'draw' then 'draw' else 'loss' end
    where match_id=p_match_id and side=2;

  update public.player_ratings r set rating=mp.rating_after,
    wins=r.wins + case when mp.result='win' then 1 else 0 end,
    losses=r.losses + case when mp.result='loss' then 1 else 0 end,
    draws=r.draws + case when mp.result='draw' then 1 else 0 end
  from public.match_players mp
  where mp.match_id=p_match_id and r.player_id=mp.player_id
    and r.season_key='preseason' and r.mode=(select mode from public.matches where id=p_match_id);

  perform public.accrue_match_rewards(p_match_id);
  return true;
end;
$function$;

-- 9. Publish a month's reward budget: min(50m, openingVault/12 + 0.8 × prior-month acquisitions), split 62.5/18.75/12.5/6.25.
CREATE OR REPLACE FUNCTION public.publish_reward_budget(p_month date, p_opening_reward_vault numeric, p_prior_month_acquired numeric DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_month date := date_trunc('month', p_month)::date; v_budget numeric;
BEGIN
  IF p_opening_reward_vault IS NULL OR p_opening_reward_vault < 0 OR coalesce(p_prior_month_acquired, 0) < 0 THEN RAISE EXCEPTION 'Invalid amounts'; END IF;
  IF EXISTS (SELECT 1 FROM public.reward_days WHERE budget_month = v_month) THEN RAISE EXCEPTION 'Month already has settled days'; END IF;
  v_budget := trunc(least(50000000, p_opening_reward_vault / 12 + 0.8 * coalesce(p_prior_month_acquired, 0)), 8);
  INSERT INTO public.monthly_reward_budgets (month, opening_reward_vault, prior_month_acquired, calculated_budget,
    match_pool, activity_pool, league_pool, leaderboard_pool, status, published_at)
  VALUES (v_month, p_opening_reward_vault, coalesce(p_prior_month_acquired, 0), v_budget,
    trunc(v_budget * 0.625, 8), trunc(v_budget * 0.1875, 8), trunc(v_budget * 0.125, 8), trunc(v_budget * 0.0625, 8), 'published', now())
  ON CONFLICT (month) DO UPDATE SET opening_reward_vault = excluded.opening_reward_vault, prior_month_acquired = excluded.prior_month_acquired,
    calculated_budget = excluded.calculated_budget, match_pool = excluded.match_pool, activity_pool = excluded.activity_pool,
    league_pool = excluded.league_pool, leaderboard_pool = excluded.leaderboard_pool, status = 'published', published_at = now();
  RETURN jsonb_build_object('month', v_month, 'budget', v_budget::text);
END;
$$;

-- 10. Settle one finished UTC day. Unfunded months are left open (no Coins promised before funding).
CREATE OR REPLACE FUNCTION public.settle_reward_day(p_day date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  b public.monthly_reward_budgets%rowtype; v_days integer; v_roll_m numeric := 0; v_roll_a numeric := 0;
  v_pool_m numeric; v_pool_a numeric; v_tm numeric; v_ta numeric; r public.player_reward_days%rowtype;
  v_mc numeric; v_ac numeric; v_paid_m numeric := 0; v_paid_a numeric := 0; v_players integer := 0;
BEGIN
  IF p_day IS NULL OR p_day >= (now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'Day is not finished yet'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('settle_reward_day'));
  IF EXISTS (SELECT 1 FROM public.reward_days WHERE reward_day = p_day) THEN RETURN jsonb_build_object('day', p_day, 'status', 'already_settled'); END IF;
  SELECT * INTO b FROM public.monthly_reward_budgets WHERE month = date_trunc('month', p_day)::date AND status = 'published';
  IF NOT FOUND THEN RETURN jsonb_build_object('day', p_day, 'status', 'unfunded'); END IF;

  v_days := extract(day FROM (date_trunc('month', p_day) + interval '1 month - 1 day'))::integer;
  SELECT rollover_out_match, rollover_out_activity INTO v_roll_m, v_roll_a FROM public.reward_days WHERE reward_day = p_day - 1;
  v_roll_m := coalesce(v_roll_m, 0); v_roll_a := coalesce(v_roll_a, 0);
  v_pool_m := trunc(b.match_pool / v_days, 8) + v_roll_m;
  v_pool_a := trunc(b.activity_pool / v_days, 8) + v_roll_a;
  SELECT coalesce(sum(match_shares), 0), coalesce(sum(activity_shares), 0) INTO v_tm, v_ta
    FROM public.player_reward_days WHERE reward_day = p_day;

  FOR r IN SELECT * FROM public.player_reward_days WHERE reward_day = p_day AND (match_shares > 0 OR activity_shares > 0)
           ORDER BY player_id FOR UPDATE LOOP
    v_mc := CASE WHEN v_tm > 0 AND r.match_shares > 0 THEN trunc(least(v_pool_m * r.match_shares / v_tm, v_pool_m * 0.005), 8) ELSE 0 END;
    v_ac := CASE WHEN v_ta > 0 AND r.activity_shares > 0 THEN trunc(least(v_pool_a * r.activity_shares / v_ta, v_pool_a * 0.0025), 8) ELSE 0 END;
    IF v_mc > 0 THEN
      PERFORM public.record_ledger_entry(r.player_id, 'coins', v_mc, 'match_reward', 'reward:match:' || p_day || ':' || r.player_id,
        'reward_day', p_day::text, jsonb_build_object('shares', r.match_shares::text, 'totalShares', v_tm::text, 'wins', r.eligible_wins));
    END IF;
    IF v_ac > 0 THEN
      PERFORM public.record_ledger_entry(r.player_id, 'coins', v_ac, 'daily_reward', 'reward:daily:' || p_day || ':' || r.player_id,
        'reward_day', p_day::text, jsonb_build_object('points', r.activity_points, 'shares', r.activity_shares::text, 'totalShares', v_ta::text));
    END IF;
    IF v_mc > 0 OR v_ac > 0 THEN v_players := v_players + 1; END IF;
    v_paid_m := v_paid_m + v_mc; v_paid_a := v_paid_a + v_ac;
    UPDATE public.player_reward_days SET match_coins = v_mc, activity_coins = v_ac, settled_at = now()
     WHERE reward_day = p_day AND player_id = r.player_id;
  END LOOP;
  UPDATE public.player_reward_days SET settled_at = now() WHERE reward_day = p_day AND settled_at IS NULL;

  INSERT INTO public.reward_days (reward_day, budget_month, match_pool, activity_pool, rollover_in_match, rollover_in_activity,
    total_match_shares, total_activity_shares, paid_match, paid_activity, rollover_out_match, rollover_out_activity, players_paid)
  VALUES (p_day, b.month, v_pool_m, v_pool_a, v_roll_m, v_roll_a, v_tm, v_ta, v_paid_m, v_paid_a, v_pool_m - v_paid_m, v_pool_a - v_paid_a, v_players);
  RETURN jsonb_build_object('day', p_day, 'status', 'settled', 'paidMatch', v_paid_m::text, 'paidActivity', v_paid_a::text, 'players', v_players);
END;
$$;

-- 11. Settle every finished day that can be settled (daily job).
CREATE OR REPLACE FUNCTION public.settle_due_reward_days()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_today date := (now() AT TIME ZONE 'UTC')::date; v_start date; v_day date; n integer := 0; res jsonb;
BEGIN
  v_start := least(
    coalesce((SELECT max(reward_day) + 1 FROM public.reward_days), v_today),
    coalesce((SELECT min(reward_day) FROM public.player_reward_days WHERE settled_at IS NULL), v_today),
    coalesce((SELECT min(month) FROM public.monthly_reward_budgets WHERE status = 'published'
               AND month > coalesce((SELECT max(budget_month) FROM public.reward_days), '-infinity'::date)), v_today));
  v_start := greatest(v_start, v_today - 400);
  v_day := v_start;
  WHILE v_day < v_today LOOP
    res := public.settle_reward_day(v_day);
    IF res->>'status' = 'settled' THEN n := n + 1; END IF;
    v_day := v_day + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- 12. Signed-in player's energy, today's progress and estimated Coins.
CREATE OR REPLACE FUNCTION public.my_rewards_today()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_today date := (now() AT TIME ZONE 'UTC')::date; e public.reward_energy%rowtype;
  v_ticks integer; v_energy integer := 24; v_next timestamptz; d public.player_reward_days%rowtype;
  b public.monthly_reward_budgets%rowtype; v_days integer; v_pool_m numeric := 0; v_pool_a numeric := 0;
  v_tm numeric; v_ta numeric; v_est_m numeric := 0; v_est_a numeric := 0; v_funded boolean; v_last jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO e FROM public.reward_energy WHERE player_id = v_uid;
  IF FOUND THEN
    v_ticks := greatest(0, floor(extract(epoch FROM (now() - e.anchor_at)) / 3600))::integer;
    v_energy := least(24, e.energy + v_ticks);
    IF v_energy < 24 THEN v_next := e.anchor_at + make_interval(hours => v_ticks + 1); END IF;
  END IF;

  SELECT * INTO d FROM public.player_reward_days WHERE reward_day = v_today AND player_id = v_uid;
  SELECT * INTO b FROM public.monthly_reward_budgets WHERE month = date_trunc('month', v_today)::date AND status = 'published';
  v_funded := FOUND;
  SELECT coalesce(sum(match_shares), 0), coalesce(sum(activity_shares), 0) INTO v_tm, v_ta FROM public.player_reward_days WHERE reward_day = v_today;
  IF v_funded THEN
    v_days := extract(day FROM (date_trunc('month', v_today) + interval '1 month - 1 day'))::integer;
    v_pool_m := trunc(b.match_pool / v_days, 8) + coalesce((SELECT rollover_out_match FROM public.reward_days WHERE reward_day = v_today - 1), 0);
    v_pool_a := trunc(b.activity_pool / v_days, 8) + coalesce((SELECT rollover_out_activity FROM public.reward_days WHERE reward_day = v_today - 1), 0);
    IF v_tm > 0 AND coalesce(d.match_shares, 0) > 0 THEN v_est_m := trunc(least(v_pool_m * d.match_shares / v_tm, v_pool_m * 0.005), 8); END IF;
    IF v_ta > 0 AND coalesce(d.activity_shares, 0) > 0 THEN v_est_a := trunc(least(v_pool_a * d.activity_shares / v_ta, v_pool_a * 0.0025), 8); END IF;
  END IF;
  SELECT jsonb_build_object('day', reward_day, 'matchCoins', match_coins::text, 'activityCoins', activity_coins::text) INTO v_last
    FROM public.player_reward_days WHERE player_id = v_uid AND settled_at IS NOT NULL AND (match_coins > 0 OR activity_coins > 0)
   ORDER BY reward_day DESC LIMIT 1;

  RETURN jsonb_build_object(
    'day', v_today, 'energy', v_energy, 'maxEnergy', 24, 'nextEnergyAt', v_next,
    'eligibleWins', coalesce(d.eligible_wins, 0), 'matchShares', coalesce(d.match_shares, 0)::text,
    'bannersUsed', coalesce(cardinality(d.banners), 0), 'rulesetsWon', coalesce(cardinality(d.rulesets), 0),
    'lowManaWin', coalesce(d.low_mana_win, false), 'activityPoints', coalesce(d.activity_points, 0),
    'activityShares', coalesce(d.activity_shares, 0)::text, 'dailyMultiplier', coalesce(d.daily_multiplier, 0)::text,
    'funded', v_funded, 'matchPool', v_pool_m::text, 'activityPool', v_pool_a::text,
    'totalMatchShares', v_tm::text, 'totalActivityShares', v_ta::text,
    'estimatedMatchCoins', v_est_m::text, 'estimatedActivityCoins', v_est_a::text, 'lastPayout', v_last);
END;
$$;

-- 13. Execute permissions: only my_rewards_today is callable by players; everything else is server-only.
REVOKE EXECUTE ON FUNCTION public.reward_league(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reward_activity_points(integer, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spend_reward_energy(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accrue_match_rewards(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_match(uuid, text, uuid, jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_reward_budget(date, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_reward_day(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_due_reward_days() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.my_rewards_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reward_league(integer), public.reward_activity_points(integer, integer, integer, boolean),
  public.spend_reward_energy(uuid, timestamptz), public.accrue_match_rewards(uuid),
  public.finalize_match(uuid, text, uuid, jsonb, jsonb, text, text), public.publish_reward_budget(date, numeric, numeric),
  public.settle_reward_day(date), public.settle_due_reward_days(), public.my_rewards_today() TO service_role;
GRANT EXECUTE ON FUNCTION public.my_rewards_today() TO authenticated;

-- 14. Daily settlement job runner.
CREATE EXTENSION IF NOT EXISTS pg_cron;