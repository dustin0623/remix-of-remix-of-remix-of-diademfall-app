-- Card Essence (CE): combining copies of the same card merges their CE into one surviving asset.
ALTER TABLE public.card_assets ADD COLUMN essence integer NOT NULL DEFAULT 1;
ALTER TABLE public.card_assets ADD CONSTRAINT card_assets_essence_check CHECK (essence >= 1);
ALTER TABLE public.card_assets ADD COLUMN combined_into uuid REFERENCES public.card_assets(id);
ALTER TABLE public.card_assets ADD COLUMN combined_at timestamptz;
ALTER TABLE public.card_assets DROP CONSTRAINT card_assets_status_check;
ALTER TABLE public.card_assets ADD CONSTRAINT card_assets_status_check
  CHECK (status IN ('available', 'listed', 'rented', 'escrowed', 'burned', 'combined'));
ALTER TABLE public.card_assets ADD CONSTRAINT card_assets_combined_check
  CHECK ((status = 'combined') = (combined_into IS NOT NULL));
COMMENT ON COLUMN public.card_assets.essence IS 'Card Essence: 1 per opened copy; combining adds the absorbed copies'' CE to the surviving asset. Absorbed (combined) assets keep their CE value for audit only.';
CREATE INDEX IF NOT EXISTS card_assets_owner_card_idx ON public.card_assets (owner_id, card_id, foil);

-- Cumulative CE required per level; rows are loaded from src/game/combining.ts by scripts/load-catalog.ts.
CREATE TABLE public.card_level_requirements (
  rarity text NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  foil text NOT NULL CHECK (foil IN ('regular', 'gold')),
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 10),
  required_essence integer NOT NULL CHECK (required_essence >= 1),
  PRIMARY KEY (rarity, foil, level)
);
GRANT SELECT ON public.card_level_requirements TO anon, authenticated;
GRANT ALL ON public.card_level_requirements TO service_role;
ALTER TABLE public.card_level_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_level_requirements_read ON public.card_level_requirements FOR SELECT TO anon, authenticated USING (true);

-- Permanent audit of every combine.
CREATE TABLE public.card_combinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id),
  card_id text NOT NULL REFERENCES public.cards(id),
  foil text NOT NULL CHECK (foil IN ('regular', 'gold')),
  target_asset_id uuid NOT NULL REFERENCES public.card_assets(id),
  source_asset_ids uuid[] NOT NULL,
  essence_before integer NOT NULL,
  essence_added integer NOT NULL,
  essence_after integer NOT NULL,
  level_before integer NOT NULL,
  level_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_combinations_player_idx ON public.card_combinations (player_id, created_at DESC);
GRANT SELECT ON public.card_combinations TO authenticated;
GRANT ALL ON public.card_combinations TO service_role;
ALTER TABLE public.card_combinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_combinations_read_own ON public.card_combinations FOR SELECT TO authenticated USING (player_id = auth.uid());

-- Per-card summary used by ranked: usable copies and the highest level among them (owned-available + rented-in).
CREATE OR REPLACE FUNCTION public.refresh_player_card(p_player_id uuid, p_card_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v integer; v_level smallint;
BEGIN
  SELECT (SELECT count(*) FROM public.card_assets WHERE owner_id = p_player_id AND card_id = p_card_id AND status = 'available')
       + (SELECT count(*) FROM public.rental_contracts WHERE renter_id = p_player_id AND card_id = p_card_id AND status = 'active')
    INTO v;
  SELECT coalesce(max(l), 1) INTO v_level FROM (
    SELECT level AS l FROM public.card_assets WHERE owner_id = p_player_id AND card_id = p_card_id AND status = 'available'
    UNION ALL
    SELECT a.level FROM public.rental_contracts c JOIN public.card_assets a ON a.id = c.asset_id
      WHERE c.renter_id = p_player_id AND c.card_id = p_card_id AND c.status = 'active'
  ) x;
  INSERT INTO public.player_cards (player_id, card_id, copies, level) VALUES (p_player_id, p_card_id, v, v_level)
  ON CONFLICT (player_id, card_id) DO UPDATE SET copies = excluded.copies, level = excluded.level;
END;
$function$;

-- Combine: one transaction; the target must have at least as much CE as every source; all copies must be the
-- player's own, free (available), same card and same foil; the result may not exceed the maximum useful CE.
CREATE OR REPLACE FUNCTION public.combine_card_assets(p_player_id uuid, p_target_asset_id uuid, p_source_asset_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
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
  SELECT max(required_essence) INTO v_max FROM public.card_level_requirements WHERE rarity = v_rarity AND foil = t.foil;
  IF v_max IS NULL THEN RAISE EXCEPTION 'Level requirements are not loaded'; END IF;
  v_after := t.essence + v_added;
  IF v_after > v_max THEN RAISE EXCEPTION 'Exceeds maximum CE of %', v_max; END IF;

  SELECT coalesce(max(level), 1) INTO v_level_before FROM public.card_level_requirements
    WHERE rarity = v_rarity AND foil = t.foil AND required_essence <= t.essence;
  SELECT coalesce(max(level), 1) INTO v_level_after FROM public.card_level_requirements
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
REVOKE ALL ON FUNCTION public.combine_card_assets(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.combine_card_assets(uuid, uuid, uuid[]) TO service_role;

-- Public supply accounting: combining reduces separate cards, never total CE.
CREATE OR REPLACE FUNCTION public.card_supply_summary()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'minted', count(*),
    'activeAssets', count(*) FILTER (WHERE status NOT IN ('combined', 'burned')),
    'combinedAssets', count(*) FILTER (WHERE status = 'combined'),
    'existingEssence', coalesce(sum(essence) FILTER (WHERE status NOT IN ('combined', 'burned')), 0),
    'burnedEssence', coalesce(sum(essence) FILTER (WHERE status = 'burned'), 0)
  ) FROM public.card_assets;
$function$;
REVOKE ALL ON FUNCTION public.card_supply_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.card_supply_summary() TO anon, authenticated, service_role;