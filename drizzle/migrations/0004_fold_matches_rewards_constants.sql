-- 1. Treasury ledger also holds published monthly budgets and daily reward settlements.
ALTER TABLE public.treasury_ledger DROP CONSTRAINT treasury_ledger_entry_type_check;
ALTER TABLE public.treasury_ledger ADD CONSTRAINT treasury_ledger_entry_type_check
  CHECK (entry_type IN ('flow', 'snapshot', 'acquisition', 'budget', 'reward_day'));
ALTER TABLE public.treasury_ledger ADD CONSTRAINT treasury_ledger_budget_shape CHECK (entry_type <> 'budget' OR (
  category = 'published' AND wallet_id IS NULL AND account IS NULL AND amount >= 0 AND reference_id ~ '^\d{4}-\d{2}-01$'));
ALTER TABLE public.treasury_ledger ADD CONSTRAINT treasury_ledger_reward_day_shape CHECK (entry_type <> 'reward_day' OR (
  category = 'settlement' AND wallet_id IS NULL AND account IS NULL AND amount >= 0 AND reference_id ~ '^\d{4}-\d{2}-\d{2}$'));
CREATE UNIQUE INDEX treasury_ledger_budget_key ON public.treasury_ledger (reference_id) WHERE entry_type = 'budget';
CREATE UNIQUE INDEX treasury_ledger_reward_day_key ON public.treasury_ledger (reference_id) WHERE entry_type = 'reward_day';
COMMENT ON TABLE public.treasury_ledger IS 'Every treasury event: fee/payout flows, wallet balance snapshots, Coin acquisitions, published monthly reward budgets (entry_type budget, reference_id = month) and daily reward settlements (entry_type reward_day, reference_id = day); amounts and pools in details.';

INSERT INTO public.treasury_ledger (entry_type, category, amount, reference_type, reference_id, details, occurred_at)
  SELECT 'budget', 'published', calculated_budget, 'reward_budget', month::text,
    jsonb_build_object('openingRewardVault', opening_reward_vault::text, 'priorMonthAcquired', prior_month_acquired::text,
      'matchPool', match_pool::text, 'activityPool', activity_pool::text, 'leaguePool', league_pool::text, 'leaderboardPool', leaderboard_pool::text),
    coalesce(published_at, created_at)
  FROM public.monthly_reward_budgets WHERE status = 'published';
INSERT INTO public.treasury_ledger (entry_type, category, amount, reference_type, reference_id, details, occurred_at)
  SELECT 'reward_day', 'settlement', paid_match + paid_activity, 'reward_day', reward_day::text,
    jsonb_build_object('budgetMonth', budget_month, 'matchPool', match_pool::text, 'activityPool', activity_pool::text,
      'rolloverInMatch', rollover_in_match::text, 'rolloverInActivity', rollover_in_activity::text,
      'totalMatchShares', total_match_shares::text, 'totalActivityShares', total_activity_shares::text,
      'paidMatch', paid_match::text, 'paidActivity', paid_activity::text,
      'rolloverOutMatch', rollover_out_match::text, 'rolloverOutActivity', rollover_out_activity::text, 'playersPaid', players_paid),
    settled_at
  FROM public.reward_days;

-- 2. Matches carry both players, their hidden locked teams and their reward outcome.
ALTER TABLE public.matches
  ADD COLUMN game_version text,
  ADD COLUMN player1_id uuid REFERENCES public.profiles(id),
  ADD COLUMN player2_id uuid REFERENCES public.profiles(id),
  ADD COLUMN p1_rating_before integer,
  ADD COLUMN p1_rating_after integer,
  ADD COLUMN p1_result text CHECK (p1_result IS NULL OR p1_result IN ('win', 'loss', 'draw', 'cancelled')),
  ADD COLUMN p2_rating_before integer,
  ADD COLUMN p2_rating_after integer,
  ADD COLUMN p2_result text CHECK (p2_result IS NULL OR p2_result IN ('win', 'loss', 'draw', 'cancelled')),
  ADD COLUMN p1_team jsonb CHECK (p1_team IS NULL OR jsonb_typeof(p1_team) = 'object'),
  ADD COLUMN p2_team jsonb CHECK (p2_team IS NULL OR jsonb_typeof(p2_team) = 'object'),
  ADD COLUMN p1_reward jsonb CHECK (p1_reward IS NULL OR jsonb_typeof(p1_reward) = 'object'),
  ADD COLUMN p2_reward jsonb CHECK (p2_reward IS NULL OR jsonb_typeof(p2_reward) = 'object'),
  ADD CONSTRAINT matches_distinct_players CHECK (player1_id <> player2_id);
