begin;

create table if not exists public.economy_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.economy_config(key,value) values
('economy-1.0.0','{"version":"economy-1.0.0","currencies":{"credits":{"transferable":false,"withdrawable":false,"usdPerUnit":0.001,"unitsPerUsd":1000},"coins":{"transferable":true,"withdrawable":true,"blockchainToken":true,"totalSupply":1000000000,"decimals":8}},"coinAllocation":{"gameplayRewards":320000000,"liquidity":180000000,"ecosystemTreasury":180000000,"teamContributors":150000000,"communityLaunch":80000000,"partnersValidators":50000000,"emergencyReserve":40000000},"emissions":{"yearOne":64000000,"annualMultiplier":0.8,"buckets":{"matchWins":0.625,"dailyActivity":0.1875,"leagueSeason":0.125,"leaderboards":0.0625}},"seasons":{"days":14,"minimumLeaderboardBattles":100,"minimumLeagueRewardBattles":20,"minimumLeagueRewardWins":5},"rewardEnergy":{"maximum":24,"regenerationMinutes":60,"costPerRankedBattle":1},"leagues":[{"id":"wood","minimumRating":0,"maximumRating":999,"winMultiplier":0,"dailyMultiplier":0,"leaderboardPoolShare":0},{"id":"bronze","minimumRating":1000,"maximumRating":1399,"winMultiplier":1,"dailyMultiplier":1,"leaderboardPoolShare":0.1},{"id":"silver","minimumRating":1400,"maximumRating":1799,"winMultiplier":1.75,"dailyMultiplier":1.2,"leaderboardPoolShare":0.15},{"id":"gold","minimumRating":1800,"maximumRating":2199,"winMultiplier":3,"dailyMultiplier":1.4,"leaderboardPoolShare":0.2},{"id":"diamond","minimumRating":2200,"maximumRating":2599,"winMultiplier":5,"dailyMultiplier":1.7,"leaderboardPoolShare":0.25},{"id":"champion","minimumRating":2600,"maximumRating":null,"winMultiplier":8,"dailyMultiplier":2,"leaderboardPoolShare":0.3}],"rewardShareFormula":{"baseWinShares":100,"opponentFactorMin":0.75,"opponentFactorMax":1.25,"opponentRatingDivisor":1600,"streakBonusPerWin":0.03,"streakBonusMaximum":0.15,"goldFoilBonusPerCard":0.02,"goldFoilBonusMaximum":0.14,"dailyAccountPoolCap":0.005},"dailyActivity":{"maximumPoints":100,"minimumWins":3,"accountPoolCap":0.0025},"leaderboardPayoutBands":[{"from":1,"to":1,"poolSharePerPlayer":0.15},{"from":2,"to":2,"poolSharePerPlayer":0.1},{"from":3,"to":3,"poolSharePerPlayer":0.07},{"from":4,"to":5,"poolSharePerPlayer":0.04},{"from":6,"to":10,"poolSharePerPlayer":0.03},{"from":11,"to":20,"poolSharePerPlayer":0.02},{"from":21,"to":50,"poolSharePerPlayer":0.008333333333333333}],"fees":{"coinToCreditsSpread":0.02,"conversionBurn":0.5,"conversionTreasury":0.4,"conversionRewardReserve":0.1,"marketplace":0.05,"rental":0.05,"feeBurn":0.02,"feeRewardReserve":0.02,"feeTreasury":0.01},"packs":{"cardsPerPack":5,"priceCredits":1000,"goldFoilChance":0.02,"standardSlot":{"common":0.65,"uncommon":0.22,"rare":0.09,"epic":0.03,"legendary":0.01},"guaranteedSlot":{"uncommon":0.7,"rare":0.22,"epic":0.06,"legendary":0.02},"editions":[{"id":"ancient","maximumPacks":500000,"publicSale":450000,"reserve":50000},{"id":"oath","maximumPacks":500000,"publicSale":450000,"reserve":50000},{"id":"legionnaire","maximumPacks":500000,"publicSale":450000,"reserve":50000}]},"foil":{"types":["regular","gold"],"sameCombatStats":true,"goldRewardShareBonusPerUsedCard":0.02,"maximumGoldBonus":0.14}}'::jsonb)
on conflict(key) do update set value=excluded.value,updated_at=now();

