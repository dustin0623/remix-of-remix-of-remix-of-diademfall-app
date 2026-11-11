begin;

create table if not exists public.treasury_wallets (
  id uuid primary key default gen_random_uuid(),
  label text unique not null,
  chain text not null default 'solana',
  address text unique not null,
  wallet_type text not null check(wallet_type in ('reward_vault','operations','liquidity','reserve','burn')),
  public boolean not null default true,
  active boolean not null default true
);

create table if not exists public.treasury_snapshots (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.treasury_wallets(id),
  coin_balance numeric(30,8) not null check(coin_balance >= 0),
  quote_value_usd numeric(30,8),
  source_block bigint,
  captured_at timestamptz not null,
  unique(wallet_id,captured_at)
);

create table if not exists public.token_acquisitions (
  id uuid primary key default gen_random_uuid(),
  source text not null check(source in ('launch_purchase','pack_revenue_buyback','creator_fee_buyback','coin_credit_recycle','market_fee','rental_fee','other')),
  coins_acquired numeric(30,8) not null check(coins_acquired > 0),
  quote_spent numeric(30,8),
  quote_asset text,
  average_price_usd numeric(30,12),
  tx_hash text unique,
  destination_wallet_id uuid not null references public.treasury_wallets(id),
  acquired_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.monthly_reward_budgets (
  month_start date primary key,
  opening_reward_vault numeric(30,8) not null,
  verified_prior_month_acquisitions numeric(30,8) not null default 0,
  runway_months integer not null default 12,
  calculated_budget numeric(30,8) not null,
  approved_budget numeric(30,8) not null,
  match_pool numeric(30,8) not null,
  daily_pool numeric(30,8) not null,
  league_pool numeric(30,8) not null,
  leaderboard_pool numeric(30,8) not null,
  status text not null default 'draft' check(status in ('draft','approved','active','closed')),
  approved_at timestamptz,
  check(approved_budget <= calculated_budget),
  check(match_pool + daily_pool + league_pool + leaderboard_pool = approved_budget)
);

create table if not exists public.pack_revenue_months (
  month_start date primary key,
  gross_receipts_usd numeric(30,8) not null default 0,
  payment_fees_usd numeric(30,8) not null default 0,
  refunds_chargebacks_usd numeric(30,8) not null default 0,
  tax_reserve_usd numeric(30,8) not null default 0,
  net_receipts_usd numeric(30,8) not null default 0,
  buyback_budget_usd numeric(30,8) not null default 0,
  operations_budget_usd numeric(30,8) not null default 0,
  liquidity_budget_usd numeric(30,8) not null default 0,
  legal_reserve_usd numeric(30,8) not null default 0,
  check(buyback_budget_usd + operations_budget_usd + liquidity_budget_usd + legal_reserve_usd <= net_receipts_usd)
);

alter table public.treasury_wallets enable row level security;
alter table public.treasury_snapshots enable row level security;
alter table public.token_acquisitions enable row level security;
alter table public.monthly_reward_budgets enable row level security;
alter table public.pack_revenue_months enable row level security;

create policy treasury_wallets_public_read on public.treasury_wallets for select using(public and active);
create policy treasury_snapshots_public_read on public.treasury_snapshots for select using(true);
create policy token_acquisitions_public_read on public.token_acquisitions for select using(true);
create policy monthly_reward_budgets_public_read on public.monthly_reward_budgets for select using(status <> 'draft');
create policy pack_revenue_public_read on public.pack_revenue_months for select using(true);

insert into public.economy_config(key,value) values
('economy-2.0.0','{"version":"economy-2.0.0","token":{"fixedExternalSupply":1000000000,"projectOwnedLaunchMinimum":50000000,"projectOwnedLaunchMaximum":100000000,"additionalAcquisitionTargetMinimum":100000000,"additionalAcquisitionTargetMaximum":200000000,"projectRewardVaultTargetMinimum":150000000,"projectRewardVaultTargetMaximum":300000000},"monthlyRewards":{"desiredMinimum":25000000,"desiredMaximum":50000000,"minimumRunwayMonths":12,"acquisitionContributionRate":0.8,"formula":"min(desiredMaximum, openingRewardVault/minimumRunwayMonths + 0.80*verifiedCoinsAcquiredPreviousMonth)","distribution":{"matchWins":0.625,"dailyActivity":0.1875,"leagueSeason":0.125,"leaderboards":0.0625}},"packRevenue":{"useNetReceipts":true,"buybackShare":0.4,"operationsShare":0.4,"liquidityShare":0.1,"legalTaxReserveShare":0.1,"maximumGrossUsd":1500000},"coinToCredits":{"spread":0.02,"rewardVaultShare":0.7,"burnShare":0.2,"operationsShare":0.1},"tradingFees":{"marketplace":0.05,"rental":0.05,"rewardVaultShare":0.02,"burnShare":0.02,"operationsShare":0.01},"safeguards":{"buybackMaximumShareOfTrailing30DayOrganicVolume":0.1,"twapHours":24,"publicWallets":true,"multisig":true,"noRewardPromiseBeforeFunding":true,"monthlyRecalculation":true}}'::jsonb)
on conflict(key) do update set value=excluded.value,updated_at=now();

commit;
