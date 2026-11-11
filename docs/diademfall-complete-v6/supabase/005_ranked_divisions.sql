begin;

create table if not exists public.ranked_divisions (
  id text primary key,
  league text not null,
  tier smallint,
  minimum_rating integer not null,
  ruleset_count smallint not null,
  reward_chest text,
  reward_count smallint not null default 0,
  bonus_chest text,
  bonus_count smallint not null default 0,
  display_order smallint unique not null
);

create table if not exists public.reward_chest_types (
  id text primary key,
  name text unique not null,
  rolls smallint not null check(rolls between 1 and 3),
  definition jsonb not null,
  active boolean not null default true
);

create table if not exists public.season_division_progress (
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  highest_division_id text not null references public.ranked_divisions(id),
  current_division_id text not null references public.ranked_divisions(id),
  current_rating integer not null,
  current_streak integer not null default 0,
  primary key(season_id,player_id)
);

create table if not exists public.division_reward_claims (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  division_id text not null references public.ranked_divisions(id),
  chest_type text not null references public.reward_chest_types(id),
  chest_ordinal smallint not null,
  status text not null default 'unopened' check(status in ('unopened','opened','auto_opened')),
  commit_hash text not null,
  reveal_seed text,
  opened_at timestamptz,
  unique(season_id,player_id,division_id,chest_type,chest_ordinal)
);

create table if not exists public.division_chest_rolls (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.division_reward_claims(id) on delete cascade,
  roll_index smallint not null,
  reward_type text not null check(reward_type in ('legionnaire_card','coin_shares','credits')),
  card_asset_id uuid references public.card_assets(id),
  coin_shares numeric(30,8),
  credits bigint,
  result_proof jsonb not null,
  unique(claim_id,roll_index),
  check((reward_type='legionnaire_card' and card_asset_id is not null) or (reward_type='coin_shares' and coin_shares is not null) or (reward_type='credits' and credits is not null))
);

