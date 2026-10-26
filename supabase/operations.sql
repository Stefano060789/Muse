-- Muse-only operational safety controls. No iVote objects or policies changed.
begin;
create table if not exists public.muse_operations_counters (
  bucket text primary key,
  used integer not null default 0 check (used >= 0),
  expires_at timestamptz not null
);
create table if not exists public.muse_operations_alerts (
  id text primary key,
  event text not null check (event in ('ai-budget-warning','ai-budget-exhausted','provider-failure','storage-failure','request-failure','client-render-failure')),
  created_at timestamptz not null default now()
);
alter table public.muse_operations_counters enable row level security;
alter table public.muse_operations_alerts enable row level security;
revoke all on public.muse_operations_counters, public.muse_operations_alerts from public, anon, authenticated;
grant all on public.muse_operations_counters, public.muse_operations_alerts to service_role;

create or replace function public.muse_consume_operation(p_bucket text, p_limit integer, p_expires_at timestamptz, p_warning integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare count_used integer;
begin
  if p_bucket is null or p_bucket !~ '^[a-z0-9:-]{1,160}$' or p_limit is null or p_limit not between 1 and 10000
    or p_warning is null or p_warning not between 1 and p_limit or p_expires_at is null or p_expires_at <= now() then
    raise exception 'Invalid operations reservation';
  end if;
  delete from public.muse_operations_counters where expires_at <= now();
  delete from public.muse_operations_alerts where created_at < now() - interval '7 days';
  insert into public.muse_operations_counters(bucket,expires_at) values(p_bucket,p_expires_at) on conflict do nothing;
  select used into count_used from public.muse_operations_counters where bucket=p_bucket for update;
  if count_used >= p_limit then return jsonb_build_object('allowed',false,'used',count_used,'notify',false); end if;
  update public.muse_operations_counters set used=used+1 where bucket=p_bucket;
  return jsonb_build_object('allowed',true,'used',count_used+1,'notify',count_used+1=p_warning);
end $$;
create or replace function public.muse_record_operation_alert(p_id text,p_event text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare inserted integer;
begin
  if p_id is null or p_id !~ '^[a-z-]+:[0-9]+$' then raise exception 'Invalid alert identifier'; end if;
  delete from public.muse_operations_alerts where created_at < now() - interval '7 days';
  insert into public.muse_operations_alerts(id,event) values(p_id,p_event) on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end $$;
revoke all on function public.muse_consume_operation(text,integer,timestamptz,integer), public.muse_record_operation_alert(text,text) from public, anon, authenticated;
grant execute on function public.muse_consume_operation(text,integer,timestamptz,integer), public.muse_record_operation_alert(text,text) to service_role;

drop function if exists public.muse_delete_personal_journey(uuid,text);
create or replace function public.muse_delete_personal_journey(p_id uuid,p_capability_hash text,p_owner_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare deleted integer;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$' or p_owner_id is null then raise exception 'Invalid journey capability'; end if;
  delete from public.muse_personal_journeys where id=p_id and capability_hash=p_capability_hash and owner_id=p_owner_id;
  get diagnostics deleted = row_count;
  return deleted > 0;
end $$;
revoke all on function public.muse_delete_personal_journey(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.muse_delete_personal_journey(uuid,text,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
