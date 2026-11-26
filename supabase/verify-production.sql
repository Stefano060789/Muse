-- Read-only production check for the Muse Supabase project. Run it in the
-- Supabase SQL editor (or psql) as an operator. It changes nothing, reads no
-- story rows, and prints one row per check. Every row must say ok = true before
-- a public launch. Created 20 November 2026; extend it when migrations change.
--
-- Tables whose absence means a migration was not applied (see README).
with required_tables(name, migration) as (values
  ('shared_stories', 'shared-stories.sql'),
  ('shared_story_sessions', 'shared-stories.sql'),
  ('shared_story_generation_limits', 'shared-stories.sql'),
  ('shared_story_media', 'shared-story-media.sql'),
  ('shared_story_media_purge', 'shared-story-media.sql'),
  ('shared_story_voice', 'shared-story-gifts.sql'),
  ('shared_story_voice_purge', 'shared-story-gifts.sql'),
  ('shared_story_replies', 'shared-story-gifts.sql'),
  ('muse_personal_journeys', 'personal-journeys.sql'),
  ('muse_personal_journey_requests', 'personal-journeys.sql'),
  ('muse_adventure_sessions', 'shared-adventures.sql'),
  ('muse_adventure_requests', 'shared-adventures.sql'),
  ('muse_adventure_budgets', 'shared-adventures.sql'),
  ('muse_cooperative_players', 'shared-cooperative.sql'),
  ('muse_cooperative_turns', 'shared-cooperative.sql'),
  ('muse_operations_counters', 'operations.sql'),
  ('muse_operations_alerts', 'operations.sql'),
  ('muse_billing_accounts', 'billing.sql'),
  ('muse_billing_reservations', 'billing.sql'),
  ('muse_studio_audio', 'shared-story-studio.sql')
),
required_columns(table_name, column_name, migration) as (values
  ('shared_stories', 'owner_id', 'account-ownership.sql'),
  ('shared_stories', 'alternative_answers_normalized', 'shared-story-help.sql'),
  ('shared_story_sessions', 'skipped', 'shared-story-help.sql'),
  ('shared_story_sessions', 'revealed_hints', 'shared-story-help.sql'),
  ('shared_story_sessions', 'attempts', 'shared-stories.sql')
),
required_functions(name, migration) as (values
  ('advance_shared_story_ending', 'shared-story-endings.sql'),
  ('muse_cooperative_ending_advance', 'shared-story-endings.sql'),
  ('muse_personal_journey', 'personal-journeys.sql'),
  ('muse_delete_personal_journey', 'account-ownership.sql'),
  ('muse_consume_operation', 'operations.sql'),
  ('muse_consume_operation_units', 'operations-units.sql'),
  ('reserve_shared_story_request', 'shared-stories.sql'),
  ('muse_reserve_billing_usage', 'billing.sql')
),
muse_tables as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (c.relname like 'shared_story%' or c.relname like 'muse\_%')
)
select 'table exists: ' || t.name as check_name, t.migration as fix_with,
       exists (select 1 from muse_tables m where m.relname = t.name) as ok
from required_tables t
union all
select 'column exists: ' || c.table_name || '.' || c.column_name, c.migration,
       exists (select 1 from information_schema.columns i
               where i.table_schema = 'public' and i.table_name = c.table_name and i.column_name = c.column_name)
from required_columns c
union all
select 'function exists: ' || f.name, f.migration,
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = f.name)
from required_functions f
union all
-- Story tables hold private content: row-level security must be on.
select 'row level security on: ' || m.relname, 'enable row level security', m.relrowsecurity
from muse_tables m
union all
-- The browser keys (anon, authenticated) must not read story tables directly.
select 'no anon/authenticated table grants: ' || m.relname, 'revoke all on the table from anon, authenticated',
       not exists (select 1 from information_schema.role_table_grants g
                   where g.table_schema = 'public' and g.table_name = m.relname
                     and g.grantee in ('anon', 'authenticated', 'PUBLIC'))
from muse_tables m
union all
-- Server-side story functions must be callable only by service_role.
select 'no anon/authenticated function execute: ' || p.proname, 'revoke execute from public, anon, authenticated',
       not (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'muse\_%' or p.proname like '%shared_story%')
order by 3, 1;
