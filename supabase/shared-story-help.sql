-- Incremental Muse-only migration; no iVote tables, policies or grants change.
-- Apply AFTER shared-stories.sql and shared-adventures.sql (if adventures are
-- enabled), before deploying the matching application. Safe to reapply.
begin;

alter table public.shared_story_sessions
  add column if not exists skipped boolean not null default false;

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
  -- Match adventure lock ordering so skipping serializes with paid reservations
  -- and in-flight completions, as well as capability rotation and deletion.
  select * into story from shared_stories where id = story_uuid and expires_at > now() for update;
  if not found then raise exception 'Story unavailable'; end if;
  if expected_play_hash is null or story.play_hash <> expected_play_hash then raise exception 'Story unavailable'; end if;
  if action_name is null or action_name not in ('open', 'next', 'guess', 'hint', 'skip') then raise exception 'Invalid action'; end if;
  if action_name = 'skip' and coalesce(story.brief->>'unlockPolicy', 'solve') <> 'allow-skip' then
    raise exception 'Skipping is not enabled';
  end if;
  if action_name = 'open' then
    insert into shared_story_sessions(story_id, player_hash) values (story_uuid, session_hash) on conflict do nothing;
  end if;
  select * into player from shared_story_sessions where story_id = story_uuid and player_hash = session_hash for update;
  if not found then raise exception 'Player session unavailable'; end if;
  if not player.solved and not player.skipped then
    if action_name = 'guess' then
      if player.attempts >= 30 then raise exception 'Guess limit reached'; end if;
      if player.last_attempt_at > now() - interval '2 seconds' then raise exception 'Please wait before guessing again'; end if;
      player.solved := guess_normalized = story.answer_normalized or story.alternative_answers_normalized ? guess_normalized;
      player.attempts := player.attempts + 1;
      player.last_attempt_at := now();
    elsif action_name = 'next' then
      if story.brief ? 'adventure' then raise exception 'Use an adventure action instead of Next'; end if;
      player.current_scene := least(player.current_scene + 1, jsonb_array_length(story.content->'scenes') - 1);
    elsif action_name = 'hint' then
      player.revealed_hints := least(player.revealed_hints + 1, jsonb_array_length(coalesce(story.brief->'assistanceHints', '[]'::jsonb)));
    elsif action_name = 'skip' then
      player.skipped := true;
      if to_regclass('public.muse_adventure_requests') is not null then
        update public.muse_adventure_requests set status = 'failed', result = null
          where story_id = story_uuid and player_hash = session_hash and status = 'pending';
      end if;
    end if;
  end if;
  update shared_story_sessions set
    current_scene = player.current_scene, solved = player.solved, skipped = player.skipped,
    attempts = player.attempts, last_attempt_at = player.last_attempt_at, revealed_hints = player.revealed_hints
    where story_id = story_uuid and player_hash = session_hash;
  return jsonb_build_object('current_scene', player.current_scene, 'solved', player.solved,
    'skipped', player.skipped, 'revealed_hints', player.revealed_hints);
end;
$$;

-- Defense in depth for the existing adventure RPC: an old or concurrent caller
-- cannot reserve or finish a paid turn after skipping. Raising here rolls back
-- its entire transaction, including any budget increments before the insert.
create or replace function public.muse_guard_skipped_adventure()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status in ('pending', 'done') and exists (
    select 1 from public.shared_story_sessions
      where story_id = new.story_id and player_hash = new.player_hash and skipped
  ) then raise exception 'Adventure: already revealed'; end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.muse_adventure_requests') is not null then
    drop trigger if exists muse_guard_skipped_adventure on public.muse_adventure_requests;
    create trigger muse_guard_skipped_adventure before insert or update on public.muse_adventure_requests
      for each row execute function public.muse_guard_skipped_adventure();
  end if;
end;
$$;

revoke all on function public.muse_guard_skipped_adventure() from public, anon, authenticated;
revoke all on function public.advance_shared_story(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.advance_shared_story(uuid, text, text, text, text) to service_role;
notify pgrst, 'reload schema';
commit;
