CREATE OR REPLACE FUNCTION public.purchase_packs(p_player_id uuid, p_set_id text, p_quantity integer, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE e record; v_sold bigint; v_debit jsonb; v_owned numeric; v_bal numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT * INTO e FROM public.pack_edition_table() x WHERE x.set_id = p_set_id;
  IF NOT FOUND OR NOT e.active THEN RAISE EXCEPTION 'This pack is not on sale'; END IF;
  -- One purchase per edition at a time: the sold count is derived from the purchase ledger.
  PERFORM pg_advisory_xact_lock(hashtext('pack_supply:' || p_set_id));
  -- Replayed request: return the current state, never add packs twice.
  IF EXISTS (SELECT 1 FROM public.currency_ledger WHERE idempotency_key = p_idempotency_key) THEN
    SELECT coalesce((SELECT balance FROM public.player_items WHERE player_id = p_player_id AND item_type = 'pack' AND item_id = p_set_id), 0) INTO v_owned;
    SELECT coalesce((SELECT balance FROM public.player_items WHERE player_id = p_player_id AND item_type = 'currency' AND item_id = 'credits'), 0) INTO v_bal;
    RETURN jsonb_build_object('owned', v_owned::bigint, 'balanceAfter', v_bal::text, 'duplicate', true);
  END IF;
  SELECT coalesce(sum((l.metadata ->> 'quantity')::bigint), 0) INTO v_sold FROM public.currency_ledger l
   WHERE l.entry_type = 'pack_purchase' AND l.reference_id = p_set_id;
  IF v_sold + p_quantity > e.public_allocation THEN RAISE EXCEPTION 'Sold out'; END IF;

  v_debit := public.record_ledger_entry(p_player_id, 'credits', -(e.price_credits * p_quantity), 'pack_purchase', p_idempotency_key,
    'pack_supply', p_set_id, jsonb_build_object('pack', p_set_id, 'quantity', p_quantity, 'priceCredits', e.price_credits));
  INSERT INTO public.player_items (player_id, item_type, item_id, balance) VALUES (p_player_id, 'pack', p_set_id, p_quantity)
  ON CONFLICT (player_id, item_type, item_id) DO UPDATE SET balance = public.player_items.balance + excluded.balance
  RETURNING balance INTO v_owned;
  RETURN jsonb_build_object('owned', v_owned::bigint, 'balanceAfter', v_debit ->> 'balanceAfter', 'duplicate', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_reward_day(p_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  b record; v_days integer; v_prev jsonb; v_roll_m numeric := 0; v_roll_a numeric := 0;
  v_pool_m numeric; v_pool_a numeric; v_tm numeric; v_ta numeric; r record;
  v_mc numeric; v_ac numeric; v_paid_m numeric := 0; v_paid_a numeric := 0; v_players integer := 0;
BEGIN
  IF p_day IS NULL OR p_day >= (now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'Day is not finished yet'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('settle_reward_day'));
  IF EXISTS (SELECT 1 FROM public.treasury_ledger WHERE entry_type = 'reward_day' AND reference_id = p_day::text) THEN
    RETURN jsonb_build_object('day', p_day, 'status', 'already_settled');
  END IF;
  SELECT * INTO b FROM public.published_budget(p_day);
  IF NOT FOUND THEN RETURN jsonb_build_object('day', p_day, 'status', 'unfunded'); END IF;

  v_days := extract(day FROM (date_trunc('month', p_day) + interval '1 month - 1 day'))::integer;
  SELECT details INTO v_prev FROM public.treasury_ledger WHERE entry_type = 'reward_day' AND reference_id = (p_day - 1)::text;
  v_roll_m := coalesce((v_prev ->> 'rolloverOutMatch')::numeric, 0);
  v_roll_a := coalesce((v_prev ->> 'rolloverOutActivity')::numeric, 0);
  v_pool_m := trunc(b.match_pool / v_days, 8) + v_roll_m;
  v_pool_a := trunc(b.activity_pool / v_days, 8) + v_roll_a;
  SELECT coalesce(sum(x.match_shares), 0), coalesce(sum(x.activity_shares), 0) INTO v_tm, v_ta FROM public.reward_day_players(p_day) x;

  FOR r IN SELECT * FROM public.reward_day_players(p_day) x WHERE x.match_shares > 0 OR x.activity_shares > 0 ORDER BY x.player_id LOOP
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
  END LOOP;

  IF v_paid_m > 0 THEN INSERT INTO public.treasury_ledger (entry_type, category, account, amount, reference_type, reference_id) VALUES ('flow', 'reward_payout', 'reward_vault', -v_paid_m, 'reward_day', 'match:' || p_day); END IF;
  IF v_paid_a > 0 THEN INSERT INTO public.treasury_ledger (entry_type, category, account, amount, reference_type, reference_id) VALUES ('flow', 'reward_payout', 'reward_vault', -v_paid_a, 'reward_day', 'daily:' || p_day); END IF;

  INSERT INTO public.treasury_ledger (entry_type, category, amount, reference_type, reference_id, details)
  VALUES ('reward_day', 'settlement', v_paid_m + v_paid_a, 'reward_day', p_day::text, jsonb_build_object(
    'budgetMonth', b.month, 'matchPool', v_pool_m::text, 'activityPool', v_pool_a::text,
    'rolloverInMatch', v_roll_m::text, 'rolloverInActivity', v_roll_a::text,
    'totalMatchShares', v_tm::text, 'totalActivityShares', v_ta::text, 'paidMatch', v_paid_m::text, 'paidActivity', v_paid_a::text,
    'rolloverOutMatch', (v_pool_m - v_paid_m)::text, 'rolloverOutActivity', (v_pool_a - v_paid_a)::text, 'playersPaid', v_players));
  RETURN jsonb_build_object('day', p_day, 'status', 'settled', 'paidMatch', v_paid_m::text, 'paidActivity', v_paid_a::text, 'players', v_players);
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_due_reward_days()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_today date := (now() AT TIME ZONE 'UTC')::date; v_start date; v_day date; n integer := 0; res jsonb;
BEGIN
  v_start := least(
    coalesce((SELECT max(reference_id::date) + 1 FROM public.treasury_ledger WHERE entry_type = 'reward_day'), v_today),
    coalesce((SELECT min(x.d) FROM (
        SELECT (m.p1_reward ->> 'rewardDay')::date AS d FROM public.matches m
         WHERE m.p1_reward ->> 'status' = 'earned' AND m.completed_at > now() - interval '401 days'
        UNION
        SELECT (m.p2_reward ->> 'rewardDay')::date FROM public.matches m
         WHERE m.p2_reward ->> 'status' = 'earned' AND m.completed_at > now() - interval '401 days') x
       WHERE NOT EXISTS (SELECT 1 FROM public.treasury_ledger l WHERE l.entry_type = 'reward_day' AND l.reference_id = x.d::text)), v_today),
    coalesce((SELECT min(reference_id::date) FROM public.treasury_ledger WHERE entry_type = 'budget'
               AND reference_id::date > coalesce((SELECT max((details ->> 'budgetMonth')::date) FROM public.treasury_ledger WHERE entry_type = 'reward_day'), '-infinity'::date)), v_today));
  v_start := greatest(v_start, v_today - 400);
  v_day := v_start;
  WHILE v_day < v_today LOOP
    res := public.settle_reward_day(v_day);
    IF res->>'status' = 'settled' THEN n := n + 1; END IF;
    v_day := v_day + 1;
  END LOOP;
  RETURN n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_rewards_today()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_today date := (now() AT TIME ZONE 'UTC')::date; v_e_energy integer; v_e_anchor timestamptz;
  v_ticks integer; v_energy integer := 24; v_next timestamptz;
  v_wins integer; v_ms numeric; v_banners integer; v_rules integer; v_low boolean; v_points integer; v_as numeric; v_mult numeric;
  b record; v_prev jsonb; v_days integer; v_pool_m numeric := 0; v_pool_a numeric := 0;
  v_tm numeric; v_ta numeric; v_est_m numeric := 0; v_est_a numeric := 0; v_funded boolean; v_last jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT reward_energy, reward_energy_anchor_at INTO v_e_energy, v_e_anchor FROM public.profiles WHERE id = v_uid;
  IF FOUND THEN
    v_ticks := greatest(0, floor(extract(epoch FROM (now() - v_e_anchor)) / 3600))::integer;
    v_energy := least(24, v_e_energy + v_ticks);
    IF v_energy < 24 THEN v_next := v_e_anchor + make_interval(hours => v_ticks + 1); END IF;
  END IF;

  SELECT x.eligible_wins, x.match_shares, cardinality(x.banners), cardinality(x.rulesets), x.low_mana_win, x.activity_points, x.activity_shares, x.daily_multiplier
    INTO v_wins, v_ms, v_banners, v_rules, v_low, v_points, v_as, v_mult
    FROM public.reward_day_players(v_today) x WHERE x.player_id = v_uid;
  SELECT coalesce(sum(x.match_shares), 0), coalesce(sum(x.activity_shares), 0) INTO v_tm, v_ta FROM public.reward_day_players(v_today) x;
  SELECT * INTO b FROM public.published_budget(v_today);
  v_funded := FOUND;
  IF v_funded THEN
    v_days := extract(day FROM (date_trunc('month', v_today) + interval '1 month - 1 day'))::integer;
    SELECT details INTO v_prev FROM public.treasury_ledger WHERE entry_type = 'reward_day' AND reference_id = (v_today - 1)::text;
    v_pool_m := trunc(b.match_pool / v_days, 8) + coalesce((v_prev ->> 'rolloverOutMatch')::numeric, 0);
    v_pool_a := trunc(b.activity_pool / v_days, 8) + coalesce((v_prev ->> 'rolloverOutActivity')::numeric, 0);
    IF v_tm > 0 AND coalesce(v_ms, 0) > 0 THEN v_est_m := trunc(least(v_pool_m * v_ms / v_tm, v_pool_m * 0.005), 8); END IF;
    IF v_ta > 0 AND coalesce(v_as, 0) > 0 THEN v_est_a := trunc(least(v_pool_a * v_as / v_ta, v_pool_a * 0.0025), 8); END IF;
  END IF;
  SELECT jsonb_build_object('day', x.day, 'matchCoins', x.mc::text, 'activityCoins', x.ac::text) INTO v_last
    FROM (SELECT l.reference_id AS day,
                 coalesce(sum(l.amount) FILTER (WHERE l.entry_type = 'match_reward'), 0) AS mc,
                 coalesce(sum(l.amount) FILTER (WHERE l.entry_type = 'daily_reward'), 0) AS ac
            FROM public.currency_ledger l
           WHERE l.player_id = v_uid AND l.entry_type IN ('match_reward', 'daily_reward') AND l.reference_type = 'reward_day'
           GROUP BY l.reference_id ORDER BY l.reference_id DESC LIMIT 1) x;

  RETURN jsonb_build_object(
    'day', v_today, 'energy', v_energy, 'maxEnergy', 24, 'nextEnergyAt', v_next,
    'eligibleWins', coalesce(v_wins, 0), 'matchShares', coalesce(v_ms, 0)::text,
    'bannersUsed', coalesce(v_banners, 0), 'rulesetsWon', coalesce(v_rules, 0),
    'lowManaWin', coalesce(v_low, false), 'activityPoints', coalesce(v_points, 0),
    'activityShares', coalesce(v_as, 0)::text, 'dailyMultiplier', coalesce(v_mult, 0)::text,
    'funded', v_funded, 'matchPool', v_pool_m::text, 'activityPool', v_pool_a::text,
    'totalMatchShares', v_tm::text, 'totalActivityShares', v_ta::text,
    'estimatedMatchCoins', v_est_m::text, 'estimatedActivityCoins', v_est_a::text, 'lastPayout', v_last);
END;
$function$;

CREATE OR REPLACE FUNCTION public.publish_reward_budget(p_month date, p_opening_reward_vault numeric, p_prior_month_acquired numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_month date := date_trunc('month', p_month)::date; v_budget numeric;
BEGIN
  IF p_opening_reward_vault IS NULL OR p_opening_reward_vault < 0 OR coalesce(p_prior_month_acquired, 0) < 0 THEN RAISE EXCEPTION 'Invalid amounts'; END IF;
  IF EXISTS (SELECT 1 FROM public.treasury_ledger WHERE entry_type = 'reward_day' AND details ->> 'budgetMonth' = v_month::text) THEN
    RAISE EXCEPTION 'Month already has settled days';
  END IF;
  v_budget := trunc(least(50000000, p_opening_reward_vault / 12 + 0.8 * coalesce(p_prior_month_acquired, 0)), 8);
  INSERT INTO public.treasury_ledger (entry_type, category, amount, reference_type, reference_id, details, occurred_at)
  VALUES ('budget', 'published', v_budget, 'reward_budget', v_month::text, jsonb_build_object(
      'openingRewardVault', p_opening_reward_vault::text, 'priorMonthAcquired', coalesce(p_prior_month_acquired, 0)::text,
      'matchPool', trunc(v_budget * 0.625, 8)::text, 'activityPool', trunc(v_budget * 0.1875, 8)::text,
      'leaguePool', trunc(v_budget * 0.125, 8)::text, 'leaderboardPool', trunc(v_budget * 0.0625, 8)::text), now())
  ON CONFLICT (reference_id) WHERE entry_type = 'budget'
  DO UPDATE SET amount = excluded.amount, details = excluded.details, occurred_at = now();
  RETURN jsonb_build_object('month', v_month, 'budget', v_budget::text);
END;
$function$;
CREATE OR REPLACE FUNCTION public.calculate_reward_budget(p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_month date := date_trunc('month', p_month)::date; v_prev date; v_vault numeric; v_snap timestamptz; v_acq numeric; v_fees numeric; v_budget numeric;
BEGIN
  v_prev := (v_month - interval '1 month')::date;
  SELECT coalesce(sum(s.coin_balance), 0), max(s.captured_at) INTO v_vault, v_snap
    FROM public.treasury_wallets w
    CROSS JOIN LATERAL (SELECT t.amount AS coin_balance, t.occurred_at AS captured_at FROM public.treasury_ledger t
                         WHERE t.entry_type = 'snapshot' AND t.wallet_id = w.id AND t.occurred_at < (v_month + interval '1 month')
                         ORDER BY t.occurred_at DESC LIMIT 1) s
   WHERE w.wallet_type = 'reward_vault' AND w.active;
  SELECT coalesce(sum(a.amount), 0) INTO v_acq FROM public.treasury_ledger a
    JOIN public.treasury_wallets w ON w.id = a.wallet_id AND w.wallet_type = 'reward_vault'
   WHERE a.entry_type = 'acquisition' AND a.occurred_at >= v_prev AND a.occurred_at < v_month;
  SELECT coalesce(sum(amount), 0) INTO v_fees FROM public.treasury_ledger
   WHERE entry_type = 'flow' AND account = 'reward_vault' AND amount > 0 AND occurred_at >= v_prev AND occurred_at < v_month;
  v_budget := trunc(least(50000000, v_vault / 12 + 0.8 * (v_acq + v_fees)), 8);
  RETURN jsonb_build_object('month', v_month, 'openingRewardVault', v_vault::text, 'snapshotAt', v_snap,
    'priorMonthAcquired', (v_acq + v_fees)::text, 'acquisitionsOnChain', v_acq::text, 'feeReturns', v_fees::text,
    'budget', v_budget::text, 'matchPool', trunc(v_budget * 0.625, 8)::text, 'activityPool', trunc(v_budget * 0.1875, 8)::text,
    'leaguePool', trunc(v_budget * 0.125, 8)::text, 'leaderboardPool', trunc(v_budget * 0.0625, 8)::text,
    'published', EXISTS (SELECT 1 FROM public.published_budget(v_month)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_ranked_season(p_key text, p_pool_share numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.ranked_seasons%rowtype; v_month date; v_league numeric; v_days integer; v_pool numeric := 0;
  v_total numeric; v_paid numeric := 0; v_amt numeric; pl record; v_next integer; v_start timestamptz;
BEGIN
  SELECT * INTO s FROM public.ranked_seasons WHERE key = p_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF s.status = 'closed' THEN RETURN jsonb_build_object('season', p_key, 'duplicate', true); END IF;
  IF s.ends_at > now() THEN RAISE EXCEPTION 'Season has not ended'; END IF;
  IF p_pool_share IS NULL OR p_pool_share < 0 OR p_pool_share > 1 THEN RAISE EXCEPTION 'Invalid pool share'; END IF;
  IF EXISTS (SELECT 1 FROM public.item_openings WHERE item_type = 'chest' AND season_key = p_key AND status = 'unopened') THEN
    RAISE EXCEPTION 'Unopened chests remain';
  END IF;
  IF EXISTS (SELECT 1 FROM public.matches WHERE season_key = p_key AND status IN ('team_selection','resolving')) THEN
    RAISE EXCEPTION 'Season has unfinished matches';
  END IF;

  v_month := date_trunc('month', s.ends_at AT TIME ZONE 'UTC')::date;
  SELECT b.league_pool INTO v_league FROM public.published_budget(v_month) b;
  v_days := extract(day FROM (v_month + interval '1 month' - interval '1 day'))::integer;
  v_pool := trunc(coalesce(v_league, 0) * p_pool_share * 14 / v_days, 8);
  SELECT coalesce(sum(coin_shares), 0) INTO v_total FROM public.item_openings WHERE item_type = 'chest' AND season_key = p_key;

  IF v_pool > 0 AND v_total > 0 THEN
    FOR pl IN SELECT player_id, sum(coin_shares) AS sh FROM public.item_openings WHERE item_type = 'chest' AND season_key = p_key
              GROUP BY player_id HAVING sum(coin_shares) > 0 ORDER BY player_id LOOP
      v_amt := trunc(v_pool * pl.sh / v_total, 8);
      IF v_amt > 0 THEN
        PERFORM public.record_ledger_entry(pl.player_id, 'coins', v_amt, 'chest_reward', 'reward:chest:' || p_key || ':' || pl.player_id,
          'ranked_season', p_key, jsonb_build_object('shares', pl.sh::text));
        v_paid := v_paid + v_amt;
      END IF;
    END LOOP;
    IF v_paid > 0 THEN
      INSERT INTO public.treasury_ledger (entry_type, category, account, amount, reference_type, reference_id)
        VALUES ('flow', 'reward_payout', 'reward_vault', -v_paid, 'ranked_season', 'chests:' || p_key);
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
           coalesce((SELECT d.reset_rating FROM public.ranked_division_table() d WHERE d.min_rating <= r.rating ORDER BY d.min_rating DESC LIMIT 1), 1000)
      FROM public.player_ratings r WHERE r.season_key = p_key
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('season', p_key, 'nextSeason', 'season-' || v_next, 'pool', v_pool::text, 'shares', v_total::text, 'paid', v_paid::text, 'duplicate', false);
END $function$;

CREATE OR REPLACE FUNCTION public.treasury_month_report(p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_month date := date_trunc('month', coalesce(p_month, (now() AT TIME ZONE 'UTC')::date))::date; v_end date; v_next date;
  v_wallets jsonb; v_acqs jsonb; v_budget jsonb; v_flows jsonb; v_rewards jsonb; v_open numeric; v_close numeric; v_market jsonb;
BEGIN
  v_end := (v_month + interval '1 month')::date; v_next := v_end;
  SELECT coalesce(jsonb_agg(jsonb_build_object('label', w.label, 'address', w.address, 'type', w.wallet_type,
      'balance', s.coin_balance::text, 'capturedAt', s.captured_at, 'source', s.source) ORDER BY w.wallet_type, w.label), '[]'::jsonb)
    INTO v_wallets FROM public.treasury_wallets w
    LEFT JOIN LATERAL (SELECT t.amount AS coin_balance, t.occurred_at AS captured_at, t.category AS source FROM public.treasury_ledger t WHERE t.entry_type = 'snapshot' AND t.wallet_id = w.id AND t.occurred_at < v_end ORDER BY t.occurred_at DESC LIMIT 1) s ON true
   WHERE w.public AND w.active;
  SELECT coalesce(sum(s.coin_balance), 0) INTO v_open FROM public.treasury_wallets w
    CROSS JOIN LATERAL (SELECT t.amount AS coin_balance FROM public.treasury_ledger t WHERE t.entry_type = 'snapshot' AND t.wallet_id = w.id AND t.occurred_at < v_month ORDER BY t.occurred_at DESC LIMIT 1) s
   WHERE w.wallet_type = 'reward_vault' AND w.active;
  SELECT coalesce(sum(s.coin_balance), 0) INTO v_close FROM public.treasury_wallets w
    CROSS JOIN LATERAL (SELECT t.amount AS coin_balance FROM public.treasury_ledger t WHERE t.entry_type = 'snapshot' AND t.wallet_id = w.id AND t.occurred_at < v_end ORDER BY t.occurred_at DESC LIMIT 1) s
   WHERE w.wallet_type = 'reward_vault' AND w.active;
  SELECT coalesce(jsonb_agg(jsonb_build_object('source', a.category, 'coins', a.amount::text, 'quoteSpent', a.details ->> 'quoteSpent',
      'quoteAsset', a.details ->> 'quoteAsset', 'averagePriceUsd', a.details ->> 'averagePriceUsd', 'txHash', a.tx_hash, 'wallet', w.label, 'at', a.occurred_at) ORDER BY a.occurred_at DESC), '[]'::jsonb)
    INTO v_acqs FROM public.treasury_ledger a JOIN public.treasury_wallets w ON w.id = a.wallet_id
   WHERE a.entry_type = 'acquisition' AND a.occurred_at >= v_month AND a.occurred_at < v_end;
  SELECT jsonb_build_object('month', b.month, 'opening_reward_vault', b.opening_reward_vault::text, 'prior_month_acquired', b.prior_month_acquired::text,
      'calculated_budget', b.calculated_budget::text, 'match_pool', b.match_pool::text, 'activity_pool', b.activity_pool::text,
      'league_pool', b.league_pool::text, 'leaderboard_pool', b.leaderboard_pool::text, 'published_at', b.published_at)
    INTO v_budget FROM public.published_budget(v_month) b;
  SELECT jsonb_build_object(
      'marketToVault', coalesce(sum(amount) FILTER (WHERE category = 'market_fee' AND account = 'reward_vault'), 0)::text,
      'marketBurned', coalesce(sum(amount) FILTER (WHERE category = 'market_fee' AND account = 'burn'), 0)::text,
      'marketOperations', coalesce(sum(amount) FILTER (WHERE category = 'market_fee' AND account = 'operations'), 0)::text,
      'rentalToVault', coalesce(sum(amount) FILTER (WHERE category = 'rental_fee' AND account = 'reward_vault'), 0)::text,
      'rentalBurned', coalesce(sum(amount) FILTER (WHERE category = 'rental_fee' AND account = 'burn'), 0)::text,
      'rentalOperations', coalesce(sum(amount) FILTER (WHERE category = 'rental_fee' AND account = 'operations'), 0)::text,
      'burned', coalesce(sum(amount) FILTER (WHERE account = 'burn'), 0)::text,
      'distributed', coalesce(-sum(amount) FILTER (WHERE category = 'reward_payout'), 0)::text)
    INTO v_flows FROM public.treasury_ledger WHERE entry_type = 'flow' AND occurred_at >= v_month AND occurred_at < v_end;
  SELECT jsonb_build_object('days', count(*), 'paidMatch', coalesce(sum((details ->> 'paidMatch')::numeric), 0)::text,
      'paidActivity', coalesce(sum((details ->> 'paidActivity')::numeric), 0)::text,
      'rolloverOutMatch', (SELECT d.details ->> 'rolloverOutMatch' FROM public.treasury_ledger d
                            WHERE d.entry_type = 'reward_day' AND d.details ->> 'budgetMonth' = v_month::text ORDER BY d.reference_id DESC LIMIT 1))
    INTO v_rewards FROM public.treasury_ledger WHERE entry_type = 'reward_day' AND details ->> 'budgetMonth' = v_month::text;
  SELECT jsonb_build_object('sales', count(*), 'volume', coalesce(sum(price_coins), 0)::text) INTO v_market
    FROM public.card_listings WHERE listing_type = 'sale' AND status = 'sold' AND completed_at >= v_month AND completed_at < v_end;
  RETURN jsonb_build_object('month', v_month, 'wallets', v_wallets, 'openingRewardVault', v_open::text, 'closingRewardVault', v_close::text,
    'acquisitions', v_acqs, 'budget', v_budget, 'flows', v_flows, 'rewards', v_rewards, 'market', v_market,
    'rentals', (SELECT jsonb_build_object('contracts', count(*), 'volume', coalesce(sum(gross_coins), 0)::text) FROM public.rental_contracts WHERE starts_at >= v_month AND starts_at < v_end),
    'nextMonth', public.calculate_reward_budget(v_next),
    'months', (SELECT coalesce(jsonb_agg(m ORDER BY m DESC), '[]'::jsonb) FROM (SELECT reference_id::date AS m FROM public.treasury_ledger WHERE entry_type = 'budget') x));
END;
$function$;

CREATE OR REPLACE FUNCTION public.reveal_pack_opening(p_player_id uuid, p_opening_id uuid, p_client_seed text, p_results jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o public.item_openings%rowtype; v_seed text; r jsonb; v_asset uuid; v_out jsonb := '[]'::jsonb; v_card text;
BEGIN
  SELECT * INTO o FROM public.item_openings WHERE id = p_opening_id AND player_id = p_player_id AND item_type = 'pack' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening not found'; END IF;
  IF o.status = 'revealed' THEN
    RETURN jsonb_build_object('results', o.results, 'serverSeed', o.server_seed, 'clientSeed', o.client_seed, 'duplicate', true);
  END IF;
  SELECT server_seed INTO v_seed FROM public.game_secrets
   WHERE action_type = 'pack_opening' AND target_id = o.id AND status = 'committed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening not found'; END IF;
  IF jsonb_typeof(p_results) <> 'array' OR jsonb_array_length(p_results) <> 5 THEN  -- every pack holds exactly 5 cards
    RAISE EXCEPTION 'Invalid results';
  END IF;

  UPDATE public.player_items SET balance = balance - 1
   WHERE player_id = p_player_id AND item_type = 'pack' AND item_id = o.item_id AND balance >= 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No unopened pack'; END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_card := r ->> 'cardId';
    INSERT INTO public.player_cards (player_id, card_id, foil, opening_id, slot)
      VALUES (p_player_id, v_card, coalesce(r ->> 'foil', 'regular'), o.id, (r ->> 'slot')::smallint)
      RETURNING id INTO v_asset;
    UPDATE public.cards SET total_printed = total_printed + 1 WHERE id = v_card;
    v_out := v_out || jsonb_build_array(jsonb_build_object('assetId', v_asset, 'cardId', v_card, 'foil', coalesce(r ->> 'foil', 'regular'),
      'rarity', r ->> 'rarity', 'slot', (r ->> 'slot')::int));
  END LOOP;

  UPDATE public.item_openings SET status = 'revealed', server_seed = v_seed, client_seed = p_client_seed, results = v_out, opened_at = now()
    WHERE id = o.id;
  UPDATE public.game_secrets SET status = 'revealed', client_seed = p_client_seed, revealed_at = now()
    WHERE action_type = 'pack_opening' AND target_id = o.id;
  RETURN jsonb_build_object('results', v_out, 'serverSeed', v_seed, 'clientSeed', p_client_seed, 'duplicate', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.open_division_chest(p_player_id uuid, p_chest_id uuid, p_client_seed text, p_results jsonb, p_reserve jsonb, p_auto boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c public.item_openings%rowtype; v_seed text; r jsonb; v_rar text; v_left integer; v_asset uuid; v_card text;
  v_out jsonb := '[]'::jsonb; v_shares numeric := 0; v_credits bigint := 0; v_amt numeric;
BEGIN
  SELECT * INTO c FROM public.item_openings WHERE id = p_chest_id AND player_id = p_player_id AND item_type = 'chest' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chest not found'; END IF;
  IF c.status <> 'unopened' THEN
    RETURN jsonb_build_object('results', c.results, 'serverSeed', c.server_seed, 'clientSeed', c.client_seed, 'reserve', c.reserve_snapshot, 'duplicate', true);
  END IF;
  SELECT server_seed INTO v_seed FROM public.game_secrets
   WHERE action_type = 'division_chest' AND target_id = c.id AND status = 'committed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chest not found'; END IF;
  IF jsonb_typeof(p_results) <> 'array' OR jsonb_array_length(p_results) < 1 OR jsonb_array_length(p_results) > 3 THEN
    RAISE EXCEPTION 'Invalid results';
  END IF;

  -- The roll used the reserve capped at 3 per rarity; it must still be the same.
  PERFORM pg_advisory_xact_lock(hashtext('legionnaire_reward_reserve'));
  FOR v_rar, v_left IN SELECT x.rarity, least(x.remaining_units, 3) FROM public.reward_reserve_remaining() x ORDER BY x.rarity LOOP
    IF coalesce((p_reserve ->> v_rar)::integer, -1) <> v_left THEN RAISE EXCEPTION 'Reward reserve changed'; END IF;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    IF r ->> 'type' = 'card' THEN
      v_rar := r ->> 'rarity'; v_card := r ->> 'cardId';
      IF coalesce(r ->> 'foil', '') NOT IN ('regular','gold') THEN RAISE EXCEPTION 'Invalid results'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.cards WHERE id = v_card AND rarity = v_rar) THEN RAISE EXCEPTION 'Invalid results'; END IF;
      -- Remaining units = reserve size minus cards already minted from chests (counted live, under the lock above).
      IF coalesce((SELECT x.remaining_units FROM public.reward_reserve_remaining() x WHERE x.rarity = v_rar), 0) <= 0 THEN
        RAISE EXCEPTION 'Reward reserve changed';
      END IF;
      INSERT INTO public.player_cards (player_id, card_id, foil, opening_id, slot)
        VALUES (p_player_id, v_card, r ->> 'foil', c.id, (r ->> 'roll')::smallint) RETURNING id INTO v_asset;
      UPDATE public.cards SET total_printed = total_printed + 1 WHERE id = v_card;
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

  UPDATE public.item_openings SET status = CASE WHEN p_auto THEN 'auto_opened' ELSE 'opened' END,
      server_seed = v_seed, client_seed = p_client_seed, reserve_snapshot = p_reserve, results = v_out,
      coin_shares = v_shares, credits = v_credits, opened_at = now()
    WHERE id = c.id;
  UPDATE public.game_secrets SET status = 'revealed', client_seed = p_client_seed, revealed_at = now()
    WHERE action_type = 'division_chest' AND target_id = c.id;
  UPDATE public.player_items SET balance = balance - 1
   WHERE player_id = p_player_id AND item_type = 'chest' AND item_id = c.item_id AND balance >= 1;
  UPDATE public.ranked_seasons SET chest_coin_shares = chest_coin_shares + v_shares WHERE key = c.season_key;
  RETURN jsonb_build_object('results', v_out, 'serverSeed', v_seed, 'clientSeed', p_client_seed, 'reserve', p_reserve, 'duplicate', false);
END $function$;

COMMENT ON TABLE public.match_players IS 'DEPRECATED: replaced by matches.player1_id/player2_id and p1_/p2_ rating and result columns';
COMMENT ON TABLE public.match_submissions IS 'DEPRECATED: replaced by matches.p1_team/p2_team';
COMMENT ON TABLE public.match_rewards IS 'DEPRECATED: replaced by matches.p1_reward/p2_reward';
COMMENT ON TABLE public.player_reward_days IS 'DEPRECATED: derived by reward_day_players() from matches';
COMMENT ON TABLE public.reward_days IS 'DEPRECATED: replaced by treasury_ledger (entry_type reward_day)';
COMMENT ON TABLE public.monthly_reward_budgets IS 'DEPRECATED: replaced by treasury_ledger (entry_type budget)';
COMMENT ON TABLE public.pack_supply IS 'DEPRECATED: replaced by pack_edition_table() + pack_supply_summary()';
COMMENT ON TABLE public.legionnaire_reward_reserve IS 'DEPRECATED: replaced by reward_reserve_table() + reward_reserve_remaining()';
COMMENT ON TABLE public.game_versions IS 'DEPRECATED: replaced by game_version_table()';