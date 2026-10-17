-- Private bounded MP3 cache and lifetime accounting. Apply with the Supabase SQL editor.
BEGIN;
CREATE TABLE IF NOT EXISTS public.muse_google_budget (
  id integer PRIMARY KEY CHECK (id = 1),
  used bigint NOT NULL DEFAULT 0 CHECK (used >= 0)
);
INSERT INTO public.muse_google_budget(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.muse_google_audio (
  hash text PRIMARY KEY CHECK (hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('pending','ready','failed')),
  token uuid NOT NULL,
  expires timestamptz NOT NULL,
  audio bytea CHECK (octet_length(audio) <= 12582912)
);
ALTER TABLE public.muse_google_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muse_google_audio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.muse_google_budget, public.muse_google_audio FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.muse_google_narration(
  p_action text, p_hash text, p_token uuid, p_characters integer DEFAULT 0,
  p_limit bigint DEFAULT 0, p_audio text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_used bigint;
  v_row public.muse_google_audio%ROWTYPE;
  v_audio bytea;
  v_size bigint;
  v_old record;
BEGIN
  IF p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' OR p_token IS NULL OR
     p_action IS NULL OR p_action NOT IN ('reserve','finish','fail') THEN
    RAISE EXCEPTION 'Invalid Google narration operation';
  END IF;
  -- One shared lock serializes reservations and bounded-cache eviction across all hosts.
  SELECT used INTO STRICT v_used FROM public.muse_google_budget WHERE id=1 FOR UPDATE;
  UPDATE public.muse_google_audio SET audio=NULL WHERE audio IS NOT NULL AND expires<=now();
  SELECT * INTO v_row FROM public.muse_google_audio WHERE hash=p_hash;
  IF p_action='reserve' THEN
    IF p_characters IS NULL OR p_characters<1 OR p_characters>12000 OR
       p_limit IS NULL OR p_limit<1 OR p_limit>9007199254740991 OR p_audio IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid Google narration budget';
    END IF;
    IF v_row.status='ready' AND v_row.audio IS NOT NULL AND v_row.expires>now() THEN
      RETURN jsonb_build_object('status','ready','audio',replace(encode(v_row.audio,'base64'),chr(10),''));
    END IF;
    IF v_row.status IN ('pending','failed') THEN RETURN jsonb_build_object('status',v_row.status); END IF;
    IF p_characters>p_limit-v_used THEN RETURN jsonb_build_object('status','exhausted'); END IF;
    UPDATE public.muse_google_budget SET used=used+p_characters WHERE id=1;
    INSERT INTO public.muse_google_audio(hash,status,token,expires,audio)
      VALUES(p_hash,'pending',p_token,now()+interval '30 days',NULL)
      ON CONFLICT(hash) DO UPDATE SET status='pending',token=p_token,expires=excluded.expires,audio=NULL;
    RETURN jsonb_build_object('status','reserved');
  END IF;
  IF v_row.hash IS NULL OR v_row.status<>'pending' OR v_row.token<>p_token THEN
    RAISE EXCEPTION 'Google narration reservation mismatch';
  END IF;
  IF p_action='fail' THEN
    UPDATE public.muse_google_audio SET status='failed',audio=NULL WHERE hash=p_hash;
    RETURN jsonb_build_object('status','saved');
  END IF;
  IF p_audio IS NULL OR length(p_audio)<8 OR length(p_audio)>16777216 OR
     p_audio !~ '^[A-Za-z0-9+/]*={0,2}$' THEN RAISE EXCEPTION 'Invalid Google audio'; END IF;
  v_audio := decode(p_audio,'base64');
  IF octet_length(v_audio)>12582912 OR
     get_byte(v_audio,0)<>255 OR (get_byte(v_audio,1) & 224)<>224 THEN
    RAISE EXCEPTION 'Invalid Google audio';
  END IF;
  SELECT coalesce(sum(octet_length(audio)),0) INTO v_size FROM public.muse_google_audio;
  FOR v_old IN SELECT hash,octet_length(audio) AS bytes FROM public.muse_google_audio
      WHERE audio IS NOT NULL ORDER BY expires LOOP
    EXIT WHEN v_size+octet_length(v_audio)<=134217728;
    UPDATE public.muse_google_audio SET audio=NULL WHERE hash=v_old.hash;
    v_size := v_size-v_old.bytes;
  END LOOP;
  UPDATE public.muse_google_audio SET status='ready',audio=v_audio,expires=now()+interval '30 days' WHERE hash=p_hash;
  RETURN jsonb_build_object('status','saved');
END;
$$;
REVOKE ALL ON FUNCTION public.muse_google_narration(text,text,uuid,integer,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.muse_google_narration(text,text,uuid,integer,bigint,text) TO service_role;
COMMIT;
