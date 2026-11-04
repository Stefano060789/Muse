begin;

create table if not exists public.muse_runway_jobs (
  id uuid primary key,
  owner_id text not null,
  fingerprint text not null check (length(fingerprint) = 64),
  credits integer not null check (credits = 16),
  created_at timestamptz not null default now(),
  status text not null check (status in ('reserved', 'submitted', 'ready', 'failed', 'unknown')),
  task_id uuid
);
alter table public.muse_runway_jobs drop constraint if exists muse_runway_jobs_credits_check;
alter table public.muse_runway_jobs drop constraint if exists muse_runway_credits_check;
alter table public.muse_runway_jobs add constraint muse_runway_credits_check check (credits = 16);
create index if not exists muse_runway_owner_created on public.muse_runway_jobs(owner_id, created_at);
alter table public.muse_runway_jobs enable row level security;
revoke all on public.muse_runway_jobs from public, anon, authenticated;
grant all on public.muse_runway_jobs to service_role;

-- Atomic global lifetime budget and account UTC daily limit.
-- Failed/unknown reservations stay counted; a reused request ID never submits again.
create or replace function public.muse_reserve_runway_job(
  p_id uuid, p_owner text, p_fingerprint text, p_credits integer, p_budget integer, p_daily_cap integer
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  existing muse_runway_jobs;
  spent bigint;
  attempts bigint;
begin
  if p_credits <> 16 or p_budget < 16 or p_budget > 100000 or p_daily_cap < 1 or p_daily_cap > 10
    or length(p_fingerprint) <> 64 or length(p_owner) not between 1 and 128 then
    raise exception 'Invalid cinematic reservation';
  end if;
  perform pg_advisory_xact_lock(73628103);
  select * into existing from muse_runway_jobs where id = p_id;
  if found then
    if existing.owner_id <> p_owner or existing.fingerprint <> p_fingerprint then
      return jsonb_build_object('reserved', false, 'conflict', true);
    end if;
    return jsonb_build_object('reserved', false, 'job', to_jsonb(existing));
  end if;
  select coalesce(sum(credits), 0) into spent from muse_runway_jobs;
  select count(*) into attempts from muse_runway_jobs where owner_id = p_owner
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if spent + p_credits > p_budget or attempts >= p_daily_cap then
    return jsonb_build_object('reserved', false, 'limited', true);
  end if;
  insert into muse_runway_jobs(id, owner_id, fingerprint, credits, status)
    values (p_id, p_owner, p_fingerprint, p_credits, 'reserved') returning * into existing;
  return jsonb_build_object('reserved', true, 'job', to_jsonb(existing));
end;
$$;
revoke all on function public.muse_reserve_runway_job(uuid,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.muse_reserve_runway_job(uuid,text,text,integer,integer,integer) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('muse-runway-clips', 'muse-runway-clips', false, 31457280, array['video/mp4'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;
