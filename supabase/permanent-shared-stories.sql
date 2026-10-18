begin;

-- Infinity preserves the existing RPC authorization and deletion checks while
-- removing automatic expiry. Already deleted stories cannot be recovered.
alter table public.shared_stories alter column expires_at set default 'infinity'::timestamptz;
update public.shared_stories set expires_at = 'infinity'::timestamptz
where expires_at <> 'infinity'::timestamptz;

notify pgrst, 'reload schema';
commit;
