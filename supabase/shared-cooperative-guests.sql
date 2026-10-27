-- Apply after shared-cooperative.sql.
-- Guest participant IDs are random UUIDs derived from an opaque browser session
-- token; unlike account IDs, they do not have a row in auth.users.
begin;

alter table public.muse_cooperative_players
  drop constraint if exists muse_cooperative_players_user_id_fkey;

create or replace function public.muse_cooperative_story(input jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  sid uuid;
  uid uuid;
  op text := input->>'operation';
  story public.shared_stories%rowtype;
  active public.muse_cooperative_turns%rowtype;
  own_name text;
  next_uid uuid;
  player_count integer;
  members jsonb;
begin
  if op = 'ready' then return jsonb_build_object('ready', true); end if;
  sid := (input->>'storyId')::uuid;
  uid := (input->>'userId')::uuid;
  if op is null or op not in ('join', 'view', 'pass') then raise exception 'Cooperative: invalid operation'; end if;
  select * into story from public.shared_stories where id = sid and expires_at > now() for update;
  if not found or story.brief->'adventure'->>'cooperative' is distinct from 'true' then
    raise exception 'Cooperative: story unavailable';
  end if;
  if op = 'join' then
    declare
      requested_name text := nullif(btrim(input->>'displayName'), '');
      next_position integer;
    begin
      select count(*), coalesce(max(position), 0) + 1 into player_count, next_position
        from public.muse_cooperative_players where story_id = sid;
      if not exists (select 1 from public.muse_cooperative_players where story_id = sid and user_id = uid) then
        if requested_name is null then raise exception 'Cooperative: enter a display name to join'; end if;
        if length(requested_name) > 40 then
          raise exception 'Cooperative: display name must be at most 40 characters';
        end if;
        if player_count >= 20 then raise exception 'Cooperative: this story is full (20 participants maximum)'; end if;
        if exists (
          select 1 from public.muse_cooperative_players where story_id = sid and display_name = requested_name
        ) then requested_name := 'Participant ' || next_position; end if;
        insert into public.muse_cooperative_players(story_id, user_id, display_name, position)
          values (sid, uid, requested_name, next_position);
        insert into public.muse_cooperative_turns(story_id, current_user_id, turn_number)
          values (sid, uid, 1) on conflict (story_id) do nothing;
      end if;
    end;
  end if;
  select display_name into own_name from public.muse_cooperative_players where story_id = sid and user_id = uid;
  if own_name is null then raise exception 'Cooperative: join this story before viewing progress'; end if;
  select * into active from public.muse_cooperative_turns where story_id = sid for update;
  if not found then raise exception 'Cooperative: turn state unavailable'; end if;

  if op = 'pass' then
    if active.current_user_id <> uid then raise exception 'Cooperative: it is another participant''s turn'; end if;
    if exists (
      select 1 from public.muse_adventure_requests
      where story_id = sid and player_hash = input->>'sessionHash' and status = 'pending'
    ) then raise exception 'Cooperative: wait for the current action to finish before passing'; end if;
    select user_id into next_uid from public.muse_cooperative_players
      where story_id = sid and position > (
        select position from public.muse_cooperative_players where story_id = sid and user_id = uid
      ) order by position limit 1;
    if next_uid is null then
      select user_id into next_uid from public.muse_cooperative_players where story_id = sid order by position limit 1;
    end if;
    update public.muse_cooperative_turns set current_user_id = next_uid, turn_number = turn_number + 1
      where story_id = sid returning * into active;
  end if;

  select jsonb_agg(jsonb_build_object('displayName', display_name, 'position', position) order by position)
    into members from public.muse_cooperative_players where story_id = sid;
  select display_name into own_name from public.muse_cooperative_players where story_id = sid and user_id = active.current_user_id;
  return jsonb_build_object(
    'members', coalesce(members, '[]'::jsonb), 'currentTurnName', own_name,
    'turnNumber', active.turn_number, 'isYourTurn', active.current_user_id = uid,
    'yourName', (select display_name from public.muse_cooperative_players where story_id = sid and user_id = uid)
  );
end;
$$;

revoke all on function public.muse_cooperative_story(jsonb) from public, anon, authenticated;
grant execute on function public.muse_cooperative_story(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
