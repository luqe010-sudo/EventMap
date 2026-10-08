-- EventMap: read-only catalog audit. No application rows or credentials.
-- Run with: npx supabase db query --linked --file docs/security-audit-readonly.sql
select jsonb_build_object(
  'tables', (select jsonb_agg(to_jsonb(t) order by t.table_name) from (
    select c.relname as table_name, c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  ) t),
  'policies', (select jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname)
    from pg_policies p where p.schemaname = 'public'),
  'grants', (select jsonb_agg(to_jsonb(g) order by g.table_name, g.grantee, g.privilege_type)
    from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated', 'PUBLIC')),
  'column_grants', (select jsonb_agg(to_jsonb(g) order by g.table_name, g.column_name, g.grantee)
    from information_schema.column_privileges g
    where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated', 'PUBLIC')
      and g.table_name in ('profiles', 'events', 'saved_events', 'organizer_users')),
  'triggers', (select jsonb_agg(to_jsonb(t) order by t.schema_name, t.table_name, t.trigger_name) from (
    select n.nspname as schema_name, c.relname as table_name, t.tgname as trigger_name,
      t.tgenabled as enabled, pg_get_triggerdef(t.oid) as definition,
      pn.nspname as function_schema, p.proname as function_name
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
    where not t.tgisinternal and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
  ) t),
  'functions', (select jsonb_agg(to_jsonb(f) order by f.schema_name, f.name) from (
    select n.nspname as schema_name, p.proname as name,
      pg_get_function_identity_arguments(p.oid) as arguments,
      p.prosecdef as security_definer, p.proconfig as config,
      p.proacl::text as acl, pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f' and (n.nspname = 'public' or p.oid in (
      select t.tgfoid from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace tn on tn.oid = c.relnamespace
      where not t.tgisinternal and tn.nspname = 'auth' and c.relname = 'users'
    )) and not exists (
      select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
        and d.objid = p.oid and d.deptype = 'e'
    )
  ) f),
  'constraints', (select jsonb_agg(to_jsonb(k) order by k.table_name, k.name) from (
    select c.relname as table_name, k.conname as name, k.contype as type,
      pg_get_constraintdef(k.oid) as definition
    from pg_constraint k join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
  ) k),
  'indexes', (select jsonb_agg(to_jsonb(i) order by i.tablename, i.indexname)
    from pg_indexes i where i.schemaname = 'public'),
  'columns', (select jsonb_agg(to_jsonb(c) order by c.table_name, c.ordinal_position)
    from information_schema.columns c where c.table_schema = 'public')
) as audit;
