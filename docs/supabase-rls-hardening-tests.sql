-- REVIEW-ONLY post-fix tests for supabase-rls-hardening-proposal.sql.
-- Prepared 2026-10-06. Author has NOT executed this file.
-- Run ONLY after separate approval and successful application of the two policy
-- changes. Run as postgres in one dedicated PostgreSQL 17 connection with STOP
-- ON FIRST ERROR; close/ROLLBACK the connection on any unhandled SQL error.
-- No DDL, stored functions, temp tables, Auth API, passwords or email addresses.
-- SET ROLE and plaintext request claims simulate SQL RLS; they do not create
-- or verify real Auth sessions/JWT signatures/SMTP or test A04 atomic writers.
-- Every explicit write uses ea060626-0000-4000-8001-* fixture IDs. The reviewed
-- Auth trigger alone generates the organizer/membership UUIDs; its organizer is
-- derived from the exact synthetic user UUID AND the unique full-UUID slug.
-- Fixtures stay uncommitted and invisible to other sessions, then roll back.
-- REQUIRED: in a fresh connection prepend the TWO applied_check_md5 values
-- recorded by the approved policy deployment as session GUCs before this file:
--   SET eventmap.rls_locations_check_md5 = '<approved applied value>';
--   SET eventmap.rls_analytics_check_md5 = '<approved applied value>';
-- This script never derives those expected hashes from arbitrary current state.
-- Final static PASS is valid only if every preceding assertion completed and
-- the client stopped on the first SQL error. It also returns actual absence counts.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public, extensions;
SELECT set_config('request.jwt.claim.sub','',true),
  set_config('request.jwt.claim.role','',true), set_config('request.jwt.claims','{}',true);
SAVEPOINT hardening_fixtures;

DO $guard$
DECLARE
  rel regclass;
  collision boolean;
  signature text;
  expected_hash text;
  target record;
  actual_policy record;
  supplied_hash text;
