-- Cards become unique, unstacked instances: card_assets is renamed to player_cards (the old per-card
-- summary table is dropped), combined copies are flagged with is_combined/combined_to, and the catalog
-- tracks each card's printed/combined/circulating supply. Ranked reads the per-card best level from the
-- player_card_stacks view instead of a stored summary.

DROP TABLE public.player_cards;
DROP FUNCTION public.refresh_player_card(uuid, text);
DROP FUNCTION public.combine_card_assets(uuid, uuid, uuid[]);

ALTER TABLE public.card_assets RENAME TO player_cards;
ALTER TABLE public.player_cards RENAME COLUMN owner_id TO player_id;
ALTER TABLE public.player_cards RENAME COLUMN combined_into TO combined_to;
ALTER TABLE public.player_cards ADD COLUMN is_combined boolean NOT NULL DEFAULT false;
ALTER TABLE public.player_cards ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.player_cards SET is_combined = (status = 'combined');
ALTER TABLE public.player_cards DROP CONSTRAINT card_assets_combined_check;
ALTER TABLE public.player_cards ADD CONSTRAINT player_cards_combined_check
  CHECK (is_combined = (combined_to IS NOT NULL) AND is_combined = (status = 'combined'));

ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_pkey TO player_cards_pkey;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_essence_check TO player_cards_essence_check;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_foil_check TO player_cards_foil_check;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_level_check TO player_cards_level_check;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_slot_check TO player_cards_slot_check;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_status_check TO player_cards_status_check;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_opening_id_slot_key TO player_cards_opening_id_slot_key;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_chest_id_slot_key TO player_cards_chest_id_slot_key;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_opening_id_fkey TO player_cards_opening_id_fkey;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_card_id_fkey TO player_cards_card_id_fkey;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_combined_into_fkey TO player_cards_combined_to_fkey;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_owner_id_fkey TO player_cards_player_id_fkey;
ALTER TABLE public.player_cards RENAME CONSTRAINT card_assets_chest_id_fkey TO player_cards_chest_id_fkey;
ALTER INDEX public.card_assets_owner_card_idx RENAME TO player_cards_player_card_idx;
ALTER INDEX public.card_assets_owner_idx RENAME TO player_cards_player_status_idx;
ALTER POLICY card_assets_read ON public.player_cards RENAME TO player_cards_read;
CREATE TRIGGER player_cards_updated_at BEFORE UPDATE ON public.player_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
COMMENT ON TABLE public.player_cards IS 'Every card a player has: one row per unique copy (never stacked). Combined copies keep their row with is_combined = true and combined_to = the surviving copy.';

ALTER TABLE public.card_combinations RENAME COLUMN target_asset_id TO target_card_id;
ALTER TABLE public.card_combinations RENAME COLUMN source_asset_ids TO source_card_ids;
ALTER TABLE public.card_combinations RENAME CONSTRAINT card_combinations_target_asset_id_fkey TO card_combinations_target_card_id_fkey;

-- Catalog supply per card.
ALTER TABLE public.cards ADD COLUMN total_printed integer NOT NULL DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN total_combined integer NOT NULL DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN max_supply integer;
UPDATE public.cards c SET
  total_printed = (SELECT count(*) FROM public.player_cards p WHERE p.card_id = c.id),
  total_combined = (SELECT count(*) FROM public.player_cards p WHERE p.card_id = c.id AND p.is_combined);
ALTER TABLE public.cards ADD COLUMN circulating_supply integer GENERATED ALWAYS AS (total_printed - total_combined) STORED;
ALTER TABLE public.cards ADD CONSTRAINT cards_supply_check
  CHECK (total_printed >= 0 AND total_combined >= 0 AND total_combined <= total_printed);
ALTER TABLE public.cards ADD CONSTRAINT cards_max_supply_check
  CHECK (max_supply IS NULL OR (max_supply >= 0 AND total_printed <= max_supply));

-- Per-card best usable level and copy count (owned available copies + cards rented in). Read by ranked.
CREATE VIEW public.player_card_stacks WITH (security_invoker = true) AS
SELECT x.player_id, x.card_id, count(*)::integer AS copies, max(x.level)::smallint AS level,
       (count(*) FILTER (WHERE x.foil = 'gold'))::integer AS gold_copies
