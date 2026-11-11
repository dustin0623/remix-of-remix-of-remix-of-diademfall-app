-- Phase 5 (marketplace + rentals, priced in Coins, 5% fee: 2% reward vault, 2% burn, 1% operations)
-- Phase 6 (treasury wallets, snapshots, acquisitions, computed monthly budget, public report)

-- ===== Roles (admin operates the treasury) =====
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_read_own ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- ===== In-game treasury flows (fees to vault/burn/operations, reward payouts out of the vault) =====
CREATE TABLE public.treasury_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_type text NOT NULL CHECK (flow_type IN ('market_fee','rental_fee','reward_payout','adjustment')),
  account text NOT NULL CHECK (account IN ('reward_vault','burn','operations')),
  amount numeric(30,8) NOT NULL CHECK (amount <> 0),
  reference_type text,
  reference_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flow_type, account, reference_id)
);
CREATE INDEX treasury_flows_created_idx ON public.treasury_flows (created_at);
GRANT SELECT ON public.treasury_flows TO anon, authenticated;
GRANT ALL ON public.treasury_flows TO service_role;
ALTER TABLE public.treasury_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_flows_read ON public.treasury_flows FOR SELECT TO anon, authenticated USING (true);

-- ===== Marketplace =====
CREATE TABLE public.market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.card_assets(id),
  seller_id uuid NOT NULL REFERENCES public.profiles(id),
  card_id text NOT NULL,
  foil text NOT NULL CHECK (foil IN ('regular','gold')),
  price_coins numeric(30,8) NOT NULL CHECK (price_coins >= 0.01 AND price_coins <= 1000000000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  buyer_id uuid REFERENCES public.profiles(id),
  fee_coins numeric(30,8),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX market_listings_one_active ON public.market_listings (asset_id) WHERE status = 'active';
CREATE INDEX market_listings_active_idx ON public.market_listings (card_id, price_coins) WHERE status = 'active';
CREATE INDEX market_listings_seller_idx ON public.market_listings (seller_id, created_at DESC);
GRANT SELECT ON public.market_listings TO authenticated;
GRANT ALL ON public.market_listings TO service_role;
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY market_listings_read ON public.market_listings FOR SELECT TO authenticated
  USING (status = 'active' OR seller_id = auth.uid() OR buyer_id = auth.uid());

-- ===== Rentals =====
CREATE TABLE public.rental_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.card_assets(id),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  card_id text NOT NULL,
  foil text NOT NULL CHECK (foil IN ('regular','gold')),
  price_coins_per_day numeric(30,8) NOT NULL CHECK (price_coins_per_day >= 0.01 AND price_coins_per_day <= 100000000),
  minimum_days integer NOT NULL DEFAULT 1 CHECK (minimum_days >= 1),
  maximum_days integer NOT NULL DEFAULT 30 CHECK (maximum_days >= minimum_days AND maximum_days <= 90),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','rented','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rental_listings_one_open ON public.rental_listings (asset_id) WHERE status IN ('active','rented');
CREATE INDEX rental_listings_active_idx ON public.rental_listings (card_id, price_coins_per_day) WHERE status = 'active';
CREATE INDEX rental_listings_owner_idx ON public.rental_listings (owner_id, created_at DESC);
GRANT SELECT ON public.rental_listings TO authenticated;
GRANT ALL ON public.rental_listings TO service_role;
ALTER TABLE public.rental_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY rental_listings_read ON public.rental_listings FOR SELECT TO authenticated
  USING (status = 'active' OR owner_id = auth.uid());

CREATE TABLE public.rental_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.rental_listings(id),
  asset_id uuid NOT NULL REFERENCES public.card_assets(id),
  card_id text NOT NULL,
  foil text NOT NULL CHECK (foil IN ('regular','gold')),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  renter_id uuid NOT NULL REFERENCES public.profiles(id),
  days integer NOT NULL CHECK (days >= 1),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  gross_coins numeric(30,8) NOT NULL CHECK (gross_coins > 0),
  fee_coins numeric(30,8) NOT NULL CHECK (fee_coins >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  completed_at timestamptz,
  CHECK (ends_at > starts_at)
);
CREATE UNIQUE INDEX rental_contracts_one_active ON public.rental_contracts (asset_id) WHERE status = 'active';
CREATE INDEX rental_contracts_renter_idx ON public.rental_contracts (renter_id, status);
CREATE INDEX rental_contracts_owner_idx ON public.rental_contracts (owner_id, status);
CREATE INDEX rental_contracts_due_idx ON public.rental_contracts (ends_at) WHERE status = 'active';
GRANT SELECT ON public.rental_contracts TO authenticated;
GRANT ALL ON public.rental_contracts TO service_role;
ALTER TABLE public.rental_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY rental_contracts_participant ON public.rental_contracts FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR renter_id = auth.uid());