BEGIN
  IF current_user <> 'postgres'
     OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
     OR current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'Requires reviewed PostgreSQL 17 postgres connection and normal triggers';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated')
      AND NOT rolsuper AND NOT rolbypassrls) <> 2 THEN
    RAISE EXCEPTION 'Unexpected anon/authenticated runtime role attributes';
  END IF;
  -- Actual-catalog hashes used by the successfully executed 8000 fixture suite.
  FOR signature, expected_hash IN SELECT * FROM (VALUES
    ('public.handle_new_user()', '26085fa3b667ac7495ade91806ee8035'),
    ('public.is_admin()', 'f7ab1aa8018aadea0df439f17b4641cf'),
    ('public.get_my_saved_events(uuid)', '460f98be908fd43ba79fd5903aef2253'),
    ('public.set_my_saved_event(uuid,boolean)', 'c918aa2f029d2b047ab8510b57de0564')
  ) f(signature, fingerprint)
  LOOP
    IF md5(pg_get_functiondef(signature::regprocedure)) IS DISTINCT FROM expected_hash THEN
      RAISE EXCEPTION 'Function drift: %; obtain catalog and review before testing', signature;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='auth.users'::regclass
      AND NOT tgisinternal) <> 1
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
      AND NOT tgisinternal AND tgname='on_auth_user_created' AND tgenabled IN ('O','A')
      AND tgfoid='public.handle_new_user()'::regprocedure) THEN
    RAISE EXCEPTION 'Auth custom trigger inventory changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN
    ('public.profiles'::regclass,'public.organizers'::regclass,
     'public.organizer_users'::regclass,'public.events'::regclass,
     'public.locations'::regclass,'public.event_analytics'::regclass)) THEN
    RAISE EXCEPTION 'Unexpected fixture-table custom trigger; review possible side effects';
  END IF;
  FOREACH rel IN ARRAY ARRAY['public.profiles'::regclass,'public.organizers'::regclass,
    'public.organizer_users'::regclass,'public.events'::regclass,
    'public.locations'::regclass,'public.event_analytics'::regclass]
  LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=rel) THEN
      RAISE EXCEPTION 'RLS disabled: %',rel;
    END IF;
  END LOOP;
  FOR target IN SELECT * FROM (VALUES
    ('locations','locations_insert_admin_or_organizer','authenticated',
      'eventmap.rls_locations_check_md5'),
    ('event_analytics','Anyone can insert event analytics','public',
      'eventmap.rls_analytics_check_md5')
  ) p(table_name, policy_name, policy_role, expected_hash_setting)
  LOOP
    IF (SELECT count(*) FROM pg_policy
      WHERE polrelid=format('public.%I',target.table_name)::regclass
        AND polcmd IN ('a','*')) <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one post-fix INSERT/ALL policy on %',target.table_name;
    END IF;
    SELECT p.* INTO STRICT actual_policy FROM pg_policies p
      WHERE p.schemaname='public' AND p.tablename=target.table_name
        AND p.policyname=target.policy_name;
    IF actual_policy.cmd <> 'INSERT' OR actual_policy.permissive <> 'PERMISSIVE'
       OR actual_policy.qual IS NOT NULL
       OR actual_policy.roles IS DISTINCT FROM ARRAY[target.policy_role]::name[]
       OR actual_policy.with_check IS NULL
       OR regexp_replace(lower(actual_policy.with_check),'[[:space:]()]','','g')='true' THEN
      RAISE EXCEPTION 'Unexpected or broadly permissive post-fix policy: %.%',
        target.table_name,target.policy_name;
    END IF;
    supplied_hash := current_setting(target.expected_hash_setting,true);
    IF supplied_hash IS NULL OR supplied_hash !~ '^[0-9a-f]{32}$' THEN
      RAISE EXCEPTION 'Missing approved-deployment hash: %',
        target.expected_hash_setting;
    END IF;
    IF md5(actual_policy.with_check) IS DISTINCT FROM supplied_hash THEN
      RAISE EXCEPTION 'Post-fix policy differs from the approved deployment hash: %',
        target.policy_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='locations'
      AND policyname='locations authenticated insert') THEN
    RAISE EXCEPTION 'Old broad locations INSERT policy still exists';
  END IF;
  -- Namespace collisions are checked before all fixture writes/trigger upserts.
  FOREACH rel IN ARRAY ARRAY['auth.users'::regclass,'public.profiles'::regclass,
    'public.organizers'::regclass,'public.organizer_users'::regclass,
    'public.events'::regclass,'public.locations'::regclass,'public.event_analytics'::regclass]
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE id::text LIKE $1)',rel)
      INTO collision USING 'ea060626-0000-4000-8001-%';
    IF collision THEN RAISE EXCEPTION 'Hardening fixture namespace collision: %',rel; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.organizers
      WHERE slug='eventmap-hardening-org-ea060626-0000-4000-8001-000000000002')
     OR EXISTS (SELECT 1 FROM public.events
      WHERE slug LIKE 'eventmap-hardening-event-ea060626-0000-4000-8001-%')
     OR EXISTS (SELECT 1 FROM public.organizer_users
      WHERE user_id::text LIKE 'ea060626-0000-4000-8001-%')
     OR EXISTS (SELECT 1 FROM public.saved_events
      WHERE user_id::text LIKE 'ea060626-0000-4000-8001-%'
         OR event_id::text LIKE 'ea060626-0000-4000-8001-%')
     OR EXISTS (SELECT 1 FROM public.event_sources
      WHERE event_id::text LIKE 'ea060626-0000-4000-8001-%')
     OR EXISTS (SELECT 1 FROM public.event_analytics
      WHERE event_id::text LIKE 'ea060626-0000-4000-8001-%'
         OR user_id::text LIKE 'ea060626-0000-4000-8001-%') THEN
    RAISE EXCEPTION 'Hardening fixture slug/relationship collision';
  END IF;
END $guard$;

INSERT INTO auth.users (id,raw_user_meta_data) VALUES
('ea060626-0000-4000-8001-000000000001',
  '{"role":"user","display_name":"EventMap hardening user"}'),
('ea060626-0000-4000-8001-000000000002',
  '{"role":"organizer","organizer_name":"EventMap hardening org ea060626-0000-4000-8001-000000000002"}'),
('ea060626-0000-4000-8001-000000000003',
  '{"role":"admin","display_name":"EventMap hardening fixture admin"}');
