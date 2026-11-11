-- 1. Reward Energy moves onto profiles (one pool per player).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reward_energy smallint NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS reward_energy_anchor_at timestamptz NOT NULL DEFAULT now();
UPDATE public.profiles p SET reward_energy = e.energy, reward_energy_anchor_at = e.anchor_at
  FROM public.reward_energy e WHERE e.player_id = p.id;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_reward_energy_range CHECK (reward_energy BETWEEN 0 AND 24);
-- Players may only edit their display name and avatar; energy, level and experience are server-owned.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, avatar_path) ON public.profiles TO authenticated;

-- 2. player_items: every non-card thing a player holds (currencies, unopened packs, unopened chests).
CREATE TABLE public.player_items (
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('currency', 'pack', 'chest')),
  item_id text NOT NULL,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  locked numeric NOT NULL DEFAULT 0 CHECK (locked >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, item_type, item_id),
  CONSTRAINT player_items_known_ids CHECK (
    (item_type = 'currency' AND item_id IN ('credits', 'coins'))
    OR (item_type = 'chest' AND item_id IN ('scout', 'war', 'crown'))
    OR item_type = 'pack'),
  CONSTRAINT player_items_precision CHECK (
    balance = round(balance, 8) AND locked = round(locked, 8)
    AND ((item_type = 'currency' AND item_id = 'coins') OR (balance = trunc(balance) AND locked = trunc(locked))))
);
GRANT SELECT ON public.player_items TO authenticated;
GRANT ALL ON public.player_items TO service_role;
ALTER TABLE public.player_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_items_read_own ON public.player_items FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE TRIGGER player_items_updated_at BEFORE UPDATE ON public.player_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.player_items (player_id, item_type, item_id, balance, locked)
  SELECT player_id, 'currency', currency, available, locked FROM public.currency_balances
  UNION ALL SELECT player_id, 'pack', set_id, quantity, 0 FROM public.player_packs WHERE quantity > 0
  UNION ALL SELECT player_id, 'chest', chest_type, count(*), 0 FROM public.division_chests WHERE status = 'unopened' GROUP BY player_id, chest_type
ON CONFLICT DO NOTHING;
INSERT INTO public.player_items (player_id, item_type, item_id)
  SELECT p.id, 'currency', c FROM public.profiles p CROSS JOIN (VALUES ('credits'), ('coins')) AS x(c)
ON CONFLICT DO NOTHING;

-- 3. Static game constants (generated from src/game/sql-constants.ts) replace the reference tables.
CREATE OR REPLACE FUNCTION public.ranked_division_table()
 RETURNS TABLE(id text, league text, tier integer, min_rating integer, rulesets integer, reward_chest text, reward_count integer, bonus_chest text, bonus_count integer, reset_rating integer)
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.id::text, v.league::text, v.tier::integer, v.min_rating::integer, v.rulesets::integer, v.reward_chest::text,
         v.reward_count::integer, v.bonus_chest::text, v.bonus_count::integer, v.reset_rating::integer
  FROM (VALUES
    ('wood', 'wood', NULL, 0, 0, NULL, 0, NULL, 0, 0),
    ('bronze_iii', 'bronze', 3, 1000, 1, NULL, 0, NULL, 0, 1000),
    ('bronze_ii', 'bronze', 2, 1135, 1, 'scout', 2, NULL, 0, 1000),
    ('bronze_i', 'bronze', 1, 1270, 1, 'scout', 3, NULL, 0, 1000),
    ('silver_iii', 'silver', 3, 1400, 1, 'scout', 4, NULL, 0, 1000),
    ('silver_ii', 'silver', 2, 1535, 2, 'war', 1, 'scout', 2, 1000),
    ('silver_i', 'silver', 1, 1670, 2, 'war', 2, NULL, 0, 1000),
    ('gold_iii', 'gold', 3, 1800, 2, 'war', 3, NULL, 0, 1400),
    ('gold_ii', 'gold', 2, 1935, 2, 'crown', 1, 'war', 2, 1400),
    ('gold_i', 'gold', 1, 2070, 2, 'crown', 2, NULL, 0, 1400),
    ('diamond_iii', 'diamond', 3, 2200, 2, 'crown', 3, NULL, 0, 1800),
    ('diamond_ii', 'diamond', 2, 2335, 2, 'crown', 4, NULL, 0, 1800),
    ('diamond_i', 'diamond', 1, 2470, 2, 'crown', 5, NULL, 0, 1800),
    ('champion_iii', 'champion', 3, 2600, 2, 'crown', 6, NULL, 0, 2200),
    ('champion_ii', 'champion', 2, 2800, 2, 'crown', 7, NULL, 0, 2200),
    ('champion_i', 'champion', 1, 3000, 2, 'crown', 9, NULL, 0, 2200)
  ) AS v(id, league, tier, min_rating, rulesets, reward_chest, reward_count, bonus_chest, bonus_count, reset_rating)
$fn$;

