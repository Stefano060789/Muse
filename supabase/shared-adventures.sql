-- Incremental Muse-only migration. Apply after shared-stories.sql.
-- No iVote objects, policies, or grants are changed.
begin;

create table if not exists public.muse_adventure_sessions (
  story_id uuid not null references public.shared_stories(id) on delete cascade,
  player_hash text not null,
  used integer not null default 0 check (used between 0 and 12),
  turn jsonb,
  primary key (story_id, player_hash)
);
create table if not exists public.muse_adventure_requests (
  story_id uuid not null,
  player_hash text not null,
  request_id text not null,
  fingerprint text not null,
  status text not null check (status in ('pending', 'done', 'failed')),
  reserved_at timestamptz not null default now(),
  revision integer not null,
  result jsonb,
  primary key (story_id, player_hash, request_id),
  foreign key (story_id, player_hash) references public.muse_adventure_sessions on delete cascade
);
create table if not exists public.muse_adventure_budgets (
  bucket text primary key,
  used integer not null default 0 check (used >= 0)
);
alter table public.muse_adventure_sessions enable row level security;
alter table public.muse_adventure_requests enable row level security;
alter table public.muse_adventure_budgets enable row level security;
revoke all on public.muse_adventure_sessions, public.muse_adventure_requests, public.muse_adventure_budgets from public, anon, authenticated;
grant all on public.muse_adventure_sessions, public.muse_adventure_requests, public.muse_adventure_budgets to service_role;

create or replace function public.muse_shared_adventure(input jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  sid uuid;
  ph text := input->>'sessionHash';
  op text := input->>'operation';
  rid text := input->>'requestId';
  fp text := input->>'fingerprint';
  story public.shared_stories%rowtype;
  player public.shared_story_sessions%rowtype;
  state public.muse_adventure_sessions%rowtype;
  previous public.muse_adventure_requests%rowtype;
  budget integer;
  total integer;
  daily integer;
  cap integer := (input->>'cap')::integer;
  sb text;
  day_bucket text := 'day:' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  pending boolean;
  view jsonb;
  response jsonb;
  failed boolean := coalesce((input->>'failed')::boolean, false);
begin
  if cap is null or cap not between 1 and 10000 then raise exception 'Adventure: invalid global cap'; end if;
  if op = 'ready' then
    return jsonb_build_object('view', jsonb_build_object('revision', 0, 'actionsUsed', 0, 'actionsRemaining', 12,
      'budget', 0, 'budgetRemaining', 0, 'pending', false, 'turn', null));
  end if;
  if op is null or op not in ('view', 'reserve', 'finish') then raise exception 'Adventure: invalid operation'; end if;
  sid := (input->>'storyId')::uuid;
  sb := 'story:' || sid::text;
  -- Story lock serializes rotation/deletion/legacy judging with reservation and
  -- completion. The daily row serializes budgets across all Muse adventures.
  select * into story from public.shared_stories where id = sid and expires_at > now() for update;
  if not found or story.play_hash is distinct from input->>'playHash' then raise exception 'Adventure: story unavailable'; end if;
  select * into player from public.shared_story_sessions where story_id = sid and player_hash = ph for update;
  if not found then raise exception 'Adventure: session unavailable'; end if;
  budget := (story.brief->'adventure'->>'actionBudget')::integer;
  if budget is null or budget not between 1 and 1000 then raise exception 'Adventure: not enabled'; end if;
  insert into public.muse_adventure_sessions(story_id, player_hash) values (sid, ph) on conflict do nothing;
  select * into state from public.muse_adventure_sessions where story_id = sid and player_hash = ph for update;
  update public.muse_adventure_requests set status = 'failed'
    where story_id = sid and player_hash = ph and status = 'pending' and reserved_at <= now() - interval '90 seconds';
  insert into public.muse_adventure_budgets(bucket) values (day_bucket) on conflict do nothing;
  select used into daily from public.muse_adventure_budgets where bucket = day_bucket for update;
  insert into public.muse_adventure_budgets(bucket) values (sb) on conflict do nothing;
  select used into total from public.muse_adventure_budgets where bucket = sb for update;
  select exists(select 1 from public.muse_adventure_requests where story_id = sid and player_hash = ph and status = 'pending') into pending;
  view := jsonb_build_object('revision', state.used, 'actionsUsed', state.used, 'actionsRemaining', 12 - state.used,
    'budget', budget, 'budgetRemaining', greatest(0, budget - total), 'pending', pending, 'turn', state.turn);
  if op = 'view' then return jsonb_build_object('view', view); end if;
  if rid is null or rid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or fp is null or fp !~ '^[0-9a-f]{64}$' then raise exception 'Adventure: invalid request'; end if;
  select * into previous from public.muse_adventure_requests where story_id = sid and player_hash = ph and request_id = rid;
  if op = 'finish' then
    if previous.request_id is null or previous.fingerprint <> fp or previous.status <> 'pending' then raise exception 'Adventure: attempt expired or already completed'; end if;
    if player.solved or state.used <> previous.revision then raise exception 'Adventure: stale or solved state'; end if;
    if not failed and (input->'turn' is null or jsonb_typeof(input->'turn') <> 'object') then raise exception 'Adventure: missing turn'; end if;
    if not failed then
      state.turn := input->'turn';
      update public.muse_adventure_sessions set turn = state.turn where story_id = sid and player_hash = ph;
    end if;
    view := view || jsonb_build_object('pending', false, 'turn', state.turn);
    response := jsonb_build_object('view', view, 'status', case when failed then 'failed' else 'done' end);
    update public.muse_adventure_requests set status = case when failed then 'failed' else 'done' end, result = response
      where story_id = sid and player_hash = ph and request_id = rid;
    return response;
  end if;
  if previous.request_id is not null then
    if previous.fingerprint <> fp then raise exception 'Adventure: request ID reused with different action'; end if;
    return coalesce(previous.result, jsonb_build_object('view', view, 'status', previous.status));
  end if;
  if player.solved then raise exception 'Adventure: already solved'; end if;
  if pending then raise exception 'Adventure: action in progress; reopen to refresh'; end if;
  if (input->>'revision')::integer is distinct from state.used then raise exception 'Adventure: stale state; reopen to refresh'; end if;
  if state.used >= 12 then raise exception 'Adventure: 12-action cap reached. Final guesses, hints and audio remain available.'; end if;
  if total >= budget or daily >= cap then raise exception 'Adventure: AI budget reached. Final guesses, hints and audio remain available.'; end if;
  update public.muse_adventure_budgets set used = used + 1 where bucket in (sb, day_bucket);
  update public.muse_adventure_sessions set used = used + 1 where story_id = sid and player_hash = ph;
  insert into public.muse_adventure_requests(story_id, player_hash, request_id, fingerprint, status, revision)
    values (sid, ph, rid, fp, 'pending', state.used + 1);
  view := view || jsonb_build_object('revision', state.used + 1, 'actionsUsed', state.used + 1, 'actionsRemaining', 11 - state.used,
    'budgetRemaining', budget - total - 1, 'pending', true);
  return jsonb_build_object('view', view, 'status', 'reserved');
end;
$$;
revoke all on function public.muse_shared_adventure(jsonb) from public, anon, authenticated;
grant execute on function public.muse_shared_adventure(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