FROM (
  SELECT p.player_id, p.card_id, p.level, p.foil FROM public.player_cards p
   WHERE p.status = 'available' AND NOT p.is_combined
  UNION ALL
  SELECT rc.renter_id, p.card_id, p.level, p.foil FROM public.rental_contracts rc
    JOIN public.player_cards p ON p.id = rc.asset_id
   WHERE rc.status = 'active'
) x
GROUP BY x.player_id, x.card_id;
REVOKE ALL ON public.player_card_stacks FROM anon, authenticated;
GRANT SELECT ON public.player_card_stacks TO authenticated;
GRANT ALL ON public.player_card_stacks TO service_role;

CREATE OR REPLACE FUNCTION public.card_supply_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'minted', (SELECT coalesce(sum(total_printed), 0) FROM public.cards),
    'combinedAssets', (SELECT coalesce(sum(total_combined), 0) FROM public.cards),
    'activeAssets', count(*) FILTER (WHERE NOT is_combined AND status <> 'burned'),
    'existingEssence', coalesce(sum(essence) FILTER (WHERE NOT is_combined AND status <> 'burned'), 0),
    'burnedEssence', coalesce(sum(essence) FILTER (WHERE status = 'burned'), 0)
  ) FROM public.player_cards;
$function$;

CREATE OR REPLACE FUNCTION public.combine_player_cards(p_player_id uuid, p_target_card_id uuid, p_source_card_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t public.player_cards%rowtype; s public.player_cards%rowtype; v_rarity text; v_max integer; v_added integer := 0;
  v_after integer; v_level_before integer; v_level_after integer; v_found integer := 0; v_id uuid;
BEGIN
  IF p_source_card_ids IS NULL OR cardinality(p_source_card_ids) < 1 OR cardinality(p_source_card_ids) > 100 THEN
    RAISE EXCEPTION 'Pick copies to combine';
  END IF;
  IF array_position(p_source_card_ids, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT x) FROM unnest(p_source_card_ids) x) <> cardinality(p_source_card_ids)
     OR p_target_card_id = ANY(p_source_card_ids) THEN
    RAISE EXCEPTION 'Each copy can only be used once';
  END IF;

  -- Lock every involved card in a fixed order (no deadlocks between concurrent combines).
  PERFORM 1 FROM public.player_cards WHERE id = p_target_card_id OR id = ANY(p_source_card_ids) ORDER BY id FOR UPDATE;

  SELECT * INTO t FROM public.player_cards WHERE id = p_target_card_id;
  IF NOT FOUND OR t.player_id <> p_player_id THEN RAISE EXCEPTION 'Not your card'; END IF;
  IF t.status <> 'available' OR t.is_combined THEN RAISE EXCEPTION 'Card is not available'; END IF;

  FOR s IN SELECT * FROM public.player_cards WHERE id = ANY(p_source_card_ids) LOOP
    IF s.player_id <> p_player_id THEN RAISE EXCEPTION 'Not your card'; END IF;
    IF s.status <> 'available' OR s.is_combined THEN RAISE EXCEPTION 'Card is not available'; END IF;
    IF s.card_id <> t.card_id THEN RAISE EXCEPTION 'Different cards cannot be combined'; END IF;
    IF s.foil <> t.foil THEN RAISE EXCEPTION 'Regular and Gold cannot be combined'; END IF;
    IF s.essence > t.essence THEN RAISE EXCEPTION 'Surviving card must have the most CE'; END IF;
    v_added := v_added + s.essence;
    v_found := v_found + 1;
  END LOOP;
  IF v_found <> cardinality(p_source_card_ids) THEN RAISE EXCEPTION 'Not your card'; END IF;

  SELECT rarity INTO v_rarity FROM public.cards WHERE id = t.card_id;
  SELECT max(required_essence) INTO v_max FROM public.card_level_requirement_table() WHERE rarity = v_rarity AND foil = t.foil;
  IF v_max IS NULL THEN RAISE EXCEPTION 'Unknown card rarity'; END IF;
  v_after := t.essence + v_added;
  IF v_after > v_max THEN RAISE EXCEPTION 'Exceeds maximum CE of %', v_max; END IF;

  SELECT coalesce(max(level), 1) INTO v_level_before FROM public.card_level_requirement_table()
    WHERE rarity = v_rarity AND foil = t.foil AND required_essence <= t.essence;
  SELECT coalesce(max(level), 1) INTO v_level_after FROM public.card_level_requirement_table()
    WHERE rarity = v_rarity AND foil = t.foil AND required_essence <= v_after;

  UPDATE public.player_cards SET status = 'combined', is_combined = true, combined_to = t.id, combined_at = now()
    WHERE id = ANY(p_source_card_ids);
  UPDATE public.player_cards SET essence = v_after, level = v_level_after WHERE id = t.id;
  UPDATE public.cards SET total_combined = total_combined + v_found WHERE id = t.card_id;
  INSERT INTO public.card_combinations (player_id, card_id, foil, target_card_id, source_card_ids,
      essence_before, essence_added, essence_after, level_before, level_after)
    VALUES (p_player_id, t.card_id, t.foil, t.id, p_source_card_ids, t.essence, v_added, v_after, v_level_before, v_level_after)
    RETURNING id INTO v_id;

  RETURN jsonb_build_object('combinationId', v_id, 'targetCardId', t.id, 'cardId', t.card_id, 'foil', t.foil,
    'essenceBefore', t.essence, 'essenceAdded', v_added, 'essenceAfter', v_after,
    'levelBefore', v_level_before, 'levelAfter', v_level_after);
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
  IF jsonb_typeof(p_results) <> 'array' OR jsonb_array_length(p_results) <> 5 THEN  -- every pack holds exactly 5 cards
    RAISE EXCEPTION 'Invalid results';
  END IF;

  UPDATE public.player_items SET balance = balance - 1
   WHERE player_id = p_player_id AND item_type = 'pack' AND item_id = o.set_id AND balance >= 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No unopened pack'; END IF;
  UPDATE public.pack_supply SET opened_packs = opened_packs + 1 WHERE set_id = o.set_id;

  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_card := r ->> 'cardId';
    INSERT INTO public.player_cards (player_id, card_id, foil, opening_id, slot)
      VALUES (p_player_id, v_card, coalesce(r ->> 'foil', 'regular'), o.id, (r ->> 'slot')::smallint)
      RETURNING id INTO v_asset;
    UPDATE public.cards SET total_printed = total_printed + 1 WHERE id = v_card;
    v_out := v_out || jsonb_build_array(jsonb_build_object('assetId', v_asset, 'cardId', v_card, 'foil', coalesce(r ->> 'foil', 'regular'),
      'rarity', r ->> 'rarity', 'slot', (r ->> 'slot')::int));
  END LOOP;

  UPDATE public.pack_openings SET status = 'revealed', server_seed = v_seed, client_seed = p_client_seed, results = v_out, revealed_at = now()
    WHERE id = o.id;
  DELETE FROM public.pack_opening_secrets WHERE opening_id = o.id;
  RETURN jsonb_build_object('results', v_out, 'serverSeed', v_seed, 'clientSeed', p_client_seed, 'duplicate', false);