DO $registration$
DECLARE org_id uuid;
BEGIN
  IF (SELECT count(*) FROM public.profiles
      WHERE id::text LIKE 'ea060626-0000-4000-8001-%') <> 3
     OR (SELECT count(*) FROM public.profiles
      WHERE id IN ('ea060626-0000-4000-8001-000000000001',
        'ea060626-0000-4000-8001-000000000003') AND role='user') <> 2
     OR NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id='ea060626-0000-4000-8001-000000000002' AND role='organizer') THEN
    RAISE EXCEPTION 'Synthetic registration/profile role whitelist failed';
  END IF;
  SELECT o.id INTO STRICT org_id FROM public.organizers o
    JOIN public.organizer_users ou ON ou.organizer_id=o.id
    WHERE ou.user_id='ea060626-0000-4000-8001-000000000002' AND ou.role='owner'
      AND o.slug='eventmap-hardening-org-ea060626-0000-4000-8001-000000000002'
      AND o.is_verified=false;
  IF (SELECT count(*) FROM public.organizer_users
      WHERE user_id::text LIKE 'ea060626-0000-4000-8001-%') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one synthetic organizer membership';
  END IF;
  PERFORM set_config('eventmap.hardening.org_id',org_id::text,true);
END $registration$;
-- Only postgres promotes this exact synthetic fixture; metadata alone did not.
UPDATE public.profiles SET role='admin'
  WHERE id='ea060626-0000-4000-8001-000000000003';
INSERT INTO public.events
  (id,title,slug,start_at,status,visibility,is_cancelled,organizer_id,
   submitted_by_organizer_id,created_by)
SELECT ('ea060626-0000-4000-8001-'||suffix)::uuid,'EventMap hardening '||suffix,
  'eventmap-hardening-event-ea060626-0000-4000-8001-'||suffix,
  now()+interval '1 day',status,visibility,cancelled,
  current_setting('eventmap.hardening.org_id')::uuid,
  current_setting('eventmap.hardening.org_id')::uuid,
  'ea060626-0000-4000-8001-000000000002'::uuid
FROM (VALUES
  ('000000000101','published','public',false),
  ('000000000102','draft','public',false),
  ('000000000103','published','private',false),
  ('000000000104','published','public',true)
) f(suffix,status,visibility,cancelled);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true),
  set_config('request.jwt.claim.role','anon',true),
  set_config('request.jwt.claims','{"role":"anon"}',true);
DO $anon$
DECLARE invalid_event uuid; analytic_suffix text;
BEGIN
  IF auth.uid() IS NOT NULL OR (SELECT count(*) FROM public.events
      WHERE id::text LIKE 'ea060626-0000-4000-8001-%') <> 1 THEN
    RAISE EXCEPTION 'Anon claims/event fixture visibility failed';
  END IF;
  BEGIN
    INSERT INTO public.locations (id,name) VALUES
      ('ea060626-0000-4000-8001-000000000401','EventMap hardening anon denied');
    RAISE EXCEPTION 'Anon location INSERT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO public.event_analytics (id,event_id,event_type,user_id,session_id) VALUES
    ('ea060626-0000-4000-8001-000000000501','ea060626-0000-4000-8001-000000000101',
     'view',NULL,'ea060626-0000-4000-8001-anon');
  IF NOT FOUND THEN RAISE EXCEPTION 'Anon public analytics INSERT failed'; END IF;
  FOR analytic_suffix,invalid_event IN SELECT * FROM (VALUES
    ('000000000502','ea060626-0000-4000-8001-000000000102'::uuid),
    ('000000000503','ea060626-0000-4000-8001-000000000103'::uuid),
    ('000000000504','ea060626-0000-4000-8001-000000000104'::uuid)
  ) p(suffix,event_id)
  LOOP
    BEGIN
      INSERT INTO public.event_analytics (id,event_id,event_type,user_id,session_id) VALUES
        (('ea060626-0000-4000-8001-'||analytic_suffix)::uuid,invalid_event,
         'view',NULL,'ea060626-0000-4000-8001-anon-denied');
      RAISE EXCEPTION 'Anon nonpublic/cancelled analytics INSERT allowed: %',invalid_event;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  BEGIN
    INSERT INTO public.event_analytics (id,event_id,event_type,user_id) VALUES
      ('ea060626-0000-4000-8001-000000000505','ea060626-0000-4000-8001-000000000101',
       'view','ea060626-0000-4000-8001-000000000003');
    RAISE EXCEPTION 'Anon foreign user_id analytics INSERT allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $anon$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8001-000000000001',true),
  set_config('request.jwt.claim.role','authenticated',true),
  set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8001-000000000001","role":"authenticated"}',true);
