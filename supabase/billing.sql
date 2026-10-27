-- Account-level, server-enforced no-card trial and monthly Muse Plus allowances.
-- Apply after account-ownership.sql with Supabase service-role access configured.
begin;

create table if not exists public.muse_billing_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'plus')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '1 month'),
  period_started_at timestamptz not null default now(),
  period_ends_at timestamptz not null default (now() + interval '1 month'),
  stories_used integer not null default 0 check (stories_used >= 0),
  interactions_used integer not null default 0 check (interactions_used >= 0),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);

create table if not exists public.muse_billing_reservations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  usage_kind text not null check (usage_kind in ('story', 'interaction')),
  reserved_at timestamptz not null default now(),
  primary key (owner_id, request_id, usage_kind)
);

create table if not exists public.muse_stripe_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.muse_billing_accounts enable row level security;
alter table public.muse_billing_reservations enable row level security;
alter table public.muse_stripe_events enable row level security;
revoke all on public.muse_billing_accounts, public.muse_billing_reservations, public.muse_stripe_events
  from public, anon, authenticated;
grant all on public.muse_billing_accounts, public.muse_billing_reservations, public.muse_stripe_events
  to service_role;

create or replace function public.muse_initialize_billing_trial()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.muse_billing_accounts(owner_id, trial_started_at, trial_ends_at, period_started_at, period_ends_at)
  values (new.id, now(), now() + interval '1 month', now(), now() + interval '1 month')
  on conflict (owner_id) do nothing;
  return new;
end $$;

drop trigger if exists muse_initialize_billing_trial on auth.users;
create trigger muse_initialize_billing_trial
  after insert on auth.users
  for each row execute function public.muse_initialize_billing_trial();

-- Existing accounts get a one-month trial from migration time, never an old signup date.
insert into public.muse_billing_accounts(owner_id)
select id from auth.users
on conflict (owner_id) do nothing;

create or replace function public.muse_billing_status(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare row_data public.muse_billing_accounts%rowtype;
begin
  if p_owner_id is null then raise exception 'Billing account unavailable'; end if;
  insert into public.muse_billing_accounts(owner_id) values (p_owner_id) on conflict (owner_id) do nothing;
  select * into row_data from public.muse_billing_accounts where owner_id = p_owner_id for update;
  if row_data.status = 'trialing' and row_data.trial_ends_at <= now() then
    update public.muse_billing_accounts set tier = 'free', status = 'expired', updated_at = now()
      where owner_id = p_owner_id returning * into row_data;
  end if;
  return jsonb_build_object(
    'tier', row_data.tier, 'status', row_data.status,
    'trialStartedAt', row_data.trial_started_at, 'trialEndsAt', row_data.trial_ends_at,
    'periodStartedAt', row_data.period_started_at, 'periodEndsAt', row_data.period_ends_at,
    'storiesUsed', row_data.stories_used, 'storyLimit', 10,
    'interactionsUsed', row_data.interactions_used, 'interactionLimit', 120,
    'canGenerate', row_data.status = 'trialing' or row_data.status = 'active'
  );
end $$;

create or replace function public.muse_reserve_billing_usage(
  p_owner_id uuid, p_request_id text, p_usage_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare row_data public.muse_billing_accounts%rowtype;
declare inserted_count integer;
declare used_count integer;
declare usage_limit integer;
begin
  if p_owner_id is null or p_request_id is null or p_request_id !~ '^[A-Za-z0-9:-]{1,200}$'
     or p_usage_kind is null or p_usage_kind not in ('story', 'interaction') then
    raise exception 'Invalid billing reservation';
  end if;
  insert into public.muse_billing_accounts(owner_id) values (p_owner_id) on conflict (owner_id) do nothing;
  select * into row_data from public.muse_billing_accounts where owner_id = p_owner_id for update;

  if row_data.status = 'trialing' and row_data.trial_ends_at <= now() then
    update public.muse_billing_accounts set tier = 'free', status = 'expired', updated_at = now()
      where owner_id = p_owner_id returning * into row_data;
  end if;
  if row_data.status not in ('trialing', 'active') then
    return jsonb_build_object('allowed', false, 'reason', 'trial_or_subscription_ended');
  end if;
  if row_data.status = 'active' and row_data.period_ends_at <= now() then
    return jsonb_build_object('allowed', false, 'reason', 'subscription_period_unavailable');
  end if;

  insert into public.muse_billing_reservations(owner_id, request_id, usage_kind)
    values (p_owner_id, p_request_id, p_usage_kind) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return jsonb_build_object('allowed', true, 'duplicate', true);
  end if;

  if p_usage_kind = 'story' then
    used_count := row_data.stories_used;
    usage_limit := 10;
  else
    used_count := row_data.interactions_used;
    usage_limit := 120;
  end if;
  if used_count >= usage_limit then
    delete from public.muse_billing_reservations
      where owner_id = p_owner_id and request_id = p_request_id and usage_kind = p_usage_kind;
    return jsonb_build_object('allowed', false, 'reason', case when p_usage_kind = 'story' then 'story_limit' else 'interaction_limit' end,
      'used', used_count, 'limit', usage_limit);
  end if;
  if p_usage_kind = 'story' then
    update public.muse_billing_accounts set stories_used = stories_used + 1, updated_at = now() where owner_id = p_owner_id returning * into row_data;
  else
    update public.muse_billing_accounts set interactions_used = interactions_used + 1, updated_at = now() where owner_id = p_owner_id returning * into row_data;
  end if;
  return jsonb_build_object(
    'allowed', true, 'duplicate', false, 'tier', row_data.tier, 'status', row_data.status,
    'storiesUsed', row_data.stories_used, 'storyLimit', 10,
    'interactionsUsed', row_data.interactions_used, 'interactionLimit', 120
  );
end $$;

revoke all on function public.muse_initialize_billing_trial(), public.muse_billing_status(uuid),
  public.muse_reserve_billing_usage(uuid, text, text) from public, anon, authenticated;
grant execute on function public.muse_billing_status(uuid), public.muse_reserve_billing_usage(uuid, text, text)
  to service_role;
notify pgrst, 'reload schema';
commit;
