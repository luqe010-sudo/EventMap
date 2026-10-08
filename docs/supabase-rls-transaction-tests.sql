-- REVIEW BEFORE EXECUTION: EventMap synthetic PostgreSQL 17 RLS tests.
-- Prepared 2026-10-06; author has NOT executed this file.
-- User authorized tests against the existing Supabase; root/reviewer must check
-- the current catalog and this entire script before execution. Run as postgres,
-- in a dedicated connection with STOP ON FIRST ERROR and close/ROLLBACK on error.
-- No DDL, stored functions, temp tables, Auth API, passwords or email addresses.
-- Plaintext request claims + SET ROLE simulate SQL RLS, NOT real JWT/Auth/SMTP.
-- Every explicit write uses the listed ea060626-0000-4000-8000-* fixture IDs or
-- the two org IDs derived from the exact synthetic user IDs AND unique slugs.
-- Approved exception: real registration trigger generates random organizer and
-- membership UUIDs for these two users. Do not alter the trigger/defaults.
-- Fixtures are uncommitted, invisible to other sessions, and always rolled back.
-- Known-gap assertions reproduce current behavior; their security verdict FAIL
-- is deliberately separate from correct RLS checks. This does not test A04 RPC,
-- transaction/concurrency faults, real signup, JWT signatures or external I/O.
-- Final report is valid only if ALL preceding statements completed without error.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public, extensions;
SELECT set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', '', true), set_config('request.jwt.claims', '{}', true);
SAVEPOINT fixtures;

DO $guard$
DECLARE rel regclass; collision boolean; signature text; expected text;
BEGIN
  IF current_user <> 'postgres' OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'Requires PostgreSQL 17 postgres connection and normal trigger execution';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated') AND NOT rolsuper AND NOT rolbypassrls) <> 2 THEN
    RAISE EXCEPTION 'Unexpected runtime role attributes';
  END IF;
  -- Fingerprints from actual catalog snapshot 2026-10-06, not migration text.
  -- Root confirmed custom trigger body again at 16:45 CEST. Drift => review anew.
  FOR signature, expected IN SELECT * FROM (VALUES
    ('public.handle_new_user()', '26085fa3b667ac7495ade91806ee8035'),
    ('public.is_admin()', 'f7ab1aa8018aadea0df439f17b4641cf'),
    ('public.get_my_saved_events(uuid)', '460f98be908fd43ba79fd5903aef2253'),
    ('public.set_my_saved_event(uuid,boolean)', 'c918aa2f029d2b047ab8510b57de0564')) f(signature, fingerprint)
  LOOP
    IF md5(pg_get_functiondef(signature::regprocedure)) IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'Function drift: %; obtain current catalog and review', signature;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal) <> 1
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
      AND NOT tgisinternal AND tgname='on_auth_user_created' AND tgenabled IN ('O','A')
      AND tgfoid='public.handle_new_user()'::regprocedure) THEN
    RAISE EXCEPTION 'Auth trigger inventory changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN
    ('public.profiles'::regclass,'public.organizers'::regclass,'public.organizer_users'::regclass,
     'public.events'::regclass,'public.event_sources'::regclass,'public.locations'::regclass,
     'public.saved_events'::regclass,'public.event_analytics'::regclass,'public.event_moderation_logs'::regclass)) THEN
    RAISE EXCEPTION 'Unexpected custom trigger on fixture table; review possible side effects';
  END IF;
  FOREACH rel IN ARRAY ARRAY['public.events'::regclass,'public.event_sources'::regclass,
    'public.profiles'::regclass,'public.organizer_users'::regclass,'public.organizers'::regclass,
    'public.locations'::regclass,'public.saved_events'::regclass,'public.event_analytics'::regclass]
  LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=rel) THEN RAISE EXCEPTION 'RLS disabled: %', rel; END IF;
  END LOOP;
  -- Collision checks precede EVERY fixture INSERT, including trigger upserts.
  FOREACH rel IN ARRAY ARRAY['auth.users'::regclass,'public.profiles'::regclass,'public.organizers'::regclass,
    'public.organizer_users'::regclass,'public.events'::regclass,'public.event_sources'::regclass,
    'public.locations'::regclass,'public.event_analytics'::regclass,'public.event_moderation_logs'::regclass]
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE id::text LIKE $1)', rel)
      INTO collision USING 'ea060626-0000-4000-8000-%';
    IF collision THEN RAISE EXCEPTION 'Fixture namespace collision: %', rel; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.organizers WHERE slug IN (
      'eventmap-rls-a-ea060626-0000-4000-8000-000000000003',
      'eventmap-rls-b-ea060626-0000-4000-8000-000000000004'))
    OR EXISTS (SELECT 1 FROM public.events WHERE slug LIKE 'eventmap-rls-ea060626-0000-4000-8000-%')
    OR EXISTS (SELECT 1 FROM public.organizer_users WHERE user_id::text LIKE 'ea060626-0000-4000-8000-%')
    OR EXISTS (SELECT 1 FROM public.saved_events WHERE user_id::text LIKE 'ea060626-0000-4000-8000-%'
      OR event_id::text LIKE 'ea060626-0000-4000-8000-%') THEN
    RAISE EXCEPTION 'Fixture slug/relationship namespace collision';
  END IF;
