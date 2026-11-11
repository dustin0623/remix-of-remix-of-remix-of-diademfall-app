-- Diademfall base schema (catalog, profiles, ratings, decks, ranked matchmaking, wallets, packs, card assets).
-- Rebuilt for this project; the later migrations (grants/signup trigger, rewards, market/treasury) build on it.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ===== Catalog =====
CREATE TABLE public.game_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text UNIQUE NOT NULL,
  engine_version text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  catalog_hash text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX game_versions_one_active ON public.game_versions ((status)) WHERE status = 'active';

CREATE TABLE public.cards (
  id text PRIMARY KEY,
  game_version_id uuid NOT NULL REFERENCES public.game_versions(id),
  set_id text NOT NULL CHECK (set_id IN ('ancient','oath','legionnaire','alpha','beta')),
  banner_id text NOT NULL CHECK (banner_id IN ('bastion_orders','wild_courts','veil_covenant','hollow_legions','skybound_houses','wyrm_clans')),
  card_type text NOT NULL CHECK (card_type IN ('summoner','unit')),
  name text NOT NULL,
  rarity text NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  mana smallint NOT NULL CHECK (mana BETWEEN 0 AND 20),
  level_cap smallint NOT NULL CHECK (level_cap BETWEEN 1 AND 10),
  art_path text,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(definition) = 'object'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cards_catalog_idx ON public.cards (game_version_id, set_id, banner_id, card_type, rarity);

CREATE TABLE public.rulesets (
  id text PRIMARY KEY,
  game_version_id uuid NOT NULL REFERENCES public.game_versions(id),
  name text NOT NULL,
  category text NOT NULL,
  phase text NOT NULL,
  description text NOT NULL,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(definition) = 'object'),
  incompatible_with text[] NOT NULL DEFAULT '{}',
  selection_weight integer NOT NULL DEFAULT 100 CHECK (selection_weight >= 0),
  active boolean NOT NULL DEFAULT true
);

-- ===== Players =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text CHECK (char_length(display_name) BETWEEN 1 AND 32),
  avatar_path text,
  account_level integer NOT NULL DEFAULT 1 CHECK (account_level >= 1),
  experience bigint NOT NULL DEFAULT 0 CHECK (experience >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE TABLE public.player_ratings (
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  season_key text NOT NULL DEFAULT 'preseason',
  mode text NOT NULL DEFAULT 'ranked',
  rating integer NOT NULL DEFAULT 1000 CHECK (rating >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  draws integer NOT NULL DEFAULT 0 CHECK (draws >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, season_key, mode)
);
CREATE INDEX ratings_leaderboard_idx ON public.player_ratings (season_key, mode, rating DESC);

-- Per-card summary used by ranked: copies = playable copies (owned available assets, later + rented-in).
CREATE TABLE public.player_cards (
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id text NOT NULL REFERENCES public.cards(id),
  copies integer NOT NULL DEFAULT 1 CHECK (copies >= 0),
  level smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  experience integer NOT NULL DEFAULT 0 CHECK (experience >= 0),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, card_id)
);
CREATE INDEX player_cards_player_idx ON public.player_cards (player_id, level DESC);

-- Saved teams: one row per team (summoner + ordered unit ids).
CREATE TABLE public.decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  banner_id text NOT NULL CHECK (banner_id IN ('bastion_orders','wild_courts','veil_covenant','hollow_legions','skybound_houses','wyrm_clans')),
  summoner_card_id text REFERENCES public.cards(id),
  unit_card_ids text[] NOT NULL DEFAULT '{}' CHECK (cardinality(unit_card_ids) <= 6),
  mode text NOT NULL DEFAULT 'ranked',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, name)
);

-- ===== Ranked matchmaking and matches =====
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_version_id uuid NOT NULL REFERENCES public.game_versions(id),
  engine_version text NOT NULL,
  mode text NOT NULL,
  region text NOT NULL DEFAULT 'global',
  status text NOT NULL DEFAULT 'team_selection' CHECK (status IN ('team_selection','resolving','completed','cancelled','invalid')),
  mana_cap smallint NOT NULL CHECK (mana_cap BETWEEN 10 AND 99),
  seed text NOT NULL,
  ruleset_ids text[] NOT NULL DEFAULT '{}',
  winner_player_id uuid REFERENCES public.profiles(id),
  outcome text CHECK (outcome IN ('side_1','side_2','draw','cancelled','invalid')),
  result jsonb CHECK (result IS NULL OR jsonb_typeof(result) = 'object'),
  replay jsonb CHECK (replay IS NULL OR jsonb_typeof(replay) = 'object'),
  input_hash text,
  result_hash text,
  selection_deadline timestamptz NOT NULL DEFAULT (now() + interval '90 seconds'),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX matches_status_idx ON public.matches (status, created_at);
CREATE INDEX matches_completed_idx ON public.matches (completed_at DESC) WHERE status = 'completed';

