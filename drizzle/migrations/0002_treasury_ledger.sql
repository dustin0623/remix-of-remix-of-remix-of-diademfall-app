CREATE TABLE public.treasury_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL CHECK (entry_type IN ('flow', 'snapshot', 'acquisition')),
  category text NOT NULL,
  wallet_id uuid REFERENCES public.treasury_wallets(id),
  account text CHECK (account IS NULL OR account IN ('reward_vault', 'burn', 'operations')),
  amount numeric(30, 8) NOT NULL,
  reference_type text,
  reference_id text,
  tx_hash text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treasury_ledger_flow_shape CHECK (entry_type <> 'flow' OR (
    account IS NOT NULL AND wallet_id IS NULL AND reference_id IS NOT NULL AND amount <> 0
    AND category IN ('market_fee', 'rental_fee', 'reward_payout', 'adjustment'))),
  CONSTRAINT treasury_ledger_snapshot_shape CHECK (entry_type <> 'snapshot' OR (
    wallet_id IS NOT NULL AND account IS NULL AND amount >= 0 AND category IN ('manual', 'chain'))),
  CONSTRAINT treasury_ledger_acquisition_shape CHECK (entry_type <> 'acquisition' OR (
    wallet_id IS NOT NULL AND account IS NULL AND amount > 0
    AND category IN ('launch_purchase', 'pack_revenue_buyback', 'creator_fee_buyback', 'coin_credit_recycle', 'other')
    AND (details ->> 'quoteAsset' IS NULL OR details ->> 'quoteAsset' IN ('SOL', 'USDC', 'USD'))))
);
COMMENT ON TABLE public.treasury_ledger IS 'Every treasury event: fee/payout flows (entry_type flow, category = flow type), wallet balance snapshots (category manual|chain, amount = balance) and Coin acquisitions (category = source, amount = coins, quote fields in details).';
CREATE UNIQUE INDEX treasury_ledger_flow_key ON public.treasury_ledger (category, account, reference_id) WHERE entry_type = 'flow';
CREATE UNIQUE INDEX treasury_ledger_snapshot_key ON public.treasury_ledger (wallet_id, occurred_at) WHERE entry_type = 'snapshot';
CREATE UNIQUE INDEX treasury_ledger_acquisition_tx_key ON public.treasury_ledger (tx_hash) WHERE entry_type = 'acquisition' AND tx_hash IS NOT NULL;
CREATE INDEX treasury_ledger_type_time_idx ON public.treasury_ledger (entry_type, occurred_at DESC);
CREATE INDEX treasury_ledger_wallet_idx ON public.treasury_ledger (wallet_id, entry_type, occurred_at DESC) WHERE wallet_id IS NOT NULL;

GRANT SELECT ON public.treasury_ledger TO anon, authenticated;
GRANT ALL ON public.treasury_ledger TO service_role;
ALTER TABLE public.treasury_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_ledger_public_read ON public.treasury_ledger FOR SELECT TO anon, authenticated
  USING (entry_type <> 'snapshot' OR EXISTS (SELECT 1 FROM public.treasury_wallets w WHERE w.id = treasury_ledger.wallet_id AND w.public AND w.active));

INSERT INTO public.treasury_ledger (entry_type, category, account, amount, reference_type, reference_id, occurred_at, created_at)
  SELECT 'flow', flow_type, account, amount, reference_type, reference_id, created_at, created_at FROM public.treasury_flows;
INSERT INTO public.treasury_ledger (entry_type, category, wallet_id, amount, created_by, occurred_at)
  SELECT 'snapshot', source, wallet_id, coin_balance, created_by, captured_at FROM public.treasury_snapshots;
INSERT INTO public.treasury_ledger (entry_type, category, wallet_id, amount, tx_hash, details, created_by, occurred_at)
  SELECT 'acquisition', source, destination_wallet_id, coins_acquired, tx_hash,
    metadata || jsonb_strip_nulls(jsonb_build_object('quoteSpent', quote_spent::text, 'quoteAsset', quote_asset, 'averagePriceUsd', average_price_usd::text)),
    created_by, acquired_at FROM public.token_acquisitions;

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
    'published', EXISTS (SELECT 1 FROM public.monthly_reward_budgets WHERE month = v_month AND status = 'published'));
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
  SELECT league_pool INTO v_league FROM public.monthly_reward_budgets WHERE month = v_month AND status = 'published';
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

