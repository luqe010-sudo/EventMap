-- Run against the reviewed EventMap database in one postgres connection.
-- Stop on the first unhandled error and roll back or close the connection.
-- Synthetic users and all resulting rows remain uncommitted and are rolled back.
-- SET LOCAL ROLE and claims exercise PostgreSQL privileges, not real JWTs.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL search_path = pg_catalog, public, extensions;

DO $guard$
DECLARE
  rpc_oid oid := to_regprocedure('public.upgrade_my_organizer_account(text)');
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
    OR current_database() <> 'postgres'
    OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR current_setting('session_replication_role') <> 'origin'
    OR (SELECT system_identifier::text FROM pg_control_system()) IS DISTINCT FROM '7642734024280108049'
    OR (SELECT oid::text FROM pg_database WHERE datname = current_database()) IS DISTINCT FROM '5'
    OR md5(pg_get_functiondef('auth.uid()'::regprocedure)) IS DISTINCT FROM 'ea3b41bf29e2ad573067939329aa088e' THEN
    RAISE EXCEPTION 'Requires the reviewed EventMap PostgreSQL 17 connection';
  END IF;

  IF rpc_oid IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid = rpc_oid AND p.prosecdef
      AND p.proowner = 'postgres'::regrole AND p.proconfig = ARRAY['search_path=pg_catalog, pg_temp']
      AND md5(replace(pg_get_functiondef(p.oid), chr(13) || chr(10), chr(10))) = '5b6e3988371fd90139de48090b9b4dd0'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
        WHERE a.grantee <> p.proowner AND (a.grantee <> 'authenticated'::regrole OR a.is_grantable))
  ) THEN
    RAISE EXCEPTION 'Organizer upgrade function or ACL differs from the reviewed release';
  END IF;

  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal) <> 1
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'on_auth_user_created' AND NOT tgisinternal AND tgenabled = 'O'
      AND tgtype = 5 AND tgnargs = 0 AND tgqual IS NULL AND tgfoid = 'public.handle_new_user()'::regprocedure)
    OR md5(pg_get_functiondef('public.handle_new_user()'::regprocedure)) IS DISTINCT FROM '26085fa3b667ac7495ade91806ee8035'
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
      AND (tgrelid IN ('public.profiles'::regclass, 'public.organizer_users'::regclass)
        OR (tgrelid = 'public.organizers'::regclass AND (tgtype & 4) <> 0)))
    OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class IN ('auth.users'::regclass,
      'public.profiles'::regclass, 'public.organizers'::regclass, 'public.organizer_users'::regclass)) THEN
    RAISE EXCEPTION 'Fixture trigger or rewrite inventory changed';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id::text LIKE 'ea161126-0000-4000-8100-%')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id::text LIKE 'ea161126-0000-4000-8100-%')
    OR EXISTS (SELECT 1 FROM public.organizer_users WHERE user_id::text LIKE 'ea161126-0000-4000-8100-%')
    OR EXISTS (SELECT 1 FROM public.organizers WHERE starts_with(slug, 'eventmap-upgrade-check-ea161126')) THEN
    RAISE EXCEPTION 'Organizer upgrade fixture namespace collision';
  END IF;
END $guard$;

SAVEPOINT upgrade_fixtures;
INSERT INTO auth.users (id, raw_user_meta_data, is_anonymous) VALUES
  ('ea161126-0000-4000-8100-000000000001', '{"role":"user","display_name":"EventMap upgrade viewer"}', false),
  ('ea161126-0000-4000-8100-000000000002', '{"role":"user","display_name":"EventMap second viewer"}', false),
  ('ea161126-0000-4000-8100-000000000003', '{"role":"user","display_name":"EventMap upgrade admin"}', false),
  ('ea161126-0000-4000-8100-000000000004', '{"role":"user","display_name":"EventMap anonymous user"}', true);
UPDATE public.profiles SET role = 'admin' WHERE id = 'ea161126-0000-4000-8100-000000000003';
DO $registration$
BEGIN
  IF (SELECT count(*) FROM public.profiles WHERE id::text LIKE 'ea161126-0000-4000-8100-%' AND role = 'user') <> 3
    OR (SELECT role FROM public.profiles WHERE id = 'ea161126-0000-4000-8100-000000000003') IS DISTINCT FROM 'admin'
    OR EXISTS (SELECT 1 FROM public.organizer_users WHERE user_id::text LIKE 'ea161126-0000-4000-8100-%') THEN
    RAISE EXCEPTION 'Unexpected state from registered fixtures';
  END IF;
END $registration$;

SELECT set_config('request.jwt.claim.sub', 'ea161126-0000-4000-8100-000000000001', true),
  set_config('request.jwt.claim.role', 'authenticated', true),
  set_config('request.jwt.claims', '{"role":"authenticated","sub":"ea161126-0000-4000-8100-000000000001"}', true);
SET LOCAL ROLE anon;
DO $anon$
BEGIN
  PERFORM public.upgrade_my_organizer_account('EventMap Upgrade Check EA161126');
  RAISE EXCEPTION 'anon obtained organizer upgrade execute';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $anon$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $service$
BEGIN
  PERFORM public.upgrade_my_organizer_account('EventMap Upgrade Check EA161126');
  RAISE EXCEPTION 'service_role obtained organizer upgrade execute';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $service$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $upgrade_test$