-- ===== Helpers =====
-- Playable copies = owned 'available' assets + cards rented in. Ranked reads player_cards.copies.
CREATE OR REPLACE FUNCTION public.refresh_player_card(p_player_id uuid, p_card_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v integer;
BEGIN
  SELECT (SELECT count(*) FROM public.card_assets WHERE owner_id = p_player_id AND card_id = p_card_id AND status = 'available')
       + (SELECT count(*) FROM public.rental_contracts WHERE renter_id = p_player_id AND card_id = p_card_id AND status = 'active')
    INTO v;
  INSERT INTO public.player_cards (player_id, card_id, copies) VALUES (p_player_id, p_card_id, v)
  ON CONFLICT (player_id, card_id) DO UPDATE SET copies = excluded.copies;
END;
$$;

-- 5% fee: 2% reward vault, 2% burn, operations gets the rest of the fee (absorbs rounding).
CREATE OR REPLACE FUNCTION public.split_trading_fee(p_gross numeric, OUT fee numeric, OUT vault numeric, OUT burn numeric, OUT ops numeric)
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  fee := trunc(p_gross * 0.05, 8);
  vault := trunc(p_gross * 0.02, 8);
  burn := trunc(p_gross * 0.02, 8);
  ops := fee - vault - burn;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_trading_fee(p_flow_type text, p_reference_id text, p_gross numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM public.split_trading_fee(p_gross);
  IF f.vault > 0 THEN INSERT INTO public.treasury_flows (flow_type, account, amount, reference_type, reference_id) VALUES (p_flow_type, 'reward_vault', f.vault, p_flow_type, p_reference_id); END IF;
  IF f.burn > 0 THEN INSERT INTO public.treasury_flows (flow_type, account, amount, reference_type, reference_id) VALUES (p_flow_type, 'burn', f.burn, p_flow_type, p_reference_id); END IF;
  IF f.ops > 0 THEN INSERT INTO public.treasury_flows (flow_type, account, amount, reference_type, reference_id) VALUES (p_flow_type, 'operations', f.ops, p_flow_type, p_reference_id); END IF;
  RETURN f.fee;
END;
$$;

-- ===== Market functions (service-only; the server passes the verified player id) =====
CREATE OR REPLACE FUNCTION public.market_list_card(p_player_id uuid, p_asset_id uuid, p_price numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.card_assets%rowtype; v_id uuid;
BEGIN
  IF p_price IS NULL OR p_price < 0.01 OR p_price <> round(p_price, 8) THEN RAISE EXCEPTION 'Invalid price'; END IF;
  SELECT * INTO a FROM public.card_assets WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND OR a.owner_id <> p_player_id THEN RAISE EXCEPTION 'Not your card'; END IF;
  IF a.status <> 'available' THEN RAISE EXCEPTION 'Card is not available'; END IF;
  UPDATE public.card_assets SET status = 'listed' WHERE id = a.id;
  INSERT INTO public.market_listings (asset_id, seller_id, card_id, foil, price_coins) VALUES (a.id, p_player_id, a.card_id, a.foil, p_price) RETURNING id INTO v_id;
  PERFORM public.refresh_player_card(p_player_id, a.card_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.market_cancel_listing(p_player_id uuid, p_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE l public.market_listings%rowtype;
BEGIN
  SELECT * INTO l FROM public.market_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR l.seller_id <> p_player_id THEN RAISE EXCEPTION 'Not your listing'; END IF;
  IF l.status <> 'active' THEN RETURN false; END IF;
  UPDATE public.market_listings SET status = 'cancelled', completed_at = now() WHERE id = l.id;
  UPDATE public.card_assets SET status = 'available' WHERE id = l.asset_id AND status = 'listed';
  PERFORM public.refresh_player_card(p_player_id, l.card_id);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.market_buy(p_buyer_id uuid, p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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

  UPDATE public.card_assets SET owner_id = p_buyer_id, status = 'available' WHERE id = l.asset_id;
  UPDATE public.market_listings SET status = 'sold', buyer_id = p_buyer_id, fee_coins = v_fee, completed_at = now() WHERE id = l.id;
  PERFORM public.refresh_player_card(l.seller_id, l.card_id);
  PERFORM public.refresh_player_card(p_buyer_id, l.card_id);
  RETURN jsonb_build_object('listingId', l.id, 'duplicate', false, 'balanceAfter', v_debit->>'balanceAfter', 'fee', v_fee::text);
END;
$$;

-- ===== Rental functions (service-only) =====
CREATE OR REPLACE FUNCTION public.rental_list_card(p_player_id uuid, p_asset_id uuid, p_price_per_day numeric, p_minimum_days integer, p_maximum_days integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.card_assets%rowtype; v_id uuid;
BEGIN
  IF p_price_per_day IS NULL OR p_price_per_day < 0.01 OR p_price_per_day <> round(p_price_per_day, 8) THEN RAISE EXCEPTION 'Invalid price'; END IF;
  IF p_minimum_days < 1 OR p_maximum_days < p_minimum_days OR p_maximum_days > 90 THEN RAISE EXCEPTION 'Invalid rental days'; END IF;
  SELECT * INTO a FROM public.card_assets WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND OR a.owner_id <> p_player_id THEN RAISE EXCEPTION 'Not your card'; END IF;
  IF a.status <> 'available' THEN RAISE EXCEPTION 'Card is not available'; END IF;
  UPDATE public.card_assets SET status = 'listed' WHERE id = a.id;
  INSERT INTO public.rental_listings (asset_id, owner_id, card_id, foil, price_coins_per_day, minimum_days, maximum_days)
    VALUES (a.id, p_player_id, a.card_id, a.foil, p_price_per_day, p_minimum_days, p_maximum_days) RETURNING id INTO v_id;
  PERFORM public.refresh_player_card(p_player_id, a.card_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rental_cancel_listing(p_player_id uuid, p_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE l public.rental_listings%rowtype;
BEGIN
  SELECT * INTO l FROM public.rental_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR l.owner_id <> p_player_id THEN RAISE EXCEPTION 'Not your listing'; END IF;
  IF l.status = 'rented' THEN RAISE EXCEPTION 'Card is rented out'; END IF;
  IF l.status <> 'active' THEN RETURN false; END IF;
  UPDATE public.rental_listings SET status = 'cancelled' WHERE id = l.id;
  UPDATE public.card_assets SET status = 'available' WHERE id = l.asset_id AND status = 'listed';
  PERFORM public.refresh_player_card(p_player_id, l.card_id);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rental_rent(p_renter_id uuid, p_listing_id uuid, p_days integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
  UPDATE public.card_assets SET status = 'rented' WHERE id = l.asset_id;
  PERFORM public.refresh_player_card(p_renter_id, l.card_id);
  RETURN jsonb_build_object('contractId', v_contract, 'endsAt', v_ends, 'gross', v_gross::text, 'balanceAfter', v_debit->>'balanceAfter');
END;
$$;

-- Ended rentals: usage returns to the owner and the card goes back on its rental listing.
CREATE OR REPLACE FUNCTION public.expire_rentals()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.rental_contracts%rowtype; n integer := 0;
BEGIN
  FOR c IN SELECT * FROM public.rental_contracts WHERE status = 'active' AND ends_at <= now() ORDER BY ends_at FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.rental_contracts SET status = 'completed', completed_at = now() WHERE id = c.id;
    UPDATE public.rental_listings SET status = 'active' WHERE id = c.listing_id AND status = 'rented';
    UPDATE public.card_assets SET status = 'listed' WHERE id = c.asset_id AND status = 'rented';
    PERFORM public.refresh_player_card(c.renter_id, c.card_id);
    PERFORM public.refresh_player_card(c.owner_id, c.card_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- ===== Rewards: Gold bonus counts owned-available and rented-in Gold cards; payouts recorded as vault outflows =====
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
      SELECT count(DISTINCT x.card_id) INTO v_gold FROM (
        SELECT a.card_id FROM public.card_assets a
         WHERE a.owner_id = p.player_id AND a.foil = 'gold' AND a.status = 'available' AND a.card_id = ANY (v_ids)
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
$$;

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

  IF v_paid_m > 0 THEN INSERT INTO public.treasury_flows (flow_type, account, amount, reference_type, reference_id) VALUES ('reward_payout', 'reward_vault', -v_paid_m, 'reward_day', 'match:' || p_day); END IF;
  IF v_paid_a > 0 THEN INSERT INTO public.treasury_flows (flow_type, account, amount, reference_type, reference_id) VALUES ('reward_payout', 'reward_vault', -v_paid_a, 'reward_day', 'daily:' || p_day); END IF;

  INSERT INTO public.reward_days (reward_day, budget_month, match_pool, activity_pool, rollover_in_match, rollover_in_activity,
    total_match_shares, total_activity_shares, paid_match, paid_activity, rollover_out_match, rollover_out_activity, players_paid)
  VALUES (p_day, b.month, v_pool_m, v_pool_a, v_roll_m, v_roll_a, v_tm, v_ta, v_paid_m, v_paid_a, v_pool_m - v_paid_m, v_pool_a - v_paid_a, v_players);
  RETURN jsonb_build_object('day', p_day, 'status', 'settled', 'paidMatch', v_paid_m::text, 'paidActivity', v_paid_a::text, 'players', v_players);
END;
$$;

-- ===== Treasury (public on-chain wallets, balance snapshots, acquisitions) =====
CREATE TABLE public.treasury_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE CHECK (char_length(label) BETWEEN 2 AND 60),
  chain text NOT NULL DEFAULT 'solana' CHECK (chain = 'solana'),
  address text NOT NULL UNIQUE CHECK (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  wallet_type text NOT NULL CHECK (wallet_type IN ('reward_vault','operations','liquidity','reserve','burn')),
  public boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.treasury_wallets TO anon, authenticated;
GRANT ALL ON public.treasury_wallets TO service_role;
ALTER TABLE public.treasury_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_wallets_public_read ON public.treasury_wallets FOR SELECT TO anon, authenticated USING (public AND active);

CREATE TABLE public.treasury_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.treasury_wallets(id),
  coin_balance numeric(30,8) NOT NULL CHECK (coin_balance >= 0),
  quote_value_usd numeric(30,8),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','chain')),
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (wallet_id, captured_at)
);
CREATE INDEX treasury_snapshots_wallet_idx ON public.treasury_snapshots (wallet_id, captured_at DESC);
GRANT SELECT ON public.treasury_snapshots TO anon, authenticated;
GRANT ALL ON public.treasury_snapshots TO service_role;
ALTER TABLE public.treasury_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY treasury_snapshots_public_read ON public.treasury_snapshots FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.treasury_wallets w WHERE w.id = wallet_id AND w.public AND w.active));

CREATE TABLE public.token_acquisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('launch_purchase','pack_revenue_buyback','creator_fee_buyback','coin_credit_recycle','other')),
  coins_acquired numeric(30,8) NOT NULL CHECK (coins_acquired > 0),
  quote_spent numeric(30,8) CHECK (quote_spent IS NULL OR quote_spent >= 0),
  quote_asset text CHECK (quote_asset IS NULL OR quote_asset IN ('SOL','USDC','USD')),
  average_price_usd numeric(30,12) CHECK (average_price_usd IS NULL OR average_price_usd >= 0),
  tx_hash text UNIQUE,
  destination_wallet_id uuid NOT NULL REFERENCES public.treasury_wallets(id),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX token_acquisitions_acquired_idx ON public.token_acquisitions (acquired_at DESC);
GRANT SELECT ON public.token_acquisitions TO anon, authenticated;
GRANT ALL ON public.token_acquisitions TO service_role;
ALTER TABLE public.token_acquisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY token_acquisitions_public_read ON public.token_acquisitions FOR SELECT TO anon, authenticated USING (true);

-- Budget formula inputs: latest reward-vault snapshot per active vault wallet + previous month's
-- verified acquisitions into vault wallets + in-game fee returns to the vault.
CREATE OR REPLACE FUNCTION public.calculate_reward_budget(p_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_month date := date_trunc('month', p_month)::date; v_prev date; v_vault numeric; v_snap timestamptz; v_acq numeric; v_fees numeric; v_budget numeric;
BEGIN
  v_prev := (v_month - interval '1 month')::date;
  SELECT coalesce(sum(s.coin_balance), 0), max(s.captured_at) INTO v_vault, v_snap
    FROM public.treasury_wallets w
    CROSS JOIN LATERAL (SELECT coin_balance, captured_at FROM public.treasury_snapshots t
                         WHERE t.wallet_id = w.id AND t.captured_at < (v_month + interval '1 month')
                         ORDER BY captured_at DESC LIMIT 1) s
   WHERE w.wallet_type = 'reward_vault' AND w.active;
  SELECT coalesce(sum(a.coins_acquired), 0) INTO v_acq FROM public.token_acquisitions a
    JOIN public.treasury_wallets w ON w.id = a.destination_wallet_id AND w.wallet_type = 'reward_vault'
   WHERE a.acquired_at >= v_prev AND a.acquired_at < v_month;
  SELECT coalesce(sum(amount), 0) INTO v_fees FROM public.treasury_flows
   WHERE account = 'reward_vault' AND amount > 0 AND created_at >= v_prev AND created_at < v_month;
  v_budget := trunc(least(50000000, v_vault / 12 + 0.8 * (v_acq + v_fees)), 8);
  RETURN jsonb_build_object('month', v_month, 'openingRewardVault', v_vault::text, 'snapshotAt', v_snap,
    'priorMonthAcquired', (v_acq + v_fees)::text, 'acquisitionsOnChain', v_acq::text, 'feeReturns', v_fees::text,
    'budget', v_budget::text, 'matchPool', trunc(v_budget * 0.625, 8)::text, 'activityPool', trunc(v_budget * 0.1875, 8)::text,
    'leaguePool', trunc(v_budget * 0.125, 8)::text, 'leaderboardPool', trunc(v_budget * 0.0625, 8)::text,
    'published', EXISTS (SELECT 1 FROM public.monthly_reward_budgets WHERE month = v_month AND status = 'published'));
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_calculated_reward_budget(p_month date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c jsonb;
BEGIN
  IF date_trunc('month', p_month)::date < date_trunc('month', now() AT TIME ZONE 'UTC')::date THEN RAISE EXCEPTION 'Month already over'; END IF;
  c := public.calculate_reward_budget(p_month);
  IF (c->>'openingRewardVault')::numeric <= 0 THEN RAISE EXCEPTION 'Reward vault balance is zero'; END IF;
  RETURN public.publish_reward_budget((c->>'month')::date, (c->>'openingRewardVault')::numeric, (c->>'priorMonthAcquired')::numeric);
END;
$$;

-- Public monthly report (aggregates of public data only).
CREATE OR REPLACE FUNCTION public.treasury_month_report(p_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
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
    FROM public.market_listings WHERE status = 'sold' AND completed_at >= v_month AND completed_at < v_end;
  RETURN jsonb_build_object('month', v_month, 'wallets', v_wallets, 'openingRewardVault', v_open::text, 'closingRewardVault', v_close::text,
    'acquisitions', v_acqs, 'budget', v_budget, 'flows', v_flows, 'rewards', v_rewards, 'market', v_market,
    'rentals', (SELECT jsonb_build_object('contracts', count(*), 'volume', coalesce(sum(gross_coins), 0)::text) FROM public.rental_contracts WHERE starts_at >= v_month AND starts_at < v_end),
    'nextMonth', public.calculate_reward_budget(v_next),
    'months', (SELECT coalesce(jsonb_agg(m ORDER BY m DESC), '[]'::jsonb) FROM (SELECT month AS m FROM public.monthly_reward_budgets WHERE status = 'published') x));
END;
$$;

-- ===== Execute permissions =====
REVOKE EXECUTE ON FUNCTION public.refresh_player_card(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.split_trading_fee(numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_trading_fee(text, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.market_list_card(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.market_cancel_listing(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.market_buy(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rental_list_card(uuid, uuid, numeric, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rental_cancel_listing(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rental_rent(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_rentals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accrue_match_rewards(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_reward_day(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_reward_budget(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_calculated_reward_budget(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.treasury_month_report(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_player_card(uuid, text), public.split_trading_fee(numeric), public.record_trading_fee(text, text, numeric),
  public.market_list_card(uuid, uuid, numeric), public.market_cancel_listing(uuid, uuid), public.market_buy(uuid, uuid),
  public.rental_list_card(uuid, uuid, numeric, integer, integer), public.rental_cancel_listing(uuid, uuid), public.rental_rent(uuid, uuid, integer),
  public.expire_rentals(), public.accrue_match_rewards(uuid), public.settle_reward_day(date),
  public.calculate_reward_budget(date), public.publish_calculated_reward_budget(date), public.treasury_month_report(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.treasury_month_report(date) TO anon, authenticated;