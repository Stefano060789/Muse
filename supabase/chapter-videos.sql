-- Muse-only private chapter video metadata. Apply only after review.
begin;

create table if not exists public.muse_chapter_videos (
  id uuid primary key,
  owner_id text not null,
  chapter_id uuid not null,
  story_id uuid not null,
  chapter_number integer not null check (chapter_number > 0),
  status text not null check (status in ('starting', 'pending', 'ready', 'failed', 'unknown')),
  provider_reference text,
  asset_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  next_check_at timestamptz not null,
  lease_id uuid,
  lease_until timestamptz
);
create index if not exists muse_chapter_videos_owner_idx on public.muse_chapter_videos(owner_id, created_at);
create index if not exists muse_chapter_videos_check_idx on public.muse_chapter_videos(next_check_at);
alter table public.muse_chapter_videos enable row level security;
revoke all on public.muse_chapter_videos from public, anon, authenticated;
grant all on public.muse_chapter_videos to service_role;

create table if not exists public.muse_chapter_video_maintenance (
  id boolean primary key default true check (id),
  completed_at timestamptz not null
);
alter table public.muse_chapter_video_maintenance enable row level security;
revoke all on public.muse_chapter_video_maintenance from public, anon, authenticated;
grant all on public.muse_chapter_video_maintenance to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('muse-chapter-videos', 'muse-chapter-videos', false, 31457280, array['video/mp4'])
on conflict (id) do nothing;

-- A restrictive policy prevents unrelated permissive Storage policies from
-- exposing the bucket to browser roles. The server uses service_role.
drop policy if exists "muse_chapter_videos_no_client_select" on storage.objects;
drop policy if exists "muse_chapter_videos_no_client_insert" on storage.objects;
drop policy if exists "muse_chapter_videos_no_client_update" on storage.objects;
drop policy if exists "muse_chapter_videos_no_client_delete" on storage.objects;
create policy "muse_chapter_videos_no_client_select" on storage.objects
  as restrictive for select to anon, authenticated using (bucket_id is distinct from 'muse-chapter-videos');
create policy "muse_chapter_videos_no_client_insert" on storage.objects
  as restrictive for insert to anon, authenticated with check (bucket_id is distinct from 'muse-chapter-videos');
create policy "muse_chapter_videos_no_client_update" on storage.objects
  as restrictive for update to anon, authenticated
  using (bucket_id is distinct from 'muse-chapter-videos') with check (bucket_id is distinct from 'muse-chapter-videos');
create policy "muse_chapter_videos_no_client_delete" on storage.objects
  as restrictive for delete to anon, authenticated using (bucket_id is distinct from 'muse-chapter-videos');

commit;