create table if not exists public.currency_balances (
  player_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency in ('credits','coins')),
  available numeric(30,8) not null default 0 check (available >= 0),
  locked numeric(30,8) not null default 0 check (locked >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id,currency)
);

create table if not exists public.currency_ledger (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.profiles(id),
  currency text not null check (currency in ('credits','coins')),
  amount numeric(30,8) not null,
  balance_after numeric(30,8) not null check (balance_after >= 0),
  entry_type text not null,
  reference_type text,
  reference_id text,
  idempotency_key text unique not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists currency_ledger_player_idx on public.currency_ledger(player_id,created_at desc);

insert into public.currency_balances(player_id,currency)
select p.id, c.currency from public.profiles p cross join (values ('credits'),('coins')) c(currency)
on conflict(player_id,currency) do nothing;

create or replace function public.handle_new_user_economy()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.currency_balances(player_id,currency) values(new.id,'credits'),(new.id,'coins')
  on conflict(player_id,currency) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_economy on auth.users;
create trigger on_auth_user_created_economy after insert on auth.users
for each row execute function public.handle_new_user_economy();

create table if not exists public.coin_credit_conversions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id),
  coins_debited numeric(30,8) not null check (coins_debited > 0),
  oracle_usd_price numeric(30,12) not null check (oracle_usd_price > 0),
  spread_bps integer not null default 200,
  credits_issued bigint not null check (credits_issued > 0),
  oracle_timestamp timestamptz not null,
  tx_hash text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_epochs (
  id uuid primary key default gen_random_uuid(),
  epoch_date date unique not null,
  emission_year integer not null check (emission_year >= 1),
  match_pool numeric(30,8) not null,
  daily_pool numeric(30,8) not null,
  status text not null default 'open' check (status in ('open','settling','settled')),
  settled_at timestamptz
);

create table if not exists public.daily_reward_shares (
  epoch_id uuid not null references public.reward_epochs(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  match_shares numeric(30,8) not null default 0,
  activity_points integer not null default 0,
  activity_shares numeric(30,8) not null default 0,
  eligible_wins integer not null default 0,
  match_coins numeric(30,8),
  activity_coins numeric(30,8),
  primary key(epoch_id,player_id)
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  season_number integer unique not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  league_pool numeric(30,8) not null,
  leaderboard_pool numeric(30,8) not null,
  status text not null default 'scheduled' check(status in ('scheduled','active','settling','settled')),
  check(ends_at > starts_at)
);

create table if not exists public.season_player_stats (
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  highest_league text not null,
  rating integer not null,
  battles integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  max_streak integer not null default 0,
  league_shares numeric(30,8) not null default 0,
  leaderboard_rank integer,
  league_coins numeric(30,8),
  leaderboard_coins numeric(30,8),
  primary key(season_id,player_id)
);

create table if not exists public.pack_supply (
  set_id text primary key references public.card_sets(id),
  price_credits bigint not null default 1000,
  maximum_packs bigint not null,
  public_allocation bigint not null,
  reserve_allocation bigint not null,
  sold_packs bigint not null default 0,
  opened_packs bigint not null default 0,
  active boolean not null default true,
  check(public_allocation + reserve_allocation = maximum_packs),
  check(sold_packs <= maximum_packs),
  check(opened_packs <= maximum_packs)
);

insert into public.pack_supply(set_id,maximum_packs,public_allocation,reserve_allocation)
values ('ancient',500000,450000,50000),('oath',500000,450000,50000),('legionnaire',500000,450000,50000)
on conflict(set_id) do update set maximum_packs=excluded.maximum_packs,public_allocation=excluded.public_allocation,reserve_allocation=excluded.reserve_allocation;

create table if not exists public.player_packs (
  player_id uuid not null references public.profiles(id) on delete cascade,
  set_id text not null references public.card_sets(id),
  quantity bigint not null default 0 check(quantity >= 0),
  primary key(player_id,set_id)
);

create table if not exists public.pack_openings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id),
  set_id text not null references public.card_sets(id),
  commit_hash text not null,
  reveal_seed text not null,
  results jsonb not null,
  opened_at timestamptz not null default now()
);