COMMENT ON COLUMN public.matches.p1_team IS 'Side 1 locked team {summonerCardId, summonerLevel, formation, calculatedMana, submissionHash, lockedAt}; hidden from players (no column grant) until the replay is public.';
COMMENT ON COLUMN public.matches.p1_reward IS 'Side 1 ranked reward {rewardDay, status, energySpent, leagueId, leagueMultiplier, opponentFactor, streakBonus, foilBonus, goldCards, shares, banner, lowMana, dailyMultiplier}; read through server functions only.';

UPDATE public.matches m SET game_version = g.version FROM public.game_versions g WHERE g.id = m.game_version_id;
UPDATE public.matches m SET player1_id = p.player_id, p1_rating_before = p.rating_before, p1_rating_after = p.rating_after, p1_result = p.result
  FROM public.match_players p WHERE p.match_id = m.id AND p.side = 1;
UPDATE public.matches m SET player2_id = p.player_id, p2_rating_before = p.rating_before, p2_rating_after = p.rating_after, p2_result = p.result
  FROM public.match_players p WHERE p.match_id = m.id AND p.side = 2;
UPDATE public.matches m SET p1_team = jsonb_build_object('summonerCardId', s.summoner_card_id, 'summonerLevel', s.summoner_level, 'formation', s.formation,
    'calculatedMana', s.calculated_mana, 'submissionHash', s.submission_hash, 'lockedAt', s.locked_at)
  FROM public.match_submissions s WHERE s.match_id = m.id AND s.player_id = m.player1_id;
UPDATE public.matches m SET p2_team = jsonb_build_object('summonerCardId', s.summoner_card_id, 'summonerLevel', s.summoner_level, 'formation', s.formation,
    'calculatedMana', s.calculated_mana, 'submissionHash', s.submission_hash, 'lockedAt', s.locked_at)
  FROM public.match_submissions s WHERE s.match_id = m.id AND s.player_id = m.player2_id;
UPDATE public.matches m SET p1_reward = jsonb_build_object('rewardDay', r.reward_day, 'status', r.status, 'energySpent', r.energy_spent, 'leagueId', r.league_id,
    'leagueMultiplier', r.league_multiplier, 'opponentFactor', r.opponent_factor, 'streakBonus', r.streak_bonus, 'foilBonus', r.foil_bonus,
    'goldCards', r.gold_cards, 'shares', r.shares, 'banner', (SELECT c.banner_id FROM public.cards c WHERE c.id = m.p1_team ->> 'summonerCardId'),
    'lowMana', false, 'dailyMultiplier', (SELECT l.daily_multiplier FROM public.reward_league(m.p1_rating_before) l))
  FROM public.match_rewards r WHERE r.match_id = m.id AND r.player_id = m.player1_id;
UPDATE public.matches m SET p2_reward = jsonb_build_object('rewardDay', r.reward_day, 'status', r.status, 'energySpent', r.energy_spent, 'leagueId', r.league_id,
    'leagueMultiplier', r.league_multiplier, 'opponentFactor', r.opponent_factor, 'streakBonus', r.streak_bonus, 'foilBonus', r.foil_bonus,
    'goldCards', r.gold_cards, 'shares', r.shares, 'banner', (SELECT c.banner_id FROM public.cards c WHERE c.id = m.p2_team ->> 'summonerCardId'),
    'lowMana', false, 'dailyMultiplier', (SELECT l.daily_multiplier FROM public.reward_league(m.p2_rating_before) l))
  FROM public.match_rewards r WHERE r.match_id = m.id AND r.player_id = m.player2_id;

CREATE INDEX matches_player1_idx ON public.matches (player1_id, created_at DESC);
CREATE INDEX matches_player2_idx ON public.matches (player2_id, created_at DESC);
CREATE INDEX matches_p1_reward_day_idx ON public.matches ((p1_reward ->> 'rewardDay')) WHERE p1_reward ->> 'status' = 'earned';
CREATE INDEX matches_p2_reward_day_idx ON public.matches ((p2_reward ->> 'rewardDay')) WHERE p2_reward ->> 'status' = 'earned';

-- Players read their matches, but never the locked teams or reward rows (server functions read those).
REVOKE SELECT ON public.matches FROM anon, authenticated;
GRANT SELECT (id, game_version, engine_version, mode, region, status, mana_cap, seed, ruleset_ids, winner_player_id, outcome, result, replay,
  input_hash, result_hash, selection_deadline, created_at, started_at, completed_at, season_key,
  player1_id, player2_id, p1_rating_before, p1_rating_after, p1_result, p2_rating_before, p2_rating_after, p2_result) ON public.matches TO authenticated;
