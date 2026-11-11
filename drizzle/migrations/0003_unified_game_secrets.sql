-- One table for every hidden server seed used by a chance roll (pack openings, division chests, later drops).
CREATE TABLE public.game_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL CHECK (action_type IN ('pack_opening', 'division_chest')),
  target_id uuid NOT NULL,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  server_seed text NOT NULL CHECK (char_length(server_seed) >= 16),
  commit_hash text NOT NULL,
  client_seed text,
  status text NOT NULL DEFAULT 'committed' CHECK (status IN ('committed', 'revealed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revealed_at timestamptz,
  UNIQUE (action_type, target_id)
);
CREATE INDEX game_secrets_player_idx ON public.game_secrets (player_id, created_at DESC);

GRANT ALL ON public.game_secrets TO service_role;
REVOKE ALL ON public.game_secrets FROM anon, authenticated;
ALTER TABLE public.game_secrets ENABLE ROW LEVEL SECURITY;
-- No policies: players never read seeds from here; revealed seeds are copied onto pack_openings / division_chests.
COMMENT ON TABLE public.game_secrets IS 'Hidden server seeds for provably fair rolls, one per (action_type, target_id). Service role only.';

-- Carry over any seeds still waiting in the old tables.
INSERT INTO public.game_secrets (action_type, target_id, player_id, server_seed, commit_hash)
  SELECT 'pack_opening', o.id, o.player_id, s.server_seed, o.commit_hash
    FROM public.pack_opening_secrets s JOIN public.pack_openings o ON o.id = s.opening_id
  ON CONFLICT DO NOTHING;
INSERT INTO public.game_secrets (action_type, target_id, player_id, server_seed, commit_hash)
  SELECT 'division_chest', c.id, c.player_id, s.server_seed, c.commit_hash
    FROM public.division_chest_secrets s JOIN public.division_chests c ON c.id = s.chest_id
  ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.pack_opening_secrets IS 'DEPRECATED: replaced by game_secrets (action_type pack_opening)';
COMMENT ON TABLE public.division_chest_secrets IS 'DEPRECATED: replaced by game_secrets (action_type division_chest)';

CREATE OR REPLACE FUNCTION public._new_division_chest(p_season text, p_player uuid, p_division text, p_type text, p_ordinal integer, p_match uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_seed text := encode(extensions.gen_random_bytes(32), 'hex'); v_hash text; v_id uuid;
BEGIN
  v_hash := encode(extensions.digest(v_seed, 'sha256'), 'hex');
  INSERT INTO public.division_chests (season_key, player_id, division_id, chest_type, ordinal, match_id, algorithm, commit_hash)
    VALUES (p_season, p_player, p_division, p_type, p_ordinal, p_match, 'diademfall-chest-v1', v_hash)
    ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.game_secrets (action_type, target_id, player_id, server_seed, commit_hash)
      VALUES ('division_chest', v_id, p_player, v_seed, v_hash);
    INSERT INTO public.player_items (player_id, item_type, item_id, balance) VALUES (p_player, 'chest', p_type, 1)
      ON CONFLICT (player_id, item_type, item_id) DO UPDATE SET balance = public.player_items.balance + 1;
  END IF;
  RETURN v_id;
END $function$;

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
DECLARE o public.pack_openings%rowtype; v_seed text; r jsonb; v_asset uuid; v_out jsonb := '[]'::jsonb; v_card text;
BEGIN
  SELECT * INTO o FROM public.pack_openings WHERE id = p_opening_id AND player_id = p_player_id FOR UPDATE;
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
DECLARE c public.division_chests%rowtype; v_seed text; r jsonb; v_rar text; v_left integer; v_asset uuid; v_card text;
  v_out jsonb := '[]'::jsonb; v_shares numeric := 0; v_credits bigint := 0; v_amt numeric;
BEGIN
  SELECT * INTO c FROM public.division_chests WHERE id = p_chest_id AND player_id = p_player_id FOR UPDATE;
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
  UPDATE public.game_secrets SET status = 'revealed', client_seed = p_client_seed, revealed_at = now()
    WHERE action_type = 'division_chest' AND target_id = c.id;
  UPDATE public.player_items SET balance = balance - 1
   WHERE player_id = p_player_id AND item_type = 'chest' AND item_id = c.chest_type AND balance >= 1;
  UPDATE public.ranked_seasons SET chest_coin_shares = chest_coin_shares + v_shares WHERE key = c.season_key;
  RETURN jsonb_build_object('results', v_out, 'serverSeed', v_seed, 'clientSeed', p_client_seed, 'reserve', p_reserve, 'duplicate', false);
END $function$;