DO $ordinary_user$
DECLARE n integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM 'ea060626-0000-4000-8001-000000000001'::uuid
     OR public.is_admin() OR EXISTS (SELECT 1 FROM public.organizer_users
      WHERE user_id='ea060626-0000-4000-8001-000000000001') THEN
    RAISE EXCEPTION 'Ordinary user claims/authority failed';
  END IF;
  BEGIN
    INSERT INTO public.locations (id,name) VALUES
      ('ea060626-0000-4000-8001-000000000402','EventMap hardening ordinary user denied');
    RAISE EXCEPTION 'Ordinary user location INSERT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Source profile policy permits self-description as organizer. This alone
  -- must not confer location-write authority without organizer_users membership.
  UPDATE public.profiles SET role='organizer'
    WHERE id='ea060626-0000-4000-8001-000000000001';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id='ea060626-0000-4000-8001-000000000001' AND role='organizer')
     OR EXISTS (SELECT 1 FROM public.organizer_users
      WHERE user_id='ea060626-0000-4000-8001-000000000001') THEN
    RAISE EXCEPTION 'Self-described organizer fixture failed';
  END IF;
  BEGIN
    INSERT INTO public.locations (id,name) VALUES
      ('ea060626-0000-4000-8001-000000000403','EventMap hardening membership-less organizer denied');
    RAISE EXCEPTION 'Self-described organizer without membership inserted location';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.profiles SET role='user'
    WHERE id='ea060626-0000-4000-8001-000000000001';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Ordinary-user fixture role restoration failed'; END IF;
  INSERT INTO public.event_analytics (id,event_id,event_type,user_id,session_id) VALUES
    ('ea060626-0000-4000-8001-000000000506','ea060626-0000-4000-8001-000000000101',
     'view','ea060626-0000-4000-8001-000000000001','ea060626-0000-4000-8001-own');
  IF NOT FOUND THEN RAISE EXCEPTION 'Authenticated own-user public analytics failed'; END IF;
  BEGIN
    INSERT INTO public.event_analytics (id,event_id,event_type,user_id) VALUES
      ('ea060626-0000-4000-8001-000000000507','ea060626-0000-4000-8001-000000000101',
       'view','ea060626-0000-4000-8001-000000000002');
    RAISE EXCEPTION 'Authenticated foreign user_id analytics INSERT allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $ordinary_user$;

SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8001-000000000002',true),
  set_config('request.jwt.claim.role','authenticated',true),
  set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8001-000000000002","role":"authenticated"}',true);
DO $member_organizer$
DECLARE invalid_event uuid; analytic_suffix text; n integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM 'ea060626-0000-4000-8001-000000000002'::uuid
     OR public.is_admin() OR NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id='ea060626-0000-4000-8001-000000000002' AND role='organizer')
     OR NOT EXISTS (SELECT 1 FROM public.organizer_users
      WHERE user_id='ea060626-0000-4000-8001-000000000002'
        AND organizer_id=current_setting('eventmap.hardening.org_id')::uuid)
     OR (SELECT count(*) FROM public.events
      WHERE id::text LIKE 'ea060626-0000-4000-8001-%')<>4 THEN
    RAISE EXCEPTION 'Organizer membership/owned fixture visibility failed';
  END IF;
  INSERT INTO public.locations (id,name) VALUES
    ('ea060626-0000-4000-8001-000000000404','EventMap hardening member organizer allowed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Member organizer location INSERT failed'; END IF;
  -- Membership alone must not confer organizer write authority after a profile
  -- changes back to user. Both parts of the organizer condition are required.
  UPDATE public.profiles SET role='user'
    WHERE id='ea060626-0000-4000-8001-000000000002';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id='ea060626-0000-4000-8001-000000000002' AND role='user')
     OR NOT EXISTS (SELECT 1 FROM public.organizer_users
      WHERE user_id='ea060626-0000-4000-8001-000000000002'
        AND organizer_id=current_setting('eventmap.hardening.org_id')::uuid) THEN
    RAISE EXCEPTION 'Membership without organizer profile fixture failed';
  END IF;
  BEGIN
    INSERT INTO public.locations (id,name) VALUES
      ('ea060626-0000-4000-8001-000000000406','EventMap hardening user with membership denied');
    RAISE EXCEPTION 'Membership without organizer profile inserted location';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.profiles SET role='organizer'
    WHERE id='ea060626-0000-4000-8001-000000000002';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id='ea060626-0000-4000-8001-000000000002' AND role='organizer') THEN
    RAISE EXCEPTION 'Organizer fixture role restoration failed';
  END IF;
  -- Owner RLS can read these three events. The explicit analytics availability
  -- predicate must still reject them; anon denial alone would not prove this.
  FOR analytic_suffix,invalid_event IN SELECT * FROM (VALUES
    ('000000000509','ea060626-0000-4000-8001-000000000102'::uuid),
    ('000000000510','ea060626-0000-4000-8001-000000000103'::uuid),
    ('000000000511','ea060626-0000-4000-8001-000000000104'::uuid)
  ) p(suffix,event_id)
  LOOP
    BEGIN
      INSERT INTO public.event_analytics (id,event_id,event_type,user_id) VALUES
        (('ea060626-0000-4000-8001-'||analytic_suffix)::uuid,invalid_event,
         'view','ea060626-0000-4000-8001-000000000002');
      RAISE EXCEPTION 'Organizer nonpublic/cancelled analytics INSERT allowed: %',invalid_event;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