END $guard$;

INSERT INTO auth.users (id, raw_user_meta_data) VALUES
('ea060626-0000-4000-8000-000000000001', '{"role":"user","display_name":"EventMap RLS user A"}'),
('ea060626-0000-4000-8000-000000000002', '{"role":"admin","display_name":"EventMap RLS malicious metadata"}'),
('ea060626-0000-4000-8000-000000000003', '{"role":"organizer","organizer_name":"EventMap RLS A ea060626-0000-4000-8000-000000000003"}'),
('ea060626-0000-4000-8000-000000000004', '{"role":"organizer","organizer_name":"EventMap RLS B ea060626-0000-4000-8000-000000000004"}'),
('ea060626-0000-4000-8000-000000000005', '{"role":"user","display_name":"EventMap RLS user B"}'),
('ea060626-0000-4000-8000-000000000006', '{"role":"unknown","display_name":"EventMap RLS admin fixture"}');
DO $registration$
DECLARE org_a uuid; org_b uuid;
BEGIN
  IF (SELECT count(*) FROM public.profiles WHERE id::text LIKE 'ea060626-0000-4000-8000-%') <> 6
    OR (SELECT count(*) FROM public.profiles WHERE id IN ('ea060626-0000-4000-8000-000000000001',
      'ea060626-0000-4000-8000-000000000002','ea060626-0000-4000-8000-000000000005','ea060626-0000-4000-8000-000000000006') AND role='user') <> 4
    OR (SELECT count(*) FROM public.profiles WHERE id IN ('ea060626-0000-4000-8000-000000000003','ea060626-0000-4000-8000-000000000004') AND role='organizer') <> 2 THEN
    RAISE EXCEPTION 'Registration role whitelist/profile fixture checks failed';
  END IF;
  SELECT o.id INTO STRICT org_a FROM public.organizers o JOIN public.organizer_users ou ON ou.organizer_id=o.id
    WHERE ou.user_id='ea060626-0000-4000-8000-000000000003' AND ou.role='owner'
      AND o.slug='eventmap-rls-a-ea060626-0000-4000-8000-000000000003' AND o.is_verified=false;
  SELECT o.id INTO STRICT org_b FROM public.organizers o JOIN public.organizer_users ou ON ou.organizer_id=o.id
    WHERE ou.user_id='ea060626-0000-4000-8000-000000000004' AND ou.role='owner'
      AND o.slug='eventmap-rls-b-ea060626-0000-4000-8000-000000000004' AND o.is_verified=false;
  IF org_a=org_b OR (SELECT count(*) FROM public.organizer_users WHERE user_id IN
    ('ea060626-0000-4000-8000-000000000003','ea060626-0000-4000-8000-000000000004')) <> 2 THEN
    RAISE EXCEPTION 'Organizer registration/membership isolation failed';
  END IF;
  PERFORM set_config('eventmap.fixture.org_a',org_a::text,true), set_config('eventmap.fixture.org_b',org_b::text,true);
