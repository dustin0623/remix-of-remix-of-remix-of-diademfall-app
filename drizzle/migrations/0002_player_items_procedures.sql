CREATE OR REPLACE FUNCTION public.record_ledger_entry(p_player_id uuid, p_currency text, p_amount numeric, p_entry_type text, p_idempotency_key text, p_reference_type text DEFAULT NULL::text, p_reference_id text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE e public.currency_ledger%rowtype; v_bal numeric;
BEGIN
  IF p_currency NOT IN ('credits','coins') THEN RAISE EXCEPTION 'Invalid currency'; END IF;
  IF p_amount IS NULL OR p_amount = 0 OR p_amount <> round(p_amount, 8) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_currency = 'credits' AND p_amount <> trunc(p_amount) THEN RAISE EXCEPTION 'Credits must be whole numbers'; END IF;

  SELECT * INTO e FROM public.currency_ledger WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF e.player_id <> p_player_id OR e.currency <> p_currency OR e.amount <> p_amount OR e.entry_type <> p_entry_type THEN
      RAISE EXCEPTION 'Idempotency key reused with different values';
    END IF;
    RETURN jsonb_build_object('entryId', e.id, 'balanceAfter', e.balance_after::text, 'duplicate', true);
  END IF;

  INSERT INTO public.player_items (player_id, item_type, item_id) VALUES (p_player_id, 'currency', p_currency) ON CONFLICT DO NOTHING;
  SELECT balance INTO v_bal FROM public.player_items
   WHERE player_id = p_player_id AND item_type = 'currency' AND item_id = p_currency FOR UPDATE;
  IF v_bal + p_amount < 0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.player_items SET balance = v_bal + p_amount
   WHERE player_id = p_player_id AND item_type = 'currency' AND item_id = p_currency;
  INSERT INTO public.currency_ledger (player_id, currency, amount, balance_after, entry_type, reference_type, reference_id, idempotency_key, metadata)
    VALUES (p_player_id, p_currency, p_amount, v_bal + p_amount, p_entry_type, p_reference_type, p_reference_id, p_idempotency_key, coalesce(p_metadata, '{}'::jsonb))
    RETURNING * INTO e;
  RETURN jsonb_build_object('entryId', e.id, 'balanceAfter', e.balance_after::text, 'duplicate', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  INSERT INTO public.player_items (player_id, item_type, item_id) VALUES (new.id, 'currency', 'credits'), (new.id, 'currency', 'coins') ON CONFLICT DO NOTHING;
  RETURN new;
END $function$;

CREATE OR REPLACE FUNCTION public.purchase_packs(p_player_id uuid, p_set_id text, p_quantity integer, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.pack_supply%rowtype; v_debit jsonb; v_owned numeric; v_bal numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  -- Replayed request: return the current state, never add packs twice.
  IF EXISTS (SELECT 1 FROM public.currency_ledger WHERE idempotency_key = p_idempotency_key) THEN
    SELECT coalesce((SELECT balance FROM public.player_items WHERE player_id = p_player_id AND item_type = 'pack' AND item_id = p_set_id), 0) INTO v_owned;
    SELECT coalesce((SELECT balance FROM public.player_items WHERE player_id = p_player_id AND item_type = 'currency' AND item_id = 'credits'), 0) INTO v_bal;
    RETURN jsonb_build_object('owned', v_owned::bigint, 'balanceAfter', v_bal::text, 'duplicate', true);
  END IF;
  SELECT * INTO s FROM public.pack_supply WHERE set_id = p_set_id FOR UPDATE;
  IF NOT FOUND OR NOT s.active THEN RAISE EXCEPTION 'This pack is not on sale'; END IF;
  IF s.sold_packs + p_quantity > s.public_allocation THEN RAISE EXCEPTION 'Sold out'; END IF;

  v_debit := public.record_ledger_entry(p_player_id, 'credits', -(s.price_credits * p_quantity), 'pack_purchase', p_idempotency_key,
    'pack_supply', p_set_id, jsonb_build_object('pack', p_set_id, 'quantity', p_quantity, 'priceCredits', s.price_credits));
  UPDATE public.pack_supply SET sold_packs = sold_packs + p_quantity WHERE set_id = p_set_id;
  INSERT INTO public.player_items (player_id, item_type, item_id, balance) VALUES (p_player_id, 'pack', p_set_id, p_quantity)
  ON CONFLICT (player_id, item_type, item_id) DO UPDATE SET balance = public.player_items.balance + excluded.balance
  RETURNING balance INTO v_owned;
  RETURN jsonb_build_object('owned', v_owned::bigint, 'balanceAfter', v_debit ->> 'balanceAfter', 'duplicate', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.commit_pack_opening(p_player_id uuid, p_set_id text, p_server_seed text, p_algorithm text, p_catalog_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o public.pack_openings%rowtype;
BEGIN
  SELECT * INTO o FROM public.pack_openings WHERE player_id = p_player_id AND set_id = p_set_id AND status = 'committed';
  IF FOUND THEN RETURN jsonb_build_object('openingId', o.id, 'commitHash', o.commit_hash, 'existing', true); END IF;
  IF coalesce((SELECT balance FROM public.player_items WHERE player_id = p_player_id AND item_type = 'pack' AND item_id = p_set_id), 0) < 1 THEN
    RAISE EXCEPTION 'No unopened pack';
  END IF;
  IF p_server_seed IS NULL OR char_length(p_server_seed) < 16 THEN RAISE EXCEPTION 'Invalid server seed'; END IF;
  INSERT INTO public.pack_openings (player_id, set_id, commit_hash, algorithm, catalog_version)
    VALUES (p_player_id, p_set_id, encode(sha256(convert_to(p_server_seed, 'UTF8')), 'hex'), p_algorithm, p_catalog_version)
    RETURNING * INTO o;
  INSERT INTO public.pack_opening_secrets (opening_id, server_seed) VALUES (o.id, p_server_seed);
  RETURN jsonb_build_object('openingId', o.id, 'commitHash', o.commit_hash, 'existing', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reveal_pack_opening(p_player_id uuid, p_opening_id uuid, p_client_seed text, p_results jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o public.pack_openings%rowtype; v_seed text; r jsonb; v_asset uuid; v_out jsonb := '[]'::jsonb; v_card text;
BEGIN
  SELECT * INTO o FROM public.pack_openings WHERE id = p_opening_id AND player_id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening not found'; END IF;
  IF o.status = 'revealed' THEN
    RETURN jsonb_build_object('results', o.results, 'serverSeed', o.server_seed, 'clientSeed', o.client_seed, 'duplicate', true);
  END IF;
  SELECT server_seed INTO v_seed FROM public.pack_opening_secrets WHERE opening_id = o.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening not found'; END IF;
  IF jsonb_typeof(p_results) <> 'array' OR jsonb_array_length(p_results) < 1 OR jsonb_array_length(p_results) > 10 THEN
    RAISE EXCEPTION 'Invalid results';
  END IF;

  UPDATE public.player_items SET balance = balance - 1
   WHERE player_id = p_player_id AND item_type = 'pack' AND item_id = o.set_id AND balance >= 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No unopened pack'; END IF;
  UPDATE public.pack_supply SET opened_packs = opened_packs + 1 WHERE set_id = o.set_id;

  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_card := r ->> 'cardId';
    INSERT INTO public.card_assets (owner_id, card_id, foil, opening_id, slot)
      VALUES (p_player_id, v_card, coalesce(r ->> 'foil', 'regular'), o.id, (r ->> 'slot')::smallint)
      RETURNING id INTO v_asset;
    v_out := v_out || jsonb_build_array(jsonb_build_object('assetId', v_asset, 'cardId', v_card, 'foil', coalesce(r ->> 'foil', 'regular'),
      'rarity', r ->> 'rarity', 'slot', (r ->> 'slot')::int));
  END LOOP;
  FOR v_card IN SELECT DISTINCT x ->> 'cardId' FROM jsonb_array_elements(p_results) x LOOP
    PERFORM public.refresh_player_card(p_player_id, v_card);
  END LOOP;

  UPDATE public.pack_openings SET status = 'revealed', server_seed = v_seed, client_seed = p_client_seed, results = v_out, revealed_at = now()
    WHERE id = o.id;
  DELETE FROM public.pack_opening_secrets WHERE opening_id = o.id;
  RETURN jsonb_build_object('results', v_out, 'serverSeed', v_seed, 'clientSeed', p_client_seed, 'duplicate', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public._new_division_chest(p_season text, p_player uuid, p_division text, p_type text, p_ordinal integer, p_match uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_seed text := encode(extensions.gen_random_bytes(32), 'hex'); v_id uuid;
BEGIN
  INSERT INTO public.division_chests (season_key, player_id, division_id, chest_type, ordinal, match_id, algorithm, commit_hash)
    VALUES (p_season, p_player, p_division, p_type, p_ordinal, p_match, 'diademfall-chest-v1',
            encode(extensions.digest(v_seed, 'sha256'), 'hex'))
    ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.division_chest_secrets (chest_id, server_seed) VALUES (v_id, v_seed);
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
  UPDATE public.player_items SET balance = balance - 1
   WHERE player_id = p_player_id AND item_type = 'chest' AND item_id = c.chest_type AND balance >= 1;
  UPDATE public.ranked_seasons SET chest_coin_shares = chest_coin_shares + v_shares WHERE key = c.season_key;
  RETURN jsonb_build_object('results', v_out, 'serverSeed', v_seed, 'clientSeed', p_client_seed, 'reserve', p_reserve, 'duplicate', false);
END $function$;

CREATE OR REPLACE FUNCTION public.spend_reward_energy(p_player_id uuid, p_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_energy integer; v_anchor_at timestamptz; v_ticks integer; v_now integer; v_anchor timestamptz;
BEGIN
  SELECT reward_energy, reward_energy_anchor_at INTO v_energy, v_anchor_at FROM public.profiles WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  v_ticks := greatest(0, floor(extract(epoch FROM (p_at - v_anchor_at)) / 3600))::integer;
  v_now := least(24, v_energy + v_ticks);
  v_anchor := CASE WHEN v_now >= 24 THEN p_at ELSE v_anchor_at + make_interval(hours => v_ticks) END;
  IF v_now < 1 THEN
    UPDATE public.profiles SET reward_energy = 0, reward_energy_anchor_at = v_anchor WHERE id = p_player_id;
    RETURN false;
  END IF;
  UPDATE public.profiles SET reward_energy = v_now - 1, reward_energy_anchor_at = v_anchor WHERE id = p_player_id;
  RETURN true;
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
  v_ticks integer; v_energy integer := 24; v_next timestamptz; d public.player_reward_days%rowtype;
  b public.monthly_reward_budgets%rowtype; v_days integer; v_pool_m numeric := 0; v_pool_a numeric := 0;
  v_tm numeric; v_ta numeric; v_est_m numeric := 0; v_est_a numeric := 0; v_funded boolean; v_last jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT reward_energy, reward_energy_anchor_at INTO v_e_energy, v_e_anchor FROM public.profiles WHERE id = v_uid;
  IF FOUND THEN
    v_ticks := greatest(0, floor(extract(epoch FROM (now() - v_e_anchor)) / 3600))::integer;
    v_energy := least(24, v_e_energy + v_ticks);
    IF v_energy < 24 THEN v_next := v_e_anchor + make_interval(hours => v_ticks + 1); END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.combine_card_assets(p_player_id uuid, p_target_asset_id uuid, p_source_asset_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t public.card_assets%rowtype; s public.card_assets%rowtype; v_rarity text; v_max integer; v_added integer := 0;
  v_after integer; v_level_before integer; v_level_after integer; v_found integer := 0; v_id uuid;
BEGIN
  IF p_source_asset_ids IS NULL OR cardinality(p_source_asset_ids) < 1 OR cardinality(p_source_asset_ids) > 100 THEN
    RAISE EXCEPTION 'Pick copies to combine';
  END IF;
  IF array_position(p_source_asset_ids, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT x) FROM unnest(p_source_asset_ids) x) <> cardinality(p_source_asset_ids)
     OR p_target_asset_id = ANY(p_source_asset_ids) THEN
    RAISE EXCEPTION 'Each copy can only be used once';
  END IF;

  -- Lock every involved asset in a fixed order (no deadlocks between concurrent combines).
  PERFORM 1 FROM public.card_assets WHERE id = p_target_asset_id OR id = ANY(p_source_asset_ids) ORDER BY id FOR UPDATE;

  SELECT * INTO t FROM public.card_assets WHERE id = p_target_asset_id;
  IF NOT FOUND OR t.owner_id <> p_player_id THEN RAISE EXCEPTION 'Not your card'; END IF;
  IF t.status <> 'available' THEN RAISE EXCEPTION 'Card is not available'; END IF;

  FOR s IN SELECT * FROM public.card_assets WHERE id = ANY(p_source_asset_ids) LOOP
    IF s.owner_id <> p_player_id THEN RAISE EXCEPTION 'Not your card'; END IF;
    IF s.status <> 'available' THEN RAISE EXCEPTION 'Card is not available'; END IF;
    IF s.card_id <> t.card_id THEN RAISE EXCEPTION 'Different cards cannot be combined'; END IF;
    IF s.foil <> t.foil THEN RAISE EXCEPTION 'Regular and Gold cannot be combined'; END IF;
    IF s.essence > t.essence THEN RAISE EXCEPTION 'Surviving card must have the most CE'; END IF;
    v_added := v_added + s.essence;
    v_found := v_found + 1;
  END LOOP;
  IF v_found <> cardinality(p_source_asset_ids) THEN RAISE EXCEPTION 'Not your card'; END IF;

  SELECT rarity INTO v_rarity FROM public.cards WHERE id = t.card_id;
  SELECT max(required_essence) INTO v_max FROM public.card_level_requirement_table() WHERE rarity = v_rarity AND foil = t.foil;
  IF v_max IS NULL THEN RAISE EXCEPTION 'Unknown card rarity'; END IF;
  v_after := t.essence + v_added;
  IF v_after > v_max THEN RAISE EXCEPTION 'Exceeds maximum CE of %', v_max; END IF;

  SELECT coalesce(max(level), 1) INTO v_level_before FROM public.card_level_requirement_table()
    WHERE rarity = v_rarity AND foil = t.foil AND required_essence <= t.essence;
  SELECT coalesce(max(level), 1) INTO v_level_after FROM public.card_level_requirement_table()
    WHERE rarity = v_rarity AND foil = t.foil AND required_essence <= v_after;

  UPDATE public.card_assets SET status = 'combined', combined_into = t.id, combined_at = now()
    WHERE id = ANY(p_source_asset_ids);
  UPDATE public.card_assets SET essence = v_after, level = v_level_after WHERE id = t.id;
  INSERT INTO public.card_combinations (player_id, card_id, foil, target_asset_id, source_asset_ids,
      essence_before, essence_added, essence_after, level_before, level_after)
    VALUES (p_player_id, t.card_id, t.foil, t.id, p_source_asset_ids, t.essence, v_added, v_after, v_level_before, v_level_after)
    RETURNING id INTO v_id;
  PERFORM public.refresh_player_card(p_player_id, t.card_id);

  RETURN jsonb_build_object('combinationId', v_id, 'assetId', t.id, 'cardId', t.card_id, 'foil', t.foil,
    'essenceBefore', t.essence, 'essenceAdded', v_added, 'essenceAfter', v_after,
    'levelBefore', v_level_before, 'levelAfter', v_level_after);
END;
$function$;

CREATE OR REPLACE FUNCTION public._try_match_ticket(p_ticket_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  INSERT INTO public.matches (game_version_id, engine_version, mode, region, mana_cap, seed, ruleset_ids, season_key)
    VALUES (v.id, v.engine_version, t.mode, t.region, v_caps[1 + floor(random() * cardinality(v_caps))::int],
            encode(extensions.gen_random_bytes(16), 'hex'), v_rules, t.season_key)
    RETURNING id INTO v_match;
  INSERT INTO public.match_players (match_id, player_id, side, rating_before)
    VALUES (v_match, opp.player_id, 1, opp.rating), (v_match, t.player_id, 2, t.rating);
  UPDATE public.matchmaking_tickets SET status = 'matched', match_id = v_match, matched_at = now() WHERE id IN (t.id, opp.id);
  RETURN v_match;
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
           coalesce((SELECT d.reset_rating FROM public.ranked_division_table() d WHERE d.min_rating <= r.rating ORDER BY d.min_rating DESC LIMIT 1), 1000)
      FROM public.player_ratings r WHERE r.season_key = p_key
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('season', p_key, 'nextSeason', 'season-' || v_next, 'pool', v_pool::text, 'shares', v_total::text, 'paid', v_paid::text, 'duplicate', false);
END $function$;

CREATE OR REPLACE FUNCTION public.grant_division_chests(p_player uuid, p_season text, p_before integer, p_after integer, p_match uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE d record; i integer; v_n integer := 0;
BEGIN
  FOR d IN SELECT * FROM public.ranked_division_table() WHERE min_rating > p_before AND min_rating <= p_after ORDER BY min_rating LOOP
    FOR i IN 1..d.reward_count LOOP
      IF public._new_division_chest(p_season, p_player, d.id, d.reward_chest, i, p_match) IS NOT NULL THEN v_n := v_n + 1; END IF;
    END LOOP;
    FOR i IN 1..d.bonus_count LOOP
      IF public._new_division_chest(p_season, p_player, d.id, d.bonus_chest, i, p_match) IS NOT NULL THEN v_n := v_n + 1; END IF;
    END LOOP;
  END LOOP;
  RETURN v_n;
END $function$;

CREATE OR REPLACE FUNCTION public.ranked_rating_change(p_rating integer, p_result text, p_streak integer, OUT rating_after integer, OUT streak_after integer)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_champion integer;
BEGIN
  SELECT min(min_rating) INTO v_champion FROM public.ranked_division_table() WHERE league = 'champion';
  v_champion := coalesce(v_champion, 2600);
  IF p_result = 'win' THEN
    streak_after := coalesce(p_streak, 0) + 1;
    rating_after := p_rating + 20 + CASE WHEN streak_after >= 3 AND p_rating < v_champion THEN 10 ELSE 0 END;
  ELSIF p_result = 'loss' THEN
    streak_after := 0; rating_after := greatest(0, p_rating - 20);
  ELSE
    streak_after := 0; rating_after := p_rating;
  END IF;
END $function$;

COMMENT ON TABLE public.currency_balances IS 'DEPRECATED: replaced by player_items (item_type currency)';
COMMENT ON TABLE public.player_packs IS 'DEPRECATED: replaced by player_items (item_type pack)';
COMMENT ON TABLE public.reward_energy IS 'DEPRECATED: replaced by profiles.reward_energy / reward_energy_anchor_at';
COMMENT ON TABLE public.ranked_divisions IS 'DEPRECATED: replaced by public.ranked_division_table() generated from src/game/divisions.ts';
COMMENT ON TABLE public.rulesets IS 'DEPRECATED: replaced by public.ranked_ruleset_pool() generated from src/game/catalog/rulesets.ts';
COMMENT ON TABLE public.card_level_requirements IS 'DEPRECATED: replaced by public.card_level_requirement_table() generated from src/game/combining.ts';