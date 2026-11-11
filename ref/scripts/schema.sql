-- Consolidated idempotent schema for self-hosted Supabase/Postgres.
-- Run: psql "$DATABASE_URL" -f scripts/schema.sql  (or paste into the SQL editor)

-- ===== 0000_persist_chest_damage.sql =====
-- 0000_initial_schema: rebuilt baseline (tables + core game functions).
CREATE TABLE IF NOT EXISTS public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE,
  username text,
  coins bigint NOT NULL DEFAULT 0,
  deposited_balance bigint NOT NULL DEFAULT 0,
  token_hash text NOT NULL DEFAULT '',
  referral_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  referred_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  is_test boolean NOT NULL DEFAULT false,
  avatar_id integer NOT NULL DEFAULT 0,
  banner_id integer NOT NULL DEFAULT 100,
  background_id integer NOT NULL DEFAULT 200,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS players_username_lower_idx ON public.players (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.player_houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  nft_id text NOT NULL UNIQUE,
  rarity text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  registered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.heroes (
  id text PRIMARY KEY DEFAULT ('hero_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  name text NOT NULL,
  rarity text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  power integer NOT NULL,
  speed integer NOT NULL,
  stamina integer NOT NULL,
  bomb_number integer NOT NULL,
  bomb_range integer NOT NULL,
  max_energy integer NOT NULL,
  energy integer NOT NULL,
  skills text[] NOT NULL DEFAULT '{}',
  on_map boolean NOT NULL DEFAULT false,
  recovery_at timestamptz NOT NULL DEFAULT now(),
  house_id uuid REFERENCES public.player_houses(id) ON DELETE SET NULL,
  is_listed boolean NOT NULL DEFAULT false,
  market_price numeric,
  listed_at timestamptz,
  reserved_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  reserved_until timestamptz,
  purchase_tx text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS heroes_player_idx ON public.heroes (player_id);
CREATE INDEX IF NOT EXISTS heroes_listed_idx ON public.heroes (is_listed) WHERE is_listed;

CREATE TABLE IF NOT EXISTS public.stage_maps (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  stage integer NOT NULL DEFAULT 1,
  seed bigint NOT NULL,
  destroyed_nodes text[] NOT NULL DEFAULT '{}',
  damaged_nodes jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_milestones (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  xp bigint NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  total_gold_claimed bigint NOT NULL DEFAULT 0,
  total_chests integer NOT NULL DEFAULT 0,
  chests_common integer NOT NULL DEFAULT 0,
  chests_uncommon integer NOT NULL DEFAULT 0,
  chests_rare integer NOT NULL DEFAULT 0,
  chests_epic integer NOT NULL DEFAULT 0,
  chests_legendary integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  wallet_address text NOT NULL DEFAULT '',
  session_token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active',
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_sessions_player_idx ON public.game_sessions (player_id, status);

CREATE TABLE IF NOT EXISTS public.transactions_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions_processed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_id uuid,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  action text NOT NULL,
  status text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Service-role only: browsers never touch these tables directly.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['players','player_houses','heroes','stage_maps','player_milestones','game_sessions','transactions_pending','transactions_processed'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Sessions ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_or_renew_game_session(p_player_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_token uuid;
BEGIN
  PERFORM 1 FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_player'; END IF;
  UPDATE game_sessions SET status = 'closed' WHERE player_id = p_player_id AND status = 'active';
  INSERT INTO game_sessions (player_id, wallet_address)
  VALUES (p_player_id, coalesce((SELECT wallet_address FROM players WHERE id = p_player_id), ''))
  RETURNING session_token INTO v_token;
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.assert_game_session(p_player_id uuid, p_session_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_session_token IS NULL OR NOT EXISTS (
    SELECT 1 FROM game_sessions WHERE player_id = p_player_id AND session_token = p_session_token AND status = 'active'
  ) THEN RAISE EXCEPTION 'SESSION_SUPERSEDED'; END IF;
END $$;

-- Progress ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_progress(p_player_id uuid, p_seed bigint, p_rewards jsonb, p_total_chests integer, p_new_seed bigint, p_session_token uuid, p_chests jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_map stage_maps%ROWTYPE; v_key text; v_amt jsonb; v_amount bigint; v_accepted int := 0; v_gain bigint := 0;
  v_chest jsonb; v_rarity text; v_xp bigint := 0; v_gold bigint := 0; v_count int := 0;
  c_common int := 0; c_uncommon int := 0; c_rare int := 0; c_epic int := 0; c_legendary int := 0;
BEGIN
  PERFORM 1 FROM players WHERE id = p_player_id FOR UPDATE;
  PERFORM assert_game_session(p_player_id, p_session_token);
  SELECT * INTO STRICT v_map FROM stage_maps WHERE player_id = p_player_id FOR UPDATE;
  IF v_map.seed = p_seed THEN
    FOR v_key, v_amt IN SELECT key, value FROM jsonb_each(coalesce(p_rewards, '{}'::jsonb)) LOOP
      IF v_key !~ '^\d{1,3},\d{1,3}$' OR v_key = ANY(v_map.destroyed_nodes) THEN CONTINUE; END IF;
      v_amount := greatest(0, coalesce((v_amt #>> '{}')::numeric, 0))::bigint;
      v_map.destroyed_nodes := array_append(v_map.destroyed_nodes, v_key);
      v_accepted := v_accepted + 1;
      v_gain := v_gain + v_amount;
      v_chest := coalesce(p_chests, '{}'::jsonb) -> v_key;
      IF v_chest IS NOT NULL THEN
        v_rarity := v_chest ->> 'rarity';
        v_xp := v_xp + greatest(0, coalesce((v_chest ->> 'hp')::numeric, 0))::bigint;
        v_gold := v_gold + v_amount;
        v_count := v_count + 1;
        CASE v_rarity WHEN 'uncommon' THEN c_uncommon := c_uncommon + 1; WHEN 'rare' THEN c_rare := c_rare + 1;
          WHEN 'epic' THEN c_epic := c_epic + 1; WHEN 'legendary' THEN c_legendary := c_legendary + 1;
          ELSE c_common := c_common + 1; END CASE;
      END IF;
    END LOOP;
    UPDATE players SET coins = coins + v_gain, updated_at = now() WHERE id = p_player_id;
    IF v_count > 0 THEN
      INSERT INTO player_milestones AS m (player_id, xp, level, total_gold_claimed, total_chests, chests_common, chests_uncommon, chests_rare, chests_epic, chests_legendary)
      VALUES (p_player_id, v_xp, floor(sqrt(v_xp / 1000.0))::int + 1, v_gold, v_count, c_common, c_uncommon, c_rare, c_epic, c_legendary)
      ON CONFLICT (player_id) DO UPDATE SET
        xp = m.xp + v_xp, level = floor(sqrt((m.xp + v_xp) / 1000.0))::int + 1,
        total_gold_claimed = m.total_gold_claimed + v_gold, total_chests = m.total_chests + v_count,
        chests_common = m.chests_common + c_common, chests_uncommon = m.chests_uncommon + c_uncommon,
        chests_rare = m.chests_rare + c_rare, chests_epic = m.chests_epic + c_epic,
        chests_legendary = m.chests_legendary + c_legendary, updated_at = now();
    END IF;
    IF p_new_seed > 0 THEN
      v_map.stage := v_map.stage + 1; v_map.seed := p_new_seed; v_map.destroyed_nodes := '{}';
      v_map.damaged_nodes := '{}'::jsonb;
    END IF;
    UPDATE stage_maps SET stage = v_map.stage, seed = v_map.seed, destroyed_nodes = v_map.destroyed_nodes,
      damaged_nodes = v_map.damaged_nodes, last_sync_at = now(), updated_at = now() WHERE player_id = p_player_id;
  END IF;
  RETURN jsonb_build_object('coins', (SELECT coins FROM players WHERE id = p_player_id), 'stage', v_map.stage,
    'seed', v_map.seed, 'destroyed', to_jsonb(v_map.destroyed_nodes), 'accepted', v_accepted);
END $$;

-- Heroes -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_heroes_state(p_player_id uuid, p_heroes jsonb, p_session_token uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_h jsonb; v_n int := 0;
BEGIN
  PERFORM 1 FROM players WHERE id = p_player_id FOR UPDATE;
  IF p_session_token IS NOT NULL THEN
    PERFORM assert_game_session(p_player_id, p_session_token);
  ELSIF EXISTS (SELECT 1 FROM game_sessions WHERE player_id = p_player_id AND status = 'active'
                AND last_heartbeat_at > now() - interval '2 minutes') THEN
    RAISE EXCEPTION 'SESSION_ACTIVE_ELSEWHERE';
  END IF;
  FOR v_h IN SELECT * FROM jsonb_array_elements(coalesce(p_heroes, '[]'::jsonb)) LOOP
    UPDATE heroes SET
      energy = greatest(0, (v_h ->> 'energy')::numeric)::int,
      on_map = coalesce((v_h ->> 'onMap')::boolean, false),
      recovery_at = least(now(), to_timestamp((v_h ->> 'recoveryAt')::numeric / 1000.0)),
      updated_at = now()
    WHERE id = v_h ->> 'id' AND player_id = p_player_id;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'updated', v_n);
END $$;

CREATE OR REPLACE FUNCTION public.mint_heroes(p_player_id uuid, p_cost bigint, p_heroes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_coins bigint; v_h jsonb; v_row heroes%ROWTYPE; v_out jsonb := '[]'::jsonb;
BEGIN
  IF p_cost < 0 OR jsonb_typeof(p_heroes) <> 'array' OR jsonb_array_length(p_heroes) = 0 THEN RAISE EXCEPTION 'invalid_mint'; END IF;
  SELECT coins INTO v_coins FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_player'; END IF;
  IF v_coins < p_cost THEN RAISE EXCEPTION 'not_enough_coins'; END IF;
  UPDATE players SET coins = coins - p_cost, updated_at = now() WHERE id = p_player_id RETURNING coins INTO v_coins;
  FOR v_h IN SELECT * FROM jsonb_array_elements(p_heroes) LOOP
    IF coalesce((v_h ->> 'level')::int, 1) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'invalid_mint_level'; END IF;
    INSERT INTO heroes (player_id, name, level, rarity, power, speed, stamina, bomb_number, bomb_range, max_energy, energy, skills)
    VALUES (p_player_id, v_h ->> 'type', coalesce((v_h ->> 'level')::int, 1), v_h ->> 'rarity', (v_h ->> 'power')::int, (v_h ->> 'speed')::int,
      (v_h ->> 'stamina')::int, (v_h ->> 'bombNumber')::int, (v_h ->> 'bombRange')::int,
      (v_h ->> 'maxEnergy')::int, (v_h ->> 'maxEnergy')::int,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(v_h -> 'skills', '[]'::jsonb))), '{}'))
    RETURNING * INTO v_row;
    v_out := v_out || jsonb_build_object('id', v_row.id, 'name', v_row.name, 'type', v_row.name, 'level', v_row.level,
      'rarity', v_row.rarity, 'power', v_row.power, 'speed', v_row.speed, 'stamina', v_row.stamina,
      'bombNumber', v_row.bomb_number, 'bombRange', v_row.bomb_range, 'maxEnergy', v_row.max_energy,
      'skills', to_jsonb(v_row.skills), 'energy', v_row.energy, 'onMap', false,
      'recoveryAt', floor(extract(epoch FROM v_row.recovery_at) * 1000), 'listed', false);
  END LOOP;
  RETURN jsonb_build_object('coins', v_coins, 'heroes', v_out);
END $$;

-- Marketplace ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_hero(p_player_id uuid, p_hero_id text, p_price numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_price IS NULL OR p_price <= 0 THEN RAISE EXCEPTION 'cannot_list'; END IF;
  UPDATE heroes SET is_listed = true, market_price = p_price, listed_at = now(), updated_at = now()
  WHERE id = p_hero_id AND player_id = p_player_id AND NOT on_map AND house_id IS NULL AND NOT is_listed;
  IF NOT FOUND THEN RAISE EXCEPTION 'cannot_list'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_hero_listing(p_player_id uuid, p_hero_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE heroes SET is_listed = false, market_price = NULL, listed_at = NULL, reserved_by = NULL, reserved_until = NULL, updated_at = now()
  WHERE id = p_hero_id AND player_id = p_player_id AND is_listed AND purchase_tx IS NULL
    AND (reserved_until IS NULL OR reserved_until < now());
  IF NOT FOUND THEN RAISE EXCEPTION 'hero_reserved'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_market_hero(p_buyer_id uuid, p_hero_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v heroes%ROWTYPE;
BEGIN
  SELECT * INTO v FROM heroes WHERE id = p_hero_id FOR UPDATE;
  IF NOT FOUND OR NOT v.is_listed OR v.player_id = p_buyer_id OR v.purchase_tx IS NOT NULL
     OR (v.reserved_until > now() AND v.reserved_by IS DISTINCT FROM p_buyer_id) THEN
    RAISE EXCEPTION 'hero_unavailable';
  END IF;
  UPDATE heroes SET reserved_by = p_buyer_id, reserved_until = now() + interval '5 minutes', updated_at = now()
  WHERE id = p_hero_id RETURNING * INTO v;
  RETURN jsonb_build_object('price', v.market_price, 'reservedUntil', floor(extract(epoch FROM v.reserved_until) * 1000));
END $$;

CREATE OR REPLACE FUNCTION public.release_market_reservation(p_buyer_id uuid, p_hero_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE heroes SET reserved_by = NULL, reserved_until = NULL, updated_at = now()
  WHERE id = p_hero_id AND reserved_by = p_buyer_id AND purchase_tx IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.submit_market_payment(p_buyer_id uuid, p_hero_id text, p_tx text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v heroes%ROWTYPE; v_job uuid;
BEGIN
  SELECT * INTO v FROM heroes WHERE id = p_hero_id FOR UPDATE;
  IF NOT FOUND OR NOT v.is_listed OR v.reserved_by IS DISTINCT FROM p_buyer_id OR v.reserved_until < now() OR v.purchase_tx IS NOT NULL THEN
    RAISE EXCEPTION 'reservation_expired';
  END IF;
  UPDATE heroes SET purchase_tx = p_tx, updated_at = now() WHERE id = p_hero_id;
  INSERT INTO transactions_pending (player_id, action, payload)
  VALUES (p_buyer_id, 'market_purchase', jsonb_build_object('heroId', p_hero_id, 'tx', p_tx, 'price', v.market_price, 'seller', v.player_id, 'buyer', p_buyer_id))
  RETURNING id INTO v_job;
  RETURN v_job;
END $$;

CREATE OR REPLACE FUNCTION public.settle_market_purchase(p_hero_id text, p_tx text, p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_success THEN
    UPDATE heroes SET player_id = reserved_by, is_listed = false, market_price = NULL, listed_at = NULL,
      reserved_by = NULL, reserved_until = NULL, purchase_tx = NULL, on_map = false, house_id = NULL, updated_at = now()
    WHERE id = p_hero_id AND purchase_tx = p_tx AND reserved_by IS NOT NULL;
  ELSE
    UPDATE heroes SET reserved_by = NULL, reserved_until = NULL, purchase_tx = NULL, updated_at = now()
    WHERE id = p_hero_id AND purchase_tx = p_tx;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_purchase'; END IF;
END $$;

-- Wallet / queue -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_player_id uuid, p_amount bigint, p_address text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_coins bigint; v_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR coalesce(p_address, '') = '' THEN RAISE EXCEPTION 'invalid_withdrawal'; END IF;
  SELECT coins INTO v_coins FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_player'; END IF;
  IF v_coins < p_amount THEN RAISE EXCEPTION 'not_enough_coins'; END IF;
  UPDATE players SET coins = coins - p_amount, updated_at = now() WHERE id = p_player_id RETURNING coins INTO v_coins;
  INSERT INTO transactions_pending (player_id, action, payload)
  VALUES (p_player_id, 'withdrawal', jsonb_build_object('address', p_address, 'amount', p_amount))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('coins', v_coins, 'transaction_id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.claim_pending_transactions(p_limit integer DEFAULT 10)
RETURNS SETOF public.transactions_pending LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE transactions_pending t SET status = 'processing', locked_at = now(), attempts = t.attempts + 1
  WHERE t.id IN (
    SELECT id FROM transactions_pending
    WHERE status = 'pending' OR (status = 'processing' AND locked_at < now() - interval '5 minutes')
    ORDER BY created_at LIMIT greatest(1, least(p_limit, 100)) FOR UPDATE SKIP LOCKED)
  RETURNING t.*;
$$;

-- Houses & cosmetics ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_hero_house(p_player_id uuid, p_hero_id text, p_house_id uuid, p_capacity integer, p_energy integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v heroes%ROWTYPE;
BEGIN
  SELECT * INTO v FROM heroes WHERE id = p_hero_id AND player_id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_hero'; END IF;
  IF v.on_map THEN RAISE EXCEPTION 'hero_on_map'; END IF;
  IF v.is_listed THEN RAISE EXCEPTION 'hero_listed'; END IF;
  IF p_house_id IS NOT NULL THEN
    PERFORM 1 FROM player_houses WHERE id = p_house_id AND player_id = p_player_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'unknown_house'; END IF;
    IF (SELECT count(*) FROM heroes WHERE house_id = p_house_id AND id <> p_hero_id) >= p_capacity THEN
      RAISE EXCEPTION 'house_full';
    END IF;
  END IF;
  UPDATE heroes SET house_id = p_house_id, energy = greatest(0, least(p_energy, max_energy)), recovery_at = now(), updated_at = now()
  WHERE id = p_hero_id;
END $$;

CREATE OR REPLACE FUNCTION public.unregister_house(p_player_id uuid, p_house_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE heroes SET house_id = NULL, recovery_at = now(), updated_at = now() WHERE house_id = p_house_id AND player_id = p_player_id;
  DELETE FROM player_houses WHERE id = p_house_id AND player_id = p_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_house'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_player_cosmetic(p_player_id uuid, p_kind text, p_template_id integer, p_required_level integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_level int;
BEGIN
  SELECT floor(sqrt(coalesce((SELECT xp FROM player_milestones WHERE player_id = p_player_id), 0) / 1000.0))::int + 1 INTO v_level;
  IF v_level < coalesce(p_required_level, 1) THEN RAISE EXCEPTION 'cosmetic_locked'; END IF;
  IF p_kind = 'avatar' THEN UPDATE players SET avatar_id = p_template_id, updated_at = now() WHERE id = p_player_id;
  ELSIF p_kind = 'banner' THEN UPDATE players SET banner_id = p_template_id, updated_at = now() WHERE id = p_player_id;
  ELSIF p_kind = 'background' THEN UPDATE players SET background_id = p_template_id, updated_at = now() WHERE id = p_player_id;
  ELSE RAISE EXCEPTION 'invalid_kind'; END IF;
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'start_or_renew_game_session(uuid)', 'assert_game_session(uuid,uuid)',
    'save_progress(uuid,bigint,jsonb,integer,bigint,uuid,jsonb)', 'save_heroes_state(uuid,jsonb,uuid)',
    'mint_heroes(uuid,bigint,jsonb)', 'list_hero(uuid,text,numeric)', 'cancel_hero_listing(uuid,text)',
    'reserve_market_hero(uuid,text)', 'release_market_reservation(uuid,text)', 'submit_market_payment(uuid,text,text)',
    'settle_market_purchase(text,text,boolean)', 'request_withdrawal(uuid,bigint,text)', 'claim_pending_transactions(integer)',
    'set_hero_house(uuid,text,uuid,integer,integer)', 'unregister_house(uuid,uuid)', 'set_player_cosmetic(uuid,text,integer,integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

ALTER TABLE public.stage_maps ADD COLUMN IF NOT EXISTS damaged_nodes jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.save_progress_with_damage(p_player_id uuid, p_seed bigint, p_rewards jsonb, p_total_chests integer, p_new_seed bigint, p_session_token uuid, p_chests jsonb, p_damaged jsonb, p_expected_sync_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_map public.stage_maps%ROWTYPE; v_saved jsonb; v_key text; v_hp jsonb;
BEGIN
PERFORM 1 FROM public.players WHERE id=p_player_id FOR UPDATE;
PERFORM public.assert_game_session(p_player_id,p_session_token);
SELECT * INTO STRICT v_map FROM public.stage_maps WHERE player_id=p_player_id FOR UPDATE;
IF v_map.seed<>p_seed OR v_map.last_sync_at IS DISTINCT FROM p_expected_sync_at THEN
RETURN jsonb_build_object('coins',(SELECT coins FROM public.players WHERE id=p_player_id),'stage',v_map.stage,'seed',v_map.seed,'destroyed',to_jsonb(v_map.destroyed_nodes),'damaged',v_map.damaged_nodes,'accepted',0,'conflict',true);
END IF;
IF jsonb_typeof(p_damaged)<>'object' THEN RAISE EXCEPTION 'invalid_damage'; END IF;
v_saved:=public.save_progress(p_player_id,p_seed,p_rewards,p_total_chests,p_new_seed,p_session_token,p_chests);
SELECT * INTO STRICT v_map FROM public.stage_maps WHERE player_id=p_player_id;
IF v_map.seed<>p_seed THEN v_map.damaged_nodes:='{}'::jsonb;
ELSE
FOR v_key,v_hp IN SELECT key,value FROM jsonb_each(p_damaged) LOOP
IF v_key !~ '^\d{1,3},\d{1,3}$' OR jsonb_typeof(v_hp)<>'number' OR (v_hp::text)::numeric<1 OR (v_hp::text)::numeric<>trunc((v_hp::text)::numeric) THEN RAISE EXCEPTION 'invalid_damage'; END IF;
IF NOT (v_key=ANY(v_map.destroyed_nodes)) THEN
v_map.damaged_nodes:=jsonb_set(v_map.damaged_nodes,ARRAY[v_key],to_jsonb(least((v_hp::text)::integer,coalesce((v_map.damaged_nodes->>v_key)::integer,(v_hp::text)::integer))));
END IF;
END LOOP;
FOREACH v_key IN ARRAY v_map.destroyed_nodes LOOP v_map.damaged_nodes:=v_map.damaged_nodes-v_key; END LOOP;
END IF;
UPDATE public.stage_maps SET damaged_nodes=v_map.damaged_nodes WHERE player_id=p_player_id;
RETURN v_saved||jsonb_build_object('damaged',v_map.damaged_nodes,'conflict',false);
END $$;
REVOKE ALL ON FUNCTION public.save_progress_with_damage(uuid,bigint,jsonb,integer,bigint,uuid,jsonb,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_progress_with_damage(uuid,bigint,jsonb,integer,bigint,uuid,jsonb,jsonb,timestamptz) TO service_role;
-- ===== 0001_one_house_per_player.sql =====
CREATE OR REPLACE FUNCTION public.register_house(p_player_id uuid, p_nft_id text, p_rarity text, p_is_demo boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_owner uuid; v_existing uuid;
BEGIN
  SELECT player_id, id INTO v_owner, v_id FROM player_houses WHERE nft_id = p_nft_id;
  IF v_id IS NOT NULL THEN
    IF v_owner <> p_player_id THEN RAISE EXCEPTION 'house_taken'; END IF;
    RETURN v_id;
  END IF;
  SELECT id INTO v_existing FROM player_houses WHERE player_id = p_player_id LIMIT 1;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'one_house_only'; END IF;
  INSERT INTO player_houses (player_id, nft_id, rarity, is_demo) VALUES (p_player_id, p_nft_id, p_rarity, p_is_demo) RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
-- ===== 0002_leaderboard_snapshot.sql =====
CREATE OR REPLACE FUNCTION public.leaderboard_snapshot()
RETURNS TABLE (
  rank bigint,
  player_id uuid,
  username text,
  avatar_id integer,
  xp bigint,
  level integer,
  hero_count integer,
  hero_points bigint,
  score bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH roster AS (
    SELECT h.player_id,
           count(*)::integer AS hero_count,
           -- Rarity point values mirror HERO_RARITY_POINTS in src/lib/game/leaderboard/leaderboard.ts
           sum(CASE h.rarity
                 WHEN 'common' THEN 250
                 WHEN 'uncommon' THEN 750
                 WHEN 'rare' THEN 2500
                 WHEN 'epic' THEN 10000
                 WHEN 'legendary' THEN 50000
                 ELSE 0 END)::bigint AS hero_points
    FROM public.heroes h
    GROUP BY h.player_id
  ),
  scored AS (
    SELECT p.id AS player_id,
           COALESCE(NULLIF(p.username, ''), 'miner_' || substr(replace(p.id::text, '-', ''), 1, 8)) AS username,
           p.avatar_id,
           COALESCE(m.xp, 0)::bigint AS xp,
           COALESCE(r.hero_count, 0) AS hero_count,
           COALESCE(r.hero_points, 0)::bigint AS hero_points,
           (COALESCE(m.xp, 0) + COALESCE(r.hero_points, 0))::bigint AS score
    FROM public.players p
    LEFT JOIN public.player_milestones m ON m.player_id = p.id
    LEFT JOIN roster r ON r.player_id = p.id
    WHERE p.is_test = false
  )
  SELECT rank() OVER (ORDER BY s.score DESC, s.player_id) AS rank,
         s.player_id,
         s.username,
         s.avatar_id,
         s.xp,
         (floor(sqrt(s.xp / 1000.0)) + 1)::integer AS level,
         s.hero_count,
         s.hero_points,
         s.score
  FROM scored s
  ORDER BY s.score DESC, s.player_id;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_snapshot() TO service_role;
-- ===== 0003_verify_baseline.sql =====
COMMENT ON TABLE public.players IS 'Wallet-only game players';
-- ===== token_ledger_history (account history ledger) =====
-- Coin ledger: one row per coin change with the balance before and after.
CREATE TABLE IF NOT EXISTS public.token_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('transaction', 'gameplay', 'economy')),
  action text NOT NULL,
  amount bigint NOT NULL,
  balance_before bigint NOT NULL,
  balance_after bigint NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'processing', 'failed')),
  reference_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS token_ledger_player_idx ON public.token_ledger (player_id, id DESC);
CREATE INDEX IF NOT EXISTS token_ledger_player_category_idx ON public.token_ledger (player_id, category, id DESC);
REVOKE ALL ON public.token_ledger FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.token_ledger TO service_role;
ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ledger_record(p_player_id uuid, p_category text, p_action text, p_amount bigint,
  p_balance_after bigint, p_reference text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb, p_status text DEFAULT 'completed')
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  INSERT INTO token_ledger (player_id, category, action, amount, balance_before, balance_after, status, reference_id, metadata)
  VALUES (p_player_id, p_category, p_action, p_amount, p_balance_after - p_amount, p_balance_after, p_status, p_reference, coalesce(p_metadata, '{}'::jsonb));
$function$;

-- Gameplay rewards: syncs within one stage merge into a single row while no other coin change happened in between.
CREATE OR REPLACE FUNCTION public.ledger_stage_reward(p_player_id uuid, p_seed bigint, p_stage integer, p_gain bigint,
  p_balance_after bigint, p_xp bigint, p_chests jsonb, p_cleared boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_last token_ledger%ROWTYPE; v_ref text := p_seed::text;
BEGIN
  IF coalesce(p_gain, 0) <= 0 THEN RETURN; END IF;
  SELECT * INTO v_last FROM token_ledger WHERE player_id = p_player_id ORDER BY id DESC LIMIT 1;
  IF FOUND AND v_last.action = 'stage_rewards' AND v_last.reference_id = v_ref AND v_last.balance_after = p_balance_after - p_gain THEN
    UPDATE token_ledger SET amount = amount + p_gain, balance_after = p_balance_after, updated_at = now(),
      metadata = jsonb_build_object('stage', p_stage,
        'cleared', p_cleared OR coalesce((metadata ->> 'cleared')::boolean, false),
        'xp', coalesce((metadata ->> 'xp')::bigint, 0) + coalesce(p_xp, 0),
        'syncs', coalesce((metadata ->> 'syncs')::int, 1) + 1,
        'chests', (SELECT jsonb_object_agg(k, coalesce((metadata -> 'chests' ->> k)::int, 0) + coalesce((p_chests ->> k)::int, 0))
                   FROM unnest(ARRAY['common', 'uncommon', 'rare', 'epic', 'legendary']) AS k))
    WHERE id = v_last.id;
  ELSE
    INSERT INTO token_ledger (player_id, category, action, amount, balance_before, balance_after, reference_id, metadata)
    VALUES (p_player_id, 'gameplay', 'stage_rewards', p_gain, p_balance_after - p_gain, p_balance_after, v_ref,
      jsonb_build_object('stage', p_stage, 'cleared', p_cleared, 'xp', coalesce(p_xp, 0), 'syncs', 1, 'chests', coalesce(p_chests, '{}'::jsonb)));
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.save_progress(p_player_id uuid, p_seed bigint, p_rewards jsonb, p_total_chests integer, p_new_seed bigint, p_session_token uuid, p_chests jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_map stage_maps%ROWTYPE; v_key text; v_amt jsonb; v_amount bigint; v_accepted int := 0; v_gain bigint := 0;
  v_chest jsonb; v_rarity text; v_xp bigint := 0; v_gold bigint := 0; v_count int := 0; v_balance bigint;
  c_common int := 0; c_uncommon int := 0; c_rare int := 0; c_epic int := 0; c_legendary int := 0;
BEGIN
  PERFORM 1 FROM players WHERE id = p_player_id FOR UPDATE;
  PERFORM assert_game_session(p_player_id, p_session_token);
  SELECT * INTO STRICT v_map FROM stage_maps WHERE player_id = p_player_id FOR UPDATE;
  IF v_map.seed = p_seed THEN
    FOR v_key, v_amt IN SELECT key, value FROM jsonb_each(coalesce(p_rewards, '{}'::jsonb)) LOOP
      IF v_key !~ '^\d{1,3},\d{1,3}$' OR v_key = ANY(v_map.destroyed_nodes) THEN CONTINUE; END IF;
      v_amount := greatest(0, coalesce((v_amt #>> '{}')::numeric, 0))::bigint;
      v_map.destroyed_nodes := array_append(v_map.destroyed_nodes, v_key);
      v_accepted := v_accepted + 1;
      v_gain := v_gain + v_amount;
      v_chest := coalesce(p_chests, '{}'::jsonb) -> v_key;
      IF v_chest IS NOT NULL THEN
        v_rarity := v_chest ->> 'rarity';
        v_xp := v_xp + greatest(0, coalesce((v_chest ->> 'hp')::numeric, 0))::bigint;
        v_gold := v_gold + v_amount;
        v_count := v_count + 1;
        CASE v_rarity WHEN 'uncommon' THEN c_uncommon := c_uncommon + 1; WHEN 'rare' THEN c_rare := c_rare + 1;
          WHEN 'epic' THEN c_epic := c_epic + 1; WHEN 'legendary' THEN c_legendary := c_legendary + 1;
          ELSE c_common := c_common + 1; END CASE;
      END IF;
    END LOOP;
    UPDATE players SET coins = coins + v_gain, updated_at = now() WHERE id = p_player_id RETURNING coins INTO v_balance;
    PERFORM ledger_stage_reward(p_player_id, p_seed, v_map.stage, v_gain, v_balance, v_xp,
      jsonb_build_object('common', c_common, 'uncommon', c_uncommon, 'rare', c_rare, 'epic', c_epic, 'legendary', c_legendary),
      p_new_seed > 0);
    IF v_count > 0 THEN
      INSERT INTO player_milestones AS m (player_id, xp, level, total_gold_claimed, total_chests, chests_common, chests_uncommon, chests_rare, chests_epic, chests_legendary)
      VALUES (p_player_id, v_xp, floor(sqrt(v_xp / 1000.0))::int + 1, v_gold, v_count, c_common, c_uncommon, c_rare, c_epic, c_legendary)
      ON CONFLICT (player_id) DO UPDATE SET
        xp = m.xp + v_xp, level = floor(sqrt((m.xp + v_xp) / 1000.0))::int + 1,
        total_gold_claimed = m.total_gold_claimed + v_gold, total_chests = m.total_chests + v_count,
        chests_common = m.chests_common + c_common, chests_uncommon = m.chests_uncommon + c_uncommon,
        chests_rare = m.chests_rare + c_rare, chests_epic = m.chests_epic + c_epic,
        chests_legendary = m.chests_legendary + c_legendary, updated_at = now();
    END IF;
    IF p_new_seed > 0 THEN
      v_map.stage := v_map.stage + 1; v_map.seed := p_new_seed; v_map.destroyed_nodes := '{}';
      v_map.damaged_nodes := '{}'::jsonb;
    END IF;
    UPDATE stage_maps SET stage = v_map.stage, seed = v_map.seed, destroyed_nodes = v_map.destroyed_nodes,
      damaged_nodes = v_map.damaged_nodes, last_sync_at = now(), updated_at = now() WHERE player_id = p_player_id;
  END IF;
  RETURN jsonb_build_object('coins', (SELECT coins FROM players WHERE id = p_player_id), 'stage', v_map.stage,
    'seed', v_map.seed, 'destroyed', to_jsonb(v_map.destroyed_nodes), 'accepted', v_accepted);
END $function$;

CREATE OR REPLACE FUNCTION public.mint_heroes(p_player_id uuid, p_cost bigint, p_heroes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_coins bigint; v_h jsonb; v_row heroes%ROWTYPE; v_out jsonb := '[]'::jsonb;
BEGIN
  IF p_cost < 0 OR jsonb_typeof(p_heroes) <> 'array' OR jsonb_array_length(p_heroes) = 0 THEN RAISE EXCEPTION 'invalid_mint'; END IF;
  SELECT coins INTO v_coins FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_player'; END IF;
  IF v_coins < p_cost THEN RAISE EXCEPTION 'not_enough_coins'; END IF;
  UPDATE players SET coins = coins - p_cost, updated_at = now() WHERE id = p_player_id RETURNING coins INTO v_coins;
  FOR v_h IN SELECT * FROM jsonb_array_elements(p_heroes) LOOP
    IF coalesce((v_h ->> 'level')::int, 1) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'invalid_mint_level'; END IF;
    INSERT INTO heroes (player_id, name, level, rarity, power, speed, stamina, bomb_number, bomb_range, max_energy, energy, skills)
    VALUES (p_player_id, v_h ->> 'type', coalesce((v_h ->> 'level')::int, 1), v_h ->> 'rarity', (v_h ->> 'power')::int, (v_h ->> 'speed')::int,
      (v_h ->> 'stamina')::int, (v_h ->> 'bombNumber')::int, (v_h ->> 'bombRange')::int,
      (v_h ->> 'maxEnergy')::int, (v_h ->> 'maxEnergy')::int,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(v_h -> 'skills', '[]'::jsonb))), '{}'))
    RETURNING * INTO v_row;
    v_out := v_out || jsonb_build_object('id', v_row.id, 'name', v_row.name, 'type', v_row.name, 'level', v_row.level,
      'rarity', v_row.rarity, 'power', v_row.power, 'speed', v_row.speed, 'stamina', v_row.stamina,
      'bombNumber', v_row.bomb_number, 'bombRange', v_row.bomb_range, 'maxEnergy', v_row.max_energy,
      'skills', to_jsonb(v_row.skills), 'energy', v_row.energy, 'onMap', false,
      'recoveryAt', floor(extract(epoch FROM v_row.recovery_at) * 1000), 'listed', false);
  END LOOP;
  PERFORM ledger_record(p_player_id, 'economy', 'mint_hero', -p_cost, v_coins, NULL,
    jsonb_build_object('count', jsonb_array_length(v_out), 'heroes',
      (SELECT jsonb_agg(jsonb_build_object('name', h ->> 'name', 'rarity', h ->> 'rarity', 'level', (h ->> 'level')::int)) FROM jsonb_array_elements(v_out) h)));
  RETURN jsonb_build_object('coins', v_coins, 'heroes', v_out);
END $function$;

CREATE OR REPLACE FUNCTION public.level_up_hero(p_player_id uuid, p_hero_id text, p_cost bigint, p_expected_level integer, p_stats jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_coins bigint; v_h heroes%ROWTYPE; v_gain integer;
BEGIN
  IF p_cost < 0 THEN RAISE EXCEPTION 'invalid_cost'; END IF;
  SELECT * INTO v_h FROM heroes WHERE id = p_hero_id AND player_id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_hero'; END IF;
  IF v_h.is_listed THEN RAISE EXCEPTION 'hero_listed'; END IF;
  IF v_h.level <> p_expected_level OR (p_stats ->> 'level')::int <> p_expected_level + 1 THEN RAISE EXCEPTION 'level_changed'; END IF;
  SELECT coins INTO v_coins FROM players WHERE id = p_player_id FOR UPDATE;
  IF v_coins < p_cost THEN RAISE EXCEPTION 'not_enough_coins'; END IF;
  UPDATE players SET coins = coins - p_cost, updated_at = now() WHERE id = p_player_id RETURNING coins INTO v_coins;
  v_gain := greatest(0, (p_stats ->> 'maxEnergy')::int - v_h.max_energy);
  UPDATE heroes SET level = (p_stats ->> 'level')::int, power = (p_stats ->> 'power')::int, speed = (p_stats ->> 'speed')::int,
    stamina = (p_stats ->> 'stamina')::int, bomb_number = (p_stats ->> 'bombNumber')::int, bomb_range = (p_stats ->> 'bombRange')::int,
    max_energy = (p_stats ->> 'maxEnergy')::int, energy = least((p_stats ->> 'maxEnergy')::int, energy + v_gain), updated_at = now()
  WHERE id = p_hero_id RETURNING * INTO v_h;
  PERFORM ledger_record(p_player_id, 'economy', 'level_up', -p_cost, v_coins, p_hero_id,
    jsonb_build_object('hero', v_h.name, 'rarity', v_h.rarity, 'fromLevel', p_expected_level, 'toLevel', v_h.level));
  RETURN jsonb_build_object('coins', v_coins, 'energy', v_h.energy);
END $function$;

CREATE OR REPLACE FUNCTION public.fuse_heroes(p_player_id uuid, p_hero_ids text[], p_rarity text, p_fee bigint, p_daily_limit integer, p_success boolean, p_burn_id text, p_new_hero jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_coins bigint; v_count integer; v_row heroes%ROWTYPE; v_burned text;
BEGIN
  IF p_fee < 0 OR array_length(p_hero_ids, 1) <> 3 OR NOT (p_burn_id = ANY(p_hero_ids)) THEN RAISE EXCEPTION 'invalid_fusion'; END IF;
  SELECT coins INTO v_coins FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_player'; END IF;
  SELECT count(*) INTO v_count FROM (SELECT id FROM heroes WHERE id = ANY(p_hero_ids) AND player_id = p_player_id AND rarity = p_rarity
    AND NOT is_listed AND NOT on_map AND house_id IS NULL AND reserved_by IS NULL FOR UPDATE) locked;
  IF v_count <> 3 THEN RAISE EXCEPTION 'heroes_unavailable'; END IF;
  SELECT count(*) INTO v_count FROM hero_fusions WHERE player_id = p_player_id AND created_at >= date_trunc('day', now());
  IF v_count >= p_daily_limit THEN RAISE EXCEPTION 'fusion_limit'; END IF;
  IF v_coins < p_fee THEN RAISE EXCEPTION 'not_enough_coins'; END IF;
  UPDATE players SET coins = coins - p_fee, updated_at = now() WHERE id = p_player_id RETURNING coins INTO v_coins;
  INSERT INTO hero_fusions (player_id, rarity, success) VALUES (p_player_id, p_rarity, p_success);
  IF NOT p_success THEN
    SELECT name INTO v_burned FROM heroes WHERE id = p_burn_id AND player_id = p_player_id;
    DELETE FROM heroes WHERE id = p_burn_id AND player_id = p_player_id;
    PERFORM ledger_record(p_player_id, 'economy', 'fusion', -p_fee, v_coins, p_burn_id,
      jsonb_build_object('rarity', p_rarity, 'success', false, 'lostHero', v_burned));
    RETURN jsonb_build_object('coins', v_coins, 'success', false, 'burnedId', p_burn_id);
  END IF;
  DELETE FROM heroes WHERE id = ANY(p_hero_ids) AND player_id = p_player_id;
  INSERT INTO heroes (player_id, name, level, rarity, power, speed, stamina, bomb_number, bomb_range, max_energy, energy)
  VALUES (p_player_id, p_new_hero ->> 'type', (p_new_hero ->> 'level')::int, p_new_hero ->> 'rarity', (p_new_hero ->> 'power')::int,
    (p_new_hero ->> 'speed')::int, (p_new_hero ->> 'stamina')::int, (p_new_hero ->> 'bombNumber')::int, (p_new_hero ->> 'bombRange')::int,
    (p_new_hero ->> 'maxEnergy')::int, (p_new_hero ->> 'maxEnergy')::int)
  RETURNING * INTO v_row;
  PERFORM ledger_record(p_player_id, 'economy', 'fusion', -p_fee, v_coins, v_row.id,
    jsonb_build_object('rarity', p_rarity, 'success', true, 'hero', v_row.name, 'heroRarity', v_row.rarity, 'heroLevel', v_row.level));
  RETURN jsonb_build_object('coins', v_coins, 'success', true, 'hero', jsonb_build_object('id', v_row.id, 'name', v_row.name, 'type', v_row.name,
    'level', v_row.level, 'rarity', v_row.rarity, 'power', v_row.power, 'speed', v_row.speed, 'stamina', v_row.stamina,
    'bombNumber', v_row.bomb_number, 'bombRange', v_row.bomb_range, 'maxEnergy', v_row.max_energy, 'skills', to_jsonb(v_row.skills),
    'energy', v_row.energy, 'onMap', false, 'recoveryAt', floor(extract(epoch FROM v_row.recovery_at) * 1000), 'listed', false));
END $function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_player_id uuid, p_amount bigint, p_address text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_coins bigint; v_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR coalesce(p_address, '') = '' THEN RAISE EXCEPTION 'invalid_withdrawal'; END IF;
  SELECT coins INTO v_coins FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_player'; END IF;
  IF v_coins < p_amount THEN RAISE EXCEPTION 'not_enough_coins'; END IF;
  UPDATE players SET coins = coins - p_amount, updated_at = now() WHERE id = p_player_id RETURNING coins INTO v_coins;
  INSERT INTO transactions_pending (player_id, action, payload)
  VALUES (p_player_id, 'withdrawal', jsonb_build_object('address', p_address, 'amount', p_amount))
  RETURNING id INTO v_id;
  PERFORM ledger_record(p_player_id, 'transaction', 'withdrawal', -p_amount, v_coins, v_id::text,
    jsonb_build_object('address', p_address), 'processing');
  RETURN jsonb_build_object('coins', v_coins, 'transaction_id', v_id);
END $function$;

CREATE OR REPLACE FUNCTION public.settle_market_purchase(p_hero_id text, p_tx text, p_success boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v heroes%ROWTYPE; v_meta jsonb;
BEGIN
  IF p_success THEN
    SELECT * INTO v FROM heroes WHERE id = p_hero_id AND purchase_tx = p_tx AND reserved_by IS NOT NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'unknown_purchase'; END IF;
    UPDATE heroes SET player_id = reserved_by, is_listed = false, market_price = NULL, listed_at = NULL,
      reserved_by = NULL, reserved_until = NULL, purchase_tx = NULL, on_map = false, house_id = NULL, updated_at = now()
    WHERE id = p_hero_id;
    -- Market trades are paid by wallet transfer, so coin balances do not change; the trade is still recorded.
    v_meta := jsonb_build_object('hero', v.name, 'rarity', v.rarity, 'level', v.level, 'price', v.market_price, 'heroId', v.id);
    PERFORM ledger_record(v.reserved_by, 'economy', 'market_purchase', 0, (SELECT coins FROM players WHERE id = v.reserved_by), p_tx,
      v_meta || jsonb_build_object('seller', (SELECT username FROM players WHERE id = v.player_id)));
    PERFORM ledger_record(v.player_id, 'economy', 'market_sale', 0, (SELECT coins FROM players WHERE id = v.player_id), p_tx,
      v_meta || jsonb_build_object('buyer', (SELECT username FROM players WHERE id = v.reserved_by)));
  ELSE
    UPDATE heroes SET reserved_by = NULL, reserved_until = NULL, purchase_tx = NULL, updated_at = now()
    WHERE id = p_hero_id AND purchase_tx = p_tx;
    IF NOT FOUND THEN RAISE EXCEPTION 'unknown_purchase'; END IF;
  END IF;
END $function$;

-- One page of a player's ledger plus totals for the active filter.
CREATE OR REPLACE FUNCTION public.list_ledger(p_player_id uuid, p_category text, p_since timestamptz, p_limit integer, p_offset integer)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH f AS (
    SELECT l.* FROM token_ledger l
    WHERE l.player_id = p_player_id
      AND (p_category IS NULL OR l.category = p_category)
      AND (p_since IS NULL OR l.updated_at >= p_since)
  ), page AS (
    SELECT f.*, q.status AS queue_status FROM f
    LEFT JOIN LATERAL (
      SELECT CASE WHEN f.action = 'withdrawal' AND f.reference_id ~ '^[0-9a-f-]{36}$' THEN coalesce(
        (SELECT x.status FROM transactions_processed x WHERE x.pending_id = f.reference_id::uuid ORDER BY x.created_at DESC LIMIT 1),
        (SELECT t.status FROM transactions_pending t WHERE t.id = f.reference_id::uuid)) END AS status
    ) q ON true
    ORDER BY f.id DESC
    LIMIT greatest(1, least(coalesce(p_limit, 30), 100)) OFFSET greatest(0, coalesce(p_offset, 0))
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM f),
    'net', (SELECT coalesce(sum(amount), 0) FROM f),
    'records', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'category', category, 'action', action, 'amount', amount,
      'balanceBefore', balance_before, 'balanceAfter', balance_after, 'status', status, 'queueStatus', queue_status,
      'reference', reference_id, 'metadata', metadata, 'createdAt', created_at, 'updatedAt', updated_at) ORDER BY id DESC) FROM page), '[]'::jsonb));
$function$;

REVOKE ALL ON FUNCTION public.ledger_record(uuid, text, text, bigint, bigint, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_record(uuid, text, text, bigint, bigint, text, jsonb, text) TO service_role;
REVOKE ALL ON FUNCTION public.ledger_stage_reward(uuid, bigint, integer, bigint, bigint, bigint, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_stage_reward(uuid, bigint, integer, bigint, bigint, bigint, jsonb, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.list_ledger(uuid, text, timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_ledger(uuid, text, timestamptz, integer, integer) TO service_role;
CREATE OR REPLACE FUNCTION public.buy_market_hero(p_buyer_id uuid, p_hero_id text, p_expected_price bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_seller uuid; v_h heroes%ROWTYPE; v_price bigint; v_fee bigint; v_net bigint; v_buyer_balance bigint; v_seller_balance bigint; v_ref text := gen_random_uuid()::text; v_meta jsonb;
BEGIN
  SELECT player_id INTO v_seller FROM heroes WHERE id = p_hero_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'hero_unavailable'; END IF;
  IF v_seller = p_buyer_id THEN RAISE EXCEPTION 'self_purchase'; END IF;
  -- Match player-first save/fusion operations; consistently order both wallets.
  PERFORM id FROM players WHERE id IN (p_buyer_id, v_seller) ORDER BY id FOR UPDATE;
  SELECT coins INTO v_buyer_balance FROM players WHERE id = p_buyer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_player'; END IF;
  SELECT * INTO v_h FROM heroes WHERE id = p_hero_id FOR UPDATE;
  IF NOT FOUND OR NOT v_h.is_listed OR v_h.player_id <> v_seller OR v_h.purchase_tx IS NOT NULL OR v_h.on_map OR v_h.house_id IS NOT NULL THEN RAISE EXCEPTION 'hero_unavailable'; END IF;
  IF v_h.market_price IS NULL OR v_h.market_price <= 0 OR v_h.market_price > 9007199254740991 OR v_h.market_price <> trunc(v_h.market_price) THEN RAISE EXCEPTION 'invalid_price'; END IF;
  v_price := v_h.market_price::bigint;
  IF p_expected_price IS NULL OR p_expected_price <> v_price THEN RAISE EXCEPTION 'price_changed'; END IF;
  IF v_buyer_balance < v_price THEN RAISE EXCEPTION 'not_enough_coins'; END IF;
  -- Round the 5% burn upward because balances are whole coins.
  v_fee := ceil(v_price::numeric / 20)::bigint;
  v_net := v_price - v_fee;
  IF (SELECT coins::numeric + v_net FROM players WHERE id = v_seller) > 9007199254740991 THEN RAISE EXCEPTION 'balance_limit'; END IF;
  UPDATE players SET coins = coins - v_price, updated_at = now() WHERE id = p_buyer_id RETURNING coins INTO v_buyer_balance;
  UPDATE players SET coins = coins + v_net, updated_at = now() WHERE id = v_seller RETURNING coins INTO v_seller_balance;
  UPDATE heroes SET player_id = p_buyer_id, is_listed = false, market_price = NULL, listed_at = NULL, reserved_by = NULL, reserved_until = NULL, purchase_tx = NULL, on_map = false, house_id = NULL, recovery_at = now(), updated_at = now() WHERE id = p_hero_id RETURNING * INTO v_h;
  v_meta := jsonb_build_object('hero', v_h.name, 'heroId', v_h.id, 'rarity', v_h.rarity, 'level', v_h.level, 'price', v_price, 'feePercent', 5, 'feeBurned', v_fee, 'sellerProceeds', v_net, 'payment', 'coins');
  PERFORM ledger_record(p_buyer_id, 'economy', 'market_purchase', -v_price, v_buyer_balance, v_ref, v_meta || jsonb_build_object('seller', (SELECT username FROM players WHERE id = v_seller)));
  PERFORM ledger_record(v_seller, 'economy', 'market_sale', v_net, v_seller_balance, v_ref, v_meta || jsonb_build_object('buyer', (SELECT username FROM players WHERE id = p_buyer_id)));
  RETURN jsonb_build_object('coins', v_buyer_balance, 'fee', v_fee, 'proceeds', v_net, 'reference', v_ref, 'hero', jsonb_build_object('id', v_h.id, 'name', v_h.name, 'type', v_h.name, 'rarity', v_h.rarity, 'level', v_h.level, 'power', v_h.power, 'speed', v_h.speed, 'stamina', v_h.stamina, 'bombNumber', v_h.bomb_number, 'bombRange', v_h.bomb_range, 'maxEnergy', v_h.max_energy, 'energy', v_h.energy, 'skills', to_jsonb(v_h.skills), 'onMap', false, 'listed', false, 'recoveryAt', floor(extract(epoch FROM v_h.recovery_at) * 1000)));
END $$;
REVOKE ALL ON FUNCTION public.buy_market_hero(uuid,text,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_market_hero(uuid,text,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.list_hero(p_player_id uuid, p_hero_id text, p_price numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_price IS NULL OR p_price <= 0 OR p_price > 9007199254740991 OR p_price <> trunc(p_price) THEN RAISE EXCEPTION 'cannot_list'; END IF;
  UPDATE heroes SET is_listed = true, market_price = p_price, listed_at = now(), reserved_by = NULL, reserved_until = NULL, updated_at = now()
  WHERE id = p_hero_id AND player_id = p_player_id AND NOT on_map AND house_id IS NULL AND NOT is_listed AND purchase_tx IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'cannot_list'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.cancel_hero_listing(p_player_id uuid, p_hero_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE heroes SET is_listed = false, market_price = NULL, listed_at = NULL, reserved_by = NULL, reserved_until = NULL, updated_at = now()
  WHERE id = p_hero_id AND player_id = p_player_id AND is_listed AND purchase_tx IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'hero_unavailable'; END IF;
END $$;
-- Block stale clients from opening new blockchain payments; keep settlement for already-submitted transfers.
CREATE OR REPLACE FUNCTION public.reserve_market_hero(p_buyer_id uuid, p_hero_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'market_uses_coins'; END $$;
CREATE OR REPLACE FUNCTION public.submit_market_payment(p_buyer_id uuid, p_hero_id text, p_tx text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'market_uses_coins'; END $$;
COMMENT ON COLUMN public.heroes.reserved_by IS 'DEPRECATED: only retained for previously submitted blockchain purchases; new trades use buy_market_hero.';
COMMENT ON COLUMN public.heroes.reserved_until IS 'DEPRECATED: new coin purchases have no timed reservation.';
COMMENT ON COLUMN public.heroes.purchase_tx IS 'DEPRECATED: retained only to settle previously submitted blockchain purchases.';
COMMENT ON FUNCTION public.reserve_market_hero(uuid,text) IS 'DEPRECATED: disabled; use buy_market_hero.';
COMMENT ON FUNCTION public.submit_market_payment(uuid,text,text) IS 'DEPRECATED: disabled; use buy_market_hero.';
COMMENT ON FUNCTION public.settle_market_purchase(text,text,boolean) IS 'DEPRECATED: retained only for previously submitted blockchain payments.';
-- Blockchain bridge (deposits & withdrawals) --------------------------------
ALTER TABLE public.transactions_pending
  ADD CONSTRAINT transactions_pending_action_check CHECK (action = 'withdrawal');
CREATE INDEX IF NOT EXISTS transactions_pending_claim_idx
  ON public.transactions_pending (status, locked_at, created_at);
ALTER TABLE public.transactions_processed
  ADD CONSTRAINT transactions_processed_action_check CHECK (action IN ('deposit', 'withdrawal'));
CREATE UNIQUE INDEX IF NOT EXISTS transactions_processed_tx_hash_key
  ON public.transactions_processed (tx_hash) WHERE tx_hash IS NOT NULL;
ALTER TABLE public.transactions_processed
  ADD CONSTRAINT transactions_processed_pending_id_fkey
  FOREIGN KEY (pending_id) REFERENCES public.transactions_pending (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.process_deposit(p_player_id uuid, p_amount bigint, p_tx_hash text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_coins bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR coalesce(p_tx_hash, '') = '' THEN RAISE EXCEPTION 'invalid_deposit'; END IF;
  IF EXISTS (SELECT 1 FROM transactions_processed WHERE tx_hash = p_tx_hash) THEN
    SELECT coins INTO v_coins FROM players WHERE id = p_player_id;
    RETURN jsonb_build_object('credited', false, 'coins', v_coins, 'txHash', p_tx_hash);
  END IF;
  UPDATE players SET coins = coins + p_amount, updated_at = now() WHERE id = p_player_id RETURNING coins INTO v_coins;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_player'; END IF;
  INSERT INTO transactions_processed (player_id, action, status, result, tx_hash)
  VALUES (p_player_id, 'deposit', 'completed', coalesce(p_metadata, '{}'::jsonb), p_tx_hash);
  PERFORM ledger_record(p_player_id, 'transaction', 'deposit', p_amount, v_coins, p_tx_hash,
    coalesce(p_metadata, '{}'::jsonb), 'completed');
  RETURN jsonb_build_object('credited', true, 'coins', v_coins, 'txHash', p_tx_hash);
END $$;

CREATE OR REPLACE FUNCTION public.settle_withdrawal(p_pending_id uuid, p_status text, p_tx_hash text DEFAULT NULL, p_error_reason text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v transactions_pending%ROWTYPE; v_coins bigint; v_amount bigint;
BEGIN
  IF p_status NOT IN ('completed', 'failed') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT * INTO v FROM transactions_pending WHERE id = p_pending_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_pending'; END IF;
  v_amount := coalesce((v.payload ->> 'amount')::bigint, 0);
  IF p_status = 'completed' THEN
    IF coalesce(p_tx_hash, '') = '' THEN RAISE EXCEPTION 'missing_tx_hash'; END IF;
    INSERT INTO transactions_processed (pending_id, player_id, action, status, result, tx_hash)
    VALUES (v.id, v.player_id, 'withdrawal', 'completed',
      jsonb_build_object('pendingId', v.id, 'address', v.payload ->> 'address', 'amount', v_amount) || coalesce(p_metadata, '{}'::jsonb), p_tx_hash);
    DELETE FROM transactions_pending WHERE id = v.id;
    UPDATE token_ledger SET status = 'completed', updated_at = now(),
      metadata = metadata || jsonb_build_object('txHash', p_tx_hash) || coalesce(p_metadata, '{}'::jsonb)
    WHERE reference_id = v.id::text AND category = 'transaction' AND action = 'withdrawal';
    SELECT coins INTO v_coins FROM players WHERE id = v.player_id;
    RETURN jsonb_build_object('status', 'completed', 'coins', v_coins, 'txHash', p_tx_hash);
  END IF;
  UPDATE players SET coins = coins + v_amount, updated_at = now() WHERE id = v.player_id RETURNING coins INTO v_coins;
  INSERT INTO transactions_processed (pending_id, player_id, action, status, result, tx_hash)
  VALUES (v.id, v.player_id, 'withdrawal', 'failed',
    jsonb_build_object('pendingId', v.id, 'address', v.payload ->> 'address', 'amount', v_amount, 'error', p_error_reason) || coalesce(p_metadata, '{}'::jsonb), p_tx_hash);
  DELETE FROM transactions_pending WHERE id = v.id;
  UPDATE token_ledger SET status = 'failed', updated_at = now(),
    metadata = metadata || jsonb_build_object('error', coalesce(p_error_reason, 'payout_failed'), 'refunded', true)
  WHERE reference_id = v.id::text AND category = 'transaction' AND action = 'withdrawal';
  RETURN jsonb_build_object('status', 'failed', 'coins', v_coins, 'refunded', v_amount);
END $$;

CREATE OR REPLACE FUNCTION public.settle_market_purchase(p_hero_id text, p_tx text, p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'market_uses_coins';
END $$;
COMMENT ON FUNCTION public.settle_market_purchase(text, text, boolean) IS 'DEPRECATED: marketplace purchases are paid in coins via buy_market_hero; no blockchain settlement remains.';

REVOKE ALL ON FUNCTION public.process_deposit(uuid, bigint, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_deposit(uuid, bigint, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.settle_withdrawal(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_withdrawal(uuid, text, text, text, jsonb) TO service_role;
-- ===== hero_soft_burn_and_fusion =====
-- Hero soft-burn: fused heroes stay in the table as permanent provenance instead of being deleted.
ALTER TABLE public.heroes
  ADD COLUMN IF NOT EXISTS is_burned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS burned_at timestamptz;

-- Active-roster queries skip burned heroes; burn history stays quickly readable.
CREATE INDEX IF NOT EXISTS heroes_active_player_idx ON public.heroes (player_id) WHERE NOT is_burned;
CREATE INDEX IF NOT EXISTS heroes_burned_player_idx ON public.heroes (player_id, burned_at) WHERE is_burned;

-- Fusion: daily limit counted from the token ledger, soft-burn instead of DELETE.
CREATE OR REPLACE FUNCTION public.fuse_heroes(p_player_id uuid, p_hero_ids text[], p_rarity text, p_fee bigint, p_daily_limit integer, p_success boolean, p_burn_id text, p_new_hero jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_coins bigint; v_count integer; v_row heroes%ROWTYPE; v_burned text;
BEGIN
  IF p_fee < 0 OR array_length(p_hero_ids, 1) <> 3 OR NOT (p_burn_id = ANY(p_hero_ids)) THEN RAISE EXCEPTION 'invalid_fusion'; END IF;
  SELECT coins INTO v_coins FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_player'; END IF;
  SELECT count(*) INTO v_count FROM (SELECT id FROM heroes WHERE id = ANY(p_hero_ids) AND player_id = p_player_id AND rarity = p_rarity
    AND NOT is_burned AND NOT is_listed AND NOT on_map AND house_id IS NULL AND reserved_by IS NULL FOR UPDATE) locked;
  IF v_count <> 3 THEN RAISE EXCEPTION 'heroes_unavailable'; END IF;
  SELECT count(*) INTO v_count FROM token_ledger WHERE player_id = p_player_id AND action = 'fusion' AND created_at >= date_trunc('day', now());
  IF v_count >= p_daily_limit THEN RAISE EXCEPTION 'fusion_limit'; END IF;
  IF v_coins < p_fee THEN RAISE EXCEPTION 'not_enough_coins'; END IF;
  UPDATE players SET coins = coins - p_fee, updated_at = now() WHERE id = p_player_id RETURNING coins INTO v_coins;
  IF NOT p_success THEN
    SELECT name INTO v_burned FROM heroes WHERE id = p_burn_id AND player_id = p_player_id;
    UPDATE heroes SET is_burned = true, burned_at = now(), on_map = false, house_id = NULL, is_listed = false, updated_at = now()
    WHERE id = p_burn_id AND player_id = p_player_id;
    PERFORM ledger_record(p_player_id, 'economy', 'fusion', -p_fee, v_coins, p_burn_id,
      jsonb_build_object('rarity', p_rarity, 'success', false, 'burnedHeroId', p_burn_id, 'burnedHeroName', v_burned));
    RETURN jsonb_build_object('coins', v_coins, 'success', false, 'burnedId', p_burn_id);
  END IF;
  UPDATE heroes SET is_burned = true, burned_at = now(), on_map = false, house_id = NULL, is_listed = false, updated_at = now()
  WHERE id = ANY(p_hero_ids) AND player_id = p_player_id;
  INSERT INTO heroes (player_id, name, level, rarity, power, speed, stamina, bomb_number, bomb_range, max_energy, energy)
  VALUES (p_player_id, p_new_hero ->> 'type', (p_new_hero ->> 'level')::int, p_new_hero ->> 'rarity', (p_new_hero ->> 'power')::int,
    (p_new_hero ->> 'speed')::int, (p_new_hero ->> 'stamina')::int, (p_new_hero ->> 'bombNumber')::int, (p_new_hero ->> 'bombRange')::int,
    (p_new_hero ->> 'maxEnergy')::int, (p_new_hero ->> 'maxEnergy')::int)
  RETURNING * INTO v_row;
  PERFORM ledger_record(p_player_id, 'economy', 'fusion', -p_fee, v_coins, v_row.id,
    jsonb_build_object('rarity', p_rarity, 'success', true, 'hero', v_row.name, 'heroRarity', v_row.rarity, 'heroLevel', v_row.level,
      'newHeroId', v_row.id, 'burnedHeroIds', to_jsonb(p_hero_ids)));
  RETURN jsonb_build_object('coins', v_coins, 'success', true, 'hero', jsonb_build_object('id', v_row.id, 'name', v_row.name, 'type', v_row.name,
    'level', v_row.level, 'rarity', v_row.rarity, 'power', v_row.power, 'speed', v_row.speed, 'stamina', v_row.stamina,
    'bombNumber', v_row.bomb_number, 'bombRange', v_row.bomb_range, 'maxEnergy', v_row.max_energy, 'skills', to_jsonb(v_row.skills),
    'energy', v_row.energy, 'onMap', false, 'recoveryAt', floor(extract(epoch FROM v_row.recovery_at) * 1000), 'listed', false));
END $function$;

-- Burned heroes can never be leveled up.
CREATE OR REPLACE FUNCTION public.level_up_hero(p_player_id uuid, p_hero_id text, p_cost bigint, p_expected_level integer, p_stats jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_coins bigint; v_h heroes%ROWTYPE; v_gain integer;
BEGIN
  IF p_cost < 0 THEN RAISE EXCEPTION 'invalid_cost'; END IF;
  -- Upgrade price must equal current level squared x 5,000 coins (levels 1-9).
  IF p_expected_level IS NULL OR p_expected_level < 1 OR p_expected_level >= 10
     OR p_cost <> (p_expected_level::bigint * p_expected_level * 5000) THEN
    RAISE EXCEPTION 'invalid_level_up_cost';
  END IF;
  SELECT * INTO v_h FROM heroes WHERE id = p_hero_id AND player_id = p_player_id FOR UPDATE;
  IF NOT FOUND OR v_h.is_burned THEN RAISE EXCEPTION 'unknown_hero'; END IF;
  IF v_h.is_listed THEN RAISE EXCEPTION 'hero_listed'; END IF;
  IF v_h.level <> p_expected_level OR (p_stats ->> 'level')::int <> p_expected_level + 1 THEN RAISE EXCEPTION 'level_changed'; END IF;
  SELECT coins INTO v_coins FROM players WHERE id = p_player_id FOR UPDATE;
  IF v_coins < p_cost THEN RAISE EXCEPTION 'not_enough_coins'; END IF;
  UPDATE players SET coins = coins - p_cost, updated_at = now() WHERE id = p_player_id RETURNING coins INTO v_coins;
  v_gain := greatest(0, (p_stats ->> 'maxEnergy')::int - v_h.max_energy);
  UPDATE heroes SET level = (p_stats ->> 'level')::int, power = (p_stats ->> 'power')::int, speed = (p_stats ->> 'speed')::int,
    stamina = (p_stats ->> 'stamina')::int, bomb_number = (p_stats ->> 'bombNumber')::int, bomb_range = (p_stats ->> 'bombRange')::int,
    max_energy = (p_stats ->> 'maxEnergy')::int, energy = least((p_stats ->> 'maxEnergy')::int, energy + v_gain), updated_at = now()
  WHERE id = p_hero_id RETURNING * INTO v_h;
  PERFORM ledger_record(p_player_id, 'economy', 'level_up', -p_cost, v_coins, p_hero_id,
    jsonb_build_object('hero', v_h.name, 'rarity', v_h.rarity, 'fromLevel', p_expected_level, 'toLevel', v_h.level));
  RETURN jsonb_build_object('coins', v_coins, 'energy', v_h.energy);
END $function$;

-- Burned heroes can never be listed on the market.
CREATE OR REPLACE FUNCTION public.list_hero(p_player_id uuid, p_hero_id text, p_price numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_price IS NULL OR p_price <= 0 OR p_price > 9007199254740991 OR p_price <> trunc(p_price) THEN RAISE EXCEPTION 'cannot_list'; END IF;
  UPDATE heroes SET is_listed = true, market_price = p_price, listed_at = now(), reserved_by = NULL, reserved_until = NULL, updated_at = now()
  WHERE id = p_hero_id AND player_id = p_player_id AND NOT is_burned AND NOT on_map AND house_id IS NULL AND NOT is_listed AND purchase_tx IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'cannot_list'; END IF;
END $$;

-- Burned heroes can never rest in a house or occupy a house slot.
CREATE OR REPLACE FUNCTION public.set_hero_house(p_player_id uuid, p_hero_id text, p_house_id uuid, p_capacity integer, p_energy integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v heroes%ROWTYPE;
BEGIN
  SELECT * INTO v FROM heroes WHERE id = p_hero_id AND player_id = p_player_id FOR UPDATE;
  IF NOT FOUND OR v.is_burned THEN RAISE EXCEPTION 'unknown_hero'; END IF;
  IF v.on_map THEN RAISE EXCEPTION 'hero_on_map'; END IF;
  IF v.is_listed THEN RAISE EXCEPTION 'hero_listed'; END IF;
  IF p_house_id IS NOT NULL THEN
    PERFORM 1 FROM player_houses WHERE id = p_house_id AND player_id = p_player_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'unknown_house'; END IF;
    IF (SELECT count(*) FROM heroes WHERE house_id = p_house_id AND id <> p_hero_id AND NOT is_burned) >= p_capacity THEN
      RAISE EXCEPTION 'house_full';
    END IF;
  END IF;
  UPDATE heroes SET house_id = p_house_id, energy = greatest(0, least(p_energy, max_energy)), recovery_at = now(), updated_at = now()
  WHERE id = p_hero_id;
END $$;

-- Live energy saves never touch burned heroes.
CREATE OR REPLACE FUNCTION public.save_heroes_state(p_player_id uuid, p_heroes jsonb, p_session_token uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_h jsonb; v_n int := 0;
BEGIN
  PERFORM 1 FROM players WHERE id = p_player_id FOR UPDATE;
  IF p_session_token IS NOT NULL THEN
    PERFORM assert_game_session(p_player_id, p_session_token);
  ELSIF EXISTS (SELECT 1 FROM game_sessions WHERE player_id = p_player_id AND status = 'active'
                AND last_heartbeat_at > now() - interval '2 minutes') THEN
    RAISE EXCEPTION 'SESSION_ACTIVE_ELSEWHERE';
  END IF;
  FOR v_h IN SELECT * FROM jsonb_array_elements(coalesce(p_heroes, '[]'::jsonb)) LOOP
    UPDATE heroes SET
      energy = greatest(0, (v_h ->> 'energy')::numeric)::int,
      on_map = coalesce((v_h ->> 'onMap')::boolean, false),
      recovery_at = least(now(), to_timestamp((v_h ->> 'recoveryAt')::numeric / 1000.0)),
      updated_at = now()
    WHERE id = v_h ->> 'id' AND player_id = p_player_id AND NOT is_burned;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'updated', v_n);
END $$;

-- Leaderboard counts only active (unburned) heroes.
CREATE OR REPLACE FUNCTION public.leaderboard_snapshot()
RETURNS TABLE (
  rank bigint,
  player_id uuid,
  username text,
  avatar_id integer,
  xp bigint,
  level integer,
  hero_count integer,
  hero_points bigint,
  score bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH roster AS (
    SELECT h.player_id,
           count(*)::integer AS hero_count,
           -- Rarity point values mirror HERO_RARITY_POINTS in src/lib/game/leaderboard/leaderboard.ts
           sum(CASE h.rarity
                 WHEN 'common' THEN 250
                 WHEN 'uncommon' THEN 750
                 WHEN 'rare' THEN 2500
                 WHEN 'epic' THEN 10000
                 WHEN 'legendary' THEN 50000
                 ELSE 0 END)::bigint AS hero_points
    FROM public.heroes h
    WHERE NOT h.is_burned
    GROUP BY h.player_id
  ),
  scored AS (
    SELECT p.id AS player_id,
           COALESCE(NULLIF(p.username, ''), 'miner_' || substr(replace(p.id::text, '-', ''), 1, 8)) AS username,
           p.avatar_id,
           COALESCE(m.xp, 0)::bigint AS xp,
           COALESCE(r.hero_count, 0) AS hero_count,
           COALESCE(r.hero_points, 0)::bigint AS hero_points,
           (COALESCE(m.xp, 0) + COALESCE(r.hero_points, 0))::bigint AS score
    FROM public.players p
    LEFT JOIN public.player_milestones m ON m.player_id = p.id
    LEFT JOIN roster r ON r.player_id = p.id
    WHERE p.is_test = false
  )
  SELECT rank() OVER (ORDER BY s.score DESC, s.player_id) AS rank,
         s.player_id,
         s.username,
         s.avatar_id,
         s.xp,
         (floor(sqrt(s.xp / 1000.0)) + 1)::integer AS level,
         s.hero_count,
         s.hero_points,
         s.score
  FROM scored s
  ORDER BY s.score DESC, s.player_id;
$$;

-- Burned heroes can never be bought (defense in depth; listed heroes are never burned).
CREATE OR REPLACE FUNCTION public.buy_market_hero(p_buyer_id uuid, p_hero_id text, p_expected_price bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_seller uuid; v_h heroes%ROWTYPE; v_price bigint; v_fee bigint; v_net bigint; v_buyer_balance bigint; v_seller_balance bigint; v_ref text := gen_random_uuid()::text; v_meta jsonb;
BEGIN
  SELECT player_id INTO v_seller FROM heroes WHERE id = p_hero_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'hero_unavailable'; END IF;
  IF v_seller = p_buyer_id THEN RAISE EXCEPTION 'self_purchase'; END IF;
  -- Match player-first save/fusion operations; consistently order both wallets.
  PERFORM id FROM players WHERE id IN (p_buyer_id, v_seller) ORDER BY id FOR UPDATE;
  SELECT coins INTO v_buyer_balance FROM players WHERE id = p_buyer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_player'; END IF;
  SELECT * INTO v_h FROM heroes WHERE id = p_hero_id FOR UPDATE;
  IF NOT FOUND OR v_h.is_burned OR NOT v_h.is_listed OR v_h.player_id <> v_seller OR v_h.purchase_tx IS NOT NULL OR v_h.on_map OR v_h.house_id IS NOT NULL THEN RAISE EXCEPTION 'hero_unavailable'; END IF;
  IF v_h.market_price IS NULL OR v_h.market_price <= 0 OR v_h.market_price > 9007199254740991 OR v_h.market_price <> trunc(v_h.market_price) THEN RAISE EXCEPTION 'invalid_price'; END IF;
  v_price := v_h.market_price::bigint;
  IF p_expected_price IS NULL OR p_expected_price <> v_price THEN RAISE EXCEPTION 'price_changed'; END IF;
  IF v_buyer_balance < v_price THEN RAISE EXCEPTION 'not_enough_coins'; END IF;
  -- Round the 5% burn upward because balances are whole coins.
  v_fee := ceil(v_price::numeric / 20)::bigint;
  v_net := v_price - v_fee;
  IF (SELECT coins::numeric + v_net FROM players WHERE id = v_seller) > 9007199254740991 THEN RAISE EXCEPTION 'balance_limit'; END IF;
  UPDATE players SET coins = coins - v_price, updated_at = now() WHERE id = p_buyer_id RETURNING coins INTO v_buyer_balance;
  UPDATE players SET coins = coins + v_net, updated_at = now() WHERE id = v_seller RETURNING coins INTO v_seller_balance;
  UPDATE heroes SET player_id = p_buyer_id, is_listed = false, market_price = NULL, listed_at = NULL, reserved_by = NULL, reserved_until = NULL, purchase_tx = NULL, on_map = false, house_id = NULL, recovery_at = now(), updated_at = now() WHERE id = p_hero_id RETURNING * INTO v_h;
  v_meta := jsonb_build_object('hero', v_h.name, 'heroId', v_h.id, 'rarity', v_h.rarity, 'level', v_h.level, 'price', v_price, 'feePercent', 5, 'feeBurned', v_fee, 'sellerProceeds', v_net, 'payment', 'coins');
  PERFORM ledger_record(p_buyer_id, 'economy', 'market_purchase', -v_price, v_buyer_balance, v_ref, v_meta || jsonb_build_object('seller', (SELECT username FROM players WHERE id = v_seller)));
  PERFORM ledger_record(v_seller, 'economy', 'market_sale', v_net, v_seller_balance, v_ref, v_meta || jsonb_build_object('buyer', (SELECT username FROM players WHERE id = p_buyer_id)));
  RETURN jsonb_build_object('coins', v_buyer_balance, 'fee', v_fee, 'proceeds', v_net, 'reference', v_ref, 'hero', jsonb_build_object('id', v_h.id, 'name', v_h.name, 'type', v_h.name, 'rarity', v_h.rarity, 'level', v_h.level, 'power', v_h.power, 'speed', v_h.speed, 'stamina', v_h.stamina, 'bombNumber', v_h.bomb_number, 'bombRange', v_h.bomb_range, 'maxEnergy', v_h.max_energy, 'energy', v_h.energy, 'skills', to_jsonb(v_h.skills), 'onMap', false, 'listed', false, 'recoveryAt', floor(extract(epoch FROM v_h.recovery_at) * 1000)));
END $$;

-- Fusion history lives in the token ledger; the old hero_fusions counter table is retired
-- (dropped from this baseline; existing databases keep it with a DEPRECATED comment).