CREATE TABLE public.matchmaking_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_version_id uuid NOT NULL REFERENCES public.game_versions(id),
  season_key text NOT NULL DEFAULT 'preseason',
  mode text NOT NULL DEFAULT 'ranked',
  region text NOT NULL DEFAULT 'global',
  rating integer NOT NULL,
  rating_delta integer NOT NULL DEFAULT 150 CHECK (rating_delta BETWEEN 0 AND 1000),
  status text NOT NULL DEFAULT 'searching' CHECK (status IN ('searching','matched','cancelled','expired')),
  match_id uuid REFERENCES public.matches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  matched_at timestamptz
);
CREATE UNIQUE INDEX one_searching_ticket_per_player ON public.matchmaking_tickets (player_id) WHERE status = 'searching';
CREATE INDEX matchmaking_search_idx ON public.matchmaking_tickets (game_version_id, mode, region, rating, created_at) WHERE status = 'searching';
CREATE INDEX matchmaking_player_idx ON public.matchmaking_tickets (player_id, created_at DESC);

CREATE TABLE public.match_players (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id),
  side smallint NOT NULL CHECK (side IN (1,2)),
  rating_before integer NOT NULL,
  rating_after integer,
  result text CHECK (result IN ('win','loss','draw','cancelled')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id),
  UNIQUE (match_id, side)
);
CREATE INDEX match_players_player_history_idx ON public.match_players (player_id, joined_at DESC);

CREATE TABLE public.match_submissions (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id),
  summoner_card_id text NOT NULL REFERENCES public.cards(id),
  summoner_level smallint NOT NULL CHECK (summoner_level BETWEEN 1 AND 10),
  formation jsonb NOT NULL CHECK (jsonb_typeof(formation) = 'array' AND jsonb_array_length(formation) BETWEEN 1 AND 6),
  calculated_mana smallint NOT NULL CHECK (calculated_mana >= 0),
  submission_hash text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id),
  FOREIGN KEY (match_id, player_id) REFERENCES public.match_players(match_id, player_id)
);

-- ===== Wallets (Credits whole numbers, Coins 8 decimals) =====
CREATE TABLE public.currency_balances (
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency text NOT NULL CHECK (currency IN ('credits','coins')),
  available numeric(30,8) NOT NULL DEFAULT 0 CHECK (available >= 0),
  locked numeric(30,8) NOT NULL DEFAULT 0 CHECK (locked >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, currency)
);

CREATE TABLE public.currency_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id),
  currency text NOT NULL CHECK (currency IN ('credits','coins')),
  amount numeric(30,8) NOT NULL CHECK (amount <> 0),
  balance_after numeric(30,8) NOT NULL CHECK (balance_after >= 0),
  entry_type text NOT NULL CHECK (entry_type ~ '^[a-z][a-z0-9_]{1,47}$'),
  reference_type text,
  reference_id text,
  idempotency_key text UNIQUE NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX currency_ledger_player_idx ON public.currency_ledger (player_id, created_at DESC);

-- ===== Packs and card assets =====
CREATE TABLE public.pack_supply (
  set_id text PRIMARY KEY CHECK (set_id IN ('ancient','oath','legionnaire')),
  price_credits bigint NOT NULL DEFAULT 1000 CHECK (price_credits > 0),
  maximum_packs bigint NOT NULL,
  public_allocation bigint NOT NULL,
  reserve_allocation bigint NOT NULL,
  sold_packs bigint NOT NULL DEFAULT 0 CHECK (sold_packs >= 0),
  reserve_issued bigint NOT NULL DEFAULT 0 CHECK (reserve_issued >= 0),
  opened_packs bigint NOT NULL DEFAULT 0 CHECK (opened_packs >= 0),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (public_allocation + reserve_allocation = maximum_packs),
  CHECK (sold_packs <= public_allocation),
  CHECK (reserve_issued <= reserve_allocation),
  CHECK (opened_packs <= sold_packs + reserve_issued)
);

CREATE TABLE public.player_packs (
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  set_id text NOT NULL REFERENCES public.pack_supply(set_id),
  quantity bigint NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, set_id)
);

CREATE TABLE public.pack_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  set_id text NOT NULL REFERENCES public.pack_supply(set_id),
  status text NOT NULL DEFAULT 'committed' CHECK (status IN ('committed','revealed')),
  commit_hash text NOT NULL,
  algorithm text NOT NULL,
  catalog_version text NOT NULL,
  server_seed text,
  client_seed text,
  results jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  revealed_at timestamptz
);
CREATE UNIQUE INDEX pack_openings_one_pending ON public.pack_openings (player_id, set_id) WHERE status = 'committed';
CREATE INDEX pack_openings_player_idx ON public.pack_openings (player_id, created_at DESC);

-- Hidden server seeds until reveal (no player access at all).
CREATE TABLE public.pack_opening_secrets (
  opening_id uuid PRIMARY KEY REFERENCES public.pack_openings(id) ON DELETE CASCADE,
  server_seed text NOT NULL
);