END $member_organizer$;

SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8001-000000000003',true),
  set_config('request.jwt.claim.role','authenticated',true),
  set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8001-000000000003","role":"authenticated"}',true);
DO $admin$
BEGIN
  IF auth.uid() IS DISTINCT FROM 'ea060626-0000-4000-8001-000000000003'::uuid
     OR NOT public.is_admin() OR EXISTS (SELECT 1 FROM public.organizer_users
      WHERE user_id='ea060626-0000-4000-8001-000000000003') THEN
    RAISE EXCEPTION 'Admin fixture authority/membership independence failed';
  END IF;
  INSERT INTO public.locations (id,name) VALUES
    ('ea060626-0000-4000-8001-000000000405','EventMap hardening admin allowed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin location INSERT failed'; END IF;
END $admin$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),
  set_config('request.jwt.claim.role','',true), set_config('request.jwt.claims','{}',true);

-- A nullable cancellation flag is public under the business predicate IS NOT TRUE.
-- Only postgres changes this exact synthetic event, after the false-flag checks.
UPDATE public.events SET is_cancelled=NULL
  WHERE id='ea060626-0000-4000-8001-000000000101';
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true),
  set_config('request.jwt.claim.role','anon',true),
  set_config('request.jwt.claims','{"role":"anon"}',true);
DO $anon_null_cancellation$
BEGIN
  IF auth.uid() IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.events
      WHERE id='ea060626-0000-4000-8001-000000000101' AND is_cancelled IS NULL) THEN
    RAISE EXCEPTION 'Public NULL-cancellation fixture visibility failed';
  END IF;
  INSERT INTO public.event_analytics (id,event_id,event_type,user_id,session_id) VALUES
    ('ea060626-0000-4000-8001-000000000508','ea060626-0000-4000-8001-000000000101',
     'view',NULL,'ea060626-0000-4000-8001-null-cancellation');
  IF NOT FOUND THEN RAISE EXCEPTION 'Public NULL-cancellation analytics INSERT failed'; END IF;
END $anon_null_cancellation$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),
  set_config('request.jwt.claim.role','',true), set_config('request.jwt.claims','{}',true);

DO $rows$
BEGIN
  IF (SELECT count(*) FROM public.locations
      WHERE id::text LIKE 'ea060626-0000-4000-8001-%')<>2
     OR (SELECT count(*) FROM public.locations WHERE id IN
      ('ea060626-0000-4000-8001-000000000404','ea060626-0000-4000-8001-000000000405'))<>2
     OR (SELECT count(*) FROM public.event_analytics
      WHERE id::text LIKE 'ea060626-0000-4000-8001-%')<>3
     OR NOT EXISTS (SELECT 1 FROM public.event_analytics
      WHERE id='ea060626-0000-4000-8001-000000000501'
        AND event_id='ea060626-0000-4000-8001-000000000101' AND user_id IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.event_analytics
      WHERE id='ea060626-0000-4000-8001-000000000506'
        AND event_id='ea060626-0000-4000-8001-000000000101'
        AND user_id='ea060626-0000-4000-8001-000000000001')
     OR NOT EXISTS (SELECT 1 FROM public.event_analytics
      WHERE id='ea060626-0000-4000-8001-000000000508'
        AND event_id='ea060626-0000-4000-8001-000000000101' AND user_id IS NULL) THEN
    RAISE EXCEPTION 'Expected exactly the positive location/analytics fixtures';
  END IF;
