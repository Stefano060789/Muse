-- Synthetic Muse-only rollback smoke. Run after shared-story-help.sql.
begin;
do $$
declare
  sid uuid := gen_random_uuid();
  state jsonb;
  blocked boolean := false;
begin
  if has_function_privilege('anon', 'public.advance_shared_story(uuid,text,text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'public.advance_shared_story(uuid,text,text,text,text)', 'execute')
    or not has_function_privilege('service_role', 'public.advance_shared_story(uuid,text,text,text,text)', 'execute') then
    raise exception 'Unexpected advance RPC grants';
  end if;
  insert into public.shared_stories(id, owner_hash, play_hash, brief, content, answer_normalized, expires_at)
  values (sid, repeat('a',64), repeat('b',64),
    '{"creatorName":"Test","recipientName":"Test","message":"Fixture surprise","assistanceHints":[]}'::jsonb,
    '{"scenes":[{"title":"Fixture","body":"Fixture only","clue":"Fixture clue"}]}'::jsonb,
    'fixture answer', now() + interval '1 hour');
  state := public.advance_shared_story(sid, repeat('c',64), 'open', '', repeat('b',64));
  if (state->>'skipped')::boolean or (state->>'solved')::boolean then raise exception 'Unexpected initial state'; end if;
  begin
    perform public.advance_shared_story(sid, repeat('c',64), 'skip', '', repeat('b',64));
  exception when others then
    if sqlerrm <> 'Skipping is not enabled' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Legacy story allowed skipping'; end if;
  update public.shared_stories set brief = brief || '{"unlockPolicy":"allow-skip"}'::jsonb where id=sid;
  state := public.advance_shared_story(sid, repeat('c',64), 'skip', '', repeat('b',64));
  if not (state->>'skipped')::boolean or (state->>'solved')::boolean then raise exception 'Skip was not distinct from solving'; end if;
  state := public.advance_shared_story(sid, repeat('c',64), 'guess', 'fixture answer', repeat('b',64));
  if not (state->>'skipped')::boolean or (state->>'solved')::boolean then raise exception 'Skip changed to solved'; end if;
  state := public.advance_shared_story(sid, repeat('d',64), 'open', '', repeat('b',64));
  if (state->>'skipped')::boolean or (state->>'solved')::boolean then raise exception 'Skip leaked between playthroughs'; end if;
end;
$$;
rollback;