END $registration$;
-- The only administrator promotion is postgres changing this exact synthetic ID.
UPDATE public.profiles SET role='admin' WHERE id='ea060626-0000-4000-8000-000000000006';
INSERT INTO public.events (id,title,slug,start_at,status,visibility,is_cancelled,organizer_id,submitted_by_organizer_id,created_by)
SELECT ('ea060626-0000-4000-8000-'||suffix)::uuid, 'EventMap RLS '||suffix,
  'eventmap-rls-ea060626-0000-4000-8000-'||suffix, now()+interval '1 day', status, visibility, cancelled,
  current_setting('eventmap.fixture.org_'||owner)::uuid, current_setting('eventmap.fixture.org_'||owner)::uuid,
  CASE owner WHEN 'a' THEN 'ea060626-0000-4000-8000-000000000003'::uuid ELSE 'ea060626-0000-4000-8000-000000000004'::uuid END
FROM (VALUES
  ('000000000101','a','published','public',false), ('000000000102','a','pending_review','public',false),
  ('000000000103','a','published','private',false), ('000000000104','a','published','public',true),
  ('000000000105','b','published','public',false), ('000000000106','b','pending_review','public',false),
  ('000000000107','b','pending_review','private',false), ('000000000108','b','published','public',true),
  ('000000000109','a','draft','public',false), ('000000000110','a','published','public',false)
) f(suffix,owner,status,visibility,cancelled);
INSERT INTO public.event_sources (id,event_id,source_type,source_name) VALUES
('ea060626-0000-4000-8000-000000000301','ea060626-0000-4000-8000-000000000102','manual','EventMap RLS A source'),
('ea060626-0000-4000-8000-000000000302','ea060626-0000-4000-8000-000000000106','manual','EventMap RLS B source');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true), set_config('request.jwt.claim.role','anon',true), set_config('request.jwt.claims','{"role":"anon"}',true);
DO $anon$
BEGIN
  IF auth.uid() IS NOT NULL OR (SELECT count(*) FROM public.events WHERE id::text LIKE 'ea060626-0000-4000-8000-%') <> 3
    OR EXISTS (SELECT 1 FROM public.events WHERE id::text LIKE 'ea060626-0000-4000-8000-%'
      AND (status<>'published' OR visibility<>'public' OR is_cancelled IS TRUE)) THEN RAISE EXCEPTION 'Anon event visibility failed'; END IF;
  BEGIN PERFORM public.get_my_saved_events(); RAISE EXCEPTION 'Anon RPC read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.set_my_saved_event('ea060626-0000-4000-8000-000000000101',true); RAISE EXCEPTION 'Anon RPC write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- KNOWN SECURITY FAIL: anonymous analytics can reference a nonpublic draft.
  INSERT INTO public.event_analytics (id,event_id,event_type,user_id,session_id) VALUES
    ('ea060626-0000-4000-8000-000000000501','ea060626-0000-4000-8000-000000000109','view',NULL,'ea060626-0000-4000-8000-rls-test');
  IF NOT FOUND THEN RAISE EXCEPTION 'Known analytics baseline changed; review policy'; END IF;
END $anon$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000001',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $plain_user$
BEGIN
  IF auth.uid() IS DISTINCT FROM 'ea060626-0000-4000-8000-000000000001'::uuid OR public.is_admin() THEN RAISE EXCEPTION 'User claims/role failed'; END IF;
  BEGIN UPDATE public.profiles SET role='admin' WHERE id='ea060626-0000-4000-8000-000000000001'; RAISE EXCEPTION 'Self admin escalation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- KNOWN SECURITY FAIL: normal user can create a location via permissive policy.
  INSERT INTO public.locations (id,name) VALUES ('ea060626-0000-4000-8000-000000000601','EventMap RLS location ea060626-0000-4000-8000-000000000601');
  IF NOT FOUND THEN RAISE EXCEPTION 'Known location baseline changed; review policy'; END IF;
END $plain_user$;

SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000003',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000003","role":"authenticated"}',true);
DO $organizer_a$
DECLARE n integer; org_a uuid:=current_setting('eventmap.fixture.org_a')::uuid; org_b uuid:=current_setting('eventmap.fixture.org_b')::uuid;
BEGIN
  IF (SELECT count(*) FROM public.events WHERE id::text LIKE 'ea060626-0000-4000-8000-%') <> 7
    OR (SELECT count(*) FROM public.events WHERE id IN ('ea060626-0000-4000-8000-000000000102','ea060626-0000-4000-8000-000000000103','ea060626-0000-4000-8000-000000000104','ea060626-0000-4000-8000-000000000109')) <> 4
    OR EXISTS (SELECT 1 FROM public.events WHERE id IN ('ea060626-0000-4000-8000-000000000106','ea060626-0000-4000-8000-000000000107','ea060626-0000-4000-8000-000000000108')) THEN RAISE EXCEPTION 'Organizer read isolation failed'; END IF;
  UPDATE public.events SET title='EventMap RLS cross-owner attempt' WHERE id IN ('ea060626-0000-4000-8000-000000000105','ea060626-0000-4000-8000-000000000106');
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Foreign event update allowed'; END IF;
  INSERT INTO public.events (id,title,slug,start_at,status,visibility,created_by,submitted_by_organizer_id) VALUES
    ('ea060626-0000-4000-8000-000000000201','EventMap RLS organizer insert','eventmap-rls-ea060626-0000-4000-8000-000000000201',now()+interval '1 day','pending_review','public','ea060626-0000-4000-8000-000000000003',org_a);
  IF NOT FOUND THEN RAISE EXCEPTION 'Own pending insert failed'; END IF;
  BEGIN INSERT INTO public.events (id,title,slug,start_at,status,visibility,created_by,submitted_by_organizer_id) VALUES
    ('ea060626-0000-4000-8000-000000000202','EventMap RLS foreign submit','eventmap-rls-ea060626-0000-4000-8000-000000000202',now(),'pending_review','public','ea060626-0000-4000-8000-000000000003',org_b);
    RAISE EXCEPTION 'Foreign submitted org accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.events (id,title,slug,start_at,status,visibility,created_by,submitted_by_organizer_id) VALUES
    ('ea060626-0000-4000-8000-000000000203','EventMap RLS foreign creator','eventmap-rls-ea060626-0000-4000-8000-000000000203',now(),'pending_review','public','ea060626-0000-4000-8000-000000000004',org_a);
    RAISE EXCEPTION 'Foreign created_by accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.events SET status='published' WHERE id='ea060626-0000-4000-8000-000000000102'; RAISE EXCEPTION 'Organizer publication allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.events SET status='pending_review' WHERE id='ea060626-0000-4000-8000-000000000110';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Published to pending edit failed'; END IF;
  BEGIN INSERT INTO public.organizer_users (id,user_id,organizer_id,role) VALUES
    ('ea060626-0000-4000-8000-000000000901','ea060626-0000-4000-8000-000000000003',org_b,'owner');
    RAISE EXCEPTION 'Membership forgery allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.event_sources SET source_name='EventMap RLS foreign source attempt' WHERE id='ea060626-0000-4000-8000-000000000302';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Foreign source update allowed'; END IF;
  BEGIN INSERT INTO public.event_sources (id,event_id,source_type) VALUES
    ('ea060626-0000-4000-8000-000000000303','ea060626-0000-4000-8000-000000000106','organizer');
    RAISE EXCEPTION 'Foreign source insert allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- KNOWN FUNCTIONAL FAIL: own organizer settings UPDATE silently affects 0 rows.
  UPDATE public.organizers SET description='EventMap RLS own settings attempt' WHERE id=org_a;
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Known organizer settings baseline changed'; END IF;
  -- KNOWN SECURITY FAIL: organizer can forge fields reserved by the application.
  UPDATE public.events SET is_featured=true,is_verified=true,review_note='EventMap RLS forged note',
    created_by='ea060626-0000-4000-8000-000000000006' WHERE id='ea060626-0000-4000-8000-000000000102';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Known immutable/admin-field baseline changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id='ea060626-0000-4000-8000-000000000102' AND is_featured AND is_verified
    AND created_by='ea060626-0000-4000-8000-000000000006' AND review_note='EventMap RLS forged note') THEN RAISE EXCEPTION 'Known field probe not reproduced'; END IF;
