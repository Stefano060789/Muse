begin;

-- Shared Story final photo/video reveal. Apply after shared-stories.sql (and the
-- other Muse migrations) and BEFORE deploying the matching application code.
-- Idempotent: safe to reapply. Objects live in a PRIVATE bucket; there are no
-- anon/authenticated policies, so only the server's service role can create
-- signed upload/download URLs. Recipients receive a short-lived signed URL only
-- after the server verifies a solved player session.

alter table public.shared_stories add column if not exists media_attempts integer not null default 0;

create table if not exists public.shared_story_media (
  id uuid primary key,
  story_id uuid not null references public.shared_stories(id) on delete cascade,
  object_key text not null unique,
  kind text not null check (kind in ('photo', 'video')),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm')),
  size bigint not null check (size > 0 and size <= 20971520 and (kind = 'video' or size <= 5242880)),
  status text not null check (status in ('pending', 'ready')),
  upload_hash text not null,
  upload_expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index if not exists shared_story_media_one_ready on public.shared_story_media(story_id) where status = 'ready';
create index if not exists shared_story_media_story on public.shared_story_media(story_id);
create index if not exists shared_story_media_pending_expiry on public.shared_story_media(upload_expires_at) where status = 'pending';

-- Deleted rows (replacement, failed validation, owner removal, story deletion or
-- expiry through the FK cascade) queue their object for removal by the server.
create table if not exists public.shared_story_media_purge (
  object_key text primary key,
  queued_at timestamptz not null default now(),
  retain_until timestamptz not null default now()
);
alter table public.shared_story_media_purge add column if not exists retain_until timestamptz not null default now();

create or replace function public.muse_queue_shared_media_purge()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Supabase upload capabilities last two hours. Keep sweeping discarded
  -- pending objects until that capability can no longer create a late object.
  insert into shared_story_media_purge(object_key, retain_until)
    values (old.object_key, case when old.status = 'pending' then greatest(now(), old.created_at + interval '125 minutes') else now() end)
    on conflict (object_key) do update set retain_until = greatest(shared_story_media_purge.retain_until, excluded.retain_until);
  return old;
end;
$$;
drop trigger if exists shared_story_media_queue_purge on public.shared_story_media;
create trigger shared_story_media_queue_purge after delete on public.shared_story_media
  for each row execute function public.muse_queue_shared_media_purge();

create or replace function public.muse_begin_shared_media(media jsonb, max_attempts integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  story_uuid uuid := (media->>'story_id')::uuid;
begin
  perform 1 from shared_stories where id = story_uuid and expires_at > now() for update;
  if not found then raise exception 'Story unavailable'; end if;
  update shared_stories set media_attempts = media_attempts + 1
    where id = story_uuid and media_attempts < max_attempts;
  if not found then return false; end if;
  delete from shared_story_media where story_id = story_uuid and status = 'pending';
  insert into shared_story_media(id, story_id, object_key, kind, mime, size, status, upload_hash, upload_expires_at, created_at)
  values ((media->>'id')::uuid, story_uuid, media->>'object_key', media->>'kind', media->>'mime', (media->>'size')::bigint,
          'pending', media->>'upload_hash', (media->>'upload_expires_at')::timestamptz, (media->>'created_at')::timestamptz);
  return true;
end;
$$;

create or replace function public.muse_activate_shared_media(story_uuid uuid, media_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1 from shared_stories where id = story_uuid and expires_at > now() for update;
  if not found then raise exception 'Media unavailable'; end if;
  perform 1 from shared_story_media where id = media_uuid and story_id = story_uuid
    and status = 'pending' and upload_expires_at > now() for update;
  if not found then raise exception 'Media unavailable'; end if;
  delete from shared_story_media where story_id = story_uuid and status = 'ready';
  update shared_story_media set status = 'ready' where id = media_uuid;
end;
$$;

-- Same function as shared-stories.sql, extended with the 'upload' request kind
-- (10 per connection per hour, 200 per UTC day across the prototype).
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

alter table public.shared_story_media enable row level security;
alter table public.shared_story_media_purge enable row level security;
revoke all on public.shared_story_media, public.shared_story_media_purge from anon, authenticated;
revoke all on function public.muse_queue_shared_media_purge() from public, anon, authenticated;
revoke all on function public.muse_begin_shared_media(jsonb, integer) from public, anon, authenticated;
revoke all on function public.muse_activate_shared_media(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reserve_shared_story_request(text, text) from public, anon, authenticated;
grant execute on function public.muse_begin_shared_media(jsonb, integer) to service_role;
grant execute on function public.muse_activate_shared_media(uuid, uuid) to service_role;
grant execute on function public.reserve_shared_story_request(text, text) to service_role;
grant all on public.shared_story_media, public.shared_story_media_purge to service_role;

-- Private bucket with server-side size and type limits (exact per-type limits
-- and byte signatures are enforced again by the application).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('muse-shared-media', 'muse-shared-media', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Do not guess whether an arbitrary existing client policy also grants access
-- to this bucket (a bucket_id reference alone does not establish isolation).
-- Stop for review rather than changing policies belonging to another product.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and roles && array['public', 'anon', 'authenticated']::name[]
  ) then
    raise exception 'Existing client-role storage.objects policies require an isolation review before installing Muse media. No policies have been changed.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;