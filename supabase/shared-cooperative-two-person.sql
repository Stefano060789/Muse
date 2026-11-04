-- Apply after shared-cooperative-guests.sql.
-- Existing groups are left intact; new joins are limited to two participants.
begin;

create or replace function public.muse_limit_cooperative_story_to_two()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.muse_cooperative_players where story_id = new.story_id) >= 2 then
    raise exception 'Cooperative: this story is full (two participants maximum)';
  end if;
  return new;
end;
$$;

drop trigger if exists muse_cooperative_two_participant_limit on public.muse_cooperative_players;
create trigger muse_cooperative_two_participant_limit
  before insert on public.muse_cooperative_players
  for each row execute function public.muse_limit_cooperative_story_to_two();

revoke all on function public.muse_limit_cooperative_story_to_two() from public, anon, authenticated;
commit;
