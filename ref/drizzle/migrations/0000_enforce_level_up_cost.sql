-- Upgrade price must equal current level squared x 5,000 coins (levels 1-9).
CREATE OR REPLACE FUNCTION public.level_up_hero(p_player_id uuid, p_hero_id text, p_cost bigint, p_expected_level integer, p_stats jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_coins bigint; v_h heroes%ROWTYPE; v_gain integer;
BEGIN
  IF p_cost < 0 THEN RAISE EXCEPTION 'invalid_cost'; END IF;
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

REVOKE ALL ON FUNCTION public.level_up_hero(uuid, text, bigint, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.level_up_hero(uuid, text, bigint, integer, jsonb) TO service_role;

COMMENT ON TABLE public.hero_fusions IS 'DEPRECATED: fusion history and daily counts live in token_ledger';