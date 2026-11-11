-- Remix restore: the copied schema arrived without table grants or the auth signup trigger.

-- Public catalog and pack supply (read-only for everyone; rows filtered by RLS)
GRANT SELECT ON public.cards, public.rulesets, public.game_versions, public.pack_supply TO anon, authenticated;

-- Player data: reads scoped by RLS; writes only through server functions / SECURITY DEFINER procedures
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.player_ratings, public.player_cards, public.matchmaking_tickets,
  public.matches, public.match_players, public.match_submissions,
  public.currency_balances, public.currency_ledger,
  public.player_packs, public.pack_openings, public.card_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decks TO authenticated;

-- Server (service role) needs full access to every app table; pack_opening_secrets is server-only
GRANT ALL ON public.cards, public.rulesets, public.game_versions, public.profiles, public.player_ratings,
  public.player_cards, public.decks, public.matchmaking_tickets, public.matches, public.match_players,
  public.match_submissions, public.currency_balances, public.currency_ledger,
  public.pack_supply, public.player_packs, public.pack_openings, public.pack_opening_secrets, public.card_assets
  TO service_role;

-- Signup trigger: profile, preseason rating and wallet rows for every new account (no cards)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();