END $organizer_a$;
SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000004',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000004","role":"authenticated"}',true);
DO $organizer_b$
BEGIN
  IF (SELECT count(*) FROM public.events WHERE id::text LIKE 'ea060626-0000-4000-8000-%')<>5
    OR (SELECT count(*) FROM public.events WHERE id IN ('ea060626-0000-4000-8000-000000000106','ea060626-0000-4000-8000-000000000107','ea060626-0000-4000-8000-000000000108'))<>3
    OR EXISTS (SELECT 1 FROM public.events WHERE id IN ('ea060626-0000-4000-8000-000000000102','ea060626-0000-4000-8000-000000000103','ea060626-0000-4000-8000-000000000104','ea060626-0000-4000-8000-000000000109','ea060626-0000-4000-8000-000000000110','ea060626-0000-4000-8000-000000000201')) THEN RAISE EXCEPTION 'Organizer B read isolation failed'; END IF;
END $organizer_b$;
RESET ROLE;

-- Grant second membership ONLY as postgres to this synthetic actor/derived org.
INSERT INTO public.organizer_users (id,user_id,organizer_id,role) VALUES
  ('ea060626-0000-4000-8000-000000000901','ea060626-0000-4000-8000-000000000003',current_setting('eventmap.fixture.org_b')::uuid,'owner');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000003',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000003","role":"authenticated"}',true);
DO $dual_member_gap$
DECLARE n integer;
BEGIN
  -- KNOWN SECURITY FAIL: membership in both organizations permits reassignment.
  UPDATE public.events SET submitted_by_organizer_id=current_setting('eventmap.fixture.org_b')::uuid
    WHERE id='ea060626-0000-4000-8000-000000000201';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Known owner-transfer baseline changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id='ea060626-0000-4000-8000-000000000201'
    AND submitted_by_organizer_id=current_setting('eventmap.fixture.org_b')::uuid) THEN RAISE EXCEPTION 'Known transfer probe not reproduced'; END IF;
END $dual_member_gap$;

SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000006',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000006","role":"authenticated"}',true);
DO $admin$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin() OR (SELECT count(*) FROM public.events WHERE id::text LIKE 'ea060626-0000-4000-8000-%') <> 11 THEN RAISE EXCEPTION 'Admin fixture visibility failed'; END IF;
  UPDATE public.events SET status='published',review_note='EventMap RLS admin approval' WHERE id='ea060626-0000-4000-8000-000000000106';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Admin moderation failed'; END IF;
  INSERT INTO public.event_moderation_logs (id,event_id,reviewed_by,old_status,new_status,note) VALUES
    ('ea060626-0000-4000-8000-000000000401','ea060626-0000-4000-8000-000000000106','ea060626-0000-4000-8000-000000000006','pending_review','published','EventMap RLS admin approval');
  IF (SELECT count(*) FROM public.event_moderation_logs WHERE id='ea060626-0000-4000-8000-000000000401')<>1
    OR (SELECT count(*) FROM public.event_sources WHERE id IN ('ea060626-0000-4000-8000-000000000301','ea060626-0000-4000-8000-000000000302'))<>2 THEN RAISE EXCEPTION 'Admin relation access failed'; END IF;
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 THEN RAISE EXCEPTION 'Admin RPC leaked attendee saves'; END IF;
END $admin$;

SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000001',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $saved_a$
DECLARE invalid_id uuid;
BEGIN
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 THEN RAISE EXCEPTION 'A saw foreign saves'; END IF;
  PERFORM public.set_my_saved_event('ea060626-0000-4000-8000-000000000101',true);
  PERFORM public.set_my_saved_event('ea060626-0000-4000-8000-000000000101',true);
  IF (SELECT count(*) FROM public.get_my_saved_events('ea060626-0000-4000-8000-000000000101'))<>1
    OR (SELECT count(*) FROM public.saved_events WHERE event_id='ea060626-0000-4000-8000-000000000101')<>1 THEN RAISE EXCEPTION 'Idempotent save/count failed'; END IF;
  BEGIN PERFORM user_id FROM public.saved_events WHERE event_id='ea060626-0000-4000-8000-000000000101'; RAISE EXCEPTION 'Attendee identity SELECT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  FOREACH invalid_id IN ARRAY ARRAY['ea060626-0000-4000-8000-000000000102'::uuid,'ea060626-0000-4000-8000-000000000103'::uuid,
    'ea060626-0000-4000-8000-000000000104'::uuid,'ea060626-0000-4000-8000-000000000109'::uuid,'ea060626-0000-4000-8000-000000000199'::uuid]
  LOOP BEGIN PERFORM public.set_my_saved_event(invalid_id,true); RAISE EXCEPTION 'Unavailable event accepted: %',invalid_id; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END LOOP;
