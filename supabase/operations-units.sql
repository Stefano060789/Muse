-- Incremental Muse operation-unit reservation RPC for hosted multi-unit pilot budgets.
begin;

create or replace function public.muse_consume_operation_units(
  p_bucket text,
  p_limit integer,
  p_expires_at timestamptz,
  p_units integer
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare count_used integer;
begin
  if p_bucket is null or p_bucket !~ '^[a-z0-9:-]{1,160}$' or p_limit is null or p_limit not between 1 and 10000
    or p_units is null or p_units < 1 or p_units > p_limit or p_expires_at is null or p_expires_at <= now() then
    raise exception 'Invalid operations reservation';
  end if;
  delete from public.muse_operations_counters where expires_at <= now();
  insert into public.muse_operations_counters(bucket,expires_at) values(p_bucket,p_expires_at) on conflict do nothing;
  select used into count_used from public.muse_operations_counters where bucket=p_bucket for update;
  if count_used + p_units > p_limit then
    return jsonb_build_object('allowed',false,'used',count_used,'notify',false);
  end if;
  update public.muse_operations_counters set used=used+p_units where bucket=p_bucket;
  return jsonb_build_object('allowed',true,'used',count_used+p_units,'notify',false);
end $$;

revoke all on function public.muse_consume_operation_units(text,integer,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.muse_consume_operation_units(text,integer,timestamptz,integer) to service_role;
notify pgrst, 'reload schema';
commit;
