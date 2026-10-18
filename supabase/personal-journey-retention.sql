-- Convert surviving personal journeys to explicit, indefinite retention.
begin;
alter table public.muse_personal_journeys alter column expires_at set default 'infinity'::timestamptz;
update public.muse_personal_journeys
  set expires_at = 'infinity'::timestamptz,
      record = jsonb_set(record, '{expiresAt}', 'null'::jsonb, true);
commit;
