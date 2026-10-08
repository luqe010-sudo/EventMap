-- HISTORICAL SQL: approved and deployed from a frozen copy 2026-10-06 21:20 CEST.
-- Do not replay on production. Original approved SHA and results are recorded in
-- docs/supabase-rls-hardening-release-2026-10-06.md; the source guards now fail.
-- Target the reviewed EventMap project explicitly; do not run the local baseline.
-- Use ONE fresh dedicated connection, STOP ON FIRST ERROR and ROLLBACK/close on
-- error. Returned hashes alone do not prove success; require successful execution
-- of the entire file and verify the applied catalog before post-fix tests.
-- No new tables/columns/functions, no data changes or grant changes.
-- Fixes normal-user location INSERT and analytics INSERT for nonpublic events.
-- Does NOT provide distributed analytics dedup/rate limiting, immutable event
-- fields, organizer profile editing, or A04 atomic writer transactions.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public, extensions;
-- Acquire the locks before checking catalog fingerprints; the timeout bounds
-- waiting and the transaction releases both locks on COMMIT or ROLLBACK.
LOCK TABLE public.locations, public.event_analytics IN ACCESS EXCLUSIVE MODE;

DO $guard$
DECLARE expected record; actual record;
BEGIN
  IF current_user <> 'postgres' OR current_setting('server_version_num')::integer
      NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'Requires the reviewed PostgreSQL 17 postgres connection';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated')
      AND NOT rolsuper AND NOT rolbypassrls) <> 2
     OR md5(pg_get_functiondef('public.is_admin()'::regprocedure))
       IS DISTINCT FROM 'f7ab1aa8018aadea0df439f17b4641cf' THEN
    RAISE EXCEPTION 'Role or admin-helper drift; inspect before changing policies';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.locations'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.event_analytics'::regclass) THEN
    RAISE EXCEPTION 'Expected enabled RLS on locations and event_analytics';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('locations', 'locations authenticated insert', 'authenticated', 'b326b5062b2f0e69046810717534cb09'),
    ('locations', 'locations_insert_admin_or_organizer', 'authenticated', '9117a3b8c8bc846e0e6d1ed93dfd5ea0'),
    ('event_analytics', 'Anyone can insert event analytics', 'public', 'c453555cd3dbd2854d4c8ce711784d0e')
  ) AS source(table_name, policy_name, policy_role, check_md5)
  LOOP
    SELECT p.cmd, p.permissive, p.qual, p.roles, md5(p.with_check) AS check_md5
      INTO actual FROM pg_policies p
      WHERE p.schemaname='public' AND p.tablename=expected.table_name
        AND p.policyname=expected.policy_name;
    IF NOT FOUND OR actual.cmd <> 'INSERT' OR actual.permissive <> 'PERMISSIVE'
       OR actual.qual IS NOT NULL
       OR actual.roles IS DISTINCT FROM ARRAY[expected.policy_role]::name[]
       OR actual.check_md5 IS DISTINCT FROM expected.check_md5 THEN
      RAISE EXCEPTION 'Policy drift: %.%; inspect again before changing',
        expected.table_name, expected.policy_name;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.locations'::regclass AND polcmd IN ('a','*')) <> 2
     OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.event_analytics'::regclass AND polcmd IN ('a','*')) <> 1 THEN
    RAISE EXCEPTION 'Unexpected INSERT/ALL policies; review combined permissions';
  END IF;
END $guard$;

DROP POLICY "locations authenticated insert" ON public.locations;
ALTER POLICY "locations_insert_admin_or_organizer" ON public.locations
  WITH CHECK (
    public.is_admin()
    OR (
      EXISTS (SELECT 1 FROM public.profiles p
        WHERE p.id=(SELECT auth.uid()) AND p.role='organizer')
      AND EXISTS (SELECT 1 FROM public.organizer_users ou
        WHERE ou.user_id=(SELECT auth.uid()))
    )
  );

ALTER POLICY "Anyone can insert event analytics" ON public.event_analytics
  WITH CHECK (
    (user_id IS NULL OR user_id=(SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.events e
      WHERE e.id=event_analytics.event_id
        AND e.status='published' AND e.visibility='public'
        AND e.is_cancelled IS NOT TRUE)
  );

-- After approval: verify ordinary user/anon location denial, organizer+admin
-- location success, public analytics success and private/draft/cancelled denial
-- using only fresh synthetic fixtures with full ROLLBACK. Existing current-state
-- test script expects the old gaps; it must not be mistaken for a post-fix suite.
-- Capture fingerprints while both locks still protect the catalog. Session GUCs
-- survive COMMIT and let the CLI return these exact values without reading a
-- potentially newer catalog. A failure before COMMIT rolls back their assignment.
DO $capture$
DECLARE locations_md5 text; analytics_md5 text;
BEGIN
  SELECT md5(with_check) INTO STRICT locations_md5 FROM pg_policies
    WHERE schemaname='public' AND tablename='locations'
      AND policyname='locations_insert_admin_or_organizer';
  SELECT md5(with_check) INTO STRICT analytics_md5 FROM pg_policies
    WHERE schemaname='public' AND tablename='event_analytics'
      AND policyname='Anyone can insert event analytics';
  IF locations_md5 IS NULL OR analytics_md5 IS NULL THEN
    RAISE EXCEPTION 'Missing policy check after change';
  END IF;
  PERFORM set_config('eventmap.rls_locations_check_md5', locations_md5, false);
  PERFORM set_config('eventmap.rls_analytics_check_md5', analytics_md5, false);
END $capture$;
COMMIT;

-- Save THIS successful deployment result for rollback. Do not substitute hashes
-- read from an arbitrary later state. This SELECT reads session values only.
SELECT jsonb_build_object(
  'locations_insert_admin_or_organizer', current_setting('eventmap.rls_locations_check_md5'),
  'Anyone can insert event analytics', current_setting('eventmap.rls_analytics_check_md5')
) AS applied_check_md5;