CREATE TABLE public.card_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  card_id text NOT NULL REFERENCES public.cards(id),
  foil text NOT NULL DEFAULT 'regular' CHECK (foil IN ('regular','gold')),
  level smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','listed','rented','escrowed','burned')),
  opening_id uuid REFERENCES public.pack_openings(id),
  slot smallint CHECK (slot BETWEEN 0 AND 9),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opening_id, slot)
);
CREATE INDEX card_assets_owner_idx ON public.card_assets (owner_id, status);
CREATE INDEX card_assets_owner_card_idx ON public.card_assets (owner_id, card_id);

-- ===== Grants =====
GRANT SELECT ON public.game_versions, public.cards, public.rulesets, public.pack_supply TO anon, authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.player_ratings, public.player_cards, public.matchmaking_tickets, public.matches, public.match_players,
  public.match_submissions, public.currency_balances, public.currency_ledger, public.player_packs, public.pack_openings,
  public.card_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decks TO authenticated;
GRANT ALL ON public.game_versions, public.cards, public.rulesets, public.profiles, public.player_ratings, public.player_cards,
  public.decks, public.matches, public.matchmaking_tickets, public.match_players, public.match_submissions,
  public.currency_balances, public.currency_ledger, public.pack_supply, public.player_packs, public.pack_openings,
  public.pack_opening_secrets, public.card_assets TO service_role;

-- ===== Row level security =====
ALTER TABLE public.game_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_supply ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_opening_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_assets ENABLE ROW LEVEL SECURITY;

-- Read helper avoids recursive RLS checks on match_players.
CREATE OR REPLACE FUNCTION public.is_match_player(p_match_id uuid, p_player_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.match_players WHERE match_id = p_match_id AND player_id = p_player_id);
$$;

CREATE POLICY catalog_versions_read ON public.game_versions FOR SELECT TO anon, authenticated USING (status IN ('active','retired'));
CREATE POLICY catalog_cards_read ON public.cards FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY catalog_rulesets_read ON public.rulesets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pack_supply_read ON public.pack_supply FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY ratings_read ON public.player_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_read_own ON public.player_cards FOR SELECT TO authenticated USING (player_id = auth.uid());

CREATE POLICY decks_read_own ON public.decks FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY decks_insert_own ON public.decks FOR INSERT TO authenticated WITH CHECK (player_id = auth.uid());
CREATE POLICY decks_update_own ON public.decks FOR UPDATE TO authenticated USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());
CREATE POLICY decks_delete_own ON public.decks FOR DELETE TO authenticated USING (player_id = auth.uid());

CREATE POLICY tickets_read_own ON public.matchmaking_tickets FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY matches_read_participant ON public.matches FOR SELECT TO authenticated USING (public.is_match_player(id));
CREATE POLICY match_players_read_participant ON public.match_players FOR SELECT TO authenticated USING (public.is_match_player(match_id));
-- Players see only their own locked team; the opponent's is revealed through the completed replay.
CREATE POLICY match_submissions_read_own ON public.match_submissions FOR SELECT TO authenticated USING (player_id = auth.uid());

CREATE POLICY balances_read_own ON public.currency_balances FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY ledger_read_own ON public.currency_ledger FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY player_packs_read_own ON public.player_packs FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY pack_openings_read_own ON public.pack_openings FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY card_assets_read ON public.card_assets FOR SELECT TO authenticated USING (owner_id = auth.uid() OR status IN ('listed','rented'));

-- ===== Timestamps =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER player_cards_updated_at BEFORE UPDATE ON public.player_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER decks_updated_at BEFORE UPDATE ON public.decks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ratings_updated_at BEFORE UPDATE ON public.player_ratings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER player_packs_updated_at BEFORE UPDATE ON public.player_packs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pack_supply_updated_at BEFORE UPDATE ON public.pack_supply FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER balances_updated_at BEFORE UPDATE ON public.currency_balances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Signup: profile (sanitized, de-duplicated username), preseason rating, zero wallets; no cards =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_base text; v_name text; v_display text; v_try integer := 0;
BEGIN
  v_base := regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^A-Za-z0-9_]', '', 'g');
  IF char_length(v_base) < 3 THEN v_base := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8); END IF;
  v_base := left(v_base, 20);
  v_name := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_name)) LOOP
    v_try := v_try + 1;
    v_name := left(v_base, 15) || '_' || lpad((floor(random() * 10000))::int::text, 4, '0');
    IF v_try > 20 THEN v_name := 'player_' || substr(replace(new.id::text, '-', ''), 1, 12); EXIT; END IF;
  END LOOP;
  v_display := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 32), '');
  IF v_display IS NULL OR v_display = v_base THEN v_display := v_name; END IF;

  INSERT INTO public.profiles (id, username, display_name) VALUES (new.id, v_name, v_display);
  INSERT INTO public.player_ratings (player_id, season_key, mode) VALUES (new.id, 'preseason', 'ranked') ON CONFLICT DO NOTHING;
  INSERT INTO public.currency_balances (player_id, currency) VALUES (new.id, 'credits'), (new.id, 'coins') ON CONFLICT DO NOTHING;
  RETURN new;
END;
$$;

