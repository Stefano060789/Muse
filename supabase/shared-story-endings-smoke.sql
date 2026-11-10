-- Synthetic, rollback-only smoke after shared-story-endings.sql.
begin;
do $$
declare
  sid uuid := gen_random_uuid();
  state jsonb;
  mode text;
  op text;
  idx integer;
  blocked boolean;
begin
  if has_function_privilege('anon', 'public.advance_shared_story_ending(uuid,text,text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'public.muse_cooperative_ending_advance(jsonb)', 'execute')
    or not has_function_privilege('service_role', 'public.advance_shared_story_ending(uuid,text,text,text,text)', 'execute') then
    raise exception 'Unexpected ending RPC grants';
  end if;
  insert into public.shared_stories(id, owner_hash, play_hash, brief, content, answer_normalized, expires_at)
  values (sid, repeat('a',64), repeat('b',64),
    '{"message":"Private payoff","unlockPolicy":"allow-skip","endingChoices":["Open the door","Follow the river","Wait here"]}'::jsonb,
    '{"scenes":[{"title":"First"},{"title":"Middle"},{"title":"Final"}]}'::jsonb,
    'fixture answer', now() + interval '1 hour');
  foreach mode in array array['answer','choice','automatic'] loop
    delete from public.shared_story_sessions where story_id = sid;
    update public.shared_stories set brief = brief || jsonb_build_object('endingMode', mode) where id = sid;
    state := public.advance_shared_story_ending(sid, repeat('c',64), 'open', '', repeat('b',64));
    if (state->>'solved')::boolean then raise exception 'Early automatic reveal'; end if;
    foreach op in array array['guess','skip','ending-choice'] loop
      blocked := false;
      begin
        perform public.advance_shared_story_ending(sid, repeat('c',64), op, '0', repeat('b',64));
      exception when others then
        if sqlerrm <> 'Reach the final scene first' then raise; end if;
        blocked := true;
      end;
      if not blocked then raise exception 'Early ending accepted'; end if;
    end loop;
    state := public.advance_shared_story_ending(sid, repeat('c',64), 'next', '', repeat('b',64));
    if (state->>'solved')::boolean then raise exception 'Middle scene unlocked'; end if;
    state := public.advance_shared_story_ending(sid, repeat('c',64), 'next', '', repeat('b',64));
    if mode = 'choice' then
      blocked := false;
      begin
        perform public.advance_shared_story_ending(sid, repeat('c',64), 'ending-choice', '3', repeat('b',64));
      exception when others then
        if sqlerrm <> 'Invalid ending choice' then raise; end if;
        blocked := true;
      end;
      if not blocked then raise exception 'Out-of-range choice accepted'; end if;
      for idx in 0..2 loop
        update public.shared_story_sessions set solved = false where story_id = sid;
        state := public.advance_shared_story_ending(sid, repeat('c',64), 'ending-choice', idx::text, repeat('b',64));
        if not (state->>'solved')::boolean then raise exception 'Valid option did not complete'; end if;
      end loop;
    elsif mode = 'answer' then
      if (state->>'solved')::boolean then raise exception 'Answer ending unlocked without answer'; end if;
      state := public.advance_shared_story_ending(sid, repeat('c',64), 'guess', 'fixture answer', repeat('b',64));
    end if;
    if not (state->>'solved')::boolean then raise exception 'Ending did not persist'; end if;
    state := public.advance_shared_story_ending(sid, repeat('c',64), 'open', '', repeat('b',64));
    if not (state->>'solved')::boolean then raise exception 'Reopen lost ending'; end if;
    state := public.advance_shared_story_ending(sid, repeat('d',64), 'open', '', repeat('b',64));
    if (state->>'solved')::boolean then raise exception 'Ending leaked across sessions'; end if;
  end loop;
end;
$$;
rollback;
