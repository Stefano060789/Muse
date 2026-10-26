-- Apply after shared-stories.sql, personal-journeys.sql, and operations.sql.
-- Legacy stories stay unowned until someone proves possession of their owner link.
begin;

alter table public.shared_stories
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.muse_personal_journeys
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;
create index if not exists shared_stories_owner_id_id on public.shared_stories(owner_id, id);
create index if not exists muse_personal_journeys_owner_id_id on public.muse_personal_journeys(owner_id, id);

drop function if exists public.muse_delete_personal_journey(uuid, text);
create or replace function public.muse_delete_personal_journey(
  p_id uuid, p_capability_hash text, p_owner_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare deleted integer;
begin
  if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$' or p_owner_id is null then
    raise exception 'Invalid journey capability';
  end if;
  delete from public.muse_personal_journeys
    where id = p_id and capability_hash = p_capability_hash and owner_id = p_owner_id;
  get diagnostics deleted = row_count;
  return deleted > 0;
end $$;

revoke all on function public.muse_delete_personal_journey(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.muse_delete_personal_journey(uuid, text, uuid)
  to service_role;
notify pgrst, 'reload schema';
commit;