DROP POLICY IF EXISTS matches_read_participant ON public.matches;
CREATE POLICY matches_read_participant ON public.matches FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (player1_id, player2_id));

-- 3. Catalog versions are code constants: cards and tickets name their version.
ALTER TABLE public.cards ADD COLUMN game_version text;
UPDATE public.cards c SET game_version = g.version FROM public.game_versions g WHERE g.id = c.game_version_id;
ALTER TABLE public.matchmaking_tickets ADD COLUMN game_version text;
UPDATE public.matchmaking_tickets t SET game_version = g.version FROM public.game_versions g WHERE g.id = t.game_version_id;
ALTER TABLE public.cards ALTER COLUMN game_version_id DROP NOT NULL;
ALTER TABLE public.matches ALTER COLUMN game_version_id DROP NOT NULL;
ALTER TABLE public.matchmaking_tickets ALTER COLUMN game_version_id DROP NOT NULL;
COMMENT ON COLUMN public.cards.game_version_id IS 'DEPRECATED: replaced by game_version';
COMMENT ON COLUMN public.matches.game_version_id IS 'DEPRECATED: replaced by game_version';
COMMENT ON COLUMN public.matchmaking_tickets.game_version_id IS 'DEPRECATED: replaced by game_version';
CREATE INDEX cards_game_version_idx ON public.cards (game_version);

-- 4. Pack and reserve counters are derived from purchases, openings and minted chest cards.
CREATE INDEX currency_ledger_pack_purchase_idx ON public.currency_ledger (reference_id) WHERE entry_type = 'pack_purchase';
CREATE INDEX item_openings_type_item_status_idx ON public.item_openings (item_type, item_id, status);

CREATE OR REPLACE FUNCTION public.game_version_table()
 RETURNS TABLE(version text, engine_version text, status text, catalog_hash text)
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.version::text, v.engine_version::text, v.status::text, v.catalog_hash::text
  FROM (VALUES
    ('three-packs-economy-wayfarers-1.0.0', 'battle-engine-1.0.0', 'active', '5d3c4855b308e2b0dddcbc10c52f5cbaefe93aac6565c7e02871ba4192737926'),
    ('three-packs-1.0.0', 'battle-engine-1.0.0', 'retired', NULL),
    ('alpha-beta-1.0.0', 'battle-engine-1.0.0', 'retired', NULL)
  ) AS v(version, engine_version, status, catalog_hash)
$fn$;

CREATE OR REPLACE FUNCTION public.pack_edition_table()
 RETURNS TABLE(set_id text, price_credits bigint, maximum_packs bigint, public_allocation bigint, reserve_allocation bigint, active boolean)
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.set_id::text, v.price_credits::bigint, v.maximum_packs::bigint, v.public_allocation::bigint, v.reserve_allocation::bigint, v.active::boolean
  FROM (VALUES
    ('ancient', 1000, 500000, 450000, 50000, true),
    ('oath', 1000, 500000, 450000, 50000, true),
    ('legionnaire', 1000, 500000, 450000, 50000, true)
  ) AS v(set_id, price_credits, maximum_packs, public_allocation, reserve_allocation, active)
$fn$;

CREATE OR REPLACE FUNCTION public.reward_reserve_table()
 RETURNS TABLE(rarity text, original_units integer)
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.rarity::text, v.original_units::integer
  FROM (VALUES
    ('common', 51766),
    ('uncommon', 31774),
    ('rare', 11611),
    ('epic', 3674),
    ('legendary', 1175)
  ) AS v(rarity, original_units)
$fn$;

