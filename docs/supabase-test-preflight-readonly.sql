-- Catalog-only preflight before user-authorized transactional fixture tests.
-- No Auth/application rows, secrets, DDL/DML or external functions are read/run.
SELECT pg_catalog.jsonb_build_object(
  'collected_at', pg_catalog.statement_timestamp(),
  'server_version', pg_catalog.current_setting('server_version'),
  'triggers', (
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'schema', n.nspname, 'table', c.relname, 'name', t.tgname,
      'enabled', t.tgenabled, 'internal', t.tgisinternal,
      'trigger_definition', pg_catalog.pg_get_triggerdef(t.oid, true),
      'function_schema', fn.nspname, 'function_name', p.proname,
      'function_definition', CASE WHEN NOT t.tgisinternal
        THEN pg_catalog.pg_get_functiondef(p.oid) ELSE NULL END
    ) ORDER BY n.nspname, c.relname, t.tgname)
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
    JOIN pg_catalog.pg_namespace fn ON fn.oid = p.pronamespace
    WHERE (n.nspname = 'auth' AND c.relname = 'users')
      OR (n.nspname = 'public' AND c.relname IN (
        'profiles', 'organizers', 'organizer_users', 'events',
        'saved_events', 'event_sources', 'event_analytics',
        'locations', 'event_moderation_logs', 'notifications'
      ))
  ),
  'extensions', (
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'name', e.extname, 'version', e.extversion, 'schema', n.nspname
    ) ORDER BY e.extname)
    FROM pg_catalog.pg_extension e
    JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  )
) AS audit;