END $saved_a$;
SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000005',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000005","role":"authenticated"}',true);
DO $saved_b$
BEGIN
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 THEN RAISE EXCEPTION 'B saw A saves'; END IF;
  PERFORM public.set_my_saved_event('ea060626-0000-4000-8000-000000000101',false);
  PERFORM public.set_my_saved_event('ea060626-0000-4000-8000-000000000101',true);
  IF (SELECT count(*) FROM public.get_my_saved_events())<>1 THEN RAISE EXCEPTION 'B save failed'; END IF;
END $saved_b$;
SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000003',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000003","role":"authenticated"}',true);
DO $saved_organizer$
BEGIN
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 OR (SELECT count(*) FROM public.saved_events WHERE event_id='ea060626-0000-4000-8000-000000000101')<>2 THEN RAISE EXCEPTION 'Organizer RPC isolation/aggregate failed'; END IF;
  BEGIN PERFORM user_id FROM public.saved_events WHERE event_id='ea060626-0000-4000-8000-000000000101'; RAISE EXCEPTION 'Organizer attendee identity SELECT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.set_my_saved_event('ea060626-0000-4000-8000-000000000101',false);
END $saved_organizer$;
SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000006',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000006","role":"authenticated"}',true);
DO $saved_admin$
BEGIN
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 OR (SELECT count(*) FROM public.saved_events WHERE event_id='ea060626-0000-4000-8000-000000000101')<>2 THEN RAISE EXCEPTION 'Admin RPC isolation/aggregate failed with populated saves'; END IF;
END $saved_admin$;
SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000001',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $saved_a_still_exists$ BEGIN IF (SELECT count(*) FROM public.get_my_saved_events())<>1 THEN RAISE EXCEPTION 'Foreign actor removed A save'; END IF; END $saved_a_still_exists$;
RESET ROLE;
UPDATE public.events SET status='archived' WHERE id='ea060626-0000-4000-8000-000000000101';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000001',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $withdrawn_a$
BEGIN
  BEGIN PERFORM public.set_my_saved_event('ea060626-0000-4000-8000-000000000101',true); RAISE EXCEPTION 'Withdrawn save accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.set_my_saved_event('ea060626-0000-4000-8000-000000000101',false);
  PERFORM public.set_my_saved_event('ea060626-0000-4000-8000-000000000101',false);
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 THEN RAISE EXCEPTION 'Withdrawn unsave/idempotence failed'; END IF;
END $withdrawn_a$;
SELECT set_config('request.jwt.claim.sub','ea060626-0000-4000-8000-000000000005',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"sub":"ea060626-0000-4000-8000-000000000005","role":"authenticated"}',true);
DO $withdrawn_b$ BEGIN IF (SELECT count(*) FROM public.get_my_saved_events())<>1 THEN RAISE EXCEPTION 'A removed B save'; END IF; END $withdrawn_b$;
SELECT set_config('request.jwt.claim.sub','',true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims','{"role":"authenticated"}',true);
DO $missing_uid$
BEGIN
  IF auth.uid() IS NOT NULL OR (SELECT count(*) FROM public.get_my_saved_events())<>0 THEN RAISE EXCEPTION 'Missing UID leaked saves'; END IF;
  BEGIN PERFORM public.set_my_saved_event('ea060626-0000-4000-8000-000000000101',false); RAISE EXCEPTION 'Missing UID wrote saves'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $missing_uid$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true), set_config('request.jwt.claim.role','',true), set_config('request.jwt.claims','{}',true);
DO $baseline_gap_rows$
BEGIN
  IF (SELECT count(*) FROM public.event_analytics WHERE id='ea060626-0000-4000-8000-000000000501' AND event_id='ea060626-0000-4000-8000-000000000109' AND user_id IS NULL)<>1
    OR (SELECT count(*) FROM public.locations WHERE id='ea060626-0000-4000-8000-000000000601')<>1 THEN RAISE EXCEPTION 'Known-gap writes not reproduced'; END IF;