CREATE OR REPLACE FUNCTION public.published_budget(p_month date)
 RETURNS TABLE(month date, opening_reward_vault numeric, prior_month_acquired numeric, calculated_budget numeric, match_pool numeric,
   activity_pool numeric, league_pool numeric, leaderboard_pool numeric, published_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT l.reference_id::date, (l.details ->> 'openingRewardVault')::numeric, (l.details ->> 'priorMonthAcquired')::numeric, l.amount,
         (l.details ->> 'matchPool')::numeric, (l.details ->> 'activityPool')::numeric, (l.details ->> 'leaguePool')::numeric,
         (l.details ->> 'leaderboardPool')::numeric, l.occurred_at
    FROM public.treasury_ledger l
   WHERE l.entry_type = 'budget' AND l.reference_id = date_trunc('month', p_month)::date::text
$function$;
REVOKE ALL ON FUNCTION public.published_budget(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.published_budget(date) TO service_role;

CREATE OR REPLACE FUNCTION public.reward_day_players(p_day date)
 RETURNS TABLE(player_id uuid, eligible_wins integer, match_shares numeric, banners text[], rulesets text[], low_mana_win boolean,
   daily_multiplier numeric, activity_points integer, activity_shares numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH r AS (
    SELECT m.player1_id AS player_id, m.p1_reward AS rw, m.ruleset_ids, m.completed_at FROM public.matches m
     WHERE m.mode = 'ranked' AND m.p1_reward ->> 'status' = 'earned' AND m.p1_reward ->> 'rewardDay' = p_day::text
    UNION ALL
    SELECT m.player2_id, m.p2_reward, m.ruleset_ids, m.completed_at FROM public.matches m
     WHERE m.mode = 'ranked' AND m.p2_reward ->> 'status' = 'earned' AND m.p2_reward ->> 'rewardDay' = p_day::text
  ), g AS (
    SELECT r.player_id, count(*)::integer AS wins, sum((r.rw ->> 'shares')::numeric) AS shares,
           coalesce(array_agg(DISTINCT r.rw ->> 'banner') FILTER (WHERE r.rw ->> 'banner' IS NOT NULL), '{}'::text[]) AS banners,
           coalesce(bool_or((r.rw ->> 'lowMana')::boolean), false) AS low_mana,
           coalesce((array_agg((r.rw ->> 'dailyMultiplier')::numeric ORDER BY r.completed_at DESC))[1], 0) AS mult
      FROM r GROUP BY r.player_id
  ), rs AS (
    SELECT r.player_id, array_agg(DISTINCT x ORDER BY x) AS rulesets
      FROM r CROSS JOIN LATERAL unnest(coalesce(r.ruleset_ids, '{}'::text[])) AS x GROUP BY r.player_id
  ), p AS (
    SELECT g.*, coalesce(rs.rulesets, '{}'::text[]) AS rules,
           public.reward_activity_points(g.wins, cardinality(g.banners), cardinality(coalesce(rs.rulesets, '{}'::text[])), g.low_mana) AS points
      FROM g LEFT JOIN rs ON rs.player_id = g.player_id
  )
  SELECT p.player_id, p.wins, p.shares, p.banners, p.rules, p.low_mana, p.mult, p.points,
         CASE WHEN p.wins >= 3 THEN p.points * p.mult ELSE 0 END
    FROM p
$function$;
REVOKE ALL ON FUNCTION public.reward_day_players(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_day_players(date) TO service_role;

CREATE OR REPLACE FUNCTION public.pack_supply_summary()
 RETURNS TABLE(set_id text, price_credits bigint, maximum_packs bigint, public_allocation bigint, reserve_allocation bigint,
   sold_packs bigint, reserve_issued bigint, opened_packs bigint, active boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT e.set_id, e.price_credits, e.maximum_packs, e.public_allocation, e.reserve_allocation,
         coalesce((SELECT sum((l.metadata ->> 'quantity')::bigint) FROM public.currency_ledger l
                    WHERE l.entry_type = 'pack_purchase' AND l.reference_id = e.set_id), 0)::bigint,
         r.issued,
         ((SELECT count(*) FROM public.item_openings o WHERE o.item_type = 'pack' AND o.item_id = e.set_id AND o.status = 'revealed') + r.issued)::bigint,
         e.active
    FROM public.pack_edition_table() e
    CROSS JOIN LATERAL (SELECT CASE WHEN e.set_id = 'legionnaire'
                                    THEN (SELECT sum(t.original_units) / 5 FROM public.reward_reserve_table() t)::bigint ELSE 0::bigint END AS issued) r
$function$;
REVOKE ALL ON FUNCTION public.pack_supply_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pack_supply_summary() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reward_reserve_remaining()
 RETURNS TABLE(rarity text, original_units integer, remaining_units integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT t.rarity, t.original_units, (t.original_units - coalesce(u.used, 0))::integer
    FROM public.reward_reserve_table() t
    LEFT JOIN (SELECT c.rarity, count(*) AS used FROM public.player_cards pc
                 JOIN public.item_openings o ON o.id = pc.opening_id AND o.item_type = 'chest'
                 JOIN public.cards c ON c.id = pc.card_id
                GROUP BY c.rarity) u ON u.rarity = t.rarity
$function$;
REVOKE ALL ON FUNCTION public.reward_reserve_remaining() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reward_reserve_remaining() TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.seed_legionnaire_reserve(jsonb, integer);