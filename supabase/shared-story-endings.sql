-- Apply after shared-story-help.sql (and shared-cooperative.sql when enabled).
-- Brief JSON stores endingMode/endingChoices; no existing story needs rewriting.
begin;

create or replace function public.advance_shared_story(
  story_uuid uuid, session_hash text, action_name text, guess_normalized text default '', expected_play_hash text default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  story shared_stories%rowtype;
  player shared_story_sessions%rowtype;
  ending_mode text;
  final_scene integer;
begin
  select * into story from shared_stories where id = story_uuid and expires_at > now() for update;
  if not found or expected_play_hash is null or story.play_hash <> expected_play_hash then raise exception 'Story unavailable'; end if;
  if action_name is null or action_name not in ('open', 'next', 'guess', 'hint', 'skip', 'ending-choice') then raise exception 'Invalid action'; end if;
  ending_mode := coalesce(story.brief->>'endingMode', 'answer');
  final_scene := jsonb_array_length(story.content->'scenes') - 1;
  if action_name = 'open' then
    insert into shared_story_sessions(story_id, player_hash) values (story_uuid, session_hash) on conflict do nothing;
  end if;
  select * into player from shared_story_sessions where story_id = story_uuid and player_hash = session_hash for update;
  if not found then raise exception 'Player session unavailable'; end if;
  if action_name = 'next' and story.brief ? 'adventure' and to_regclass('public.muse_adventure_requests') is not null then
    update public.muse_adventure_requests set status = 'failed'
      where story_id = story_uuid and player_hash = session_hash and status = 'pending'
      and reserved_at <= now() - interval '90 seconds';
    if exists (select 1 from public.muse_adventure_requests
      where story_id = story_uuid and player_hash = session_hash and status = 'pending') then
      raise exception 'Adventure: action in progress; wait before continuing to the next scene.';
    end if;
  end if;
  -- Old versions allowed an early solve. It must not bypass prepared scenes.
  if player.current_scene < final_scene then
    player.solved := false;
    player.skipped := false;
  end if;
  if action_name in ('guess', 'skip', 'ending-choice') and player.current_scene < final_scene then
    raise exception 'Reach the final scene first';
  end if;
  if (action_name in ('guess', 'skip') and ending_mode <> 'answer')
    or (action_name = 'ending-choice' and ending_mode <> 'choice') then
    raise exception 'This ending requires a different action';
  end if;
  if action_name = 'ending-choice' then
    if guess_normalized is null or guess_normalized !~ '^[0-4]$' then raise exception 'Invalid ending choice'; end if;
    if jsonb_typeof(story.brief->'endingChoices') is distinct from 'array'
      or jsonb_array_length(story.brief->'endingChoices') not between 3 and 5
      or (guess_normalized::integer) >= jsonb_array_length(story.brief->'endingChoices') then
      raise exception 'Invalid ending choice';
    end if;
  end if;
  if action_name = 'skip' and coalesce(story.brief->>'unlockPolicy', 'solve') <> 'allow-skip' then raise exception 'Skipping is not enabled'; end if;
  if not player.solved and not player.skipped then
    if action_name = 'guess' then
      if player.attempts >= 30 then raise exception 'Guess limit reached'; end if;
      if player.last_attempt_at > now() - interval '2 seconds' then raise exception 'Please wait before guessing again'; end if;
      player.solved := guess_normalized <> '' and (guess_normalized = story.answer_normalized or story.alternative_answers_normalized ? guess_normalized);
      player.attempts := player.attempts + 1;
      player.last_attempt_at := now();
    elsif action_name = 'next' then
      player.current_scene := least(player.current_scene + 1, final_scene);
    elsif action_name = 'hint' then
      player.revealed_hints := least(player.revealed_hints + 1, jsonb_array_length(coalesce(story.brief->'assistanceHints', '[]'::jsonb)));
    elsif action_name = 'skip' then
      player.skipped := true;
    elsif action_name = 'ending-choice' then
      player.solved := true;
    end if;
  end if;
  if ending_mode = 'automatic' and player.current_scene = final_scene and action_name in ('open', 'next') then player.solved := true; end if;
  if (player.solved or player.skipped) and to_regclass('public.muse_adventure_requests') is not null then
    update public.muse_adventure_requests set status = 'failed', result = null
      where story_id = story_uuid and player_hash = session_hash and status = 'pending';
  end if;
  update shared_story_sessions set
    current_scene = player.current_scene, solved = player.solved, skipped = player.skipped,
    attempts = player.attempts, last_attempt_at = player.last_attempt_at, revealed_hints = player.revealed_hints
    where story_id = story_uuid and player_hash = session_hash;
  return jsonb_build_object('current_scene', player.current_scene, 'solved', player.solved,
    'skipped', player.skipped, 'revealed_hints', player.revealed_hints);
end;
$$;

-- Versioned entry points fail closed if this migration has not been applied.
create or replace function public.advance_shared_story_ending(
  story_uuid uuid, session_hash text, action_name text, guess_normalized text default '', expected_play_hash text default null
)
returns jsonb language sql security definer set search_path = public, pg_temp
as $$ select public.advance_shared_story(story_uuid, session_hash, action_name, guess_normalized, expected_play_hash) $$;

create or replace function public.muse_cooperative_ending_advance(input jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$ begin return public.muse_cooperative_advance(input); end; $$;

revoke all on function public.advance_shared_story(uuid,text,text,text,text),
  public.advance_shared_story_ending(uuid,text,text,text,text),
  public.muse_cooperative_ending_advance(jsonb) from public, anon, authenticated;
grant execute on function public.advance_shared_story(uuid,text,text,text,text),
  public.advance_shared_story_ending(uuid,text,text,text,text),
  public.muse_cooperative_ending_advance(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
