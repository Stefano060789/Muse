-- Rollback-only smoke: no external calls, no lasting reservations or audio.
BEGIN;
DO $$
DECLARE
  h text := repeat('a',64);
  t uuid := '00000000-0000-4000-8000-000000000001';
  u bigint;
  r jsonb;
  a text := encode(decode('fff384c0','hex') || decode(repeat('00',188),'hex'),'base64');
BEGIN
  IF has_function_privilege('anon','public.muse_google_narration(text,text,uuid,integer,bigint,text)','EXECUTE') OR
     has_function_privilege('authenticated','public.muse_google_narration(text,text,uuid,integer,bigint,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Narration RPC exposed to clients';
  END IF;
  IF has_table_privilege('anon','public.muse_google_audio','SELECT') OR
     has_table_privilege('authenticated','public.muse_google_budget','UPDATE') THEN
    RAISE EXCEPTION 'Private narration tables exposed';
  END IF;
  SELECT used INTO u FROM public.muse_google_budget WHERE id=1 FOR UPDATE;
  DELETE FROM public.muse_google_audio WHERE hash=h;
  r := public.muse_google_narration('reserve',h,t,4,u+4);
  IF r->>'status'<>'reserved' THEN RAISE EXCEPTION 'Reservation failed'; END IF;
  IF (public.muse_google_narration('reserve',h,t,4,u+4))->>'status'<>'pending' THEN RAISE EXCEPTION 'Dedup failed'; END IF;
  IF (public.muse_google_narration('reserve',repeat('b',64),t,1,u+4))->>'status'<>'exhausted' THEN RAISE EXCEPTION 'Cap failed'; END IF;
  r := public.muse_google_narration('finish',h,t,0,0,replace(a,chr(10),''));
  IF r->>'status'<>'saved' THEN RAISE EXCEPTION 'Cache save failed'; END IF;
  r := public.muse_google_narration('reserve',h,t,4,u+4);
  IF r->>'status'<>'ready' OR r->>'audio'<>replace(a,chr(10),'') THEN RAISE EXCEPTION 'Cache replay failed'; END IF;
  IF (SELECT used FROM public.muse_google_budget WHERE id=1)<>u+4 THEN RAISE EXCEPTION 'Replay charged'; END IF;
  UPDATE public.muse_google_audio SET expires=now()-interval '1 day' WHERE hash=h;
  r := public.muse_google_narration('reserve',h,t,4,u+8);
  IF r->>'status'<>'reserved' THEN RAISE EXCEPTION 'Expiry failed'; END IF;
  PERFORM public.muse_google_narration('fail',h,t);
  IF (public.muse_google_narration('reserve',h,t,4,u+100))->>'status'<>'failed' THEN RAISE EXCEPTION 'Failed request retried'; END IF;
END;
$$;
ROLLBACK;