CREATE OR REPLACE FUNCTION public.record_trading_fee(p_flow_type text, p_reference_id text, p_gross numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM public.split_trading_fee(p_gross);
  IF f.vault > 0 THEN INSERT INTO public.treasury_ledger (entry_type, category, account, amount, reference_type, reference_id) VALUES ('flow', p_flow_type, 'reward_vault', f.vault, p_flow_type, p_reference_id); END IF;
  IF f.burn > 0 THEN INSERT INTO public.treasury_ledger (entry_type, category, account, amount, reference_type, reference_id) VALUES ('flow', p_flow_type, 'burn', f.burn, p_flow_type, p_reference_id); END IF;
  IF f.ops > 0 THEN INSERT INTO public.treasury_ledger (entry_type, category, account, amount, reference_type, reference_id) VALUES ('flow', p_flow_type, 'operations', f.ops, p_flow_type, p_reference_id); END IF;
  RETURN f.fee;
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_reward_day(p_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  IF v_paid_m > 0 THEN INSERT INTO public.treasury_ledger (entry_type, category, account, amount, reference_type, reference_id) VALUES ('flow', 'reward_payout', 'reward_vault', -v_paid_m, 'reward_day', 'match:' || p_day); END IF;
  IF v_paid_a > 0 THEN INSERT INTO public.treasury_ledger (entry_type, category, account, amount, reference_type, reference_id) VALUES ('flow', 'reward_payout', 'reward_vault', -v_paid_a, 'reward_day', 'daily:' || p_day); END IF;

  INSERT INTO public.reward_days (reward_day, budget_month, match_pool, activity_pool, rollover_in_match, rollover_in_activity,
    total_match_shares, total_activity_shares, paid_match, paid_activity, rollover_out_match, rollover_out_activity, players_paid)
  VALUES (p_day, b.month, v_pool_m, v_pool_a, v_roll_m, v_roll_a, v_tm, v_ta, v_paid_m, v_paid_a, v_pool_m - v_paid_m, v_pool_a - v_paid_a, v_players);
  RETURN jsonb_build_object('day', p_day, 'status', 'settled', 'paidMatch', v_paid_m::text, 'paidActivity', v_paid_a::text, 'players', v_players);
END;
$function$;

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
  SELECT to_jsonb(b) INTO v_budget FROM (SELECT month, opening_reward_vault::text, prior_month_acquired::text, calculated_budget::text,
      match_pool::text, activity_pool::text, league_pool::text, leaderboard_pool::text, published_at
    FROM public.monthly_reward_budgets WHERE month = v_month AND status = 'published') b;
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
  SELECT jsonb_build_object('days', count(*), 'paidMatch', coalesce(sum(paid_match), 0)::text, 'paidActivity', coalesce(sum(paid_activity), 0)::text,
      'rolloverOutMatch', (SELECT rollover_out_match::text FROM public.reward_days WHERE budget_month = v_month ORDER BY reward_day DESC LIMIT 1))
    INTO v_rewards FROM public.reward_days WHERE budget_month = v_month;
  SELECT jsonb_build_object('sales', count(*), 'volume', coalesce(sum(price_coins), 0)::text) INTO v_market
    FROM public.card_listings WHERE listing_type = 'sale' AND status = 'sold' AND completed_at >= v_month AND completed_at < v_end;
  RETURN jsonb_build_object('month', v_month, 'wallets', v_wallets, 'openingRewardVault', v_open::text, 'closingRewardVault', v_close::text,
    'acquisitions', v_acqs, 'budget', v_budget, 'flows', v_flows, 'rewards', v_rewards, 'market', v_market,
    'rentals', (SELECT jsonb_build_object('contracts', count(*), 'volume', coalesce(sum(gross_coins), 0)::text) FROM public.rental_contracts WHERE starts_at >= v_month AND starts_at < v_end),
    'nextMonth', public.calculate_reward_budget(v_next),
    'months', (SELECT coalesce(jsonb_agg(m ORDER BY m DESC), '[]'::jsonb) FROM (SELECT month AS m FROM public.monthly_reward_budgets WHERE status = 'published') x));
END;
$function$;

COMMENT ON TABLE public.treasury_flows IS 'DEPRECATED: replaced by treasury_ledger (entry_type flow)';
COMMENT ON TABLE public.treasury_snapshots IS 'DEPRECATED: replaced by treasury_ledger (entry_type snapshot)';
COMMENT ON TABLE public.token_acquisitions IS 'DEPRECATED: replaced by treasury_ledger (entry_type acquisition)';