-- REVIEW-ONLY rollback for supabase-rls-hardening-proposal.sql; NOT EXECUTED.
-- Requires separate decision; intentionally restores the two previous gaps.
-- Use ONE fresh dedicated connection, STOP ON FIRST ERROR; ROLLBACK/close on error.
-- Caller must provide the two fingerprints recorded by the approved deployment
-- in the SAME connection, before this file; missing/mismatched values fail closed:
-- SET eventmap.rls_locations_check_md5 = '<recorded applied_check_md5>';
-- SET eventmap.rls_analytics_check_md5 = '<recorded applied_check_md5>';
-- Never replace those values with fingerprints of an arbitrary later state.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public, extensions;
LOCK TABLE public.locations, public.event_analytics IN ACCESS EXCLUSIVE MODE;

DO $guard$
DECLARE policy_row record;
BEGIN
  IF current_user <> 'postgres' OR current_setting('server_version_num')::integer
      NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'Requires the reviewed PostgreSQL 17 postgres connection';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.locations'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.event_analytics'::regclass) THEN
    RAISE EXCEPTION 'Expected enabled RLS on locations and event_analytics';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
       AND tablename='locations' AND policyname='locations authenticated insert')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
       AND tablename='locations' AND policyname='locations_insert_admin_or_organizer')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
       AND tablename='event_analytics' AND policyname='Anyone can insert event analytics') THEN
    RAISE EXCEPTION 'Unexpected rollback state; inspect the current policies first';
  END IF;
  IF current_setting('eventmap.rls_locations_check_md5', true) IS NULL
     OR current_setting('eventmap.rls_analytics_check_md5', true) IS NULL
     OR (SELECT md5(with_check) FROM pg_policies WHERE schemaname='public'
       AND tablename='locations' AND policyname='locations_insert_admin_or_organizer')
        IS DISTINCT FROM current_setting('eventmap.rls_locations_check_md5', true)
     OR (SELECT md5(with_check) FROM pg_policies WHERE schemaname='public'
       AND tablename='event_analytics' AND policyname='Anyone can insert event analytics')
        IS DISTINCT FROM current_setting('eventmap.rls_analytics_check_md5', true) THEN
    RAISE EXCEPTION 'Missing approved-deployment fingerprint or later policy drift';
  END IF;
  FOR policy_row IN SELECT p.* FROM pg_policies p
    WHERE p.schemaname='public' AND (
      (p.tablename='locations' AND p.policyname='locations_insert_admin_or_organizer')
      OR (p.tablename='event_analytics' AND p.policyname='Anyone can insert event analytics')
    )
  LOOP
    IF policy_row.cmd <> 'INSERT' OR policy_row.permissive <> 'PERMISSIVE'
       OR policy_row.qual IS NOT NULL
       OR policy_row.roles IS DISTINCT FROM
         ARRAY[CASE policy_row.tablename WHEN 'locations' THEN 'authenticated' ELSE 'public' END]::name[] THEN
      RAISE EXCEPTION 'Rollback policy role/command drift';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.locations'::regclass AND polcmd IN ('a','*')) <> 1
     OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.event_analytics'::regclass AND polcmd IN ('a','*')) <> 1 THEN
    RAISE EXCEPTION 'Unexpected INSERT/ALL policies before rollback';
  END IF;
END $guard$;

CREATE POLICY "locations authenticated insert" ON public.locations
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
ALTER POLICY "locations_insert_admin_or_organizer" ON public.locations
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles
    WHERE profiles.id=auth.uid() AND profiles.role=ANY(ARRAY['admin'::text,'organizer'::text])));
ALTER POLICY "Anyone can insert event analytics" ON public.event_analytics
  WITH CHECK (user_id IS NULL OR user_id=auth.uid());
COMMIT;
