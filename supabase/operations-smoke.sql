-- Run after operations.sql as the database administrator. All fixture changes roll back.
begin;
do $$
declare
  bucket_name text := 'smoke:' || replace(gen_random_uuid()::text,'-','');
  result jsonb;
  counter integer;
begin
  if has_table_privilege('anon','public.muse_operations_counters','SELECT')
    or has_table_privilege('authenticated','public.muse_operations_alerts','SELECT')
    or has_function_privilege('anon','public.muse_consume_operation(text,integer,timestamp with time zone,integer)','EXECUTE')
    or has_function_privilege('authenticated','public.muse_record_operation_alert(text,text)','EXECUTE')
    or has_function_privilege('anon','public.muse_delete_personal_journey(uuid,text,uuid)','EXECUTE') then
    raise exception 'Client grants must be absent';
  end if;
  if not has_function_privilege('service_role','public.muse_consume_operation(text,integer,timestamp with time zone,integer)','EXECUTE') then
    raise exception 'Service-role reservation grant missing';
  end if;
  for counter in 1..100 loop
    result := public.muse_consume_operation(bucket_name,100,now()+interval '1 hour',80);
    if (result->>'allowed')::boolean is distinct from true or (result->>'used')::integer <> counter
      or (result->>'notify')::boolean is distinct from (counter=80) then raise exception 'Incorrect reservation/warning at %',counter; end if;
  end loop;
  result := public.muse_consume_operation(bucket_name,100,now()+interval '1 hour',80);
  if (result->>'allowed')::boolean is distinct from false or (result->>'used')::integer <> 100 then
    raise exception 'Hard cap not enforced';
  end if;
  if public.muse_record_operation_alert('request-failure:999999999','request-failure') is distinct from true
    or public.muse_record_operation_alert('request-failure:999999999','request-failure') is distinct from false then
    raise exception 'Alert deduplication failed';
  end if;
  if public.muse_delete_personal_journey(gen_random_uuid(),repeat('a',64),gen_random_uuid()) is distinct from false then
    raise exception 'Unknown journey deletion must not succeed';
  end if;
  raise notice 'Muse operation cap, warning, grants, deduplication and unknown deletion checks passed; rolling back.';
end $$;
rollback;