END $rows$;

ROLLBACK TO SAVEPOINT hardening_fixtures;
RELEASE SAVEPOINT hardening_fixtures;
DO $absence$
DECLARE rel regclass; remains boolean;
BEGIN
  FOREACH rel IN ARRAY ARRAY['auth.users'::regclass,'public.profiles'::regclass,
    'public.organizers'::regclass,'public.organizer_users'::regclass,
    'public.events'::regclass,'public.locations'::regclass,'public.event_analytics'::regclass]
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE id::text LIKE $1)',rel)
      INTO remains USING 'ea060626-0000-4000-8001-%';
    IF remains THEN RAISE EXCEPTION 'Hardening fixture survived savepoint rollback: %',rel; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.organizers
      WHERE slug='eventmap-hardening-org-ea060626-0000-4000-8001-000000000002')
     OR EXISTS (SELECT 1 FROM public.organizer_users
      WHERE user_id::text LIKE 'ea060626-0000-4000-8001-%')
     OR EXISTS (SELECT 1 FROM public.saved_events
      WHERE user_id::text LIKE 'ea060626-0000-4000-8001-%'
         OR event_id::text LIKE 'ea060626-0000-4000-8001-%')
     OR EXISTS (SELECT 1 FROM public.event_sources
      WHERE event_id::text LIKE 'ea060626-0000-4000-8001-%')
     OR EXISTS (SELECT 1 FROM public.event_analytics
      WHERE event_id::text LIKE 'ea060626-0000-4000-8001-%'
         OR user_id::text LIKE 'ea060626-0000-4000-8001-%') THEN
    RAISE EXCEPTION 'Generated/related hardening fixtures survived savepoint rollback';
  END IF;
END $absence$;
ROLLBACK;

SELECT jsonb_build_object(
  'report_version','eventmap-rls-hardening-tests-2026-10-06-v1',
  'valid_only_if','all assertions completed without SQL error; client stopped on first error',
  'checks','PASS: approved post-fix policy hashes/inventory; anon/user/self-described organizer/member-without-organizer-profile location denial; member organizer/admin location success; false/NULL-cancellation public analytics success and authenticated own UID success; nonpublic/cancelled and foreign identity analytics denial; rollback',
  'not_tested',jsonb_build_array('real Auth/JWT/signup/email','A04 atomic writes','distributed analytics dedup/rate limiting'),
  'fixture_absence',jsonb_build_object(
    'auth_users',(SELECT count(*) FROM auth.users WHERE id::text LIKE 'ea060626-0000-4000-8001-%'),
    'profiles',(SELECT count(*) FROM public.profiles WHERE id::text LIKE 'ea060626-0000-4000-8001-%'),
    'organizers',(SELECT count(*) FROM public.organizers WHERE slug='eventmap-hardening-org-ea060626-0000-4000-8001-000000000002'),
    'memberships',(SELECT count(*) FROM public.organizer_users WHERE user_id::text LIKE 'ea060626-0000-4000-8001-%'),
    'events',(SELECT count(*) FROM public.events WHERE id::text LIKE 'ea060626-0000-4000-8001-%'),
    'locations',(SELECT count(*) FROM public.locations WHERE id::text LIKE 'ea060626-0000-4000-8001-%'),
    'analytics',(SELECT count(*) FROM public.event_analytics WHERE id::text LIKE 'ea060626-0000-4000-8001-%'
      OR event_id::text LIKE 'ea060626-0000-4000-8001-%' OR user_id::text LIKE 'ea060626-0000-4000-8001-%'),
    'sources',(SELECT count(*) FROM public.event_sources WHERE event_id::text LIKE 'ea060626-0000-4000-8001-%'),
    'saves',(SELECT count(*) FROM public.saved_events WHERE user_id::text LIKE 'ea060626-0000-4000-8001-%'
      OR event_id::text LIKE 'ea060626-0000-4000-8001-%')
  )
) AS verification;
