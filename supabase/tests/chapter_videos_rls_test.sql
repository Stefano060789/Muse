-- LOCAL ISOLATED DATABASE ONLY. This transaction temporarily adds permissive
-- Storage policies to prove the Muse bucket's restrictive policies still win.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into public.muse_chapter_videos
  (id, owner_id, chapter_id, story_id, chapter_number, status, expires_at, next_check_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   1, 'ready', now() + interval '7 days', now() + interval '7 days'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '22222222-2222-2222-2222-222222222222',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   1, 'ready', now() + interval '7 days', now() + interval '7 days');
insert into storage.objects(bucket_id, name) values
  ('muse-chapter-videos', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.mp4'),
  ('muse-chapter-videos', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc.mp4');

create policy "test_open_chapter_video_select" on storage.objects
  for select to authenticated, anon using (bucket_id = 'muse-chapter-videos');
create policy "test_open_chapter_video_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'muse-chapter-videos');
create policy "test_open_chapter_video_update" on storage.objects
  for update to authenticated using (bucket_id = 'muse-chapter-videos') with check (bucket_id = 'muse-chapter-videos');
create policy "test_open_chapter_video_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'muse-chapter-videos');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok($$select 1 from public.muse_chapter_videos$$, '42501', null, 'user 1 cannot directly read metadata');
select throws_ok($$update public.muse_chapter_videos set status = 'failed' returning 1$$, '42501', null, 'user 1 cannot directly update metadata');
select throws_ok($$delete from public.muse_chapter_videos returning 1$$, '42501', null, 'user 1 cannot directly delete metadata');
select throws_ok($$insert into public.muse_chapter_videos (id) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')$$, '42501', null, 'user 1 cannot directly insert metadata');
select is_empty($$select 1 from storage.objects where bucket_id = 'muse-chapter-videos'$$, 'user 1 cannot directly read video objects');
select is_empty($$update storage.objects set name = 'changed' returning 1$$, 'user 1 cannot directly update video objects');
select is_empty($$delete from storage.objects returning 1$$, 'user 1 cannot directly delete video objects');
select throws_ok($$insert into storage.objects(bucket_id, name) values ('muse-chapter-videos', 'forged.mp4')$$, '42501', null, 'user 1 cannot directly insert video objects');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$select 1 from public.muse_chapter_videos$$, '42501', null, 'user 2 cannot directly read metadata');
select throws_ok($$update public.muse_chapter_videos set status = 'failed' returning 1$$, '42501', null, 'user 2 cannot directly update metadata');
select throws_ok($$delete from public.muse_chapter_videos returning 1$$, '42501', null, 'user 2 cannot directly delete metadata');
select throws_ok($$insert into public.muse_chapter_videos (id) values ('ffffffff-ffff-4fff-8fff-ffffffffffff')$$, '42501', null, 'user 2 cannot directly insert metadata');
select is_empty($$select 1 from storage.objects where bucket_id = 'muse-chapter-videos'$$, 'user 2 cannot directly read video objects');
select is_empty($$update storage.objects set name = 'changed' returning 1$$, 'user 2 cannot directly update video objects');
select is_empty($$delete from storage.objects returning 1$$, 'user 2 cannot directly delete video objects');
select throws_ok($$insert into storage.objects(bucket_id, name) values ('muse-chapter-videos', 'forged2.mp4')$$, '42501', null, 'user 2 cannot directly insert video objects');

set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
select throws_ok($$select 1 from public.muse_chapter_videos$$, '42501', null, 'anon cannot read metadata');
select throws_ok($$select 1 from public.muse_chapter_video_maintenance$$, '42501', null, 'anon cannot read maintenance metadata');
select is_empty($$select 1 from storage.objects where bucket_id = 'muse-chapter-videos'$$, 'anon cannot directly read video objects');
select * from finish();
rollback;
