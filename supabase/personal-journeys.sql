-- Incremental Muse-only migration: apply AFTER shared-stories.sql and
-- shared-adventures.sql. Uses the SAME UTC day budget as Shared Adventure.
-- No migration is applied by the application; no iVote objects are touched.
begin;
create table if not exists public.muse_personal_journeys (
  id uuid primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  capability_hash text not null check (capability_hash ~ '^[0-9a-f]{64}$'),
  record jsonb not null,
  expires_at timestamptz not null default 'infinity'::timestamptz
);
alter table public.muse_personal_journeys add column if not exists owner_id uuid references auth.users(id) on delete cascade;
create index if not exists muse_personal_journeys_owner_id_id on public.muse_personal_journeys(owner_id, id);
alter table public.muse_personal_journeys alter column expires_at set default 'infinity'::timestamptz;
update public.muse_personal_journeys
  set expires_at = 'infinity'::timestamptz,
      record = jsonb_set(record, '{expiresAt}', 'null'::jsonb, true);
create table if not exists public.muse_personal_journey_requests (
  journey_id uuid not null references public.muse_personal_journeys on delete cascade,
  request_id text not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('create', 'turn')),
  status text not null check (status in ('pending', 'done', 'failed')),
  reserved_at timestamptz not null default now(),
  revision integer not null check (revision between 0 and 14),
  primary key (journey_id, request_id)
);
-- Upgrade existing installations too; no story records or attempts are reset.
alter table public.muse_personal_journey_requests
  drop constraint if exists muse_personal_journey_requests_revision_check;
alter table public.muse_personal_journey_requests
  add constraint muse_personal_journey_requests_revision_check check (revision between 0 and 14);
alter table public.muse_personal_journeys enable row level security;
alter table public.muse_personal_journey_requests enable row level security;
revoke all on public.muse_personal_journeys, public.muse_personal_journey_requests from public, anon, authenticated;
grant all on public.muse_personal_journeys, public.muse_personal_journey_requests to service_role;