CREATE OR REPLACE FUNCTION public.card_level_requirement_table()
 RETURNS TABLE(rarity text, foil text, level integer, required_essence integer)
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.rarity::text, v.foil::text, v.level::integer, v.required_essence::integer
  FROM (VALUES
    ('common', 'regular', 1, 1),
    ('common', 'regular', 2, 2),
    ('common', 'regular', 3, 4),
    ('common', 'regular', 4, 7),
    ('common', 'regular', 5, 11),
    ('common', 'regular', 6, 16),
    ('common', 'regular', 7, 22),
    ('common', 'regular', 8, 29),
    ('common', 'regular', 9, 37),
    ('common', 'regular', 10, 46),
    ('uncommon', 'regular', 1, 1),
    ('uncommon', 'regular', 2, 2),
    ('uncommon', 'regular', 3, 4),
    ('uncommon', 'regular', 4, 7),
    ('uncommon', 'regular', 5, 11),
    ('uncommon', 'regular', 6, 16),
    ('uncommon', 'regular', 7, 22),
    ('uncommon', 'regular', 8, 29),
    ('rare', 'regular', 1, 1),
    ('rare', 'regular', 2, 2),
    ('rare', 'regular', 3, 4),
    ('rare', 'regular', 4, 7),
    ('rare', 'regular', 5, 11),
    ('rare', 'regular', 6, 16),
    ('epic', 'regular', 1, 1),
    ('epic', 'regular', 2, 2),
    ('epic', 'regular', 3, 4),
    ('epic', 'regular', 4, 7),
    ('legendary', 'regular', 1, 1),
    ('legendary', 'regular', 2, 2),
    ('legendary', 'regular', 3, 4),
    ('common', 'gold', 1, 1),
    ('common', 'gold', 2, 2),
    ('common', 'gold', 3, 3),
    ('common', 'gold', 4, 5),
    ('common', 'gold', 5, 8),
    ('common', 'gold', 6, 11),
    ('common', 'gold', 7, 14),
    ('common', 'gold', 8, 18),
    ('common', 'gold', 9, 23),
    ('common', 'gold', 10, 28),
    ('uncommon', 'gold', 1, 1),
    ('uncommon', 'gold', 2, 2),
    ('uncommon', 'gold', 3, 3),
    ('uncommon', 'gold', 4, 5),
    ('uncommon', 'gold', 5, 8),
    ('uncommon', 'gold', 6, 11),
    ('uncommon', 'gold', 7, 14),
    ('uncommon', 'gold', 8, 18),
    ('rare', 'gold', 1, 1),
    ('rare', 'gold', 2, 2),
    ('rare', 'gold', 3, 3),
    ('rare', 'gold', 4, 4),
    ('rare', 'gold', 5, 6),
    ('rare', 'gold', 6, 8),
    ('epic', 'gold', 1, 1),
    ('epic', 'gold', 2, 2),
    ('epic', 'gold', 3, 3),
    ('epic', 'gold', 4, 4),
    ('legendary', 'gold', 1, 1),
    ('legendary', 'gold', 2, 2),
    ('legendary', 'gold', 3, 3)
  ) AS v(rarity, foil, level, required_essence)
$fn$;

CREATE OR REPLACE FUNCTION public.ranked_ruleset_pool()
 RETURNS TABLE(id text, selection_weight integer, incompatible_with text[])
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.id::text, v.selection_weight::integer, v.incompatible_with::text[]
  FROM (VALUES
    ('ancient_only', 100, '{oath_only,legionnaire_only}'),
    ('oath_only', 100, '{ancient_only,legionnaire_only}'),
    ('legionnaire_only', 100, '{ancient_only,oath_only}'),
    ('narrow_gate', 100, '{grand_muster}'),
    ('humble_origins', 100, '{crown_and_legend}'),
    ('lean_campaign', 100, '{royal_stipend}'),
    ('royal_stipend', 100, '{lean_campaign}'),
    ('oathless_day', 100, '{}'),
    ('unwritten_deeds', 100, '{echoing_hall}'),
    ('broken_formation', 100, '{shared_burden}'),
    ('no_retreat', 100, '{turning_wheel}'),
    ('turning_wheel', 100, '{no_retreat}'),
    ('open_flanks', 100, '{}'),
    ('duel_at_dawn', 100, '{}'),
    ('shattered_guard', 100, '{gilded_march}'),
    ('gilded_march', 100, '{shattered_guard}'),
    ('shared_burden', 100, '{broken_formation}'),
    ('spell_scarcity', 100, '{runic_overflow}'),
    ('runic_overflow', 100, '{spell_scarcity}'),
    ('steel_tempest', 100, '{}'),
    ('distant_thunder', 100, '{}'),
    ('crown_favor', 100, '{}'),
    ('last_light', 100, '{}'),
    ('red_hour', 100, '{}'),
    ('closing_chapter', 100, '{}'),
    ('fickle_fortune', 100, '{}'),
    ('closed_ranks', 100, '{open_contract}'),
    ('open_contract', 100, '{closed_ranks}')
  ) AS v(id, selection_weight, incompatible_with)
$fn$;

ALTER TABLE public.division_chests DROP CONSTRAINT IF EXISTS division_chests_division_id_fkey;