END $baseline_gap_rows$;

ROLLBACK TO SAVEPOINT fixtures;
RELEASE SAVEPOINT fixtures;
DO $absence$
DECLARE rel regclass; remains boolean;
BEGIN
  FOREACH rel IN ARRAY ARRAY['auth.users'::regclass,'public.profiles'::regclass,'public.organizers'::regclass,
    'public.organizer_users'::regclass,'public.events'::regclass,'public.event_sources'::regclass,
    'public.locations'::regclass,'public.event_analytics'::regclass,'public.event_moderation_logs'::regclass]
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE id::text LIKE $1)',rel)
      INTO remains USING 'ea060626-0000-4000-8000-%';
    IF remains THEN RAISE EXCEPTION 'Fixture survived savepoint rollback: %',rel; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.organizers WHERE slug IN ('eventmap-rls-a-ea060626-0000-4000-8000-000000000003','eventmap-rls-b-ea060626-0000-4000-8000-000000000004'))
    OR EXISTS (SELECT 1 FROM public.organizer_users WHERE user_id::text LIKE 'ea060626-0000-4000-8000-%')
    OR EXISTS (SELECT 1 FROM public.saved_events WHERE user_id::text LIKE 'ea060626-0000-4000-8000-%' OR event_id::text LIKE 'ea060626-0000-4000-8000-%') THEN RAISE EXCEPTION 'Generated organizer/membership/save fixtures survived rollback'; END IF;
END $absence$;
ROLLBACK;

SELECT jsonb_build_object(
  'report_version','eventmap-rls-transaction-2026-10-06-v1',
  'valid_only_if','entire script completed without SQL error; client stopped on first error',
  'sql_rls_checks','PASS: role whitelist/escalation, anon visibility, single-membership organizer isolation/publication/source, admin access, saved RPC isolation/idempotence/publication/privacy, rollback assertions',
  'known_security_failures',jsonb_build_array('normal user location INSERT allowed','dual-member submitted_by reassignment allowed','organizer admin/immutable fields writable','anon analytics INSERT against draft allowed'),
  'known_functional_failure','organizer own organization UPDATE affects zero rows',
  'not_tested',jsonb_build_array('real JWT/Auth/signup/email','A04 atomic writer and concurrent/fault/retry behavior','city count view'),
  'fixture_absence',jsonb_build_object(
    'auth_users',(SELECT count(*) FROM auth.users WHERE id::text LIKE 'ea060626-0000-4000-8000-%'),
    'events',(SELECT count(*) FROM public.events WHERE id::text LIKE 'ea060626-0000-4000-8000-%'),
    'sources',(SELECT count(*) FROM public.event_sources WHERE id::text LIKE 'ea060626-0000-4000-8000-%' OR event_id::text LIKE 'ea060626-0000-4000-8000-%'),
    'organizers',(SELECT count(*) FROM public.organizers WHERE slug IN ('eventmap-rls-a-ea060626-0000-4000-8000-000000000003','eventmap-rls-b-ea060626-0000-4000-8000-000000000004')),
    'memberships',(SELECT count(*) FROM public.organizer_users WHERE user_id::text LIKE 'ea060626-0000-4000-8000-%'),
    'profiles',(SELECT count(*) FROM public.profiles WHERE id::text LIKE 'ea060626-0000-4000-8000-%'),
    'saves',(SELECT count(*) FROM public.saved_events WHERE user_id::text LIKE 'ea060626-0000-4000-8000-%' OR event_id::text LIKE 'ea060626-0000-4000-8000-%'),
    'locations',(SELECT count(*) FROM public.locations WHERE id::text LIKE 'ea060626-0000-4000-8000-%'),
    'analytics',(SELECT count(*) FROM public.event_analytics WHERE id::text LIKE 'ea060626-0000-4000-8000-%'),
    'moderation_logs',(SELECT count(*) FROM public.event_moderation_logs WHERE id::text LIKE 'ea060626-0000-4000-8000-%')
  )
) AS verification;