-- ===== Ledger: the only way balances change (server only) =====
CREATE OR REPLACE FUNCTION public.record_ledger_entry(
  p_player_id uuid, p_currency text, p_amount numeric, p_entry_type text, p_idempotency_key text,
  p_reference_type text DEFAULT NULL, p_reference_id text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.currency_ledger%rowtype; v_bal numeric;
BEGIN
  IF p_currency NOT IN ('credits','coins') THEN RAISE EXCEPTION 'Invalid currency'; END IF;
  IF p_amount IS NULL OR p_amount = 0 OR p_amount <> round(p_amount, 8) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_currency = 'credits' AND p_amount <> trunc(p_amount) THEN RAISE EXCEPTION 'Credits must be whole numbers'; END IF;

  SELECT * INTO e FROM public.currency_ledger WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF e.player_id <> p_player_id OR e.currency <> p_currency OR e.amount <> p_amount OR e.entry_type <> p_entry_type THEN
      RAISE EXCEPTION 'Idempotency key reused with different values';
    END IF;
    RETURN jsonb_build_object('entryId', e.id, 'balanceAfter', e.balance_after::text, 'duplicate', true);
  END IF;

  INSERT INTO public.currency_balances (player_id, currency) VALUES (p_player_id, p_currency) ON CONFLICT DO NOTHING;
  SELECT available INTO v_bal FROM public.currency_balances WHERE player_id = p_player_id AND currency = p_currency FOR UPDATE;
  IF v_bal + p_amount < 0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.currency_balances SET available = v_bal + p_amount WHERE player_id = p_player_id AND currency = p_currency;
  INSERT INTO public.currency_ledger (player_id, currency, amount, balance_after, entry_type, reference_type, reference_id, idempotency_key, metadata)
    VALUES (p_player_id, p_currency, p_amount, v_bal + p_amount, p_entry_type, p_reference_type, p_reference_id, p_idempotency_key, coalesce(p_metadata, '{}'::jsonb))
    RETURNING * INTO e;
  RETURN jsonb_build_object('entryId', e.id, 'balanceAfter', e.balance_after::text, 'duplicate', false);
END;
$$;

-- ===== Packs =====
-- Playable copies of a card (owned available assets); later migrations add rented-in cards.
CREATE OR REPLACE FUNCTION public.refresh_player_card(p_player_id uuid, p_card_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v integer;
BEGIN
  SELECT count(*) INTO v FROM public.card_assets WHERE owner_id = p_player_id AND card_id = p_card_id AND status = 'available';
  INSERT INTO public.player_cards (player_id, card_id, copies) VALUES (p_player_id, p_card_id, v)
  ON CONFLICT (player_id, card_id) DO UPDATE SET copies = excluded.copies;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_packs(p_player_id uuid, p_set_id text, p_quantity integer, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.pack_supply%rowtype; v_debit jsonb; v_owned bigint; v_bal numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  -- Replayed request: return the current state, never add packs twice.
  IF EXISTS (SELECT 1 FROM public.currency_ledger WHERE idempotency_key = p_idempotency_key) THEN
    SELECT coalesce((SELECT quantity FROM public.player_packs WHERE player_id = p_player_id AND set_id = p_set_id), 0) INTO v_owned;
    SELECT coalesce((SELECT available FROM public.currency_balances WHERE player_id = p_player_id AND currency = 'credits'), 0) INTO v_bal;
    RETURN jsonb_build_object('owned', v_owned, 'balanceAfter', v_bal::text, 'duplicate', true);
  END IF;
  SELECT * INTO s FROM public.pack_supply WHERE set_id = p_set_id FOR UPDATE;
  IF NOT FOUND OR NOT s.active THEN RAISE EXCEPTION 'This pack is not on sale'; END IF;
  IF s.sold_packs + p_quantity > s.public_allocation THEN RAISE EXCEPTION 'Sold out'; END IF;

  v_debit := public.record_ledger_entry(p_player_id, 'credits', -(s.price_credits * p_quantity), 'pack_purchase', p_idempotency_key,
    'pack_supply', p_set_id, jsonb_build_object('pack', p_set_id, 'quantity', p_quantity, 'priceCredits', s.price_credits));
  UPDATE public.pack_supply SET sold_packs = sold_packs + p_quantity WHERE set_id = p_set_id;
  INSERT INTO public.player_packs (player_id, set_id, quantity) VALUES (p_player_id, p_set_id, p_quantity)
  ON CONFLICT (player_id, set_id) DO UPDATE SET quantity = public.player_packs.quantity + excluded.quantity
  RETURNING quantity INTO v_owned;
  RETURN jsonb_build_object('owned', v_owned, 'balanceAfter', v_debit ->> 'balanceAfter', 'duplicate', false);
END;
$$;

-- Step 1: commit to a hidden server seed (commit hash = sha256 of the seed). Re-uses a pending opening.
CREATE OR REPLACE FUNCTION public.commit_pack_opening(p_player_id uuid, p_set_id text, p_server_seed text, p_algorithm text, p_catalog_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.pack_openings%rowtype;
BEGIN
  SELECT * INTO o FROM public.pack_openings WHERE player_id = p_player_id AND set_id = p_set_id AND status = 'committed';
  IF FOUND THEN RETURN jsonb_build_object('openingId', o.id, 'commitHash', o.commit_hash, 'existing', true); END IF;
  IF coalesce((SELECT quantity FROM public.player_packs WHERE player_id = p_player_id AND set_id = p_set_id), 0) < 1 THEN
    RAISE EXCEPTION 'No unopened pack';
  END IF;
  IF p_server_seed IS NULL OR char_length(p_server_seed) < 16 THEN RAISE EXCEPTION 'Invalid server seed'; END IF;
  INSERT INTO public.pack_openings (player_id, set_id, commit_hash, algorithm, catalog_version)
    VALUES (p_player_id, p_set_id, encode(sha256(convert_to(p_server_seed, 'UTF8')), 'hex'), p_algorithm, p_catalog_version)
    RETURNING * INTO o;
  INSERT INTO public.pack_opening_secrets (opening_id, server_seed) VALUES (o.id, p_server_seed);
  RETURN jsonb_build_object('openingId', o.id, 'commitHash', o.commit_hash, 'existing', false);
END;
$$;

-- Step 2: burn one pack, mint the pulled cards as assets, publish the seeds. Idempotent per opening.
CREATE OR REPLACE FUNCTION public.reveal_pack_opening(p_player_id uuid, p_opening_id uuid, p_client_seed text, p_results jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.pack_openings%rowtype; v_seed text; r jsonb; v_asset uuid; v_out jsonb := '[]'::jsonb; v_card text;
BEGIN
  SELECT * INTO o FROM public.pack_openings WHERE id = p_opening_id AND player_id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening not found'; END IF;
  IF o.status = 'revealed' THEN
    RETURN jsonb_build_object('results', o.results, 'serverSeed', o.server_seed, 'clientSeed', o.client_seed, 'duplicate', true);
  END IF;
  SELECT server_seed INTO v_seed FROM public.pack_opening_secrets WHERE opening_id = o.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opening not found'; END IF;
  IF jsonb_typeof(p_results) <> 'array' OR jsonb_array_length(p_results) < 1 OR jsonb_array_length(p_results) > 10 THEN
    RAISE EXCEPTION 'Invalid results';
  END IF;

  UPDATE public.player_packs SET quantity = quantity - 1 WHERE player_id = p_player_id AND set_id = o.set_id AND quantity > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'No unopened pack'; END IF;
  UPDATE public.pack_supply SET opened_packs = opened_packs + 1 WHERE set_id = o.set_id;

  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_card := r ->> 'cardId';
    INSERT INTO public.card_assets (owner_id, card_id, foil, opening_id, slot)
      VALUES (p_player_id, v_card, coalesce(r ->> 'foil', 'regular'), o.id, (r ->> 'slot')::smallint)
      RETURNING id INTO v_asset;
    v_out := v_out || jsonb_build_array(jsonb_build_object('assetId', v_asset, 'cardId', v_card, 'foil', coalesce(r ->> 'foil', 'regular'),
      'rarity', r ->> 'rarity', 'slot', (r ->> 'slot')::int));
  END LOOP;
  FOR v_card IN SELECT DISTINCT x ->> 'cardId' FROM jsonb_array_elements(p_results) x LOOP
    PERFORM public.refresh_player_card(p_player_id, v_card);
  END LOOP;

  UPDATE public.pack_openings SET status = 'revealed', server_seed = v_seed, client_seed = p_client_seed, results = v_out, revealed_at = now()
    WHERE id = o.id;
  DELETE FROM public.pack_opening_secrets WHERE opening_id = o.id;
  RETURN jsonb_build_object('results', v_out, 'serverSeed', v_seed, 'clientSeed', p_client_seed, 'duplicate', false);
END;
$$;

-- ===== Ranked matchmaking =====
CREATE OR REPLACE FUNCTION public.both_teams_locked(p_match_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*) = 2 FROM public.match_submissions WHERE match_id = p_match_id;
$$;

-- Pair a searching ticket with the closest eligible opponent and create the match. Returns the match id or NULL.
CREATE OR REPLACE FUNCTION public._try_match_ticket(p_ticket_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t public.matchmaking_tickets%rowtype; opp public.matchmaking_tickets%rowtype; v public.game_versions%rowtype;
  v_match uuid; v_rules text[] := '{}'; v_count integer; v_pick record; v_caps integer[] := ARRAY[13,15,17,19,21,24,27,30,35,40];
  v_wait numeric;
BEGIN
  SELECT * INTO t FROM public.matchmaking_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND OR t.status <> 'searching' OR t.expires_at <= now() THEN RETURN NULL; END IF;
  -- Rating window widens by 50 every 15 seconds of waiting (max 1000).
  v_wait := extract(epoch FROM (now() - t.created_at));
  SELECT * INTO opp FROM public.matchmaking_tickets o
   WHERE o.status = 'searching' AND o.id <> t.id AND o.player_id <> t.player_id
     AND o.game_version_id = t.game_version_id AND o.mode = t.mode AND o.region = t.region AND o.expires_at > now()
     AND abs(o.rating - t.rating) <= least(1000, greatest(o.rating_delta, t.rating_delta) + floor(v_wait / 15) * 50)
   ORDER BY abs(o.rating - t.rating), o.created_at
   FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v FROM public.game_versions WHERE id = t.game_version_id;

  -- 0-2 compatible battle rules, weighted by selection_weight (only engine-supported rules have weight).
  v_count := floor(random() * 3)::int;
  WHILE cardinality(v_rules) < v_count LOOP
    SELECT r.id INTO v_pick FROM public.rulesets r
     WHERE r.active AND r.selection_weight > 0 AND r.game_version_id = v.id
       AND NOT (r.id = ANY (v_rules)) AND NOT (r.incompatible_with && v_rules)
       AND NOT EXISTS (SELECT 1 FROM public.rulesets x WHERE x.id = ANY (v_rules) AND r.id = ANY (x.incompatible_with))
     ORDER BY -ln(greatest(random(), 1e-12)) / r.selection_weight LIMIT 1;
    EXIT WHEN NOT FOUND;
    v_rules := v_rules || v_pick.id::text;
  END LOOP;

  INSERT INTO public.matches (game_version_id, engine_version, mode, region, mana_cap, seed, ruleset_ids)
    VALUES (v.id, v.engine_version, t.mode, t.region, v_caps[1 + floor(random() * cardinality(v_caps))::int],
            encode(extensions.gen_random_bytes(16), 'hex'), v_rules)
    RETURNING id INTO v_match;
  INSERT INTO public.match_players (match_id, player_id, side, rating_before)
    VALUES (v_match, opp.player_id, 1, opp.rating), (v_match, t.player_id, 2, t.rating);
  UPDATE public.matchmaking_tickets SET status = 'matched', match_id = v_match, matched_at = now() WHERE id IN (t.id, opp.id);
  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_matchmaking(p_mode text DEFAULT 'ranked', p_region text DEFAULT 'global', p_rating_delta integer DEFAULT 150)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v public.game_versions%rowtype; v_rating integer; v_ticket uuid; v_match uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_rating_delta NOT BETWEEN 0 AND 1000 THEN RAISE EXCEPTION 'Invalid rating delta'; END IF;
  IF EXISTS (SELECT 1 FROM public.match_players mp JOIN public.matches m ON m.id = mp.match_id
              WHERE mp.player_id = v_user AND m.status IN ('team_selection','resolving')) THEN
    RAISE EXCEPTION 'Finish your current match first';
  END IF;
  SELECT * INTO v FROM public.game_versions WHERE status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'No active game version'; END IF;

  INSERT INTO public.player_ratings (player_id, season_key, mode) VALUES (v_user, 'preseason', p_mode) ON CONFLICT DO NOTHING;
  SELECT rating INTO v_rating FROM public.player_ratings WHERE player_id = v_user AND season_key = 'preseason' AND mode = p_mode;
  UPDATE public.matchmaking_tickets SET status = 'cancelled' WHERE player_id = v_user AND status = 'searching';
  INSERT INTO public.matchmaking_tickets (player_id, game_version_id, season_key, mode, region, rating, rating_delta)
    VALUES (v_user, v.id, 'preseason', p_mode, p_region, v_rating, p_rating_delta) RETURNING id INTO v_ticket;
  v_match := public._try_match_ticket(v_ticket);
  RETURN jsonb_build_object('ticketId', v_ticket, 'matchId', v_match, 'status', CASE WHEN v_match IS NULL THEN 'searching' ELSE 'matched' END);
END;
$$;

-- Poll helper: re-try the caller's searching ticket (the rating window widens while waiting).
CREATE OR REPLACE FUNCTION public.retry_matchmaking()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ticket uuid; v_match uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT id INTO v_ticket FROM public.matchmaking_tickets WHERE player_id = auth.uid() AND status = 'searching' AND expires_at > now();
  IF NOT FOUND THEN RETURN jsonb_build_object('ticketId', NULL, 'matchId', NULL, 'status', 'idle'); END IF;
  v_match := public._try_match_ticket(v_ticket);
  RETURN jsonb_build_object('ticketId', v_ticket, 'matchId', v_match, 'status', CASE WHEN v_match IS NULL THEN 'searching' ELSE 'matched' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_matchmaking()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.matchmaking_tickets SET status = 'cancelled' WHERE player_id = auth.uid() AND status = 'searching';
$$;

-- Trusted server calls this after validating the team against catalog, ownership, mana and rules.
CREATE OR REPLACE FUNCTION public.lock_match_submission(p_match_id uuid, p_player_id uuid, p_summoner_card_id text, p_summoner_level smallint,
  p_formation jsonb, p_calculated_mana smallint, p_submission_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_deadline timestamptz;
BEGIN
  SELECT selection_deadline INTO v_deadline FROM public.matches WHERE id = p_match_id AND status = 'team_selection' FOR UPDATE;
  IF NOT FOUND OR v_deadline < now() THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.match_players WHERE match_id = p_match_id AND player_id = p_player_id) THEN RETURN false; END IF;
  INSERT INTO public.match_submissions (match_id, player_id, summoner_card_id, summoner_level, formation, calculated_mana, submission_hash)
    VALUES (p_match_id, p_player_id, p_summoner_card_id, p_summoner_level, p_formation, p_calculated_mana, p_submission_hash)
    ON CONFLICT (match_id, player_id) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.match_submissions WHERE match_id = p_match_id) = 2 THEN
    UPDATE public.matches SET status = 'resolving', started_at = now() WHERE id = p_match_id AND status = 'team_selection';
  END IF;
  RETURN true;
END;
$$;

-- Idempotent finalization and Elo update (K=32). Trusted server only. (Rewards are added by a later migration.)
CREATE OR REPLACE FUNCTION public.finalize_match(p_match_id uuid, p_outcome text, p_winner_player_id uuid, p_result jsonb, p_replay jsonb, p_input_hash text, p_result_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p1 public.match_players%rowtype; p2 public.match_players%rowtype; e1 numeric; s1 numeric; n1 integer; n2 integer;
BEGIN
  PERFORM 1 FROM public.matches WHERE id = p_match_id AND status = 'resolving' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_outcome NOT IN ('side_1','side_2','draw') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
  SELECT * INTO p1 FROM public.match_players WHERE match_id = p_match_id AND side = 1;
  SELECT * INTO p2 FROM public.match_players WHERE match_id = p_match_id AND side = 2;
  e1 := 1.0 / (1.0 + power(10.0, (p2.rating_before - p1.rating_before) / 400.0));
  s1 := CASE p_outcome WHEN 'side_1' THEN 1.0 WHEN 'draw' THEN 0.5 ELSE 0.0 END;
  n1 := greatest(0, round(p1.rating_before + 32 * (s1 - e1))::integer);
  n2 := greatest(0, round(p2.rating_before + 32 * ((1 - s1) - (1 - e1)))::integer);
  UPDATE public.matches SET status = 'completed', outcome = p_outcome, winner_player_id = p_winner_player_id, result = p_result, replay = p_replay,
    input_hash = p_input_hash, result_hash = p_result_hash, completed_at = now() WHERE id = p_match_id;
  UPDATE public.match_players SET rating_after = n1, result = CASE p_outcome WHEN 'side_1' THEN 'win' WHEN 'draw' THEN 'draw' ELSE 'loss' END
    WHERE match_id = p_match_id AND side = 1;
  UPDATE public.match_players SET rating_after = n2, result = CASE p_outcome WHEN 'side_2' THEN 'win' WHEN 'draw' THEN 'draw' ELSE 'loss' END
    WHERE match_id = p_match_id AND side = 2;
  UPDATE public.player_ratings r SET rating = mp.rating_after,
    wins = r.wins + CASE WHEN mp.result = 'win' THEN 1 ELSE 0 END,
    losses = r.losses + CASE WHEN mp.result = 'loss' THEN 1 ELSE 0 END,
    draws = r.draws + CASE WHEN mp.result = 'draw' THEN 1 ELSE 0 END
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id AND r.player_id = mp.player_id AND r.season_key = 'preseason'
    AND r.mode = (SELECT mode FROM public.matches WHERE id = p_match_id);
  RETURN true;
END;
$$;

-- Expire stale tickets and settle team-selection matches past their deadline:
-- one team locked = that player wins by timeout (rated), no team locked = cancelled (unrated). Returns matches settled.
CREATE OR REPLACE FUNCTION public.expire_stale_matches()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.matches%rowtype; v_sub uuid; v_side smallint; v_n integer := 0;
  p1 public.match_players%rowtype; p2 public.match_players%rowtype; e1 numeric; s1 numeric; n1 integer; n2 integer;
BEGIN
  UPDATE public.matchmaking_tickets SET status = 'expired' WHERE status = 'searching' AND expires_at <= now();
  FOR m IN SELECT * FROM public.matches WHERE status = 'team_selection' AND selection_deadline < now() ORDER BY selection_deadline
           FOR UPDATE SKIP LOCKED LOOP
    IF (SELECT count(*) FROM public.match_submissions WHERE match_id = m.id) = 1 THEN
      SELECT s.player_id, mp.side INTO v_sub, v_side FROM public.match_submissions s
        JOIN public.match_players mp ON mp.match_id = s.match_id AND mp.player_id = s.player_id WHERE s.match_id = m.id;
      SELECT * INTO p1 FROM public.match_players WHERE match_id = m.id AND side = 1;
      SELECT * INTO p2 FROM public.match_players WHERE match_id = m.id AND side = 2;
      e1 := 1.0 / (1.0 + power(10.0, (p2.rating_before - p1.rating_before) / 400.0));
      s1 := CASE WHEN v_side = 1 THEN 1.0 ELSE 0.0 END;
      n1 := greatest(0, round(p1.rating_before + 32 * (s1 - e1))::integer);
      n2 := greatest(0, round(p2.rating_before + 32 * ((1 - s1) - (1 - e1)))::integer);
      UPDATE public.matches SET status = 'completed', outcome = CASE WHEN v_side = 1 THEN 'side_1' ELSE 'side_2' END,
        winner_player_id = v_sub, result = jsonb_build_object('outcome', CASE WHEN v_side = 1 THEN 'side_1' ELSE 'side_2' END,
          'winnerPlayerId', v_sub, 'reason', 'timeout'), completed_at = now()
        WHERE id = m.id;
      UPDATE public.match_players SET rating_after = n1, result = CASE WHEN v_side = 1 THEN 'win' ELSE 'loss' END WHERE match_id = m.id AND side = 1;
      UPDATE public.match_players SET rating_after = n2, result = CASE WHEN v_side = 2 THEN 'win' ELSE 'loss' END WHERE match_id = m.id AND side = 2;
      UPDATE public.player_ratings r SET rating = mp.rating_after,
        wins = r.wins + CASE WHEN mp.result = 'win' THEN 1 ELSE 0 END,
        losses = r.losses + CASE WHEN mp.result = 'loss' THEN 1 ELSE 0 END
      FROM public.match_players mp
      WHERE mp.match_id = m.id AND r.player_id = mp.player_id AND r.season_key = 'preseason' AND r.mode = m.mode;
      IF to_regprocedure('public.accrue_match_rewards(uuid)') IS NOT NULL THEN
        EXECUTE 'SELECT public.accrue_match_rewards($1)' USING m.id;
      END IF;
    ELSE
      UPDATE public.matches SET status = 'cancelled', outcome = 'cancelled', result = jsonb_build_object('outcome', 'cancelled', 'reason', 'timeout'),
        completed_at = now() WHERE id = m.id;
      UPDATE public.match_players SET rating_after = rating_before, result = 'cancelled' WHERE match_id = m.id;
    END IF;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

-- ===== Ladder read helpers (public results only; match tables stay participant-only) =====
CREATE OR REPLACE FUNCTION public.ladder_recent_results(p_player_ids uuid[], p_per_player integer DEFAULT 20)
RETURNS TABLE (player_id uuid, result text, completed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT x.player_id, x.result, x.completed_at FROM (
    SELECT mp.player_id, mp.result, m.completed_at,
           row_number() OVER (PARTITION BY mp.player_id ORDER BY m.completed_at DESC) AS rn
      FROM public.match_players mp JOIN public.matches m ON m.id = mp.match_id
     WHERE mp.player_id = ANY (p_player_ids) AND m.status = 'completed' AND m.mode = 'ranked' AND mp.result IS NOT NULL
  ) x
  WHERE x.rn <= least(greatest(coalesce(p_per_player, 20), 1), 50)
  ORDER BY x.player_id, x.completed_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.ladder_summoner_stats()
RETURNS TABLE (summoner_card_id text, games bigint, wins bigint, draws bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.summoner_card_id, count(*) AS games,
         count(*) FILTER (WHERE mp.result = 'win') AS wins,
         count(*) FILTER (WHERE mp.result = 'draw') AS draws
    FROM public.match_submissions s
    JOIN public.match_players mp ON mp.match_id = s.match_id AND mp.player_id = s.player_id
    JOIN public.matches m ON m.id = s.match_id
   WHERE m.status = 'completed' AND m.mode = 'ranked'
   GROUP BY s.summoner_card_id;
$$;

-- ===== Function permissions =====
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_ledger_entry(uuid, text, numeric, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_player_card(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_packs(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.commit_pack_opening(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reveal_pack_opening(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._try_match_ticket(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_match_submission(uuid, uuid, text, smallint, jsonb, smallint, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_match(uuid, text, uuid, jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_matches() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_matchmaking(text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.retry_matchmaking() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_matchmaking() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ladder_recent_results(uuid[], integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ladder_summoner_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_match_player(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.both_teams_locked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_matchmaking(text, text, integer), public.retry_matchmaking(), public.cancel_matchmaking(),
  public.ladder_recent_results(uuid[], integer), public.ladder_summoner_stats(), public.is_match_player(uuid, uuid),
  public.both_teams_locked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ledger_entry(uuid, text, numeric, text, text, text, text, jsonb), public.refresh_player_card(uuid, text),
  public.purchase_packs(uuid, text, integer, text), public.commit_pack_opening(uuid, text, text, text, text),
  public.reveal_pack_opening(uuid, uuid, text, jsonb), public._try_match_ticket(uuid),
  public.lock_match_submission(uuid, uuid, text, smallint, jsonb, smallint, text),
  public.finalize_match(uuid, text, uuid, jsonb, jsonb, text, text), public.expire_stale_matches(),
  public.join_matchmaking(text, text, integer), public.retry_matchmaking(), public.cancel_matchmaking(),
  public.ladder_recent_results(uuid[], integer), public.ladder_summoner_stats(), public.is_match_player(uuid, uuid),
  public.both_teams_locked(uuid) TO service_role;
