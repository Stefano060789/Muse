-- Operator smoke test after both adventure migrations. No AI calls.
-- All fixture rows and budget changes are rolled back.
begin;
do $test$
declare
  sid uuid := gen_random_uuid();
  jid uuid;
  rid text;
  ph text := repeat('b', 64);
  fp text := repeat('c', 64);
  daily text := 'day:' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
  args jsonb;
  result jsonb;
  turn jsonb := '{"narration":"Fixture narration only.","state":{"inventory":[],"discoveries":[],"relationships":[],"progress":"Fixture progress."}}';
  opening jsonb;
  duration integer;
  max_turns integer;
  i integer;
begin
  if has_function_privilege('anon', 'public.muse_shared_adventure(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.muse_shared_adventure(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.muse_personal_journey(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.muse_personal_journey(jsonb)', 'EXECUTE') then
    raise exception 'Public RPC permission regression';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('muse_adventure_sessions',
      'muse_adventure_requests','muse_adventure_budgets','muse_personal_journeys',
      'muse_personal_journey_requests') and not c.relrowsecurity) then
    raise exception 'RLS regression';
  end if;
  insert into public.muse_adventure_budgets(bucket, used) values(daily, 0)
    on conflict(bucket) do update set used=0;
  insert into public.shared_stories(id,owner_hash,play_hash,brief,content,answer_normalized)
    values(sid,repeat('a',64),ph,'{"adventure":{"actionBudget":12}}',
      '{"scenes":[{"title":"Fixture","body":"Fixture","clue":"Fixture"}]}','fixture');
  insert into public.shared_story_sessions(story_id,player_hash) values(sid,ph);
  args := jsonb_build_object('storyId',sid,'sessionHash',ph,'playHash',ph,'cap',10000);
  for i in 1..12 loop
    rid := gen_random_uuid()::text;
    result := public.muse_shared_adventure(args || jsonb_build_object(
      'operation','reserve','requestId',rid,'fingerprint',fp,'revision',i-1));
    if result->>'status' <> 'reserved' or (result->'view'->>'actionsUsed')::integer <> i then
      raise exception 'Shared reservation regression';
    end if;
    result := public.muse_shared_adventure(args || jsonb_build_object(
      'operation','reserve','requestId',rid,'fingerprint',fp,'revision',i-1));
    if result->>'status' <> 'pending' then raise exception 'Shared duplicate charged'; end if;
    result := public.muse_shared_adventure(args || jsonb_build_object(
      'operation','finish','requestId',rid,'fingerprint',fp,'turn',turn));
    if result->>'status' <> 'done' then raise exception 'Shared completion regression'; end if;
  end loop;
  begin
    perform public.muse_shared_adventure(args || jsonb_build_object('operation','reserve',
      'requestId',gen_random_uuid()::text,'fingerprint',fp,'revision',12));
    raise exception 'Shared cap not enforced';
  exception when others then
    if sqlerrm not like 'Adventure: 12-action cap reached%' then raise; end if;
  end;
  opening := jsonb_build_object('title','Fixture','description','Fixture',
    'narrationStyle','warm','narrationLanguage','en-US','plan',jsonb_build_array('Start','Explore','End'),
    'turn',turn || '{"concluded":false}'::jsonb);
  foreach duration in array array[5,10,15,20] loop
    max_turns := duration * 3 / 5;
    jid := gen_random_uuid();
    args := jsonb_build_object('id',jid,'capabilityHash',ph,'cap',10000);
    result := public.muse_personal_journey(args || jsonb_build_object('operation','create',
      'requestId',jid::text,'fingerprint',fp,'input',jsonb_build_object(
        'duration',duration,'mood','relaxed','need','','profileKeypoints','[]'::jsonb)));
    if result->>'status' <> 'reserved' then raise exception 'Personal creation regression'; end if;
    result := public.muse_personal_journey(args || jsonb_build_object('operation','finish',
      'requestId',jid::text,'fingerprint',fp,'opening',opening));
    for i in 1..max_turns loop
      rid := gen_random_uuid()::text;
      result := public.muse_personal_journey(args || jsonb_build_object('operation','reserve',
        'requestId',rid,'fingerprint',fp,'revision',i-1,'text','Fixture action'));
      if result->>'status' <> 'reserved' or (result->'snapshot'->>'revision')::integer <> i then
        raise exception 'Personal reservation regression';
      end if;
      result := public.muse_personal_journey(args || jsonb_build_object('operation','reserve',
        'requestId',rid,'fingerprint',fp,'revision',i-1,'text','Fixture action'));
      if result->>'status' <> 'pending' then raise exception 'Personal duplicate charged'; end if;
      result := public.muse_personal_journey(args || jsonb_build_object('operation','finish',
        'requestId',rid,'fingerprint',fp,'turn',turn || jsonb_build_object('concluded',i=max_turns)));
    end loop;
    if result->'snapshot'->>'status' <> 'concluded' then raise exception 'Conclusion regression'; end if;
    begin
      perform public.muse_personal_journey(args || jsonb_build_object('operation','reserve',
        'requestId',gen_random_uuid()::text,'fingerprint',fp,'revision',max_turns,'text','Extra action'));
      raise exception 'Personal cap not enforced';
    exception when others then
      if sqlerrm <> 'Journey: response allowance exhausted' then raise; end if;
    end;
  end loop;
  if (select used from public.muse_adventure_budgets where bucket=daily) <> 42 then
    raise exception 'Shared daily budget or idempotency regression';
  end if;
  jid := gen_random_uuid();
  args := jsonb_build_object('id',jid,'capabilityHash',ph,'cap',42);
  perform public.muse_personal_journey(args || jsonb_build_object('operation','create',
    'requestId',jid::text,'fingerprint',fp,'input',jsonb_build_object(
      'duration',5,'mood','curious','need','','profileKeypoints','[]'::jsonb)));
  perform public.muse_personal_journey(args || jsonb_build_object('operation','finish',
    'requestId',jid::text,'fingerprint',fp,'opening',opening));
  begin
    perform public.muse_personal_journey(args || jsonb_build_object('operation','reserve',
      'requestId',gen_random_uuid()::text,'fingerprint',fp,'revision',0,'text','Over global cap'));
    raise exception 'Global cap not enforced';
  exception when others then
    if sqlerrm <> 'Journey: daily cap reached' then raise; end if;
  end;
end;
$test$;
rollback;
select 'PASS: shared and personal reservations, idempotency, all durations, conclusions, global cap and RPC/RLS permissions; fixtures rolled back' as result;