create table if not exists public.card_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  card_id text not null references public.cards(id),
  foil text not null check(foil in ('regular','gold')),
  bcx integer not null default 1 check(bcx > 0),
  level smallint not null default 1,
  status text not null default 'available' check(status in ('available','listed','rented','escrowed','burned')),
  mint_tx text,
  created_at timestamptz not null default now()
);
create index if not exists card_assets_owner_idx on public.card_assets(owner_id,status);

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid unique not null references public.card_assets(id),
  seller_id uuid not null references public.profiles(id),
  price_coins numeric(30,8) not null check(price_coins > 0),
  status text not null default 'active' check(status in ('active','sold','cancelled','expired')),
  buyer_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.rental_listings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid unique not null references public.card_assets(id),
  owner_id uuid not null references public.profiles(id),
  price_coins_per_day numeric(30,8) not null check(price_coins_per_day > 0),
  minimum_days integer not null default 1 check(minimum_days > 0),
  maximum_days integer not null default 30 check(maximum_days >= minimum_days),
  status text not null default 'active' check(status in ('active','rented','cancelled','expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.rental_contracts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.rental_listings(id),
  asset_id uuid not null references public.card_assets(id),
  owner_id uuid not null references public.profiles(id),
  renter_id uuid not null references public.profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  gross_coins numeric(30,8) not null check(gross_coins > 0),
  fee_coins numeric(30,8) not null check(fee_coins >= 0),
  status text not null default 'active' check(status in ('active','completed','cancelled')),
  check(ends_at > starts_at)
);

alter table public.economy_config enable row level security;
alter table public.currency_balances enable row level security;
alter table public.currency_ledger enable row level security;
alter table public.coin_credit_conversions enable row level security;
alter table public.reward_epochs enable row level security;
alter table public.daily_reward_shares enable row level security;
alter table public.seasons enable row level security;
alter table public.season_player_stats enable row level security;
alter table public.pack_supply enable row level security;
alter table public.player_packs enable row level security;
alter table public.pack_openings enable row level security;
alter table public.card_assets enable row level security;
alter table public.market_listings enable row level security;
alter table public.rental_listings enable row level security;
alter table public.rental_contracts enable row level security;

create policy economy_config_read on public.economy_config for select using(true);
create policy economy_balance_own on public.currency_balances for select to authenticated using(player_id=auth.uid());
create policy economy_ledger_own on public.currency_ledger for select to authenticated using(player_id=auth.uid());
create policy conversion_own on public.coin_credit_conversions for select to authenticated using(player_id=auth.uid());
create policy reward_epochs_read on public.reward_epochs for select to authenticated using(true);
create policy reward_shares_own on public.daily_reward_shares for select to authenticated using(player_id=auth.uid());
create policy seasons_read on public.seasons for select to authenticated using(true);
create policy season_stats_read on public.season_player_stats for select to authenticated using(true);
create policy pack_supply_read on public.pack_supply for select using(true);
create policy player_packs_own on public.player_packs for select to authenticated using(player_id=auth.uid());
create policy pack_openings_read on public.pack_openings for select to authenticated using(player_id=auth.uid());
create policy assets_owner_or_available on public.card_assets for select to authenticated using(owner_id=auth.uid() or status in ('listed','rented'));
create policy market_read on public.market_listings for select using(status='active' or seller_id=auth.uid() or buyer_id=auth.uid());
create policy rental_listings_read on public.rental_listings for select using(status='active' or owner_id=auth.uid());
create policy rental_contracts_participant on public.rental_contracts for select to authenticated using(owner_id=auth.uid() or renter_id=auth.uid());

-- No client INSERT/UPDATE/DELETE policies are provided for balances, rewards, packs, assets,
-- market settlement, or rentals. Use service-only transactional RPCs/Edge Functions.

commit;