END;
$function$;

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
      INSERT INTO public.player_cards (player_id, card_id, foil, chest_id, slot)
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

CREATE OR REPLACE FUNCTION public.accrue_match_rewards(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      SELECT count(DISTINCT x.card_id) INTO v_gold FROM (
        SELECT a.card_id FROM public.player_cards a
         WHERE a.player_id = p.player_id AND a.foil = 'gold' AND a.status = 'available' AND a.card_id = ANY (v_ids)
        UNION
        SELECT rc.card_id FROM public.rental_contracts rc
         WHERE rc.renter_id = p.player_id AND rc.foil = 'gold' AND rc.status = 'active' AND rc.card_id = ANY (v_ids)
      ) x;
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
    UPDATE public.rental_listings SET status = 'active' WHERE id = c.listing_id AND status = 'rented';
    UPDATE public.player_cards SET status = 'listed' WHERE id = c.asset_id AND status = 'rented';
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.market_buy(p_buyer_id uuid, p_listing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.market_listings%rowtype; v_fee numeric; v_debit jsonb;
BEGIN
  SELECT * INTO l FROM public.market_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.status = 'sold' AND l.buyer_id = p_buyer_id THEN RETURN jsonb_build_object('listingId', l.id, 'duplicate', true); END IF;
  IF l.status <> 'active' THEN RAISE EXCEPTION 'Listing is no longer available'; END IF;
  IF l.seller_id = p_buyer_id THEN RAISE EXCEPTION 'You cannot buy your own card'; END IF;

  v_debit := public.record_ledger_entry(p_buyer_id, 'coins', -l.price_coins, 'market_purchase', 'market_purchase:' || l.id,
    'market_listing', l.id::text, jsonb_build_object('cardId', l.card_id, 'foil', l.foil));
  v_fee := public.record_trading_fee('market_fee', l.id::text, l.price_coins);
  IF l.price_coins - v_fee > 0 THEN
    PERFORM public.record_ledger_entry(l.seller_id, 'coins', l.price_coins - v_fee, 'market_sale', 'market_sale:' || l.id,
      'market_listing', l.id::text, jsonb_build_object('cardId', l.card_id, 'gross', l.price_coins::text, 'fee', v_fee::text));
  END IF;

  UPDATE public.player_cards SET player_id = p_buyer_id, status = 'available' WHERE id = l.asset_id;
  UPDATE public.market_listings SET status = 'sold', buyer_id = p_buyer_id, fee_coins = v_fee, completed_at = now() WHERE id = l.id;
  RETURN jsonb_build_object('listingId', l.id, 'duplicate', false, 'balanceAfter', v_debit->>'balanceAfter', 'fee', v_fee::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.market_cancel_listing(p_player_id uuid, p_listing_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.market_listings%rowtype;
BEGIN
  SELECT * INTO l FROM public.market_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR l.seller_id <> p_player_id THEN RAISE EXCEPTION 'Not your listing'; END IF;
  IF l.status <> 'active' THEN RETURN false; END IF;
  UPDATE public.market_listings SET status = 'cancelled', completed_at = now() WHERE id = l.id;
  UPDATE public.player_cards SET status = 'available' WHERE id = l.asset_id AND status = 'listed';
  RETURN true;
END;
$function$;

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
  INSERT INTO public.market_listings (asset_id, seller_id, card_id, foil, price_coins) VALUES (a.id, p_player_id, a.card_id, a.foil, p_price) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rental_cancel_listing(p_player_id uuid, p_listing_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.rental_listings%rowtype;
BEGIN
  SELECT * INTO l FROM public.rental_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR l.owner_id <> p_player_id THEN RAISE EXCEPTION 'Not your listing'; END IF;
  IF l.status = 'rented' THEN RAISE EXCEPTION 'Card is rented out'; END IF;
  IF l.status <> 'active' THEN RETURN false; END IF;
  UPDATE public.rental_listings SET status = 'cancelled' WHERE id = l.id;
  UPDATE public.player_cards SET status = 'available' WHERE id = l.asset_id AND status = 'listed';
  RETURN true;
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
  INSERT INTO public.rental_listings (asset_id, owner_id, card_id, foil, price_coins_per_day, minimum_days, maximum_days)
    VALUES (a.id, p_player_id, a.card_id, a.foil, p_price_per_day, p_minimum_days, p_maximum_days) RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rental_rent(p_renter_id uuid, p_listing_id uuid, p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l public.rental_listings%rowtype; v_gross numeric; v_fee numeric; v_contract uuid := gen_random_uuid(); v_debit jsonb; v_ends timestamptz;
BEGIN
  SELECT * INTO l FROM public.rental_listings WHERE id = p_listing_id FOR UPDATE;
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
  UPDATE public.rental_listings SET status = 'rented' WHERE id = l.id;
  UPDATE public.player_cards SET status = 'rented' WHERE id = l.asset_id;
  RETURN jsonb_build_object('contractId', v_contract, 'endsAt', v_ends, 'gross', v_gross::text, 'balanceAfter', v_debit->>'balanceAfter');
END;
$function$;

REVOKE ALL ON FUNCTION public.combine_player_cards(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.combine_player_cards(uuid, uuid, uuid[]) TO service_role;
