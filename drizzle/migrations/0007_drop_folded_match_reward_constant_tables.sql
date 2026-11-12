-- Matches, daily rewards, budgets, pack supply, reward reserve and game versions now live on matches,
-- treasury_ledger and IMMUTABLE constant functions; these tables have no readers or writers left.
ALTER TABLE public.cards DROP COLUMN IF EXISTS game_version_id;
ALTER TABLE public.matches DROP COLUMN IF EXISTS game_version_id;
ALTER TABLE public.matchmaking_tickets DROP COLUMN IF EXISTS game_version_id;
DROP TABLE IF EXISTS public.match_submissions;
DROP TABLE IF EXISTS public.match_rewards;
DROP TABLE IF EXISTS public.match_players;
DROP TABLE IF EXISTS public.player_reward_days;
DROP TABLE IF EXISTS public.reward_days;
DROP TABLE IF EXISTS public.monthly_reward_budgets;
DROP TABLE IF EXISTS public.pack_supply;
DROP TABLE IF EXISTS public.legionnaire_reward_reserve;
DROP TABLE IF EXISTS public.game_versions;