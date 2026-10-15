begin;

-- Optional gift metadata, private WAV reveal uploads and recipient replies.
-- Apply after shared-story-media.sql and before deploying gifting support.
-- This migration only changes the Muse private bucket and creates Muse tables;
-- it does not alter existing storage policies.

alter table public.shared_stories add column if not exists voice_attempts integer not null default 0;

create table if not exists public.shared_story_voice (
  id uuid primary key,
  story_id uuid not null references public.shared_stories(id) on delete cascade,
  object_key text not null unique,
  kind text not null check (kind = 'voice'),
  mime text not null check (mime = 'audio/wav'),
  size bigint not null check (size > 0 and size <= 5242880),
  status text not null check (status in ('pending', 'ready')),
  upload_hash text not null,
  upload_expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index if not exists shared_story_voice_one_ready
  on public.shared_story_voice(story_id) where status = 'ready';
create index if not exists shared_story_voice_story on public.shared_story_voice(story_id);
create index if not exists shared_story_voice_pending_expiry
  on public.shared_story_voice(upload_expires_at) where status = 'pending';

create table if not exists public.shared_story_voice_purge (
  object_key text primary key,
  queued_at timestamptz not null default now(),
  retain_until timestamptz not null default now()
);
create or replace function public.muse_queue_shared_story_voice_purge()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into shared_story_voice_purge(object_key, retain_until)
    values (old.object_key, case when old.status = 'pending'
      then greatest(now(), old.created_at + interval '125 minutes') else now() end)
    on conflict (object_key) do update
      set retain_until = greatest(shared_story_voice_purge.retain_until, excluded.retain_until);
  return old;
end;
$$;
drop trigger if exists shared_story_voice_queue_purge on public.shared_story_voice;
create trigger shared_story_voice_queue_purge after delete on public.shared_story_voice
  for each row execute function public.muse_queue_shared_story_voice_purge();

create table if not exists public.shared_story_replies (
  story_id uuid not null,
  session_hash text not null,
  message text not null check (length(btrim(message)) between 1 and 1000),
  created_at timestamptz not null default now(),
  primary key (story_id, session_hash),
  foreign key (story_id, session_hash)
    references public.shared_story_sessions(story_id, player_hash) on delete cascade
);
create index if not exists shared_story_replies_story
  on public.shared_story_replies(story_id, created_at);

create or replace function public.muse_begin_shared_story_voice(voice_record jsonb, max_attempts integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  story_uuid uuid := (voice_record->>'story_id')::uuid;
begin
  perform 1 from shared_stories where id = story_uuid and expires_at > now() for update;
  if not found then raise exception 'Story unavailable'; end if;
  update shared_stories set voice_attempts = voice_attempts + 1
    where id = story_uuid and voice_attempts < max_attempts;
  if not found then return false; end if;
  delete from shared_story_voice where story_id = story_uuid and status = 'pending';
  insert into shared_story_voice(id, story_id, object_key, kind, mime, size, status, upload_hash, upload_expires_at, created_at)
  values ((voice_record->>'id')::uuid, story_uuid, voice_record->>'object_key', 'voice',
    voice_record->>'mime', (voice_record->>'size')::bigint, 'pending',
    voice_record->>'upload_hash', (voice_record->>'upload_expires_at')::timestamptz,
    (voice_record->>'created_at')::timestamptz);
  return true;
end;
$$;

create or replace function public.muse_activate_shared_story_voice(story_uuid uuid, voice_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1 from shared_stories where id = story_uuid and expires_at > now() for update;
  if not found then raise exception 'Voice unavailable'; end if;
  perform 1 from shared_story_voice where id = voice_uuid and story_id = story_uuid
    and status = 'pending' and upload_expires_at > now() for update;
  if not found then raise exception 'Voice unavailable'; end if;
  delete from shared_story_voice where story_id = story_uuid and status = 'ready';
  update shared_story_voice set status = 'ready' where id = voice_uuid;
end;
$$;

create or replace function public.muse_submit_shared_story_reply(p_story_uuid uuid, p_session_hash text, p_reply_message text)
returns table(message text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  story_brief jsonb;
  player_solved boolean;
  player_skipped boolean;
begin
  if p_reply_message is null or length(btrim(p_reply_message)) not between 1 and 1000 then
    raise exception 'Reply unavailable';
  end if;
  select brief into story_brief from shared_stories
    where id = p_story_uuid and expires_at > now() for update;
  if not found then raise exception 'Story unavailable'; end if;
  if story_brief->'gift'->>'allowReply' is distinct from 'true' then
    raise exception 'Reply unavailable';
  end if;
  select solved, skipped into player_solved, player_skipped
    from shared_story_sessions where story_id = p_story_uuid and player_hash = p_session_hash;
  if not found or (not player_solved and not player_skipped) then
    raise exception 'Reply unavailable';
  end if;
  if not exists(select 1 from shared_story_replies where story_id = p_story_uuid and shared_story_replies.session_hash = p_session_hash)
      and (select count(*) from shared_story_replies where story_id = p_story_uuid) >= 100 then
    raise exception 'Reply limit reached';
  end if;
  return query
    insert into shared_story_replies as existing(story_id, session_hash, message, created_at)
    values (p_story_uuid, p_session_hash, btrim(p_reply_message), now())
    on conflict (story_id, session_hash) do update set
      message = excluded.message,
      created_at = case when existing.message = excluded.message then existing.created_at else excluded.created_at end
    returning existing.message, existing.created_at;
end;
$$;

alter table public.shared_story_voice enable row level security;
alter table public.shared_story_voice_purge enable row level security;
alter table public.shared_story_replies enable row level security;
revoke all on public.shared_story_voice, public.shared_story_voice_purge, public.shared_story_replies from anon, authenticated;
revoke all on function public.muse_queue_shared_story_voice_purge() from public, anon, authenticated;
revoke all on function public.muse_begin_shared_story_voice(jsonb, integer) from public, anon, authenticated;
revoke all on function public.muse_activate_shared_story_voice(uuid, uuid) from public, anon, authenticated;
revoke all on function public.muse_submit_shared_story_reply(uuid, text, text) from public, anon, authenticated;
grant execute on function public.muse_begin_shared_story_voice(jsonb, integer) to service_role;
grant execute on function public.muse_activate_shared_story_voice(uuid, uuid) to service_role;
grant execute on function public.muse_submit_shared_story_reply(uuid, text, text) to service_role;
grant all on public.shared_story_voice, public.shared_story_voice_purge, public.shared_story_replies to service_role;

update storage.buckets set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'audio/wav'
] where id = 'muse-shared-media' and public = false;

notify pgrst, 'reload schema';
commit;
