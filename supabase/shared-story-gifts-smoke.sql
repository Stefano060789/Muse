-- Service-role gift migration smoke test. No AI or storage calls.
begin;
set local role service_role;
do $test$
declare
  sid uuid := gen_random_uuid();
  player text := repeat('a', 64);
  voice_id uuid := gen_random_uuid();
  media_id uuid := gen_random_uuid();
  gift jsonb := '{"occasion":"birthday","dedication":"For you","allowReply":true}'::jsonb;
  voice jsonb;
  reply_row record;
begin
  if has_function_privilege('anon', 'public.muse_begin_shared_story_voice(jsonb,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.muse_submit_shared_story_reply(uuid,text,text)', 'EXECUTE')
     or has_table_privilege('anon', 'public.shared_story_replies', 'SELECT')
     or has_table_privilege('authenticated', 'public.shared_story_voice_purge', 'SELECT') then
    raise exception 'Gift permission regression';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('shared_story_voice','shared_story_voice_purge','shared_story_replies')
      and c.relrowsecurity) <> 3 then
    raise exception 'Gift RLS regression';
  end if;
  if not exists(select 1 from storage.buckets where id='muse-shared-media' and public=false
      and 'audio/wav'=any(allowed_mime_types)) then
    raise exception 'Private WAV bucket configuration regression';
  end if;
  insert into public.shared_stories(id,owner_hash,play_hash,brief,content,answer_normalized)
    values(sid,repeat('b',64),repeat('c',64),jsonb_build_object('gift',gift),'{}','fixture');
  insert into public.shared_story_sessions(story_id,player_hash,solved)
    values(sid,player,true);
  voice := jsonb_build_object('id',voice_id,'story_id',sid,
    'object_key','stories/'||sid||'/'||voice_id||'.wav','mime','audio/wav','size',4096,
    'upload_hash',repeat('d',64),'upload_expires_at',now()+interval '15 minutes','created_at',now());
  if not public.muse_begin_shared_story_voice(voice,1) then raise exception 'Voice upload not reserved'; end if;
  if public.muse_begin_shared_story_voice(voice||jsonb_build_object('id',gen_random_uuid()),1) then
    raise exception 'Voice upload attempt cap not enforced';
  end if;
  perform public.muse_activate_shared_story_voice(sid,voice_id);
  select * into reply_row from public.muse_submit_shared_story_reply(sid,player,'A lovely surprise');
  if reply_row.message <> 'A lovely surprise' then raise exception 'Reply insert failed'; end if;
  select * into reply_row from public.muse_submit_shared_story_reply(sid,player,'A lovely surprise');
  if (select count(*) from public.shared_story_replies where story_id=sid) <> 1 then
    raise exception 'Reply retry was not idempotent';
  end if;
  delete from public.shared_stories where id=sid;
  if exists(select 1 from public.shared_story_voice where story_id=sid)
     or exists(select 1 from public.shared_story_replies where story_id=sid)
     or not exists(select 1 from public.shared_story_voice_purge where object_key='stories/'||sid||'/'||voice_id||'.wav') then
    raise exception 'Story deletion did not cascade or queue voice cleanup';
  end if;
  insert into public.shared_stories(id,owner_hash,play_hash,brief,content,answer_normalized)
    values(media_id,repeat('e',64),repeat('f',64),'{}','{}','fixture');
  insert into public.shared_story_media(id,story_id,object_key,kind,mime,size,status,upload_hash,upload_expires_at)
    values(gen_random_uuid(),media_id,'stories/'||media_id||'/'||gen_random_uuid()||'.png','photo','image/png',100,'ready',repeat('1',64),now());
  if (select count(*) from public.shared_story_media where story_id=media_id and status='ready') <> 1 then
    raise exception 'Voice schema interfered with the existing photo slot';
  end if;
end;
$test$;
rollback;
select 'PASS: gift migration permissions, RLS, private WAV bucket, voice attempt/activation, reply idempotence, cascade cleanup and independent photo slot; fixtures rolled back' as result;
