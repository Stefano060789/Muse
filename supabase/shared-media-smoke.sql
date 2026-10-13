-- Operator smoke test after shared-story-media.sql. No storage or AI calls.
-- All fixture rows, deletion queues and usage changes are rolled back.
begin;
set local role service_role;
do $test$
declare
  sid uuid := gen_random_uuid();
  mid uuid := gen_random_uuid();
  replacement uuid := gen_random_uuid();
  pending uuid := gen_random_uuid();
  media jsonb;
  i integer;
  client text := 'media-smoke-' || sid::text;
  daily text := 'day:' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD') || ':upload';
begin
  if has_function_privilege('anon', 'public.muse_begin_shared_media(jsonb,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.muse_begin_shared_media(jsonb,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.muse_activate_shared_media(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.muse_activate_shared_media(uuid,uuid)', 'EXECUTE')
     or has_table_privilege('anon', 'public.shared_story_media', 'SELECT')
     or has_table_privilege('authenticated', 'public.shared_story_media_purge', 'SELECT') then
    raise exception 'Media permission regression';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('shared_story_media','shared_story_media_purge')
      and c.relrowsecurity) <> 2 then
    raise exception 'Media RLS regression';
  end if;
  if not exists(select 1 from storage.buckets where id='muse-shared-media'
      and public=false and file_size_limit=20971520
      and allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm']) then
    raise exception 'Private bucket configuration regression';
  end if;
  if exists (
    select 1 from (values
      (null::text,true), ('true',true),
      ('(bucket_id = ''action-evidence''::text)',false),
      ('(bucket_id = ''muse-shared-media''::text)',true),
      ('((bucket_id = ''action-evidence''::text) OR true)',true),
      ('(bucket_id <> ''action-evidence''::text)',true)
    ) as cases(predicate,blocked)
    where (predicate is null
      or predicate !~ '^\(bucket_id = ''[a-zA-Z0-9_-]+''::text\)$'
      or predicate = '(bucket_id = ''muse-shared-media''::text)') <> blocked
  ) then raise exception 'Bucket isolation predicate regression'; end if;

  insert into public.shared_stories(id,owner_hash,play_hash,brief,content,answer_normalized)
    values(sid,repeat('a',64),repeat('b',64),'{}','{}','fixture');
  media := jsonb_build_object('id',mid,'story_id',sid,'object_key','stories/'||sid||'/'||mid||'.png',
    'kind','photo','mime','image/png','size',100,'upload_hash',repeat('c',64),
    'upload_expires_at',now()+interval '15 minutes','created_at',now());
  if not public.muse_begin_shared_media(media,1) then raise exception 'Upload not reserved'; end if;
  if public.muse_begin_shared_media(media||jsonb_build_object('id',gen_random_uuid()),1) then
    raise exception 'Upload attempt cap not enforced';
  end if;
  update public.shared_story_media set upload_expires_at=now()-interval '1 second' where id=mid;
  begin
    perform public.muse_activate_shared_media(sid,mid);
    raise exception 'Expired upload activated';
  exception when others then
    if sqlerrm <> 'Media unavailable' then raise; end if;
  end;
  update public.shared_story_media set upload_expires_at=now()+interval '15 minutes' where id=mid;
  perform public.muse_activate_shared_media(sid,mid);
  media := media||jsonb_build_object('id',replacement,
    'object_key','stories/'||sid||'/'||replacement||'.png');
  if not public.muse_begin_shared_media(media,6) then raise exception 'Replacement not reserved'; end if;
  perform public.muse_activate_shared_media(sid,replacement);
  if (select count(*) from public.shared_story_media where story_id=sid and status='ready')<>1
     or not exists(select 1 from public.shared_story_media_purge where object_key='stories/'||sid||'/'||mid||'.png') then
    raise exception 'Replacement or purge queue regression';
  end if;
  media := media||jsonb_build_object('id',pending,
    'object_key','stories/'||sid||'/'||pending||'.png');
  if not public.muse_begin_shared_media(media,6) then raise exception 'Pending upload not reserved'; end if;
  delete from public.shared_stories where id=sid;
  if exists(select 1 from public.shared_story_media where story_id=sid)
     or not exists(select 1 from public.shared_story_media_purge
       where object_key='stories/'||sid||'/'||replacement||'.png')
     or not exists(select 1 from public.shared_story_media_purge
       where object_key='stories/'||sid||'/'||pending||'.png' and retain_until>=now()+interval '125 minutes') then
    raise exception 'Cascade or late-upload retention regression';
  end if;

  insert into public.shared_story_generation_limits(bucket,count) values(daily,0)
    on conflict(bucket) do update set count=0;
  for i in 1..10 loop
    if not public.reserve_shared_story_request(client,'upload') then
      raise exception 'Upload hourly allowance regression';
    end if;
  end loop;
  if public.reserve_shared_story_request(client,'upload') then
    raise exception 'Upload hourly cap not enforced';
  end if;
  update public.shared_story_generation_limits set count=200 where bucket=daily;
  if public.reserve_shared_story_request(client||'-daily','upload') then
    raise exception 'Upload daily cap not enforced';
  end if;
end;
$test$;
rollback;
select 'PASS: service-role media RPCs, permissions, private bucket, isolation predicates, upload caps, activation, replacement and cleanup retention; all fixture changes rolled back' as result;