create table if not exists public.legionnaire_reward_reserve (
  id boolean primary key default true check(id),
  committed_packs bigint not null default 20000,
  original_card_units bigint not null default 100000,
  remaining_card_units bigint not null default 100000,
  common_remaining bigint not null default 0,
  uncommon_remaining bigint not null default 0,
  rare_remaining bigint not null default 0,
  epic_remaining bigint not null default 0,
  legendary_remaining bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.legionnaire_reward_reserve(id) values(true) on conflict(id) do nothing;

alter table public.ranked_divisions enable row level security;
alter table public.reward_chest_types enable row level security;
alter table public.season_division_progress enable row level security;
alter table public.division_reward_claims enable row level security;
alter table public.division_chest_rolls enable row level security;
alter table public.legionnaire_reward_reserve enable row level security;

create policy divisions_read on public.ranked_divisions for select using(true);
create policy chest_types_read on public.reward_chest_types for select using(active);
create policy division_progress_read_own on public.season_division_progress for select to authenticated using(player_id=auth.uid());
create policy division_claims_read_own on public.division_reward_claims for select to authenticated using(player_id=auth.uid());
create policy division_rolls_read_own on public.division_chest_rolls for select to authenticated using(exists(select 1 from public.division_reward_claims c where c.id=claim_id and c.player_id=auth.uid()));
create policy legionnaire_reserve_read on public.legionnaire_reward_reserve for select using(true);

-- Insert configuration generated with the package.
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('wood','wood',null,0,0,null,0,null,0,0) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('bronze_iii','bronze',3,1000,1,null,0,null,0,1) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('bronze_ii','bronze',2,1135,1,'scout',2,null,0,2) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('bronze_i','bronze',1,1270,1,'scout',3,null,0,3) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('silver_iii','silver',3,1400,1,'scout',4,null,0,4) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('silver_ii','silver',2,1535,2,'war',1,'scout',2,5) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('silver_i','silver',1,1670,2,'war',2,null,0,6) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('gold_iii','gold',3,1800,2,'war',3,null,0,7) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('gold_ii','gold',2,1935,2,'crown',1,'war',2,8) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('gold_i','gold',1,2070,2,'crown',2,null,0,9) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('diamond_iii','diamond',3,2200,2,'crown',3,null,0,10) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('diamond_ii','diamond',2,2335,2,'crown',4,null,0,11) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('diamond_i','diamond',1,2470,2,'crown',5,null,0,12) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('champion_iii','champion',3,2600,2,'crown',6,null,0,13) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('champion_ii','champion',2,2800,2,'crown',7,null,0,14) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.ranked_divisions(id,league,tier,minimum_rating,ruleset_count,reward_chest,reward_count,bonus_chest,bonus_count,display_order) values ('champion_i','champion',1,3000,2,'crown',9,null,0,15) on conflict(id) do update set league=excluded.league,tier=excluded.tier,minimum_rating=excluded.minimum_rating,ruleset_count=excluded.ruleset_count,reward_chest=excluded.reward_chest,reward_count=excluded.reward_count,bonus_chest=excluded.bonus_chest,bonus_count=excluded.bonus_count,display_order=excluded.display_order;
insert into public.reward_chest_types(id,name,rolls,definition,active) values ('scout','Scout Chest',1,'{"id":"scout","name":"Scout Chest","rolls":1,"outcomes":{"legionnaireCard":35,"coinShares":45,"credits":20},"coinShares":[{"weight":60,"value":10},{"weight":30,"value":25},{"weight":10,"value":50}],"credits":[{"weight":70,"value":10},{"weight":25,"value":25},{"weight":5,"value":50}],"cardRarity":{"common":70,"uncommon":23,"rare":6,"epic":1,"legendary":0},"goldFoilChancePercent":1}'::jsonb,true) on conflict(id) do update set name=excluded.name,rolls=excluded.rolls,definition=excluded.definition,active=true;
insert into public.reward_chest_types(id,name,rolls,definition,active) values ('war','War Chest',2,'{"id":"war","name":"War Chest","rolls":2,"outcomes":{"legionnaireCard":45,"coinShares":40,"credits":15},"coinShares":[{"weight":60,"value":50},{"weight":30,"value":100},{"weight":10,"value":250}],"credits":[{"weight":70,"value":25},{"weight":25,"value":50},{"weight":5,"value":100}],"cardRarity":{"common":45,"uncommon":30,"rare":18,"epic":6,"legendary":1},"goldFoilChancePercent":2}'::jsonb,true) on conflict(id) do update set name=excluded.name,rolls=excluded.rolls,definition=excluded.definition,active=true;
insert into public.reward_chest_types(id,name,rolls,definition,active) values ('crown','Crown Chest',3,'{"id":"crown","name":"Crown Chest","rolls":3,"outcomes":{"legionnaireCard":55,"coinShares":35,"credits":10},"coinShares":[{"weight":60,"value":200},{"weight":30,"value":500},{"weight":10,"value":1000}],"credits":[{"weight":70,"value":50},{"weight":25,"value":100},{"weight":5,"value":250}],"cardRarity":{"common":25,"uncommon":30,"rare":25,"epic":15,"legendary":5},"goldFoilChancePercent":3}'::jsonb,true) on conflict(id) do update set name=excluded.name,rolls=excluded.rolls,definition=excluded.definition,active=true;

insert into public.economy_config(key,value) values ('ranked-divisions-1.0.0','{"version":"ranked-divisions-1.0.0","seasonDays":14,"newPlayerRating":1000,"placementDivision":"bronze_iii","rating":{"win":20,"loss":-20,"draw":0,"winStreakBonus":10,"winStreakStartsAt":3,"championStreakBonus":false},"divisions":[{"id":"wood","league":"wood","tier":null,"minRating":0,"rewardChest":null,"rewardCount":0,"rulesets":0},{"id":"bronze_iii","league":"bronze","tier":3,"minRating":1000,"rewardChest":null,"rewardCount":0,"rulesets":1},{"id":"bronze_ii","league":"bronze","tier":2,"minRating":1135,"rewardChest":"scout","rewardCount":2,"rulesets":1},{"id":"bronze_i","league":"bronze","tier":1,"minRating":1270,"rewardChest":"scout","rewardCount":3,"rulesets":1},{"id":"silver_iii","league":"silver","tier":3,"minRating":1400,"rewardChest":"scout","rewardCount":4,"rulesets":1},{"id":"silver_ii","league":"silver","tier":2,"minRating":1535,"rewardChest":"war","rewardCount":1,"bonusChest":"scout","bonusCount":2,"rulesets":2},{"id":"silver_i","league":"silver","tier":1,"minRating":1670,"rewardChest":"war","rewardCount":2,"rulesets":2},{"id":"gold_iii","league":"gold","tier":3,"minRating":1800,"rewardChest":"war","rewardCount":3,"rulesets":2},{"id":"gold_ii","league":"gold","tier":2,"minRating":1935,"rewardChest":"crown","rewardCount":1,"bonusChest":"war","bonusCount":2,"rulesets":2},{"id":"gold_i","league":"gold","tier":1,"minRating":2070,"rewardChest":"crown","rewardCount":2,"rulesets":2},{"id":"diamond_iii","league":"diamond","tier":3,"minRating":2200,"rewardChest":"crown","rewardCount":3,"rulesets":2},{"id":"diamond_ii","league":"diamond","tier":2,"minRating":2335,"rewardChest":"crown","rewardCount":4,"rulesets":2},{"id":"diamond_i","league":"diamond","tier":1,"minRating":2470,"rewardChest":"crown","rewardCount":5,"rulesets":2},{"id":"champion_iii","league":"champion","tier":3,"minRating":2600,"rewardChest":"crown","rewardCount":6,"rulesets":2},{"id":"champion_ii","league":"champion","tier":2,"minRating":2800,"rewardChest":"crown","rewardCount":7,"rulesets":2},{"id":"champion_i","league":"champion","tier":1,"minRating":3000,"rewardChest":"crown","rewardCount":9,"rulesets":2}],"chests":[{"id":"scout","name":"Scout Chest","rolls":1,"outcomes":{"legionnaireCard":35,"coinShares":45,"credits":20},"coinShares":[{"weight":60,"value":10},{"weight":30,"value":25},{"weight":10,"value":50}],"credits":[{"weight":70,"value":10},{"weight":25,"value":25},{"weight":5,"value":50}],"cardRarity":{"common":70,"uncommon":23,"rare":6,"epic":1,"legendary":0},"goldFoilChancePercent":1},{"id":"war","name":"War Chest","rolls":2,"outcomes":{"legionnaireCard":45,"coinShares":40,"credits":15},"coinShares":[{"weight":60,"value":50},{"weight":30,"value":100},{"weight":10,"value":250}],"credits":[{"weight":70,"value":25},{"weight":25,"value":50},{"weight":5,"value":100}],"cardRarity":{"common":45,"uncommon":30,"rare":18,"epic":6,"legendary":1},"goldFoilChancePercent":2},{"id":"crown","name":"Crown Chest","rolls":3,"outcomes":{"legionnaireCard":55,"coinShares":35,"credits":10},"coinShares":[{"weight":60,"value":200},{"weight":30,"value":500},{"weight":10,"value":1000}],"credits":[{"weight":70,"value":50},{"weight":25,"value":100},{"weight":5,"value":250}],"cardRarity":{"common":25,"uncommon":30,"rare":25,"epic":15,"legendary":5},"goldFoilChancePercent":3}],"seasonReset":{"wood":0,"bronze":1000,"silver":1000,"gold":1400,"diamond":1800,"champion":2200},"legionnaireRewardReserve":{"packsCommitted":20000,"cardsAvailable":100000,"withinExistingPackCap":true},"leaderboardSeparate":true}'::jsonb) on conflict(key) do update set value=excluded.value,updated_at=now();

commit;