DECLARE
  fixture_uid text;
  first_id uuid;
  second_id uuid;
  organization_name constant text := 'EventMap Upgrade Check EA161126';
BEGIN
  FOREACH fixture_uid IN ARRAY ARRAY['', 'ea161126-0000-4000-8100-000000000003',
    'ea161126-0000-4000-8100-000000000004', 'ea161126-0000-4000-8100-000000000005']
  LOOP
    PERFORM set_config('request.jwt.claim.sub', fixture_uid, true),
      set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', NULLIF(fixture_uid, ''))::text, true);
    BEGIN
      PERFORM public.upgrade_my_organizer_account(organization_name);
      RAISE EXCEPTION 'Ineligible user obtained organizer upgrade';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;

  fixture_uid := 'ea161126-0000-4000-8100-000000000001';
  PERFORM set_config('request.jwt.claim.sub', fixture_uid, true),
    set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', fixture_uid)::text, true);
  first_id := public.upgrade_my_organizer_account('  ' || organization_name || '  ');
  IF first_id IS NULL OR public.upgrade_my_organizer_account('EventMap Upgrade Check EA161126 Retry') IS DISTINCT FROM first_id THEN
    RAISE EXCEPTION 'First upgrade or idempotent retry failed';
  END IF;

  fixture_uid := 'ea161126-0000-4000-8100-000000000002';
  PERFORM set_config('request.jwt.claim.sub', fixture_uid, true),
    set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', fixture_uid)::text, true);
  second_id := public.upgrade_my_organizer_account(organization_name);
  IF second_id IS NULL OR second_id = first_id
    OR EXISTS (SELECT 1 FROM public.organizer_users WHERE organizer_id = first_id) THEN
    RAISE EXCEPTION 'Second viewer reached the first viewer membership';
  END IF;
END $upgrade_test$;
RESET ROLE;

DO $effects$
BEGIN
  IF (SELECT count(*) FROM public.profiles WHERE id::text LIKE 'ea161126-0000-4000-8100-%' AND role = 'organizer') <> 2
    OR (SELECT count(*) FROM public.organizer_users WHERE user_id::text LIKE 'ea161126-0000-4000-8100-%') <> 2
    OR (SELECT count(*) FROM public.organizers WHERE starts_with(slug, 'eventmap-upgrade-check-ea161126')) <> 2
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'ea161126-0000-4000-8100-000000000003' AND role = 'admin')
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'ea161126-0000-4000-8100-000000000004' AND role = 'user')
    OR NOT EXISTS (SELECT 1 FROM public.organizer_users m JOIN public.organizers o ON o.id = m.organizer_id
      JOIN public.profiles p ON p.id = m.user_id WHERE m.user_id = 'ea161126-0000-4000-8100-000000000001'
        AND m.role = 'owner' AND p.role = 'organizer' AND p.display_name = 'EventMap upgrade viewer'
        AND o.slug = 'eventmap-upgrade-check-ea161126' AND o.email IS NULL AND o.is_verified IS FALSE)
    OR NOT EXISTS (SELECT 1 FROM public.organizer_users m JOIN public.organizers o ON o.id = m.organizer_id
      JOIN public.profiles p ON p.id = m.user_id WHERE m.user_id = 'ea161126-0000-4000-8100-000000000002'
        AND m.role = 'owner' AND p.role = 'organizer' AND p.display_name = 'EventMap second viewer'
        AND o.slug = 'eventmap-upgrade-check-ea161126-' || replace(o.id::text, '-', '')
        AND o.email IS NULL AND o.is_verified IS FALSE) THEN
    RAISE EXCEPTION 'Upgrade did not produce exactly two own organizations and memberships';
  END IF;
END $effects$;

ROLLBACK TO SAVEPOINT upgrade_fixtures;
DO $absence$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id::text LIKE 'ea161126-0000-4000-8100-%')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id::text LIKE 'ea161126-0000-4000-8100-%')
    OR EXISTS (SELECT 1 FROM public.organizer_users WHERE user_id::text LIKE 'ea161126-0000-4000-8100-%')
    OR EXISTS (SELECT 1 FROM public.organizers WHERE starts_with(slug, 'eventmap-upgrade-check-ea161126')) THEN
    RAISE EXCEPTION 'Organizer upgrade fixtures survived rollback';
  END IF;
END $absence$;
ROLLBACK;

SELECT jsonb_build_object(
  'checks', 'PASS: exact RPC and ACL, role denials, own upgrade, idempotent retry, isolated same-name upgrade, fixture rollback',
  'fixture_absence', jsonb_build_object(
    'auth_users', (SELECT count(*) FROM auth.users WHERE id::text LIKE 'ea161126-0000-4000-8100-%'),
    'profiles', (SELECT count(*) FROM public.profiles WHERE id::text LIKE 'ea161126-0000-4000-8100-%'),
    'memberships', (SELECT count(*) FROM public.organizer_users WHERE user_id::text LIKE 'ea161126-0000-4000-8100-%'),
    'organizers', (SELECT count(*) FROM public.organizers WHERE starts_with(slug, 'eventmap-upgrade-check-ea161126'))
  )
) AS organizer_upgrade_verification;
