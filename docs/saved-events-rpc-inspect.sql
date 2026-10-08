-- Read-only catalog inspection. No account records or credentials.
select jsonb_build_object(
  'columns', (select jsonb_agg(jsonb_build_object('name', column_name, 'type', data_type, 'default', column_default)) from information_schema.columns where table_schema = 'public' and table_name = 'saved_events'),
  'constraints', (select jsonb_agg(pg_get_constraintdef(oid)) from pg_constraint where conrelid = 'public.saved_events'::regclass),
  'policies', (select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname = 'public' and tablename = 'saved_events'),
  'grants', (select jsonb_agg(to_jsonb(g)) from information_schema.column_privileges g where table_schema = 'public' and table_name = 'saved_events' and grantee in ('anon', 'authenticated')),
  'functions', (select coalesce(jsonb_agg(jsonb_build_object('signature', p.oid::regprocedure::text, 'definition', pg_get_functiondef(p.oid), 'owner', pg_get_userbyid(p.proowner), 'config', p.proconfig, 'anon', has_function_privilege('anon', p.oid, 'EXECUTE'), 'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'))), '[]'::jsonb) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('get_my_saved_events', 'set_my_saved_event')),
  'auth_required_columns', (select jsonb_agg(jsonb_build_object('name', column_name, 'type', data_type)) from information_schema.columns where table_schema = 'auth' and table_name = 'users' and is_nullable = 'NO' and column_default is null)
) as audit;
