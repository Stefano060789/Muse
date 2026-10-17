begin;

-- Apply after shared-story-media.sql. Separate from the gift voice attachment.
-- Reservations are lifetime charged characters, including failed/unknown calls.
create table if not exists public.muse_studio_audio (
  story_id uuid not null references public.shared_stories(id) on delete cascade,
  scene_index integer not null check (scene_index between 0 and 11),
  fingerprint text not null,
  object_key text not null unique,
  status text not null check (status in ('pending', 'ready', 'failed')),
  characters integer not null check (characters between 1 and 5000),
  size integer not null default 0 check (size between 0 and 5242880),
  created_at timestamptz not null default now(),
  primary key(story_id, scene_index)
);
create table if not exists public.muse_studio_budget (
  id integer primary key check (id = 1), used bigint not null default 0 check (used >= 0)
);
insert into public.muse_studio_budget values (1, 0) on conflict do nothing;
create table if not exists public.muse_studio_purge (
  object_key text primary key, retain_until timestamptz not null
);

alter table public.muse_studio_audio enable row level security;
alter table public.muse_studio_budget enable row level security;
alter table public.muse_studio_purge enable row level security;
revoke all on public.muse_studio_audio, public.muse_studio_budget, public.muse_studio_purge from public, anon, authenticated;
grant all on public.muse_studio_audio, public.muse_studio_budget, public.muse_studio_purge to service_role;

create or replace function public.muse_queue_studio_purge() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into muse_studio_purge values (old.object_key, greatest(now(), old.created_at + interval '5 minutes'))
    on conflict do nothing;
  return old;
end;
$$;
drop trigger if exists muse_studio_queue_purge on public.muse_studio_audio;
create trigger muse_studio_queue_purge after delete on public.muse_studio_audio
  for each row execute function public.muse_queue_studio_purge();
revoke all on function public.muse_queue_studio_purge() from public, anon, authenticated;

create or replace function public.muse_studio_narration(request jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  op text := request->>'operation';
  r jsonb := request->'record';
  sid uuid;
  idx integer;
  rows jsonb := '[]'::jsonb;
  keys jsonb := '[]'::jsonb;
  reserved boolean := false;
begin
  -- Expiry revokes reads immediately; cleanup is also callable by the service-role
  -- scheduler using {"operation":"purge"} / {"operation":"purged","keys":[...]}.
  delete from muse_studio_audio where story_id in (select id from shared_stories where expires_at <= now());
  insert into muse_studio_purge
    select object_key, greatest(now(), created_at + interval '5 minutes')
    from muse_studio_audio where status = 'pending' and created_at <= now() - interval '2 minutes'
    on conflict do nothing;
  update muse_studio_audio set status = 'failed'
    where status = 'pending' and created_at <= now() - interval '2 minutes';

  if op = 'purge' then
    select coalesce(jsonb_agg(object_key), '[]'::jsonb) into keys
      from (select object_key from muse_studio_purge where retain_until <= now() order by retain_until limit 20) q;
  elsif op = 'purged' then
    delete from muse_studio_purge where object_key in (select jsonb_array_elements_text(request->'keys'));
  elsif op = 'status' then
    select coalesce(jsonb_agg(to_jsonb(a) order by a.scene_index), '[]'::jsonb) into rows
      from muse_studio_audio a join shared_stories s on s.id = a.story_id
      where a.story_id = (request->>'storyId')::uuid and s.expires_at > now();
  elsif op = 'audio' then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into rows
      from muse_studio_audio a join shared_stories s on s.id = a.story_id
      where a.story_id = (request->>'storyId')::uuid and a.scene_index = (request->>'sceneIndex')::integer
        and a.status = 'ready' and s.expires_at > now()
        and (not (request ? 'sessionHash') or (s.play_hash = request->>'playHash' and exists (
          select 1 from shared_story_sessions p where p.story_id = s.id
            and p.player_hash = request->>'sessionHash' and p.current_scene >= a.scene_index)));
  elsif op = 'reserve' then
    sid := (r->>'story_id')::uuid;
    idx := (r->>'scene_index')::integer;
    perform 1 from shared_stories where id = sid and expires_at > now() for update;
    if not found then raise exception 'Story unavailable'; end if;
    if not exists (select 1 from muse_studio_audio where story_id = sid and scene_index = idx) then
      update muse_studio_budget set used = used + (r->>'characters')::integer
        where id = 1 and used + (r->>'characters')::integer <= (request->>'budget')::bigint;
      if not found then raise exception 'Studio budget exhausted'; end if;
      insert into muse_studio_audio(story_id, scene_index, fingerprint, object_key, status, characters)
        values (sid, idx, r->>'fingerprint', r->>'object_key', 'pending', (r->>'characters')::integer);
      reserved := true;
    end if;
  elsif op = 'finish' then
    update muse_studio_audio set status = case when request->>'failed' = 'true' then 'failed' else 'ready' end,
      size = case when request->>'failed' = 'true' then 0 else (r->>'size')::integer end
      where story_id = (r->>'story_id')::uuid and scene_index = (r->>'scene_index')::integer
        and object_key = r->>'object_key' and fingerprint = r->>'fingerprint' and status = 'pending';
    if request->>'failed' = 'true' then
      insert into muse_studio_purge values (r->>'object_key', greatest(now(), (r->>'created_at')::timestamptz + interval '5 minutes'))
        on conflict do nothing;
    elsif not found then raise exception 'Studio reservation expired or story deleted';
    end if;
  else raise exception 'Invalid Studio operation';
  end if;
  return jsonb_build_object('records', rows, 'reserved', reserved, 'keys', keys);
end;
$$;
revoke all on function public.muse_studio_narration(jsonb) from public, anon, authenticated;
grant execute on function public.muse_studio_narration(jsonb) to service_role;

-- Never change bucket privacy or touch recipient-upload permissions.
update storage.buckets set allowed_mime_types =
  array(select distinct unnest(allowed_mime_types || array['audio/mpeg']))
  where id = 'muse-shared-media' and allowed_mime_types is not null;
commit;
