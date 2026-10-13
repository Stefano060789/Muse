begin;

-- Reapply this transaction before deploying puzzle assistance. Existing stories
-- retain empty alternatives and existing player sessions start with no hints.
create table if not exists public.shared_stories (
  id uuid primary key,
  owner_hash text not null,
  play_hash text not null,
  brief jsonb not null,
  content jsonb not null,
  answer_normalized text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table if not exists public.shared_story_sessions (
  story_id uuid not null references public.shared_stories(id) on delete cascade,
  player_hash text not null,
  current_scene integer not null default 0,
  solved boolean not null default false,
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  primary key (story_id, player_hash)
);

create table if not exists public.shared_story_generation_limits (
  bucket text primary key,
  count integer not null
);

alter table public.shared_stories add column if not exists alternative_answers_normalized jsonb not null default '[]'::jsonb;
alter table public.shared_story_sessions add column if not exists revealed_hints integer not null default 0;

alter table public.shared_stories enable row level security;
alter table public.shared_story_sessions enable row level security;
alter table public.shared_story_generation_limits enable row level security;
revoke all on public.shared_stories, public.shared_story_sessions, public.shared_story_generation_limits from anon, authenticated;

create or replace function public.reserve_shared_story_request(client_hash text, request_kind text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  daily_bucket text := 'day:' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD') || ':' || request_kind;
  client_bucket text := 'hour:' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD-HH24') || ':' || request_kind || ':' || client_hash;
  daily_count integer;
  client_count integer;
begin
  -- Keep identical to shared-story-media.sql, which adds the 'upload' kind.
  if request_kind not in ('generate', 'guess', 'upload') then raise exception 'Invalid request kind'; end if;
  insert into shared_story_generation_limits(bucket, count) values (daily_bucket, 0) on conflict do nothing;
  select count into daily_count from shared_story_generation_limits where bucket = daily_bucket for update;
  insert into shared_story_generation_limits(bucket, count) values (client_bucket, 0) on conflict do nothing;
  select count into client_count from shared_story_generation_limits where bucket = client_bucket for update;
  if daily_count >= (case request_kind when 'generate' then 100 when 'upload' then 200 else 5000 end)
     or client_count >= (case request_kind when 'generate' then 5 when 'upload' then 10 else 60 end) then return false; end if;
  update shared_story_generation_limits set count = count + 1 where bucket in (daily_bucket, client_bucket);
  delete from shared_stories where expires_at <= now();
  delete from shared_story_generation_limits
    where bucket like 'day:%' and bucket < 'day:' || to_char(now() at time zone 'UTC' - interval '2 days', 'YYYY-MM-DD')
       or bucket like 'hour:%' and bucket < 'hour:' || to_char(now() at time zone 'UTC' - interval '2 days', 'YYYY-MM-DD-HH24');
  return true;
end;
$$;

drop function if exists public.advance_shared_story(uuid, text, text, text);
create or replace function public.advance_shared_story(
  story_uuid uuid, session_hash text, action_name text, guess_normalized text default '', expected_play_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  story shared_stories%rowtype;
  player shared_story_sessions%rowtype;
begin
  select * into story from shared_stories where id = story_uuid and expires_at > now() for share;
  if not found then raise exception 'Story unavailable'; end if;
  if expected_play_hash is not null and story.play_hash <> expected_play_hash then raise exception 'Story unavailable'; end if;
  if action_name not in ('open', 'next', 'guess', 'hint') then raise exception 'Invalid action'; end if;
  if action_name = 'open' then
    insert into shared_story_sessions(story_id, player_hash) values (story_uuid, session_hash) on conflict do nothing;
  end if;
  select * into player from shared_story_sessions where story_id = story_uuid and player_hash = session_hash for update;
  if not found then raise exception 'Player session unavailable'; end if;
  if not player.solved and action_name = 'guess' then
    if player.attempts >= 30 then raise exception 'Guess limit reached'; end if;
    if player.last_attempt_at > now() - interval '2 seconds' then raise exception 'Please wait before guessing again'; end if;
    player.solved := guess_normalized = story.answer_normalized or story.alternative_answers_normalized ? guess_normalized;
    player.attempts := player.attempts + 1;
    player.last_attempt_at := now();
  elsif not player.solved and action_name = 'next' then
    player.current_scene := least(player.current_scene + 1, jsonb_array_length(story.content->'scenes') - 1);
  elsif not player.solved and action_name = 'hint' then
    player.revealed_hints := least(player.revealed_hints + 1, jsonb_array_length(coalesce(story.brief->'assistanceHints', '[]'::jsonb)));
  end if;
  update shared_story_sessions set
    current_scene = player.current_scene, solved = player.solved,
    attempts = player.attempts, last_attempt_at = player.last_attempt_at, revealed_hints = player.revealed_hints
    where story_id = story_uuid and player_hash = session_hash;
  return jsonb_build_object('current_scene', player.current_scene, 'solved', player.solved, 'revealed_hints', player.revealed_hints);
end;
$$;

revoke all on function public.reserve_shared_story_request(text, text) from public, anon, authenticated;
revoke all on function public.advance_shared_story(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_shared_story_request(text, text) to service_role;
grant execute on function public.advance_shared_story(uuid, text, text, text, text) to service_role;
grant all on public.shared_stories, public.shared_story_sessions, public.shared_story_generation_limits to service_role;

notify pgrst, 'reload schema';
commit;