create or replace function public.muse_personal_journey(input jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  sid uuid := (input->>'id')::uuid;
  account_id uuid := (input->>'accountId')::uuid;
  op text := input->>'operation';
  ch text := input->>'capabilityHash';
  rid text := input->>'requestId';
  fp text := input->>'fingerprint';
  cap integer := (input->>'cap')::integer;
  r jsonb;
  snapshot jsonb;
  previous public.muse_personal_journey_requests%rowtype;
  duration integer;
  max_turns integer;
  used integer;
  daily integer;
  pending boolean;
  reserved boolean := false;
  failed boolean := coalesce((input->>'failed')::boolean, false);
  result_status text;
  day_bucket text := 'day:' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  stamp text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if account_id is null then raise exception 'Journey: account required'; end if;
  if cap is null or cap not between 1 and 10000 then raise exception 'Journey: invalid daily cap'; end if;
  if op is null or op not in ('create', 'view', 'reserve', 'finish', 'archive') then raise exception 'Journey: invalid operation'; end if;
  if ch is null or ch !~ '^[0-9a-f]{64}$' then raise exception 'Journey: invalid capability'; end if;
  -- This serializes first creation as well as existing-session operations.
  -- Lock order is always session then UTC budget, as in Shared Adventure.
  perform pg_advisory_xact_lock(hashtextextended('muse-personal:' || sid::text, 0));
  select record into r from public.muse_personal_journeys where id = sid and capability_hash = ch and owner_id = account_id for update;
  if r is null and op = 'create' then
    if exists(select 1 from public.muse_personal_journeys where id = sid) then raise exception 'Journey: session unavailable'; end if;
    duration := (input->'input'->>'duration')::integer;
    if duration is null or duration not in (5, 10, 15, 20) or rid is distinct from sid::text then raise exception 'Journey: invalid creation'; end if;
    if fp is null or fp !~ '^[0-9a-f]{64}$' then raise exception 'Journey: invalid request'; end if;
    r := jsonb_build_object('id', sid, 'capabilityHash', ch, 'input', input->'input',
      'createdAt', stamp, 'expiresAt', null,
      'opening', null, 'used', 0, 'turn', null, 'lastAction', '', 'scenes', '[]'::jsonb,
      'responses', '[]'::jsonb, 'creationStatus', 'pending');
    insert into public.muse_personal_journeys (id, owner_id, capability_hash, record, expires_at)
      values (sid, account_id, ch, r, 'infinity'::timestamptz);
    insert into public.muse_personal_journey_requests(journey_id, request_id, fingerprint, kind, status, revision)
      values (sid, rid, fp, 'create', 'pending', 0);
    reserved := true;
    result_status := 'reserved';
  elsif r is null then
    -- Returning a sentinel keeps unavailable sessions from being distinguished.
    return jsonb_build_object('unavailable', true);
  end if;

  if exists(select 1 from public.muse_personal_journey_requests where journey_id = sid and kind = 'create'
    and status = 'pending' and reserved_at <= now() - interval '90 seconds') then
    r := r || jsonb_build_object('creationStatus', 'failed');
  end if;
  update public.muse_personal_journey_requests set status = 'failed'
    where journey_id = sid and status = 'pending' and reserved_at <= now() - interval '90 seconds';
  duration := (r->'input'->>'duration')::integer;
  max_turns := case duration when 5 then 3 when 10 then 6 when 15 then 9 when 20 then 12 end;
  if max_turns is null then raise exception 'Journey: invalid stored duration'; end if;
  used := (r->>'used')::integer;
  select exists(select 1 from public.muse_personal_journey_requests where journey_id = sid and status = 'pending') into pending;

  if op = 'archive' then
    if jsonb_typeof(input->'archived') is distinct from 'boolean' then raise exception 'Journey: invalid archive state'; end if;
    r := r || jsonb_build_object('archived', input->'archived');
  end if;
  if not reserved and op not in ('view', 'archive') then
    if rid is null or rid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or fp is null or fp !~ '^[0-9a-f]{64}$' then raise exception 'Journey: invalid request'; end if;
    select * into previous from public.muse_personal_journey_requests where journey_id = sid and request_id = rid;
    if op = 'finish' then
      if previous.request_id is null or previous.fingerprint <> fp or previous.status <> 'pending' or previous.revision <> used then
        raise exception 'Journey: attempt expired or already completed';
      end if;
      if previous.kind = 'create' then
        if not failed and (input->'opening' is null or jsonb_typeof(input->'opening') <> 'object') then raise exception 'Journey: missing opening'; end if;
        r := r || jsonb_build_object('creationStatus', case when failed then 'failed' else 'done' end);
        if not failed then
          r := r || jsonb_build_object('opening', input->'opening', 'turn', input->'opening'->'turn',
            'scenes', jsonb_build_array(jsonb_build_object('title', input->'opening'->>'title',
              'body', input->'opening'->'turn'->>'narration', 'question', '', 'choices', '[]'::jsonb)));
        end if;
      else
        if not failed and (input->'turn' is null or jsonb_typeof(input->'turn') <> 'object') then raise exception 'Journey: missing narration'; end if;
        if not failed then
          r := r || jsonb_build_object('turn', input->'turn', 'scenes',
            (r->'scenes') || jsonb_build_array(jsonb_build_object('title',
              case when (input->'turn'->>'concluded')::boolean then 'The conclusion' else 'Chapter ' || (jsonb_array_length(r->'scenes') + 1)::text end,
              'body', input->'turn'->>'narration', 'question', '', 'choices', '[]'::jsonb)),
            'responses', (r->'responses') || jsonb_build_array(r->>'lastAction'));
        end if;
      end if;
      result_status := case when failed then 'failed' else 'done' end;
      update public.muse_personal_journey_requests set status = result_status where journey_id = sid and request_id = rid;
      pending := false;
    elsif previous.request_id is not null then
      if previous.fingerprint <> fp or previous.kind <> (case when op = 'create' then 'create' else 'turn' end) then
        raise exception 'Journey: request ID reused with different content';
      end if;
      result_status := previous.status;
    else
      if op <> 'reserve' then raise exception 'Journey: invalid operation'; end if;
      if r->>'creationStatus' <> 'done' then raise exception 'Journey: preparation incomplete or failed'; end if;
      if pending then raise exception 'Journey: response in progress; reconcile before continuing'; end if;
      if (input->>'revision')::integer is distinct from used then raise exception 'Journey: stale state; reconcile before continuing'; end if;
      if (r->'turn'->>'concluded')::boolean or
        (used >= max_turns and not (
          input->>'text' = 'Bring this chapter to a close using the choices and discoveries already made. Do not require another player action.'
          and used < max_turns + 2
        )) then raise exception 'Journey: response allowance exhausted'; end if;
      insert into public.muse_adventure_budgets(bucket) values (day_bucket) on conflict do nothing;
      select b.used into daily from public.muse_adventure_budgets b where b.bucket = day_bucket for update;
      if daily >= cap then raise exception 'Journey: daily cap reached'; end if;
      update public.muse_adventure_budgets b set used = b.used + 1 where b.bucket = day_bucket;
      used := used + 1;
      r := r || jsonb_build_object('used', used, 'lastAction', input->>'text');
      insert into public.muse_personal_journey_requests(journey_id, request_id, fingerprint, kind, status, revision)
        values (sid, rid, fp, 'turn', 'pending', used);
      result_status := 'reserved';
      pending := true;
    end if;
  end if;
  update public.muse_personal_journeys set record = r where id = sid;
  snapshot := jsonb_build_object('duration', duration, 'maxTurns', max_turns, 'revision', used,
    'pending', pending, 'state', r->'turn'->'state', 'status',
    case when r->>'creationStatus' = 'failed' then 'failed'
      when r->>'creationStatus' = 'pending' then 'preparing'
      when (r->'turn'->>'concluded')::boolean then 'concluded'
      when used >= max_turns and not pending then 'exhausted' else 'active' end);
  return jsonb_build_object('record', r, 'snapshot', snapshot, 'status', result_status);
end;
$$;
revoke all on function public.muse_personal_journey(jsonb) from public, anon, authenticated;
grant execute on function public.muse_personal_journey(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
