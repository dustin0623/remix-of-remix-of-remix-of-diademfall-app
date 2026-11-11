-- ============ 1. wallet_transfers (replaces transactions_pending + transactions_processed) ============
CREATE TABLE public.wallet_transfers (
  transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_address text,
  type text NOT NULL CHECK (type IN ('register','deposit','withdraw','purchase','market_purchase')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SUCCESS','FAILED','CANCELLED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  on_chain_ref text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  claimed_by text,
  claimed_at timestamptz,
  last_error text,
  on_chain_tx_id text,
  block_number bigint,
  result jsonb,
  error text,
  processed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CHECK ((status IN ('PENDING','PROCESSING')) = (processed_at IS NULL))
);
-- An external reference (e.g. a deposit signature) can be waiting or credited once; failed attempts may be retried.
CREATE UNIQUE INDEX wallet_transfers_ref_key ON public.wallet_transfers (type, on_chain_ref)
  WHERE on_chain_ref IS NOT NULL AND status IN ('PENDING','PROCESSING','SUCCESS');
CREATE INDEX wallet_transfers_claim_idx ON public.wallet_transfers (status, created_at) WHERE status IN ('PENDING','PROCESSING');
CREATE INDEX wallet_transfers_player_idx ON public.wallet_transfers (player_id, created_at DESC);

GRANT SELECT ON public.wallet_transfers TO authenticated;
GRANT ALL ON public.wallet_transfers TO service_role;
ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read their own transfers" ON public.wallet_transfers FOR SELECT TO authenticated USING (player_id = auth.uid());

DROP FUNCTION public.claim_pending_transactions(text, integer);
CREATE FUNCTION public.claim_pending_transactions(p_worker text, p_limit integer DEFAULT 10)
 RETURNS SETOF public.wallet_transfers
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  UPDATE public.wallet_transfers t
     SET status = 'PROCESSING', claimed_by = p_worker, claimed_at = now(), attempts = t.attempts + 1, updated_at = now()
   WHERE t.transaction_id IN (
     SELECT q.transaction_id FROM public.wallet_transfers q
      WHERE q.status = 'PENDING'
         OR (q.status = 'PROCESSING' AND q.type = 'deposit' AND q.claimed_at < now() - interval '5 minutes')
      ORDER BY q.created_at
      LIMIT greatest(1, least(coalesce(p_limit, 10), 100))
      FOR UPDATE SKIP LOCKED)
  RETURNING t.*;
$function$;
REVOKE ALL ON FUNCTION public.claim_pending_transactions(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_transactions(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_player_id uuid, p_transaction_id uuid, p_amount numeric, p_address text, p_symbol text, p_test boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_owner uuid; v_led jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 8) THEN RAISE EXCEPTION 'Invalid withdrawal amount'; END IF;
  IF coalesce(p_address, '') !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN RAISE EXCEPTION 'Invalid withdrawal address'; END IF;
  IF coalesce(p_symbol, '') = '' THEN RAISE EXCEPTION 'Invalid withdrawal token'; END IF;

  SELECT player_id INTO v_owner FROM public.wallet_transfers WHERE transaction_id = p_transaction_id;
  IF v_owner IS NOT NULL THEN
    IF v_owner <> p_player_id THEN RAISE EXCEPTION 'Transaction id already used'; END IF;
    RETURN jsonb_build_object('transactionId', p_transaction_id, 'duplicate', true);
  END IF;

  v_led := public.record_ledger_entry(p_player_id, 'coins', -p_amount, 'withdrawal', 'withdrawal:' || p_transaction_id,
    'transfer', p_transaction_id::text, jsonb_build_object('address', p_address, 'test', p_test));
  INSERT INTO public.wallet_transfers (transaction_id, player_id, wallet_address, type, metadata, max_attempts)
  VALUES (p_transaction_id, p_player_id, p_address, 'withdraw',
    jsonb_build_object('recipientAddress', p_address, 'assetType', 'token', 'symbol', p_symbol,
      'amount', p_amount::text, 'fee', '0', 'currency', 'coins', 'test', p_test), 1);
  RETURN jsonb_build_object('transactionId', p_transaction_id, 'balanceAfter', v_led ->> 'balanceAfter', 'duplicate', false);
END $function$;

CREATE OR REPLACE FUNCTION public.refund_withdrawal(p_transaction_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.wallet_transfers%rowtype; v_amount numeric;
BEGIN
  SELECT * INTO v FROM public.wallet_transfers WHERE transaction_id = p_transaction_id AND type = 'withdraw' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown withdrawal'; END IF;
  v_amount := (v.metadata ->> 'amount')::numeric;
  RETURN public.record_ledger_entry(v.player_id, 'coins', v_amount, 'withdrawal_refund', 'withdrawal_refund:' || p_transaction_id,
    'transfer', p_transaction_id::text, jsonb_build_object('reason', left(coalesce(p_reason, 'payout failed'), 300)));
END $function$;

-- ============ 2. item_openings (replaces pack_openings + division_chests) ============
CREATE TABLE public.item_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('pack','chest')),
  item_id text NOT NULL,                -- pack edition (player_items item_id) or chest type
  status text NOT NULL,
  algorithm text NOT NULL,
  commit_hash text NOT NULL,
  server_seed text,
  client_seed text,
  results jsonb,
  catalog_version text,                 -- packs
  season_key text REFERENCES public.ranked_seasons(key),   -- chests
  division_id text,                     -- chests
  ordinal smallint,                     -- chests
  match_id uuid REFERENCES public.matches(id),             -- chests
  reserve_snapshot jsonb,               -- chests
  coin_shares numeric NOT NULL DEFAULT 0 CHECK (coin_shares >= 0),
  credits bigint NOT NULL DEFAULT 0 CHECK (credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  CONSTRAINT item_openings_kind_check CHECK (
    (item_type = 'pack' AND status IN ('committed','revealed') AND catalog_version IS NOT NULL AND season_key IS NULL)
    OR (item_type = 'chest' AND status IN ('unopened','opened','auto_opened') AND item_id IN ('scout','war','crown')
        AND season_key IS NOT NULL AND division_id IS NOT NULL AND ordinal >= 1))
);
CREATE UNIQUE INDEX item_openings_one_pending_pack ON public.item_openings (player_id, item_id) WHERE item_type = 'pack' AND status = 'committed';
CREATE UNIQUE INDEX item_openings_chest_grant_key ON public.item_openings (season_key, player_id, division_id, item_id, ordinal) WHERE item_type = 'chest';
CREATE INDEX item_openings_player_idx ON public.item_openings (player_id, created_at DESC);
CREATE INDEX item_openings_season_idx ON public.item_openings (season_key, status) WHERE item_type = 'chest';

GRANT SELECT ON public.item_openings TO authenticated;
GRANT ALL ON public.item_openings TO service_role;
ALTER TABLE public.item_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY item_openings_read_own ON public.item_openings FOR SELECT TO authenticated USING (player_id = auth.uid());

-- Cards from packs and chests both point at their opening through opening_id.
ALTER TABLE public.player_cards DROP CONSTRAINT IF EXISTS player_cards_opening_id_fkey;
ALTER TABLE public.player_cards DROP CONSTRAINT IF EXISTS player_cards_chest_id_fkey;
ALTER TABLE public.player_cards ADD CONSTRAINT player_cards_opening_id_fkey FOREIGN KEY (opening_id) REFERENCES public.item_openings(id);
COMMENT ON COLUMN public.player_cards.chest_id IS 'DEPRECATED: chest cards now use opening_id (item_openings)';

CREATE OR REPLACE FUNCTION public.commit_pack_opening(p_player_id uuid, p_set_id text, p_server_seed text, p_algorithm text, p_catalog_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o public.item_openings%rowtype;
BEGIN
  SELECT * INTO o FROM public.item_openings WHERE player_id = p_player_id AND item_type = 'pack' AND item_id = p_set_id AND status = 'committed';
  IF FOUND THEN RETURN jsonb_build_object('openingId', o.id, 'commitHash', o.commit_hash, 'existing', true); END IF;
  IF coalesce((SELECT balance FROM public.player_items WHERE player_id = p_player_id AND item_type = 'pack' AND item_id = p_set_id), 0) < 1 THEN
    RAISE EXCEPTION 'No unopened pack';
  END IF;
  IF p_server_seed IS NULL OR char_length(p_server_seed) < 16 THEN RAISE EXCEPTION 'Invalid server seed'; END IF;
  INSERT INTO public.item_openings (player_id, item_type, item_id, status, commit_hash, algorithm, catalog_version)
    VALUES (p_player_id, 'pack', p_set_id, 'committed', encode(sha256(convert_to(p_server_seed, 'UTF8')), 'hex'), p_algorithm, p_catalog_version)
    RETURNING * INTO o;
  INSERT INTO public.game_secrets (action_type, target_id, player_id, server_seed, commit_hash)
    VALUES ('pack_opening', o.id, p_player_id, p_server_seed, o.commit_hash);
  RETURN jsonb_build_object('openingId', o.id, 'commitHash', o.commit_hash, 'existing', false);
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
  UPDATE public.pack_supply SET opened_packs = opened_packs + 1 WHERE set_id = o.item_id;

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

CREATE OR REPLACE FUNCTION public._new_division_chest(p_season text, p_player uuid, p_division text, p_type text, p_ordinal integer, p_match uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_seed text := encode(extensions.gen_random_bytes(32), 'hex'); v_hash text; v_id uuid;
BEGIN
  v_hash := encode(extensions.digest(v_seed, 'sha256'), 'hex');
  INSERT INTO public.item_openings (player_id, item_type, item_id, status, season_key, division_id, ordinal, match_id, algorithm, commit_hash)
    VALUES (p_player, 'chest', p_type, 'unopened', p_season, p_division, p_ordinal, p_match, 'diademfall-chest-v1', v_hash)
    ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.game_secrets (action_type, target_id, player_id, server_seed, commit_hash)
      VALUES ('division_chest', v_id, p_player, v_seed, v_hash);
    INSERT INTO public.player_items (player_id, item_type, item_id, balance) VALUES (p_player, 'chest', p_type, 1)
      ON CONFLICT (player_id, item_type, item_id) DO UPDATE SET balance = public.player_items.balance + 1;
  END IF;
  RETURN v_id;
END $function$;

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
    LEFT JOIN LATERAL (SELECT coin_balance, captured_at, source FROM public.treasury_snapshots t WHERE t.wallet_id = w.id AND t.captured_at < v_end ORDER BY captured_at DESC LIMIT 1) s ON true
   WHERE w.public AND w.active;
  SELECT coalesce(sum(s.coin_balance), 0) INTO v_open FROM public.treasury_wallets w
    CROSS JOIN LATERAL (SELECT coin_balance FROM public.treasury_snapshots t WHERE t.wallet_id = w.id AND t.captured_at < v_month ORDER BY captured_at DESC LIMIT 1) s
   WHERE w.wallet_type = 'reward_vault' AND w.active;
  SELECT coalesce(sum(s.coin_balance), 0) INTO v_close FROM public.treasury_wallets w
    CROSS JOIN LATERAL (SELECT coin_balance FROM public.treasury_snapshots t WHERE t.wallet_id = w.id AND t.captured_at < v_end ORDER BY captured_at DESC LIMIT 1) s
   WHERE w.wallet_type = 'reward_vault' AND w.active;
  SELECT coalesce(jsonb_agg(jsonb_build_object('source', a.source, 'coins', a.coins_acquired::text, 'quoteSpent', a.quote_spent::text,
      'quoteAsset', a.quote_asset, 'averagePriceUsd', a.average_price_usd::text, 'txHash', a.tx_hash, 'wallet', w.label, 'at', a.acquired_at) ORDER BY a.acquired_at DESC), '[]'::jsonb)
    INTO v_acqs FROM public.token_acquisitions a JOIN public.treasury_wallets w ON w.id = a.destination_wallet_id
   WHERE a.acquired_at >= v_month AND a.acquired_at < v_end;
  SELECT to_jsonb(b) INTO v_budget FROM (SELECT month, opening_reward_vault::text, prior_month_acquired::text, calculated_budget::text,
      match_pool::text, activity_pool::text, league_pool::text, leaderboard_pool::text, published_at
    FROM public.monthly_reward_budgets WHERE month = v_month AND status = 'published') b;
  SELECT jsonb_build_object(
      'marketToVault', coalesce(sum(amount) FILTER (WHERE flow_type = 'market_fee' AND account = 'reward_vault'), 0)::text,
      'marketBurned', coalesce(sum(amount) FILTER (WHERE flow_type = 'market_fee' AND account = 'burn'), 0)::text,
      'marketOperations', coalesce(sum(amount) FILTER (WHERE flow_type = 'market_fee' AND account = 'operations'), 0)::text,
      'rentalToVault', coalesce(sum(amount) FILTER (WHERE flow_type = 'rental_fee' AND account = 'reward_vault'), 0)::text,
      'rentalBurned', coalesce(sum(amount) FILTER (WHERE flow_type = 'rental_fee' AND account = 'burn'), 0)::text,
      'rentalOperations', coalesce(sum(amount) FILTER (WHERE flow_type = 'rental_fee' AND account = 'operations'), 0)::text,
      'burned', coalesce(sum(amount) FILTER (WHERE account = 'burn'), 0)::text,
      'distributed', coalesce(-sum(amount) FILTER (WHERE flow_type = 'reward_payout'), 0)::text)
    INTO v_flows FROM public.treasury_flows WHERE created_at >= v_month AND created_at < v_end;
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

-- ============ 3. card_listings (replaces market_listings + rental_listings) ============
CREATE TABLE public.card_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_type text NOT NULL CHECK (listing_type IN ('sale','rental')),
  asset_id uuid NOT NULL REFERENCES public.player_cards(id),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  card_id text NOT NULL REFERENCES public.cards(id),
  foil text NOT NULL CHECK (foil IN ('regular','gold')),
  price_coins numeric,            -- sale price
  price_coins_per_day numeric,    -- rental price
  minimum_days integer,
  maximum_days integer,
  status text NOT NULL DEFAULT 'active',
  buyer_id uuid REFERENCES public.profiles(id),
  fee_coins numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT card_listings_kind_check CHECK (
    (listing_type = 'sale' AND status IN ('active','sold','cancelled')
      AND price_coins >= 0.01 AND price_coins <= 1000000000
      AND price_coins_per_day IS NULL AND minimum_days IS NULL AND maximum_days IS NULL)
    OR (listing_type = 'rental' AND status IN ('active','rented','cancelled')
      AND price_coins_per_day >= 0.01 AND price_coins_per_day <= 100000000 AND price_coins IS NULL
      AND minimum_days >= 1 AND maximum_days >= minimum_days AND maximum_days <= 90 AND buyer_id IS NULL))
);
-- A card copy can have at most one open listing (sale or rental) at a time.
CREATE UNIQUE INDEX card_listings_one_open ON public.card_listings (asset_id) WHERE status IN ('active','rented');
CREATE INDEX card_listings_active_idx ON public.card_listings (listing_type, card_id) WHERE status = 'active';
CREATE INDEX card_listings_owner_idx ON public.card_listings (owner_id, created_at DESC);

GRANT SELECT ON public.card_listings TO authenticated;
GRANT ALL ON public.card_listings TO service_role;
ALTER TABLE public.card_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_listings_read ON public.card_listings FOR SELECT TO authenticated
  USING (status = 'active' OR owner_id = auth.uid() OR buyer_id = auth.uid());

ALTER TABLE public.rental_contracts DROP CONSTRAINT IF EXISTS rental_contracts_listing_id_fkey;
ALTER TABLE public.rental_contracts ADD CONSTRAINT rental_contracts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.card_listings(id);

CREATE OR REPLACE FUNCTION public.market_list_card(p_player_id uuid, p_asset_id uuid, p_price numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.player_cards%rowtype; v_id uuid;
BEGIN
  IF p_price IS NULL OR p_price < 0.01 OR p_price <> round(p_price, 8) THEN RAISE EXCEPTION 'Invalid price'; END IF;
  SELECT * INTO a FROM public.player_cards WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND OR a.player_id <> p_player_id THEN RAISE EXCEPTION 'Not your card'; END IF;
  IF a.status <> 'available' THEN RAISE EXCEPTION 'Card is not available'; END IF;
  UPDATE public.player_cards SET status = 'listed' WHERE id = a.id;
  INSERT INTO public.card_listings (listing_type, asset_id, owner_id, card_id, foil, price_coins)
    VALUES ('sale', a.id, p_player_id, a.card_id, a.foil, p_price) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.market_cancel_listing(p_player_id uuid, p_listing_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.card_listings%rowtype;
BEGIN
  SELECT * INTO l FROM public.card_listings WHERE id = p_listing_id AND listing_type = 'sale' FOR UPDATE;
  IF NOT FOUND OR l.owner_id <> p_player_id THEN RAISE EXCEPTION 'Not your listing'; END IF;
  IF l.status <> 'active' THEN RETURN false; END IF;
  UPDATE public.card_listings SET status = 'cancelled', completed_at = now() WHERE id = l.id;
  UPDATE public.player_cards SET status = 'available' WHERE id = l.asset_id AND status = 'listed';
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.market_buy(p_buyer_id uuid, p_listing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.card_listings%rowtype; v_fee numeric; v_debit jsonb;
BEGIN
  SELECT * INTO l FROM public.card_listings WHERE id = p_listing_id AND listing_type = 'sale' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.status = 'sold' AND l.buyer_id = p_buyer_id THEN RETURN jsonb_build_object('listingId', l.id, 'duplicate', true); END IF;
  IF l.status <> 'active' THEN RAISE EXCEPTION 'Listing is no longer available'; END IF;
  IF l.owner_id = p_buyer_id THEN RAISE EXCEPTION 'You cannot buy your own card'; END IF;

  v_debit := public.record_ledger_entry(p_buyer_id, 'coins', -l.price_coins, 'market_purchase', 'market_purchase:' || l.id,
    'market_listing', l.id::text, jsonb_build_object('cardId', l.card_id, 'foil', l.foil));
  v_fee := public.record_trading_fee('market_fee', l.id::text, l.price_coins);
  IF l.price_coins - v_fee > 0 THEN
    PERFORM public.record_ledger_entry(l.owner_id, 'coins', l.price_coins - v_fee, 'market_sale', 'market_sale:' || l.id,
      'market_listing', l.id::text, jsonb_build_object('cardId', l.card_id, 'gross', l.price_coins::text, 'fee', v_fee::text));
  END IF;

  UPDATE public.player_cards SET player_id = p_buyer_id, status = 'available' WHERE id = l.asset_id;
  UPDATE public.card_listings SET status = 'sold', buyer_id = p_buyer_id, fee_coins = v_fee, completed_at = now() WHERE id = l.id;
  RETURN jsonb_build_object('listingId', l.id, 'duplicate', false, 'balanceAfter', v_debit->>'balanceAfter', 'fee', v_fee::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rental_list_card(p_player_id uuid, p_asset_id uuid, p_price_per_day numeric, p_minimum_days integer, p_maximum_days integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.player_cards%rowtype; v_id uuid;
BEGIN
  IF p_price_per_day IS NULL OR p_price_per_day < 0.01 OR p_price_per_day <> round(p_price_per_day, 8) THEN RAISE EXCEPTION 'Invalid price'; END IF;
  IF p_minimum_days < 1 OR p_maximum_days < p_minimum_days OR p_maximum_days > 90 THEN RAISE EXCEPTION 'Invalid rental days'; END IF;
  SELECT * INTO a FROM public.player_cards WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND OR a.player_id <> p_player_id THEN RAISE EXCEPTION 'Not your card'; END IF;
  IF a.status <> 'available' THEN RAISE EXCEPTION 'Card is not available'; END IF;
  UPDATE public.player_cards SET status = 'listed' WHERE id = a.id;
  INSERT INTO public.card_listings (listing_type, asset_id, owner_id, card_id, foil, price_coins_per_day, minimum_days, maximum_days)
    VALUES ('rental', a.id, p_player_id, a.card_id, a.foil, p_price_per_day, p_minimum_days, p_maximum_days) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rental_cancel_listing(p_player_id uuid, p_listing_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.card_listings%rowtype;
BEGIN
  SELECT * INTO l FROM public.card_listings WHERE id = p_listing_id AND listing_type = 'rental' FOR UPDATE;
  IF NOT FOUND OR l.owner_id <> p_player_id THEN RAISE EXCEPTION 'Not your listing'; END IF;
  IF l.status = 'rented' THEN RAISE EXCEPTION 'Card is rented out'; END IF;
  IF l.status <> 'active' THEN RETURN false; END IF;
  UPDATE public.card_listings SET status = 'cancelled', completed_at = now() WHERE id = l.id;
  UPDATE public.player_cards SET status = 'available' WHERE id = l.asset_id AND status = 'listed';
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rental_rent(p_renter_id uuid, p_listing_id uuid, p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.card_listings%rowtype; v_gross numeric; v_fee numeric; v_contract uuid := gen_random_uuid(); v_debit jsonb; v_ends timestamptz;
BEGIN
  SELECT * INTO l FROM public.card_listings WHERE id = p_listing_id AND listing_type = 'rental' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.status <> 'active' THEN RAISE EXCEPTION 'Listing is no longer available'; END IF;
  IF l.owner_id = p_renter_id THEN RAISE EXCEPTION 'You cannot rent your own card'; END IF;
  IF p_days IS NULL OR p_days < l.minimum_days OR p_days > l.maximum_days THEN RAISE EXCEPTION 'Invalid rental days'; END IF;
  v_gross := trunc(l.price_coins_per_day * p_days, 8);
  v_ends := now() + make_interval(days => p_days);

  v_debit := public.record_ledger_entry(p_renter_id, 'coins', -v_gross, 'rental_payment', 'rental_payment:' || v_contract,
    'rental_contract', v_contract::text, jsonb_build_object('cardId', l.card_id, 'days', p_days));
  v_fee := public.record_trading_fee('rental_fee', v_contract::text, v_gross);
  IF v_gross - v_fee > 0 THEN
    PERFORM public.record_ledger_entry(l.owner_id, 'coins', v_gross - v_fee, 'rental_income', 'rental_income:' || v_contract,
      'rental_contract', v_contract::text, jsonb_build_object('cardId', l.card_id, 'days', p_days, 'gross', v_gross::text, 'fee', v_fee::text));
  END IF;

  INSERT INTO public.rental_contracts (id, listing_id, asset_id, card_id, foil, owner_id, renter_id, days, ends_at, gross_coins, fee_coins)
    VALUES (v_contract, l.id, l.asset_id, l.card_id, l.foil, l.owner_id, p_renter_id, p_days, v_ends, v_gross, v_fee);
  UPDATE public.card_listings SET status = 'rented' WHERE id = l.id;
  UPDATE public.player_cards SET status = 'rented' WHERE id = l.asset_id;
  RETURN jsonb_build_object('contractId', v_contract, 'endsAt', v_ends, 'gross', v_gross::text, 'balanceAfter', v_debit->>'balanceAfter');
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_rentals()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c public.rental_contracts%rowtype; n integer := 0;
BEGIN
  FOR c IN SELECT * FROM public.rental_contracts WHERE status = 'active' AND ends_at <= now() ORDER BY ends_at FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.rental_contracts SET status = 'completed', completed_at = now() WHERE id = c.id;
    UPDATE public.card_listings SET status = 'active' WHERE id = c.listing_id AND status = 'rented';
    UPDATE public.player_cards SET status = 'listed' WHERE id = c.asset_id AND status = 'rented';
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;

COMMENT ON TABLE public.transactions_pending IS 'DEPRECATED: replaced by wallet_transfers';
COMMENT ON TABLE public.transactions_processed IS 'DEPRECATED: replaced by wallet_transfers';
COMMENT ON TABLE public.pack_openings IS 'DEPRECATED: replaced by item_openings';
COMMENT ON TABLE public.division_chests IS 'DEPRECATED: replaced by item_openings';
COMMENT ON TABLE public.market_listings IS 'DEPRECATED: replaced by card_listings';
COMMENT ON TABLE public.rental_listings IS 'DEPRECATED: replaced by card_listings';