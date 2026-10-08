-- REVIEW-ONLY acceptance tests for organizer-write-hardening-proposal.sql.
-- Prepared 2026-10-08 against the fresh read-only PostgreSQL 17.6 catalog.
-- NOT EXECUTED. No database mutation is authorized by preparation of this file.
-- Run only after separate review/approval and installation in an isolated DB,
-- as postgres in ONE dedicated connection with STOP ON FIRST ERROR. On any
-- unhandled error issue ROLLBACK/close the connection; never resume at a label.
-- No DDL/functions/temp tables, real Auth API/passwords/emails, COMMIT, or writes
-- outside synthetic fixtures. Row failures catch only SQLSTATE 42501; any other
-- error fails the suite. Catalog privilege tests never execute table TRUNCATE.
-- SET LOCAL ROLE + manually set claims test SQL/RLS, not JWT authenticity.
-- A04 multiple HTTP requests, concurrent revocation/edits, retries, SMTP and UI
-- remain separate acceptance work. Multirow tests cover ONE SQL statement.
-- Fixture namespace ea081026-0000-4000-8002-*. Auth's reviewed signup trigger
-- generates three organization/membership IDs; exact user+slug derives them.
-- REQUIRED in a fresh connection: prepend the saved approved installation
-- manifest as SET eventmap.organizer_write_manifest = '<deployment JSON>';
-- do not manufacture the manifest from arbitrary current state. Prior Oct 6
-- location/analytics fingerprints below are the approved release's constants,
-- independently matched to the fresh Oct 8 snapshot; no extra GUC is required.
-- Entire suite stays uncommitted, rolls back fixtures with absence assertions,
-- and ends ROLLBACK. A printed PASS is valid only after all assertions succeed.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
SET LOCAL search_path = pg_catalog, public, extensions;
SELECT set_config('request.jwt.claim.sub','',true),
  set_config('request.jwt.claim.role','',true), set_config('request.jwt.claims','{}',true);
SAVEPOINT organizer_write_fixtures;

DO $guard$
DECLARE rel regclass; collision boolean; signature text; expected_hash text;
  actor name; privilege text; target record; actual_policy record;
  manifest jsonb; actual jsonb;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
     OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
     OR current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'Requires reviewed PostgreSQL 17 postgres connection and normal triggers';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated')
      AND NOT rolsuper AND NOT rolbypassrls) <> 2 THEN
    RAISE EXCEPTION 'Unexpected anon/authenticated role attributes';
  END IF;
  IF nullif(current_setting('eventmap.organizer_write_manifest',true),'') IS NULL THEN
    RAISE EXCEPTION 'Missing saved approved organizer-write installation manifest';
  END IF;
  manifest := current_setting('eventmap.organizer_write_manifest')::jsonb;
SELECT jsonb_build_object(
  'columns', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.table_name,x.ordinal_position) FROM (
    SELECT table_name,column_name,ordinal_position,is_nullable,data_type,udt_schema,udt_name,column_default,
      is_identity,is_generated,generation_expression,numeric_precision,numeric_scale,datetime_precision,
      collation_schema,collation_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('events','organizers','profiles','organizer_users')
  ) x),'[]'::jsonb),
  'relations', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.relation_name) FROM (
    SELECT c.relname AS relation_name,pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS explicit_acl,
      c.relkind::text AS kind,c.relpersistence::text AS persistence,c.relrowsecurity AS rls_enabled,
      c.relforcerowsecurity AS rls_forced,c.relispartition AS is_partition,c.reloptions AS options
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('events','organizers','profiles','organizer_users')
  ) x),'[]'::jsonb),
  'constraints', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.relation_name,x.constraint_name) FROM (
    SELECT n.nspname AS schema_name,c.relname AS relation_name,k.conname AS constraint_name,
      k.contype::text AS kind,k.convalidated AS validated,k.condeferrable AS deferrable,
      k.condeferred AS initially_deferred,k.conislocal AS is_local,k.coninhcount AS inheritance_count,
      k.connoinherit AS no_inherit,rn.nspname AS referenced_schema,rc.relname AS referenced_relation,
      pg_get_constraintdef(k.oid,false) AS definition
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_class rc ON rc.oid=k.confrelid LEFT JOIN pg_namespace rn ON rn.oid=rc.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('events','organizers','profiles','organizer_users')
  ) x),'[]'::jsonb),
  'policies', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname)
    FROM pg_policies p WHERE p.schemaname='public'),'[]'::jsonb),
  'functions', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name,x.arguments) FROM (
    SELECT p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
      md5(pg_get_functiondef(p.oid)) AS definition_md5,pg_get_userbyid(p.proowner) AS owner,
      p.proacl::text AS acl,p.proconfig AS config,l.lanname AS language,
      pg_get_function_result(p.oid) AS result_type,p.prosecdef AS security_definer,
      p.proisstrict AS strict,p.provolatile::text AS volatility,p.prokind::text AS kind,
      p.proparallel::text AS parallel_mode,p.proleakproof AS leakproof
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.proname IN
      ('city_slugify','get_my_saved_events','handle_new_user','is_admin','set_my_saved_event')
  ) x),'[]'::jsonb),
  'roles', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.role_name) FROM (
    SELECT rolname AS role_name,rolsuper AS superuser,rolbypassrls AS bypass_rls,
      rolinherit AS inherit,rolcanlogin AS can_login,rolcreaterole AS create_role,
      rolcreatedb AS create_database,rolreplication AS replication,rolconnlimit AS connection_limit
    FROM pg_roles WHERE rolname IN ('anon','authenticated','authenticator','cli_login_postgres','postgres','service_role')
  ) x),'[]'::jsonb),
  'memberships', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.granted_role,x.member_role) FROM (
    SELECT parent.rolname AS granted_role,member.rolname AS member_role,grantor.rolname AS grantor,
      m.admin_option,m.inherit_option,m.set_option FROM pg_auth_members m
    JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
    JOIN pg_roles grantor ON grantor.oid=m.grantor
  ) x),'[]'::jsonb),
  'column_acl', COALESCE((SELECT jsonb_agg(to_jsonb(x)
      ORDER BY x.relation_name,x.column_name,x.grantee,x.privilege_type) FROM (
    SELECT n.nspname AS schema_name,c.relname AS relation_name,a.attname AS column_name,
      CASE acl.grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee,
      pg_get_userbyid(acl.grantor) AS grantor,acl.privilege_type,acl.is_grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid CROSS JOIN LATERAL aclexplode(a.attacl) acl
    WHERE n.nspname='public' AND c.relname IN ('events','organizers','profiles','organizer_users')
      AND a.attnum>0 AND NOT a.attisdropped
  ) x),'[]'::jsonb),
  'triggers', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.table_name,x.trigger_name) FROM (
    SELECT c.relname AS table_name,t.tgname AS trigger_name,t.oid::text AS oid,
      t.tgtype::integer AS type,t.tgenabled::text AS enabled,t.tgattr::text AS update_columns,
      t.tgnargs::integer AS argument_count,(t.tgqual IS NOT NULL) AS has_when,
      pg_get_triggerdef(t.oid,false) AS definition,
      fn.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS function_identity
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace fn ON fn.oid=p.pronamespace
    WHERE n.nspname='public' AND c.relname IN ('events','organizers') AND NOT t.tgisinternal
  ) x),'[]'::jsonb),
  'guard_functions', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name,x.arguments) FROM (
    SELECT p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,p.oid::text AS oid,
      md5(p.prosrc) AS source_md5,md5(pg_get_functiondef(p.oid)) AS definition_md5,
      pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,p.proconfig AS config,l.lanname AS language,
      pg_get_function_result(p.oid) AS result_type,p.prosecdef AS security_definer,p.proisstrict AS strict,
      p.provolatile::text AS volatility,p.prokind::text AS kind,p.proparallel::text AS parallel_mode,
      p.proleakproof AS leakproof
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.proname IN ('guard_organizer_event_write','guard_organizer_profile_write')
  ) x),'[]'::jsonb),
  'identity', jsonb_build_object('database',current_database(),
    'database_oid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),
    'system_identifier',(SELECT system_identifier::text FROM pg_control_system()),
    'auth_uid_md5',md5(pg_get_functiondef('auth.uid()'::regprocedure)))
) INTO actual;
  IF manifest->>'format' IS DISTINCT FROM 'eventmap-organizer-write-v1'
     OR manifest->>'source_catalog_sha256' IS DISTINCT FROM '6860e45f7d171bcb9681d2c36f51a4bc8413f1bc2d052decd27ca747fd7022a5'
     OR actual IS DISTINCT FROM manifest->'applied' THEN
    RAISE EXCEPTION 'Installed catalog differs from saved approved deployment manifest';
  END IF;
  IF jsonb_typeof(manifest) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid approved installation manifest';
  END IF;
  FOR signature,expected_hash IN SELECT * FROM (VALUES
    ('public.handle_new_user()','26085fa3b667ac7495ade91806ee8035'),
    ('public.is_admin()','f7ab1aa8018aadea0df439f17b4641cf'),
    ('public.get_my_saved_events(uuid)','460f98be908fd43ba79fd5903aef2253'),
    ('public.set_my_saved_event(uuid,boolean)','c918aa2f029d2b047ab8510b57de0564')
  ) f(signature,fingerprint)
  LOOP
    IF md5(pg_get_functiondef(signature::regprocedure)) IS DISTINCT FROM expected_hash THEN
      RAISE EXCEPTION 'Reviewed support function drift: %',signature;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='auth.users'::regclass
      AND NOT tgisinternal) <> 1 OR NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal
        AND tgname='on_auth_user_created' AND tgenabled='O'
        AND tgfoid='public.handle_new_user()'::regprocedure) THEN
    RAISE EXCEPTION 'Auth custom trigger inventory changed';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN
      ('public.events'::regclass,'public.organizers'::regclass)) <> 2
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.events'::regclass
       AND NOT tgisinternal AND tgname='events_guard_organizer_write' AND tgenabled='O'
       AND tgtype=23 AND tgattr=''::int2vector AND tgqual IS NULL
       AND tgfoid='public.guard_organizer_event_write()'::regprocedure)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.organizers'::regclass
       AND NOT tgisinternal AND tgname='organizers_guard_organizer_write' AND tgenabled='O'
       AND tgtype=19 AND tgattr=''::int2vector AND tgqual IS NULL
       AND tgfoid='public.guard_organizer_profile_write()'::regprocedure) THEN
    RAISE EXCEPTION 'Expected exactly reviewed unconditional BEFORE row guards';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN
      ('public.profiles'::regclass,'public.organizer_users'::regclass,
       'public.locations'::regclass,'public.event_analytics'::regclass,
       'public.event_sources'::regclass,'public.event_moderation_logs'::regclass,
       'public.notifications'::regclass,'public.saved_events'::regclass,'public.categories'::regclass)) THEN
    RAISE EXCEPTION 'Unexpected fixture-table custom trigger; review side effects';
  END IF;
  FOREACH rel IN ARRAY ARRAY['public.profiles'::regclass,'public.organizers'::regclass,
    'public.organizer_users'::regclass,'public.events'::regclass,'public.locations'::regclass,
    'public.event_analytics'::regclass,'public.event_sources'::regclass,
    'public.event_moderation_logs'::regclass,'public.notifications'::regclass,
    'public.saved_events'::regclass]
  LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=rel) THEN
      RAISE EXCEPTION 'RLS disabled: %',rel;
    END IF;
  END LOOP;
  FOR signature IN SELECT unnest(ARRAY['public.guard_organizer_event_write()',
    'public.guard_organizer_profile_write()'])
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=signature::regprocedure
        AND NOT prosecdef AND prorettype='trigger'::regtype
        AND proconfig=ARRAY['search_path=pg_catalog']
        AND md5(prosrc)=CASE signature
          WHEN 'public.guard_organizer_event_write()' THEN 'e739491ae6b54a2b294e232e5602080f'
          WHEN 'public.guard_organizer_profile_write()' THEN 'b5e3e36284a89ee0fdc5336d566ae825' END) THEN
      RAISE EXCEPTION 'Unexpected guard security mode/result/search_path: %',signature;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
        aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        WHERE p.oid=signature::regprocedure AND a.grantee=0
          AND a.privilege_type='EXECUTE') THEN
      RAISE EXCEPTION 'PUBLIC can execute trigger guard: %',signature;
    END IF;
    FOREACH actor IN ARRAY ARRAY['anon'::name,'authenticated'::name,'service_role'::name]
    LOOP
      IF has_function_privilege(actor,signature,'EXECUTE') THEN
        RAISE EXCEPTION '% can execute trigger guard: %',actor,signature;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH actor IN ARRAY ARRAY['anon'::name,'authenticated'::name]
  LOOP
    FOREACH rel IN ARRAY ARRAY['public.events'::regclass,'public.organizers'::regclass]
    LOOP
      IF has_table_privilege(actor,rel,'TRUNCATE') OR has_table_privilege(actor,rel,'TRIGGER') THEN
        RAISE EXCEPTION 'Unnecessary table privileges remain for % on %',actor,rel;
      END IF;
      FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','REFERENCES']
      LOOP
        IF NOT has_table_privilege(actor,rel,privilege) THEN
          RAISE EXCEPTION 'Reviewed existing table grant lost: % % %',actor,rel,privilege;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  FOR target IN SELECT * FROM (VALUES
    ('locations','locations_insert_admin_or_organizer','authenticated','1202023c9dba1de2e86717b71308d779'),
    ('event_analytics','Anyone can insert event analytics','public','596ae3defb45b1a1eebee3fdb0928853')
  ) p(table_name,policy_name,policy_role,approved_check_md5)
  LOOP
    IF (SELECT count(*) FROM pg_policy WHERE
        polrelid=format('public.%I',target.table_name)::regclass AND polcmd IN ('a','*'))<>1 THEN
      RAISE EXCEPTION 'Expected exactly one reviewed INSERT policy on %',target.table_name;
    END IF;
    SELECT p.* INTO STRICT actual_policy FROM pg_policies p WHERE p.schemaname='public'
      AND p.tablename=target.table_name AND p.policyname=target.policy_name;
    IF actual_policy.cmd<>'INSERT' OR actual_policy.permissive<>'PERMISSIVE'
       OR actual_policy.qual IS NOT NULL OR actual_policy.roles IS DISTINCT FROM
         ARRAY[target.policy_role]::name[] OR md5(actual_policy.with_check) IS DISTINCT FROM target.approved_check_md5 THEN
      RAISE EXCEPTION 'Prior approved location/analytics policy drift: %',target.policy_name;
    END IF;
  END LOOP;
  -- Before Auth trigger upserts, cover IDs, deterministic generated slugs and
  -- every relationship namespace, including notifications with generated IDs.
  FOREACH rel IN ARRAY ARRAY['auth.users'::regclass,'public.profiles'::regclass,
    'public.organizers'::regclass,'public.organizer_users'::regclass,'public.events'::regclass,
    'public.locations'::regclass,'public.event_analytics'::regclass,'public.event_sources'::regclass,
    'public.event_moderation_logs'::regclass,'public.notifications'::regclass,'public.categories'::regclass]
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE id::text LIKE $1)',rel)
      INTO collision USING 'ea081026-0000-4000-8002-%';
    IF collision THEN RAISE EXCEPTION 'Fixture namespace collision: %',rel; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.organizers WHERE slug LIKE 'eventmap-ow-org-ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.categories WHERE slug LIKE 'eventmap-ow-category-ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.events WHERE slug LIKE 'eventmap-ow-event-ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.organizer_users WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.saved_events WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%'
       OR event_id::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.event_sources WHERE event_id::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.event_moderation_logs WHERE event_id::text LIKE 'ea081026-0000-4000-8002-%'
       OR reviewed_by::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.notifications WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%'
       OR related_event_id::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.event_analytics WHERE event_id::text LIKE 'ea081026-0000-4000-8002-%'
       OR user_id::text LIKE 'ea081026-0000-4000-8002-%') THEN
    RAISE EXCEPTION 'Fixture slug/relationship collision';
  END IF;
END $guard$;

INSERT INTO auth.users (id,raw_user_meta_data) VALUES
('ea081026-0000-4000-8002-000000000001','{"role":"organizer","organizer_name":"EventMap OW org ea081026-0000-4000-8002-000000000001"}'),
('ea081026-0000-4000-8002-000000000002','{"role":"organizer","organizer_name":"EventMap OW org ea081026-0000-4000-8002-000000000002"}'),
('ea081026-0000-4000-8002-000000000003','{"role":"admin","display_name":"EventMap OW metadata admin"}'),
('ea081026-0000-4000-8002-000000000004','{"role":"user","display_name":"EventMap OW user with membership"}'),
('ea081026-0000-4000-8002-000000000005','{"role":"user","display_name":"EventMap OW no-member organizer"}'),
('ea081026-0000-4000-8002-000000000006','{"role":"user","display_name":"EventMap OW attendee A"}'),
('ea081026-0000-4000-8002-000000000007','{"role":"user","display_name":"EventMap OW attendee B"}'),
('ea081026-0000-4000-8002-000000000008','{"role":"service_role","display_name":"EventMap OW metadata service"}'),
('ea081026-0000-4000-8002-000000000009','{"role":"organizer","organizer_name":"EventMap OW org ea081026-0000-4000-8002-000000000009"}');
DO $registration$
DECLARE actor_id uuid; org_id uuid; label text;
BEGIN
  IF (SELECT count(*) FROM public.profiles WHERE id::text LIKE 'ea081026-0000-4000-8002-%')<>9
     OR (SELECT count(*) FROM public.profiles WHERE id::text LIKE 'ea081026-0000-4000-8002-%' AND role='organizer')<>3
     OR (SELECT count(*) FROM public.profiles WHERE id IN
       ('ea081026-0000-4000-8002-000000000003','ea081026-0000-4000-8002-000000000008') AND role='user')<>2
     OR (SELECT count(*) FROM public.organizer_users WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%')<>3 THEN
    RAISE EXCEPTION 'Auth role whitelist/registration fixture failed';
  END IF;
  FOR actor_id,label IN SELECT * FROM (VALUES
    ('ea081026-0000-4000-8002-000000000001'::uuid,'a'),
    ('ea081026-0000-4000-8002-000000000002'::uuid,'b'),
    ('ea081026-0000-4000-8002-000000000009'::uuid,'c')) a(id,label)
  LOOP
    SELECT o.id INTO STRICT org_id FROM public.organizers o JOIN public.organizer_users ou
      ON ou.organizer_id=o.id WHERE ou.user_id=actor_id AND ou.role='owner'
      AND o.slug='eventmap-ow-org-'||actor_id::text AND o.is_verified=false;
    PERFORM set_config('eventmap.ow.org_'||label,org_id::text,true);
  END LOOP;
END $registration$;
-- Only postgres alters exact synthetic actors; never modify actual users.
UPDATE public.profiles SET role='organizer' WHERE id='ea081026-0000-4000-8002-000000000005';
INSERT INTO public.organizer_users (id,user_id,organizer_id,role) VALUES
 ('ea081026-0000-4000-8002-000000000901','ea081026-0000-4000-8002-000000000004',current_setting('eventmap.ow.org_a')::uuid,'member');
INSERT INTO public.categories (id,name,slug) VALUES
 ('ea081026-0000-4000-8002-000000000601','EventMap OW category','eventmap-ow-category-ea081026-0000-4000-8002-000000000601');
INSERT INTO public.locations (id,name) VALUES
 ('ea081026-0000-4000-8002-000000000701','EventMap OW content fixture location');

INSERT INTO public.events
 (id,title,slug,start_at,status,visibility,is_cancelled,organizer_id,submitted_by_organizer_id,created_by,
  published_at,created_at,updated_at,is_featured,is_verified,review_note,confidence_score,source_quality_score,timezone)
SELECT ('ea081026-0000-4000-8002-'||suffix)::uuid,'EventMap OW '||suffix,
 'eventmap-ow-event-ea081026-0000-4000-8002-'||suffix,now()+interval '1 day',status,visibility,cancelled,
 CASE WHEN suffix='000000000111' THEN NULL WHEN suffix='000000000112' THEN current_setting('eventmap.ow.org_b')::uuid
   ELSE current_setting('eventmap.ow.org_a')::uuid END,
 CASE WHEN suffix='000000000102' THEN current_setting('eventmap.ow.org_b')::uuid
   WHEN suffix='000000000116' THEN NULL ELSE current_setting('eventmap.ow.org_a')::uuid END,
 'ea081026-0000-4000-8002-000000000001'::uuid,
 CASE WHEN status='published' THEN '2025-03-01 10:00:00+01'::timestamptz ELSE NULL END,
 CASE WHEN suffix='000000000109' THEN NULL ELSE '2025-01-01 10:00:00+01'::timestamptz END,
 '2025-01-01 10:00:00+01'::timestamptz,
 CASE WHEN suffix='000000000109' THEN NULL ELSE false END,
 CASE WHEN suffix='000000000109' THEN NULL ELSE false END,NULL,NULL,NULL,
 CASE WHEN suffix='000000000109' THEN NULL ELSE 'Europe/Warsaw' END
FROM (VALUES
 ('000000000101','pending_review','public',false),('000000000102','pending_review','private',false),
 ('000000000103','published','public',false),('000000000104','published','public',false),
 ('000000000105','published','public',false),('000000000106','rejected','public',false),
 ('000000000107','rejected','public',true),('000000000108','archived','public',true),
 ('000000000109',NULL,'public',NULL),('000000000110','fixture_legacy','public',false),
 ('000000000111','pending_review','public',false),('000000000112','pending_review','public',false),
 ('000000000113','draft','public',false),('000000000114','published','private',false),
 ('000000000115','published','public',true),('000000000116','published','public',false),
 ('000000000117','published','public',NULL),('000000000118','pending_review','public',false),
 ('000000000119','pending_review','public',false),('000000000120','rejected','public',false),
 ('000000000121','pending_review',NULL,false),('000000000122','rejected','public',NULL),('000000000123',NULL,'public',NULL)
) f(suffix,status,visibility,cancelled);
UPDATE public.events SET created_by=NULL WHERE id='ea081026-0000-4000-8002-000000000109';
UPDATE public.events SET created_by='ea081026-0000-4000-8002-000000000002',review_note='historical moderation',
 confidence_score=0.5,source_quality_score=0.6,is_featured=true,is_verified=true,
 published_at='2024-01-01 12:00:00+01' WHERE id='ea081026-0000-4000-8002-000000000118';
INSERT INTO public.event_sources (id,event_id,source_type,source_name) VALUES
 ('ea081026-0000-4000-8002-000000000301','ea081026-0000-4000-8002-000000000101','organizer','EventMap OW A source'),
 ('ea081026-0000-4000-8002-000000000302','ea081026-0000-4000-8002-000000000102','organizer','EventMap OW B source');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000001',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000001","role":"authenticated"}',true);
DO $single_member$
DECLARE n integer; before_row jsonb; before_source jsonb; probe record; assigned_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM 'ea081026-0000-4000-8002-000000000001'::uuid OR public.is_admin()
     OR (SELECT count(*) FROM public.organizer_users WHERE user_id=auth.uid())<>1 THEN
    RAISE EXCEPTION 'Single organizer role/UID/membership fixture failed';
  END IF;
  SELECT to_jsonb(e) INTO STRICT before_row FROM public.events e WHERE id='ea081026-0000-4000-8002-000000000101';
  SELECT to_jsonb(s) INTO STRICT before_source FROM public.event_sources s WHERE id='ea081026-0000-4000-8002-000000000301';
  FOR probe IN SELECT * FROM (VALUES
    ('submitted_by_organizer_id','current_setting(''eventmap.ow.org_b'')::uuid'),
    ('submitted_by_organizer_id','NULL::uuid'),
    ('created_by','''ea081026-0000-4000-8002-000000000002''::uuid')) p(column_name,expression)
  LOOP
    BEGIN
      EXECUTE format('UPDATE public.events SET %I=%s WHERE id=$1',probe.column_name,probe.expression)
        USING 'ea081026-0000-4000-8002-000000000101'::uuid;
      RAISE EXCEPTION 'Single-member forbidden field accepted: %',probe.column_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    IF (SELECT to_jsonb(e) FROM public.events e WHERE id='ea081026-0000-4000-8002-000000000101') IS DISTINCT FROM before_row
       OR (SELECT to_jsonb(s) FROM public.event_sources s WHERE id='ea081026-0000-4000-8002-000000000301') IS DISTINCT FROM before_source THEN
      RAISE EXCEPTION 'Denied single-member write changed event/source';
    END IF;
  END LOOP;
  UPDATE public.events SET title='EventMap OW forbidden foreign edit' WHERE id='ea081026-0000-4000-8002-000000000102';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Foreign OLD-owner row was writable'; END IF;
  UPDATE public.events SET submitted_by_organizer_id=current_setting('eventmap.ow.org_a')::uuid
    WHERE id='ea081026-0000-4000-8002-000000000116';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'NULL OLD owner could be claimed'; END IF;
  UPDATE public.events SET title='EventMap OW single-member ordinary edit',updated_at='1900-01-01'
    WHERE id='ea081026-0000-4000-8002-000000000101' RETURNING id INTO assigned_id;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR assigned_id IS DISTINCT FROM 'ea081026-0000-4000-8002-000000000101'::uuid
     OR NOT EXISTS (SELECT 1 FROM public.events WHERE id=assigned_id AND updated_at=transaction_timestamp()
       AND submitted_by_organizer_id=current_setting('eventmap.ow.org_a')::uuid AND status='pending_review') THEN
    RAISE EXCEPTION 'Own ordinary edit/returned id/database timestamp failed';
  END IF;
  UPDATE public.event_sources SET source_name='EventMap OW foreign source attempt' WHERE id='ea081026-0000-4000-8002-000000000302';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Foreign source UPDATE allowed'; END IF;
  BEGIN
    INSERT INTO public.event_sources (id,event_id,source_type) VALUES
      ('ea081026-0000-4000-8002-000000000303','ea081026-0000-4000-8002-000000000102','organizer');
    RAISE EXCEPTION 'Foreign source INSERT allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.organizer_users (id,user_id,organizer_id,role) VALUES
      ('ea081026-0000-4000-8002-000000000902',auth.uid(),current_setting('eventmap.ow.org_b')::uuid,'owner');
    RAISE EXCEPTION 'Membership forgery allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $single_member$;

-- Every INSERT probe supplies the correct base row plus one forbidden value.
-- Duplicate base columns are avoided by removing them from the generated list.
DO $insert_contract$
DECLARE probe record; fields text[]; values_sql text[]; i integer; test_id uuid;
  base_fields text[]:=ARRAY['id','title','slug','start_at','status','visibility','is_cancelled','created_by','submitted_by_organizer_id'];
  base_values text[]; inserted public.events%ROWTYPE; n integer;
BEGIN
  FOR probe IN SELECT * FROM (VALUES
    ('is_featured','true'),('is_featured','NULL::boolean'),
    ('is_verified','true'),('is_verified','NULL::boolean'),
    ('review_note','''forged moderation'''),('confidence_score','0.7'),('source_quality_score','0.8'),
    ('created_by','''ea081026-0000-4000-8002-000000000002''::uuid'),('created_by','NULL::uuid'),
    ('submitted_by_organizer_id','current_setting(''eventmap.ow.org_b'')::uuid'),('submitted_by_organizer_id','NULL::uuid'),
    ('status','''published'''),('status','''rejected'''),('status','''draft'''),('status','''archived'''),('status','NULL::text'),
    ('visibility','''private'''),('visibility','NULL::text'),
    ('is_cancelled','true'),('is_cancelled','NULL::boolean'),
    ('timezone','''UTC'''),('timezone','NULL::text')) p(column_name,expression)
  LOOP
    test_id := 'ea081026-0000-4000-8002-000000000299';
    fields:=ARRAY[]::text[]; values_sql:=ARRAY[]::text[];
    base_values:=ARRAY[quote_literal(test_id),'''EventMap OW forbidden insert''',
      quote_literal('eventmap-ow-event-'||test_id::text),'transaction_timestamp()+interval ''1 day''',
      '''pending_review''','''public''','false','auth.uid()','current_setting(''eventmap.ow.org_a'')::uuid'];
    FOR i IN 1..array_length(base_fields,1) LOOP
      IF base_fields[i]<>probe.column_name THEN
        fields:=array_append(fields,quote_ident(base_fields[i])); values_sql:=array_append(values_sql,base_values[i]);
      END IF;
    END LOOP;
    fields:=array_append(fields,quote_ident(probe.column_name)); values_sql:=array_append(values_sql,probe.expression);
    BEGIN
      EXECUTE 'INSERT INTO public.events ('||array_to_string(fields,',')||') VALUES ('||array_to_string(values_sql,',')||')';
      RAISE EXCEPTION 'Organizer INSERT accepted protected %=%',probe.column_name,probe.expression;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    IF EXISTS (SELECT 1 FROM public.events WHERE id=test_id) THEN RAISE EXCEPTION 'Rejected INSERT left fixture'; END IF;
  END LOOP;
  -- Default published_at, explicit false history, and duplicate mixed attribution
  -- all normalize at INSERT; flags and moderation values remain their defaults.
  INSERT INTO public.events (id,title,slug,start_at,status,visibility,created_by,submitted_by_organizer_id)
  VALUES ('ea081026-0000-4000-8002-000000000201','EventMap OW new default event',
    'eventmap-ow-event-ea081026-0000-4000-8002-000000000201',now()+interval '1 day',
    'pending_review','public',auth.uid(),current_setting('eventmap.ow.org_a')::uuid) RETURNING * INTO inserted;
  IF inserted.status IS DISTINCT FROM 'pending_review' OR inserted.visibility IS DISTINCT FROM 'public'
     OR inserted.is_cancelled IS DISTINCT FROM false OR inserted.is_featured IS DISTINCT FROM false
     OR inserted.is_verified IS DISTINCT FROM false OR inserted.review_note IS NOT NULL
     OR inserted.confidence_score IS NOT NULL OR inserted.source_quality_score IS NOT NULL
     OR inserted.published_at IS NOT NULL OR inserted.created_at IS DISTINCT FROM transaction_timestamp()
     OR inserted.updated_at IS DISTINCT FROM transaction_timestamp() OR inserted.timezone IS DISTINCT FROM 'Europe/Warsaw' THEN
    RAISE EXCEPTION 'New event contract/default database dates failed';
  END IF;
  INSERT INTO public.events (id,title,slug,start_at,status,visibility,is_cancelled,created_by,
    submitted_by_organizer_id,created_at,updated_at,published_at,organizer_id)
  SELECT 'ea081026-0000-4000-8002-000000000202','EventMap OW mixed-attribution duplicate',
    'eventmap-ow-event-ea081026-0000-4000-8002-000000000202',start_at,'pending_review','public',false,
    auth.uid(),submitted_by_organizer_id,'1900-01-01','2099-01-01','2020-01-01',organizer_id
  FROM public.events WHERE id='ea081026-0000-4000-8002-000000000112' RETURNING * INTO inserted;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR inserted.organizer_id IS DISTINCT FROM current_setting('eventmap.ow.org_b')::uuid
     OR inserted.submitted_by_organizer_id IS DISTINCT FROM current_setting('eventmap.ow.org_a')::uuid
     OR inserted.status IS DISTINCT FROM 'pending_review' OR inserted.visibility IS DISTINCT FROM 'public'
     OR inserted.is_cancelled IS DISTINCT FROM false OR inserted.is_featured IS DISTINCT FROM false
     OR inserted.is_verified IS DISTINCT FROM false OR inserted.review_note IS NOT NULL
     OR inserted.confidence_score IS NOT NULL OR inserted.source_quality_score IS NOT NULL
     OR inserted.published_at IS NOT NULL OR inserted.created_at IS DISTINCT FROM transaction_timestamp()
     OR inserted.updated_at IS DISTINCT FROM transaction_timestamp() THEN
    RAISE EXCEPTION 'Duplicate attribution/default flags/history normalization failed';
  END IF;
  -- One denied row must also roll back another otherwise-valid INSERT row.
  BEGIN
    INSERT INTO public.events (id,title,slug,start_at,status,visibility,created_by,submitted_by_organizer_id,is_verified)
    VALUES ('ea081026-0000-4000-8002-000000000205','EventMap OW atomic insert valid',
      'eventmap-ow-event-ea081026-0000-4000-8002-000000000205',now(),'pending_review','public',auth.uid(),current_setting('eventmap.ow.org_a')::uuid,false),
      ('ea081026-0000-4000-8002-000000000206','EventMap OW atomic insert invalid',
      'eventmap-ow-event-ea081026-0000-4000-8002-000000000206',now(),'pending_review','public',auth.uid(),current_setting('eventmap.ow.org_a')::uuid,true);
    RAISE EXCEPTION 'Mixed permitted/forbidden multirow INSERT accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.events WHERE id IN
      ('ea081026-0000-4000-8002-000000000205','ea081026-0000-4000-8002-000000000206')) THEN
    RAISE EXCEPTION 'Multirow INSERT partially persisted';
  END IF;
END $insert_contract$;

DO $protected_update$
DECLARE probe record; before_row jsonb; event_id uuid; n integer;
BEGIN
  -- All eleven protected columns, each independently. Non-NULL fixture values
  -- also test value->NULL, and historical NULL fixture tests NULL->value below.
  FOR probe IN SELECT * FROM (VALUES
    ('id','''ea081026-0000-4000-8002-000000000298''::uuid'),
    ('created_at','''1900-01-01''::timestamptz'),('created_at','NULL::timestamptz'),
    ('created_by','''ea081026-0000-4000-8002-000000000001''::uuid'),('created_by','NULL::uuid'),
    ('submitted_by_organizer_id','current_setting(''eventmap.ow.org_b'')::uuid'),('submitted_by_organizer_id','NULL::uuid'),
    ('is_featured','false'),('is_featured','NULL::boolean'),('is_verified','false'),('is_verified','NULL::boolean'),
    ('review_note','''changed moderation'''),('review_note','NULL::text'),
    ('confidence_score','0.9'),('confidence_score','NULL::numeric'),
    ('source_quality_score','0.9'),('source_quality_score','NULL::numeric'),
    ('timezone','''UTC'''),('timezone','NULL::text'),
    ('published_at','''2099-01-01''::timestamptz'),('published_at','NULL::timestamptz')) p(column_name,expression)
  LOOP
    event_id:='ea081026-0000-4000-8002-000000000118';
    SELECT to_jsonb(e) INTO STRICT before_row FROM public.events e WHERE id=event_id;
    BEGIN
      EXECUTE format('UPDATE public.events SET %I=%s WHERE id=$1',probe.column_name,probe.expression) USING event_id;
      RAISE EXCEPTION 'Protected UPDATE accepted: %=%',probe.column_name,probe.expression;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF (SELECT to_jsonb(e) FROM public.events e WHERE id=event_id) IS DISTINCT FROM before_row THEN
      RAISE EXCEPTION 'Denied protected UPDATE changed full row: %',probe.column_name;
    END IF;
  END LOOP;
  FOR probe IN SELECT * FROM (VALUES
    ('created_at','''1900-01-01''::timestamptz'),('created_by','auth.uid()'),
    ('is_featured','false'),('is_verified','true'),('review_note','''forged note'''),
    ('confidence_score','0.8'),('source_quality_score','0.8'),('timezone','''Europe/Warsaw'''),
    ('published_at','''2020-01-01''::timestamptz')) p(column_name,expression)
  LOOP
    event_id:='ea081026-0000-4000-8002-000000000109';
    SELECT to_jsonb(e) INTO STRICT before_row FROM public.events e WHERE id=event_id;
    BEGIN
      EXECUTE format('UPDATE public.events SET %I=%s WHERE id=$1',probe.column_name,probe.expression) USING event_id;
      RAISE EXCEPTION 'NULL protected field became writable: %',probe.column_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF (SELECT to_jsonb(e) FROM public.events e WHERE id=event_id) IS DISTINCT FROM before_row THEN
      RAISE EXCEPTION 'Denied NULL protected UPDATE changed full row: %',probe.column_name;
    END IF;
  END LOOP;
  FOR probe IN SELECT * FROM (VALUES
    ('is_featured','NULL::boolean'),('is_verified','NULL::boolean'),
    ('is_featured','true'),('is_verified','true')) p(column_name,expression)
  LOOP
    SELECT to_jsonb(e) INTO STRICT before_row FROM public.events e WHERE id='ea081026-0000-4000-8002-000000000101';
    BEGIN
      EXECUTE format('UPDATE public.events SET %I=%s WHERE id=$1',probe.column_name,probe.expression)
        USING 'ea081026-0000-4000-8002-000000000101'::uuid;
      RAISE EXCEPTION 'False protected flag changed: %=%',probe.column_name,probe.expression;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF (SELECT to_jsonb(e) FROM public.events e WHERE id='ea081026-0000-4000-8002-000000000101') IS DISTINCT FROM before_row THEN
      RAISE EXCEPTION 'Denied false flag UPDATE changed row';
    END IF;
  END LOOP;
  UPDATE public.events SET id=id,created_at=created_at,created_by=created_by,
    submitted_by_organizer_id=submitted_by_organizer_id,is_featured=is_featured,is_verified=is_verified,
    review_note=review_note,confidence_score=confidence_score,source_quality_score=source_quality_score,
    timezone=timezone,published_at=published_at,title='EventMap OW preserved admin history',updated_at=NULL
    WHERE id='ea081026-0000-4000-8002-000000000118';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR NOT EXISTS (SELECT 1 FROM public.events WHERE id='ea081026-0000-4000-8002-000000000118'
      AND created_by='ea081026-0000-4000-8002-000000000002' AND is_featured AND is_verified
      AND review_note='historical moderation' AND confidence_score=0.5 AND source_quality_score=0.6
      AND published_at='2024-01-01 12:00:00+01' AND updated_at=transaction_timestamp()) THEN
    RAISE EXCEPTION 'Unchanged protected values/resubmission/database updated_at failed';
  END IF;
END $protected_update$;

DO $workflow$
DECLARE n integer; before_row jsonb; probe record; result public.events%ROWTYPE;
BEGIN
  -- Exercise all fourteen content columns in a genuine edit of published data.
  UPDATE public.events SET title='EventMap OW edited published',
    slug='eventmap-ow-event-ea081026-0000-4000-8002-000000000104-edited',description='Synthetic description',
    short_description='Synthetic summary',start_at='2030-01-01 10:00:00+01',end_at='2030-01-01 12:00:00+01',
    is_all_day=true,category_id='ea081026-0000-4000-8002-000000000601',
    location_id='ea081026-0000-4000-8002-000000000701',price_type='paid',price_min=10,price_max=20,
    currency='PLN',main_image_url='https://example.invalid/eventmap-ow.png',status='pending_review',updated_at='1900-01-01'
    WHERE id='ea081026-0000-4000-8002-000000000104' RETURNING * INTO result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR result.status IS DISTINCT FROM 'pending_review' OR result.title IS DISTINCT FROM 'EventMap OW edited published'
     OR result.slug IS DISTINCT FROM 'eventmap-ow-event-ea081026-0000-4000-8002-000000000104-edited'
     OR result.description IS DISTINCT FROM 'Synthetic description' OR result.short_description IS DISTINCT FROM 'Synthetic summary'
     OR result.start_at IS DISTINCT FROM '2030-01-01 10:00:00+01'::timestamptz
     OR result.end_at IS DISTINCT FROM '2030-01-01 12:00:00+01'::timestamptz OR result.is_all_day IS DISTINCT FROM true
     OR result.category_id IS DISTINCT FROM 'ea081026-0000-4000-8002-000000000601'::uuid
     OR result.location_id IS DISTINCT FROM 'ea081026-0000-4000-8002-000000000701'::uuid
     OR result.price_type IS DISTINCT FROM 'paid' OR result.price_min IS DISTINCT FROM 10
     OR result.price_max IS DISTINCT FROM 20 OR result.currency IS DISTINCT FROM 'PLN'
     OR result.main_image_url IS DISTINCT FROM 'https://example.invalid/eventmap-ow.png'
     OR result.published_at IS DISTINCT FROM '2025-03-01 10:00:00+01'::timestamptz
     OR result.updated_at IS DISTINCT FROM transaction_timestamp() OR result.is_cancelled IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Published content allowlist/pending transition/publication history failed';
  END IF;
  SELECT to_jsonb(e) INTO STRICT before_row FROM public.events e WHERE id='ea081026-0000-4000-8002-000000000105';
  UPDATE public.events SET visibility='private',updated_at='1900-01-01'
    WHERE id='ea081026-0000-4000-8002-000000000105';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR (SELECT to_jsonb(e)-ARRAY['visibility','updated_at'] FROM public.events e
       WHERE id='ea081026-0000-4000-8002-000000000105') IS DISTINCT FROM before_row-ARRAY['visibility','updated_at']
     OR NOT EXISTS (SELECT 1 FROM public.events WHERE id='ea081026-0000-4000-8002-000000000105'
       AND visibility='private' AND status='published' AND updated_at=transaction_timestamp()) THEN
    RAISE EXCEPTION 'Published hide changed content/state/history';
  END IF;
  UPDATE public.events SET visibility='private' WHERE id='ea081026-0000-4000-8002-000000000105';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Repeated published hide failed'; END IF;
  FOR probe IN SELECT * FROM (VALUES
    ('000000000103','title=''EventMap OW no moderation'''),
    ('000000000103','visibility=''private'',title=''EventMap OW hide plus content'''),
    ('000000000103','visibility=''private'',organizer_id=current_setting(''eventmap.ow.org_c'')::uuid'),
    ('000000000103','status=''published'''),
    ('000000000103','status=''pending_review'',is_cancelled=true'),
    ('000000000105','visibility=''public'''),
    ('000000000105','title=''EventMap OW private published edit without pending'''),
    ('000000000107','status=''pending_review'''),
    ('000000000108','is_cancelled=false'),('000000000108','is_cancelled=NULL'),
    ('000000000108','status=''pending_review'''),('000000000113','status=''pending_review'''),
    ('000000000121','visibility=''public'''),('000000000110','status=''another_legacy'''),
    ('000000000101','status=''published'''),('000000000101','status=''rejected'''),
    ('000000000101','status=''draft'''),('000000000101','status=''archived'''),
    ('000000000101','status=''fixture_legacy'''),('000000000101','status=NULL'),
    ('000000000101','visibility=NULL'),('000000000101','is_cancelled=NULL'),
    ('000000000101','status=''archived'',is_cancelled=true,visibility=''private'''),
    ('000000000101','status=''archived'',is_cancelled=true,title=''EventMap OW cancel plus content''')
  ) p(suffix,assignments)
  LOOP
    SELECT to_jsonb(e) INTO STRICT before_row FROM public.events e
      WHERE id=('ea081026-0000-4000-8002-'||probe.suffix)::uuid;
    BEGIN
      EXECUTE 'UPDATE public.events SET '||probe.assignments||' WHERE id=$1'
        USING ('ea081026-0000-4000-8002-'||probe.suffix)::uuid;
      RAISE EXCEPTION 'Forbidden workflow accepted: % %',probe.suffix,probe.assignments;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF (SELECT to_jsonb(e) FROM public.events e WHERE id=('ea081026-0000-4000-8002-'||probe.suffix)::uuid)
       IS DISTINCT FROM before_row THEN RAISE EXCEPTION 'Denied workflow changed row'; END IF;
  END LOOP;
  UPDATE public.events SET status='pending_review' WHERE id IN
    ('ea081026-0000-4000-8002-000000000106','ea081026-0000-4000-8002-000000000122');
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>2 OR (SELECT count(*) FROM public.events WHERE id IN
      ('ea081026-0000-4000-8002-000000000106','ea081026-0000-4000-8002-000000000122')
      AND status='pending_review' AND is_cancelled IS NOT TRUE)<>2 THEN
    RAISE EXCEPTION 'Rejected false/NULL cancellation resubmit failed';
  END IF;
  UPDATE public.events SET title='EventMap OW preserving NULL status edit'
    WHERE id='ea081026-0000-4000-8002-000000000109' RETURNING * INTO result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR result.status IS NOT NULL OR result.is_cancelled IS NOT NULL THEN RAISE EXCEPTION 'Unchanged NULL historical state edit failed'; END IF;
  UPDATE public.events SET title='EventMap OW historical NULL edit',status='pending_review'
    WHERE id='ea081026-0000-4000-8002-000000000109' RETURNING * INTO result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR result.status IS DISTINCT FROM 'pending_review' OR result.is_cancelled IS NOT NULL
     OR result.created_at IS NOT NULL OR result.created_by IS NOT NULL OR result.is_featured IS NOT NULL
     OR result.is_verified IS NOT NULL OR result.timezone IS NOT NULL OR result.published_at IS NOT NULL
     OR result.review_note IS NOT NULL OR result.confidence_score IS NOT NULL OR result.source_quality_score IS NOT NULL THEN
    RAISE EXCEPTION 'Historical NULL status/fields/cancellation preservation failed';
  END IF;
  UPDATE public.events SET title='EventMap OW legacy edit' WHERE id='ea081026-0000-4000-8002-000000000110' RETURNING * INTO result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR result.status IS DISTINCT FROM 'fixture_legacy' THEN RAISE EXCEPTION 'Unchanged unknown historical status failed'; END IF;
  UPDATE public.events SET title='EventMap OW archived cancelled edit' WHERE id='ea081026-0000-4000-8002-000000000108' RETURNING * INTO result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR result.status IS DISTINCT FROM 'archived' OR result.is_cancelled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Archived/cancelled ordinary content edit failed';
  END IF;
  UPDATE public.events SET organizer_id=current_setting('eventmap.ow.org_a')::uuid
    WHERE id='ea081026-0000-4000-8002-000000000111' RETURNING * INTO result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR result.organizer_id IS DISTINCT FROM result.submitted_by_organizer_id THEN RAISE EXCEPTION 'NULL attribution editor fallback failed'; END IF;
  UPDATE public.events SET title='EventMap OW mixed attribution edit',organizer_id=organizer_id
    WHERE id='ea081026-0000-4000-8002-000000000112' RETURNING * INTO result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR result.organizer_id IS DISTINCT FROM current_setting('eventmap.ow.org_b')::uuid
     OR result.submitted_by_organizer_id IS DISTINCT FROM current_setting('eventmap.ow.org_a')::uuid THEN
    RAISE EXCEPTION 'Mixed attribution preserved by edit failed';
  END IF;
  BEGIN
    UPDATE public.events SET organizer_id=current_setting('eventmap.ow.org_c')::uuid
      WHERE id='ea081026-0000-4000-8002-000000000112';
    RAISE EXCEPTION 'Third organization attribution change allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.events SET visibility='private',title='EventMap OW edit and private'
    WHERE id='ea081026-0000-4000-8002-000000000121' RETURNING * INTO result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR result.visibility IS DISTINCT FROM 'private' THEN RAISE EXCEPTION 'NULL visibility to private edit failed'; END IF;
  -- Cancellation is content/visibility preserving from every representative state.
  FOR probe IN SELECT * FROM (VALUES ('000000000103'),('000000000107'),('000000000108'),
    ('000000000110'),('000000000113'),('000000000121'),('000000000123'),('000000000201')) p(suffix)
  LOOP
    SELECT to_jsonb(e) INTO STRICT before_row FROM public.events e WHERE id=('ea081026-0000-4000-8002-'||probe.suffix)::uuid;
    UPDATE public.events SET status='archived',is_cancelled=true,updated_at='1900-01-01'
      WHERE id=('ea081026-0000-4000-8002-'||probe.suffix)::uuid RETURNING * INTO result;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>1 OR result.status IS DISTINCT FROM 'archived' OR result.is_cancelled IS DISTINCT FROM true
       OR result.updated_at IS DISTINCT FROM transaction_timestamp()
       OR to_jsonb(result)-ARRAY['status','is_cancelled','updated_at'] IS DISTINCT FROM
         before_row-ARRAY['status','is_cancelled','updated_at'] THEN RAISE EXCEPTION 'Cancellation changed content/visibility/history'; END IF;
    UPDATE public.events SET status='archived',is_cancelled=true WHERE id=result.id;
    GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Repeated cancellation failed'; END IF;
  END LOOP;
END $workflow$;

DO $organization_profile$
DECLARE probe record; returned_id uuid; n integer; before_row jsonb;
BEGIN
  FOR probe IN SELECT * FROM (VALUES
    ('name','''EventMap OW profile edited'''),
    ('slug','''eventmap-ow-org-ea081026-0000-4000-8002-000000000001-edited'''),
    ('website','''https://example.invalid/eventmap-ow'''),('facebook_url','''https://example.invalid/facebook'''),
    ('instagram_url','''https://example.invalid/instagram'''),('phone','''synthetic phone'''),
    ('email','''synthetic-contact'''),('logo_url','''https://example.invalid/logo.png'''),
    ('type','''synthetic type'''),('description','''Synthetic organization description''')) p(column_name,expression)
  LOOP
    EXECUTE format('UPDATE public.organizers SET %I=%s,updated_at=''1900-01-01'' WHERE id=$1 RETURNING id',
      probe.column_name,probe.expression) INTO returned_id USING current_setting('eventmap.ow.org_a')::uuid;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>1 OR returned_id IS DISTINCT FROM current_setting('eventmap.ow.org_a')::uuid
       OR NOT EXISTS (SELECT 1 FROM public.organizers WHERE id=returned_id AND updated_at=transaction_timestamp()) THEN
      RAISE EXCEPTION 'Own organization allowed field/returned id/database time failed: %',probe.column_name;
    END IF;
    -- Verify exact stored field independently of row count.
    EXECUTE format('SELECT CASE WHEN %I::text IS NOT DISTINCT FROM %s::text THEN 1 ELSE 0 END FROM public.organizers WHERE id=$1',
      probe.column_name,probe.expression) INTO n USING returned_id;
    IF n<>1 THEN RAISE EXCEPTION 'Organization field value mismatch: %',probe.column_name; END IF;
  END LOOP;
  UPDATE public.organizers SET description='EventMap OW forbidden foreign profile' WHERE id=current_setting('eventmap.ow.org_b')::uuid;
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Foreign organization UPDATE affected row'; END IF;
  SELECT to_jsonb(o) INTO STRICT before_row FROM public.organizers o WHERE id=current_setting('eventmap.ow.org_a')::uuid;
  FOR probe IN SELECT * FROM (VALUES
    ('id','''ea081026-0000-4000-8002-000000000998''::uuid'),
    ('created_at','''1900-01-01''::timestamptz'),('created_at','NULL::timestamptz'),
    ('is_verified','true'),('is_verified','NULL::boolean')) p(column_name,expression)
  LOOP
    BEGIN
      EXECUTE format('UPDATE public.organizers SET %I=%s WHERE id=$1',probe.column_name,probe.expression)
        USING current_setting('eventmap.ow.org_a')::uuid;
      RAISE EXCEPTION 'Protected organization field accepted: %',probe.column_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF (SELECT to_jsonb(o) FROM public.organizers o WHERE id=current_setting('eventmap.ow.org_a')::uuid)
       IS DISTINCT FROM before_row THEN RAISE EXCEPTION 'Denied organization UPDATE changed row'; END IF;
  END LOOP;
  BEGIN
    INSERT INTO public.organizers (id,name,slug) VALUES ('ea081026-0000-4000-8002-000000000997',
      'EventMap OW forged org','eventmap-ow-org-ea081026-0000-4000-8002-000000000997');
    RAISE EXCEPTION 'Organizer gained organization INSERT';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  DELETE FROM public.organizers WHERE id=current_setting('eventmap.ow.org_a')::uuid;
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Organizer gained organization DELETE'; END IF;
END $organization_profile$;
RESET ROLE;

-- Grant B membership only as postgres, solely for the exact synthetic A actor.
INSERT INTO public.organizer_users (id,user_id,organizer_id,role) VALUES
 ('ea081026-0000-4000-8002-000000000902','ea081026-0000-4000-8002-000000000001',current_setting('eventmap.ow.org_b')::uuid,'member');
UPDATE public.organizers SET created_at=NULL,is_verified=NULL WHERE id=current_setting('eventmap.ow.org_b')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000001',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000001","role":"authenticated"}',true);
DO $dual_member_and_atomicity$
DECLARE probe record; before_events jsonb; before_orgs jsonb; before_source jsonb; n integer; result public.organizers%ROWTYPE;
BEGIN
  IF (SELECT count(*) FROM public.organizer_users WHERE user_id=auth.uid())<>2 THEN RAISE EXCEPTION 'Dual membership fixture failed'; END IF;
  SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) INTO before_events FROM public.events e WHERE id IN
    ('ea081026-0000-4000-8002-000000000119','ea081026-0000-4000-8002-000000000120','ea081026-0000-4000-8002-000000000101');
  SELECT to_jsonb(s) INTO STRICT before_source FROM public.event_sources s WHERE id='ea081026-0000-4000-8002-000000000301';
  FOR probe IN SELECT * FROM (VALUES
    ('submitted_by_organizer_id','current_setting(''eventmap.ow.org_b'')::uuid'),
    ('submitted_by_organizer_id','NULL::uuid'),
    ('created_by','''ea081026-0000-4000-8002-000000000002''::uuid')) p(column_name,expression)
  LOOP
    BEGIN
      EXECUTE format('UPDATE public.events SET %I=%s WHERE id=$1',probe.column_name,probe.expression)
        USING 'ea081026-0000-4000-8002-000000000101'::uuid;
      RAISE EXCEPTION 'Dual-member ownership/creator change accepted: %',probe.column_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  BEGIN
    UPDATE public.events SET title='EventMap OW atomic forbidden title',
      status=CASE WHEN id='ea081026-0000-4000-8002-000000000120'::uuid THEN 'published' ELSE status END
      WHERE id IN ('ea081026-0000-4000-8002-000000000119','ea081026-0000-4000-8002-000000000120');
    RAISE EXCEPTION 'Mixed permitted/forbidden multirow event UPDATE accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.events e WHERE id IN
      ('ea081026-0000-4000-8002-000000000119','ea081026-0000-4000-8002-000000000120','ea081026-0000-4000-8002-000000000101'))
      IS DISTINCT FROM before_events OR (SELECT to_jsonb(s) FROM public.event_sources s
      WHERE id='ea081026-0000-4000-8002-000000000301') IS DISTINCT FROM before_source THEN
    RAISE EXCEPTION 'Forbidden multirow/owner attempt changed event/source/ownership';
  END IF;
  UPDATE public.events SET title='EventMap OW dual ordinary edit' WHERE id='ea081026-0000-4000-8002-000000000101';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Dual member ordinary event edit failed'; END IF;
  SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) INTO before_orgs FROM public.organizers o
    WHERE id IN (current_setting('eventmap.ow.org_a')::uuid,current_setting('eventmap.ow.org_b')::uuid);
  BEGIN
    UPDATE public.organizers SET id=current_setting('eventmap.ow.org_b')::uuid WHERE id=current_setting('eventmap.ow.org_a')::uuid;
    RAISE EXCEPTION 'Dual member could change organization identity';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  FOR probe IN SELECT * FROM (VALUES ('is_verified','true'),('is_verified','false'),
    ('created_at','''1900-01-01''::timestamptz')) p(column_name,expression)
  LOOP
    BEGIN
      EXECUTE format('UPDATE public.organizers SET %I=%s WHERE id=$1',probe.column_name,probe.expression)
        USING current_setting('eventmap.ow.org_b')::uuid;
      RAISE EXCEPTION 'NULL protected organization field became writable: %',probe.column_name;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  BEGIN
    UPDATE public.organizers SET description='EventMap OW atomic forbidden profile',
      is_verified=CASE WHEN id=current_setting('eventmap.ow.org_b')::uuid THEN true ELSE is_verified END
      WHERE id IN (current_setting('eventmap.ow.org_a')::uuid,current_setting('eventmap.ow.org_b')::uuid);
    RAISE EXCEPTION 'Mixed permitted/forbidden multirow organization UPDATE accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM public.organizers o
      WHERE id IN (current_setting('eventmap.ow.org_a')::uuid,current_setting('eventmap.ow.org_b')::uuid))
      IS DISTINCT FROM before_orgs THEN RAISE EXCEPTION 'Rejected organization statement partially persisted'; END IF;
  UPDATE public.organizers SET description='EventMap OW member role accepted',is_verified=is_verified,created_at=created_at,
    updated_at=NULL WHERE id=current_setting('eventmap.ow.org_b')::uuid RETURNING * INTO result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR result.created_at IS NOT NULL OR result.is_verified IS NOT NULL
     OR result.updated_at IS DISTINCT FROM transaction_timestamp() THEN RAISE EXCEPTION 'Member (non-owner) profile edit/NULL preservation failed'; END IF;
END $dual_member_and_atomicity$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $identity_denials$
DECLARE actor_id uuid; n integer; claim_role text;
BEGIN
  FOR actor_id,claim_role IN SELECT * FROM (VALUES
    ('ea081026-0000-4000-8002-000000000003'::uuid,'admin'),
    ('ea081026-0000-4000-8002-000000000004'::uuid,'authenticated'),
    ('ea081026-0000-4000-8002-000000000005'::uuid,'authenticated'),
    ('ea081026-0000-4000-8002-000000000008'::uuid,'service_role'),(NULL::uuid,'service_role')) a(id,claim_role)
  LOOP
    PERFORM set_config('request.jwt.claim.sub',coalesce(actor_id::text,''),true),
      set_config('request.jwt.claim.role',claim_role,true),
      set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role',claim_role,
        'user_metadata',jsonb_build_object('role','admin'))::text,true);
    IF current_user<>'authenticated' OR auth.uid() IS DISTINCT FROM actor_id OR public.is_admin() THEN
      RAISE EXCEPTION 'Identity-denial fixture failed: %',actor_id;
    END IF;
    IF actor_id='ea081026-0000-4000-8002-000000000004'::uuid AND NOT EXISTS
        (SELECT 1 FROM public.organizer_users WHERE user_id=auth.uid() AND organizer_id=current_setting('eventmap.ow.org_a')::uuid) THEN
      RAISE EXCEPTION 'User-with-membership fixture missing';
    END IF;
    IF actor_id='ea081026-0000-4000-8002-000000000005'::uuid AND
        (NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='organizer')
         OR EXISTS (SELECT 1 FROM public.organizer_users WHERE user_id=auth.uid())) THEN
      RAISE EXCEPTION 'Organizer-without-membership fixture invalid';
    END IF;
    BEGIN
      INSERT INTO public.events (id,title,slug,start_at,status,visibility,is_cancelled,created_by,submitted_by_organizer_id)
      VALUES ('ea081026-0000-4000-8002-000000000299','EventMap OW identity denied',
        'eventmap-ow-event-ea081026-0000-4000-8002-000000000299',now(),'pending_review','public',false,
        actor_id,current_setting('eventmap.ow.org_a')::uuid);
      RAISE EXCEPTION 'Unauthorized identity inserted event: %',actor_id;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    UPDATE public.events SET title='EventMap OW identity forbidden update' WHERE id='ea081026-0000-4000-8002-000000000101';
    GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Unauthorized identity updated event: %',actor_id; END IF;
    UPDATE public.organizers SET description='EventMap OW identity forbidden profile' WHERE id=current_setting('eventmap.ow.org_a')::uuid;
    GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Unauthorized identity updated organization: %',actor_id; END IF;
    BEGIN
      INSERT INTO public.locations (id,name) VALUES ('ea081026-0000-4000-8002-000000000799','EventMap OW identity location denied');
      RAISE EXCEPTION 'Unauthorized identity inserted location: %',actor_id;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  -- A valid organizer plus forged maintenance/admin claims still uses the
  -- organizer contract, because effective SQL role remains authenticated.
  PERFORM set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000001',true),
    set_config('request.jwt.claim.role','service_role',true),
    set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000001","role":"service_role","user_metadata":{"role":"admin"}}',true);
  IF current_user<>'authenticated' OR public.is_admin() THEN RAISE EXCEPTION 'Forged claims bypassed SQL identity'; END IF;
  BEGIN
    UPDATE public.events SET is_verified=true WHERE id='ea081026-0000-4000-8002-000000000101';
    RAISE EXCEPTION 'Claimed service_role bypassed event guard';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.organizers SET is_verified=true WHERE id=current_setting('eventmap.ow.org_a')::uuid;
    RAISE EXCEPTION 'Claimed service_role bypassed organization guard';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000003',true),
    set_config('request.jwt.claim.role','authenticated',true),
    set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000003","role":"authenticated"}',true);
  BEGIN
    UPDATE public.profiles SET role='admin' WHERE id=auth.uid();
    RAISE EXCEPTION 'Metadata-admin actor could promote own profile';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.guard_organizer_event_write(); RAISE EXCEPTION 'authenticated guard RPC EXECUTE allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.guard_organizer_profile_write(); RAISE EXCEPTION 'authenticated profile guard RPC EXECUTE allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $identity_denials$;
RESET ROLE;

-- Actual service_role with absent UID is a reviewed maintenance role. Forged
-- claims above never switched the effective SQL role to this trusted role.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"role":"authenticated"}',true);
DO $service_maintenance$
DECLARE n integer; result public.events%ROWTYPE;
BEGIN
  IF current_user<>'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Actual maintenance role fixture failed'; END IF;
  INSERT INTO public.events (id,title,slug,start_at,status,visibility,is_cancelled,is_verified,is_featured,timezone,
    created_at,updated_at,published_at,submitted_by_organizer_id)
  VALUES ('ea081026-0000-4000-8002-000000000203','EventMap OW maintenance event',
    'eventmap-ow-event-ea081026-0000-4000-8002-000000000203',now(),'published','private',false,true,true,'UTC',
    '2020-01-01','2021-01-01','2022-01-01',current_setting('eventmap.ow.org_c')::uuid) RETURNING * INTO result;
  IF result.status IS DISTINCT FROM 'published' OR result.is_verified IS DISTINCT FROM true
     OR result.timezone IS DISTINCT FROM 'UTC' OR result.created_at IS DISTINCT FROM '2020-01-01'::timestamptz
     OR result.updated_at IS DISTINCT FROM '2021-01-01'::timestamptz
     OR result.published_at IS DISTINCT FROM '2022-01-01'::timestamptz THEN
    RAISE EXCEPTION 'Actual service maintenance contract was normalized/restricted';
  END IF;
  UPDATE public.events SET review_note='EventMap OW maintenance moderation' WHERE id=result.id;
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Actual service event UPDATE failed'; END IF;
  UPDATE public.organizers SET is_verified=true WHERE id=current_setting('eventmap.ow.org_c')::uuid;
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Actual service organization UPDATE failed'; END IF;
END $service_maintenance$;
RESET ROLE;

-- Promote only synthetic 003 after metadata-admin denial has been proved.
UPDATE public.profiles SET role='admin' WHERE id='ea081026-0000-4000-8002-000000000003';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000003',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000003","role":"authenticated"}',true);
DO $admin$
DECLARE n integer; result public.events%ROWTYPE; org_result public.organizers%ROWTYPE;
BEGIN
  IF NOT public.is_admin() OR EXISTS (SELECT 1 FROM public.organizer_users WHERE user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Real-profile admin must be independent of memberships';
  END IF;
  UPDATE public.events SET status='published',visibility='private',is_cancelled=false,
    submitted_by_organizer_id=current_setting('eventmap.ow.org_c')::uuid,
    organizer_id=current_setting('eventmap.ow.org_c')::uuid,created_by='ea081026-0000-4000-8002-000000000003',
    is_featured=true,is_verified=true,review_note='EventMap OW admin moderation',confidence_score=0.9,source_quality_score=0.8,
    timezone='UTC',created_at='2020-01-01',updated_at='2021-01-01',published_at='2022-01-01'
    WHERE id='ea081026-0000-4000-8002-000000000102' RETURNING * INTO result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR result.status IS DISTINCT FROM 'published' OR result.visibility IS DISTINCT FROM 'private'
     OR result.is_featured IS DISTINCT FROM true OR result.is_verified IS DISTINCT FROM true
     OR result.review_note IS DISTINCT FROM 'EventMap OW admin moderation' OR result.confidence_score IS DISTINCT FROM 0.9
     OR result.source_quality_score IS DISTINCT FROM 0.8 OR result.organizer_id IS DISTINCT FROM current_setting('eventmap.ow.org_c')::uuid
     OR result.submitted_by_organizer_id IS DISTINCT FROM current_setting('eventmap.ow.org_c')::uuid
     OR result.created_by IS DISTINCT FROM auth.uid() OR result.timezone IS DISTINCT FROM 'UTC'
     OR result.created_at IS DISTINCT FROM '2020-01-01'::timestamptz OR result.updated_at IS DISTINCT FROM '2021-01-01'::timestamptz
     OR result.published_at IS DISTINCT FROM '2022-01-01'::timestamptz THEN
    RAISE EXCEPTION 'Admin foreign event moderation/verification/assignment/history failed';
  END IF;
  UPDATE public.organizers SET is_verified=true,created_at='2020-01-01',updated_at='2021-01-01'
    WHERE id=current_setting('eventmap.ow.org_b')::uuid RETURNING * INTO org_result;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR org_result.is_verified IS DISTINCT FROM true OR org_result.created_at IS DISTINCT FROM '2020-01-01'::timestamptz
     OR org_result.updated_at IS DISTINCT FROM '2021-01-01'::timestamptz THEN RAISE EXCEPTION 'Admin organization verification/history failed'; END IF;
  INSERT INTO public.events (id,title,slug,start_at,status,visibility,is_cancelled,is_verified,is_featured,
    review_note,timezone,created_at,updated_at,published_at,created_by,submitted_by_organizer_id)
  VALUES ('ea081026-0000-4000-8002-000000000204','EventMap OW admin event',
    'eventmap-ow-event-ea081026-0000-4000-8002-000000000204',now(),'published','private',true,true,true,
    'EventMap OW admin insert','UTC','2020-01-01','2021-01-01','2022-01-01',auth.uid(),current_setting('eventmap.ow.org_c')::uuid)
    RETURNING * INTO result;
  IF result.status IS DISTINCT FROM 'published' OR result.is_cancelled IS DISTINCT FROM true
     OR result.is_verified IS DISTINCT FROM true OR result.is_featured IS DISTINCT FROM true
     OR result.review_note IS DISTINCT FROM 'EventMap OW admin insert' OR result.timezone IS DISTINCT FROM 'UTC'
     OR result.created_at IS DISTINCT FROM '2020-01-01'::timestamptz OR result.updated_at IS DISTINCT FROM '2021-01-01'::timestamptz
     OR result.published_at IS DISTINCT FROM '2022-01-01'::timestamptz THEN RAISE EXCEPTION 'Admin INSERT contract unexpectedly restricted'; END IF;
  INSERT INTO public.locations (id,name) VALUES ('ea081026-0000-4000-8002-000000000703','EventMap OW admin location allowed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin location regression failed'; END IF;
END $admin$;
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','anon',true),
 set_config('request.jwt.claims','{"role":"anon"}',true);
DO $anon_regressions$
DECLARE invalid_event uuid; n integer;
BEGIN
  -- At this point only 116 (owner NULL) and 117 (cancellation NULL) stay public.
  IF auth.uid() IS NOT NULL OR (SELECT count(*) FROM public.events WHERE id::text LIKE 'ea081026-0000-4000-8002-%')<>2
     OR EXISTS (SELECT 1 FROM public.events WHERE id::text LIKE 'ea081026-0000-4000-8002-%'
       AND (status IS DISTINCT FROM 'published' OR visibility IS DISTINCT FROM 'public' OR is_cancelled IS TRUE)) THEN
    RAISE EXCEPTION 'Anon published/public/not-cancelled event isolation failed';
  END IF;
  BEGIN INSERT INTO public.locations (id,name) VALUES ('ea081026-0000-4000-8002-000000000799','EventMap OW anon denied');
    RAISE EXCEPTION 'Anon location INSERT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.events (id,title,slug,start_at) VALUES ('ea081026-0000-4000-8002-000000000299',
    'EventMap OW anon denied','eventmap-ow-event-ea081026-0000-4000-8002-000000000299',now());
    RAISE EXCEPTION 'Anon event INSERT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.events SET title='EventMap OW anon denied edit' WHERE id='ea081026-0000-4000-8002-000000000117';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Anon event UPDATE allowed'; END IF;
  UPDATE public.organizers SET description='EventMap OW anon denied profile' WHERE id=current_setting('eventmap.ow.org_a')::uuid;
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Anon organization UPDATE allowed'; END IF;
  BEGIN PERFORM public.guard_organizer_event_write(); RAISE EXCEPTION 'Anon guard EXECUTE allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.guard_organizer_profile_write(); RAISE EXCEPTION 'Anon profile guard EXECUTE allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.get_my_saved_events(); RAISE EXCEPTION 'Anon saved RPC read allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.set_my_saved_event('ea081026-0000-4000-8002-000000000117',true); RAISE EXCEPTION 'Anon saved RPC write allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO public.event_analytics (id,event_id,event_type,user_id,session_id) VALUES
    ('ea081026-0000-4000-8002-000000000801','ea081026-0000-4000-8002-000000000116','view',NULL,'ea081026-0000-4000-8002-anon');
  IF NOT FOUND THEN RAISE EXCEPTION 'Anon public false-cancellation analytics failed'; END IF;
  INSERT INTO public.event_analytics (id,event_id,event_type,user_id,session_id) VALUES
    ('ea081026-0000-4000-8002-000000000803','ea081026-0000-4000-8002-000000000117','view',NULL,'ea081026-0000-4000-8002-anon-null');
  IF NOT FOUND THEN RAISE EXCEPTION 'Anon public NULL-cancellation analytics failed'; END IF;
  FOREACH invalid_event IN ARRAY ARRAY['ea081026-0000-4000-8002-000000000104'::uuid,
    'ea081026-0000-4000-8002-000000000114'::uuid,'ea081026-0000-4000-8002-000000000115'::uuid,
    'ea081026-0000-4000-8002-000000000199'::uuid]
  LOOP
    BEGIN INSERT INTO public.event_analytics (id,event_id,event_type,user_id) VALUES
      ('ea081026-0000-4000-8002-000000000899',invalid_event,'view',NULL);
      RAISE EXCEPTION 'Anon analytics accepted unavailable event: %',invalid_event;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  BEGIN INSERT INTO public.event_analytics (id,event_id,event_type,user_id) VALUES
    ('ea081026-0000-4000-8002-000000000899','ea081026-0000-4000-8002-000000000117','view','ea081026-0000-4000-8002-000000000001');
    RAISE EXCEPTION 'Anon analytics accepted non-NULL UID'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anon_regressions$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000006',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000006","role":"authenticated"}',true);
DO $user_and_analytics_regressions$
DECLARE n integer;
BEGIN
  IF public.is_admin() OR EXISTS (SELECT 1 FROM public.organizer_users WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Plain attendee authority fixture failed'; END IF;
  BEGIN INSERT INTO public.locations (id,name) VALUES ('ea081026-0000-4000-8002-000000000799','EventMap OW plain user denied');
    RAISE EXCEPTION 'Plain user location INSERT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.profiles SET role='organizer' WHERE id=auth.uid();
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='organizer') THEN
    RAISE EXCEPTION 'Self-described organizer fixture failed';
  END IF;
  BEGIN INSERT INTO public.locations (id,name) VALUES ('ea081026-0000-4000-8002-000000000799','EventMap OW self-described denied');
    RAISE EXCEPTION 'Self-described organizer location INSERT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.profiles SET role='user' WHERE id=auth.uid();
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Attendee profile restoration failed'; END IF;
  INSERT INTO public.event_analytics (id,event_id,event_type,user_id,session_id) VALUES
    ('ea081026-0000-4000-8002-000000000802','ea081026-0000-4000-8002-000000000117','view',auth.uid(),'ea081026-0000-4000-8002-own');
  IF NOT FOUND THEN RAISE EXCEPTION 'Authenticated own-UID public analytics failed'; END IF;
  BEGIN INSERT INTO public.event_analytics (id,event_id,event_type,user_id) VALUES
    ('ea081026-0000-4000-8002-000000000899','ea081026-0000-4000-8002-000000000117','view','ea081026-0000-4000-8002-000000000001');
    RAISE EXCEPTION 'Authenticated analytics accepted foreign UID'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $user_and_analytics_regressions$;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000001',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000001","role":"authenticated"}',true);
DO $organizer_analytics_regression$
DECLARE invalid_event uuid;
BEGIN
  INSERT INTO public.locations (id,name) VALUES ('ea081026-0000-4000-8002-000000000702','EventMap OW organizer location allowed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Organizer location INSERT regression failed'; END IF;
  FOREACH invalid_event IN ARRAY ARRAY['ea081026-0000-4000-8002-000000000104'::uuid,
    'ea081026-0000-4000-8002-000000000114'::uuid,'ea081026-0000-4000-8002-000000000115'::uuid]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE id=invalid_event) THEN RAISE EXCEPTION 'Organizer should see own nonpublic analytics target'; END IF;
    BEGIN INSERT INTO public.event_analytics (id,event_id,event_type,user_id) VALUES
      ('ea081026-0000-4000-8002-000000000899',invalid_event,'view',auth.uid());
      RAISE EXCEPTION 'Organizer analytics accepted readable unavailable event: %',invalid_event;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
END $organizer_analytics_regression$;

SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000006',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000006","role":"authenticated"}',true);
DO $saved_a$
DECLARE invalid_id uuid;
BEGIN
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 THEN RAISE EXCEPTION 'Attendee A saw foreign saves'; END IF;
  PERFORM public.set_my_saved_event('ea081026-0000-4000-8002-000000000117',true);
  PERFORM public.set_my_saved_event('ea081026-0000-4000-8002-000000000117',true);
  IF (SELECT count(*) FROM public.get_my_saved_events('ea081026-0000-4000-8002-000000000117'))<>1
     OR (SELECT count(*) FROM public.saved_events WHERE event_id='ea081026-0000-4000-8002-000000000117')<>1 THEN
    RAISE EXCEPTION 'Idempotent saved RPC/aggregate count failed';
  END IF;
  BEGIN PERFORM user_id FROM public.saved_events WHERE event_id='ea081026-0000-4000-8002-000000000117';
    RAISE EXCEPTION 'Attendee identity SELECT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  FOREACH invalid_id IN ARRAY ARRAY['ea081026-0000-4000-8002-000000000104'::uuid,
    'ea081026-0000-4000-8002-000000000114'::uuid,'ea081026-0000-4000-8002-000000000115'::uuid,
    'ea081026-0000-4000-8002-000000000199'::uuid]
  LOOP
    BEGIN PERFORM public.set_my_saved_event(invalid_id,true);
      RAISE EXCEPTION 'Saved RPC accepted unavailable event: %',invalid_id;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
END $saved_a$;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000007',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000007","role":"authenticated"}',true);
DO $saved_b$
BEGIN
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 THEN RAISE EXCEPTION 'Attendee B saw A saves'; END IF;
  PERFORM public.set_my_saved_event('ea081026-0000-4000-8002-000000000117',false);
  PERFORM public.set_my_saved_event('ea081026-0000-4000-8002-000000000117',true);
  IF (SELECT count(*) FROM public.get_my_saved_events())<>1 THEN RAISE EXCEPTION 'B save failed'; END IF;
END $saved_b$;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000001',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000001","role":"authenticated"}',true);
DO $saved_organizer$
BEGIN
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 OR
      (SELECT count(*) FROM public.saved_events WHERE event_id='ea081026-0000-4000-8002-000000000117')<>2 THEN
    RAISE EXCEPTION 'Organizer saved RPC isolation/aggregate regression failed';
  END IF;
  BEGIN PERFORM user_id FROM public.saved_events WHERE event_id='ea081026-0000-4000-8002-000000000117';
    RAISE EXCEPTION 'Organizer attendee identity SELECT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.set_my_saved_event('ea081026-0000-4000-8002-000000000117',false);
END $saved_organizer$;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000003',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000003","role":"authenticated"}',true);
DO $saved_admin$
BEGIN
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 OR
      (SELECT count(*) FROM public.saved_events WHERE event_id='ea081026-0000-4000-8002-000000000117')<>2 THEN
    RAISE EXCEPTION 'Admin saved RPC isolation/aggregate regression failed';
  END IF;
  BEGIN PERFORM user_id FROM public.saved_events WHERE event_id='ea081026-0000-4000-8002-000000000117';
    RAISE EXCEPTION 'Admin attendee identity SELECT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $saved_admin$;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000006',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000006","role":"authenticated"}',true);
DO $saved_a_still_exists$
BEGIN IF (SELECT count(*) FROM public.get_my_saved_events())<>1 THEN RAISE EXCEPTION 'Foreign actor removed A save'; END IF; END $saved_a_still_exists$;
RESET ROLE;
UPDATE public.events SET status='archived' WHERE id='ea081026-0000-4000-8002-000000000117';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000006',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000006","role":"authenticated"}',true);
DO $withdrawn_a$
BEGIN
  BEGIN PERFORM public.set_my_saved_event('ea081026-0000-4000-8002-000000000117',true);
    RAISE EXCEPTION 'Withdrawn event save accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.set_my_saved_event('ea081026-0000-4000-8002-000000000117',false);
  PERFORM public.set_my_saved_event('ea081026-0000-4000-8002-000000000117',false);
  IF (SELECT count(*) FROM public.get_my_saved_events())<>0 THEN RAISE EXCEPTION 'Withdrawn unsave/idempotence failed'; END IF;
END $withdrawn_a$;
SELECT set_config('request.jwt.claim.sub','ea081026-0000-4000-8002-000000000007',true),
 set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"sub":"ea081026-0000-4000-8002-000000000007","role":"authenticated"}',true);
DO $withdrawn_b$
BEGIN IF (SELECT count(*) FROM public.get_my_saved_events())<>1 THEN RAISE EXCEPTION 'A removed B withdrawn save'; END IF; END $withdrawn_b$;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','authenticated',true),
 set_config('request.jwt.claims','{"role":"authenticated"}',true);
DO $saved_missing_uid$
BEGIN
  IF auth.uid() IS NOT NULL OR (SELECT count(*) FROM public.get_my_saved_events())<>0 THEN RAISE EXCEPTION 'Missing UID leaked saves'; END IF;
  BEGIN PERFORM public.set_my_saved_event('ea081026-0000-4000-8002-000000000117',false);
    RAISE EXCEPTION 'Missing UID wrote saves'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $saved_missing_uid$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','',true),
 set_config('request.jwt.claims','{}',true);

DO $fixture_results$
BEGIN
  IF current_user<>'postgres'
     OR (SELECT count(*) FROM public.events WHERE id::text LIKE 'ea081026-0000-4000-8002-%')<>27
     OR (SELECT count(*) FROM public.organizers WHERE slug LIKE 'eventmap-ow-org-ea081026-0000-4000-8002-%')<>3
     OR (SELECT count(*) FROM public.organizer_users WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%')<>5
     OR (SELECT count(*) FROM public.locations WHERE id::text LIKE 'ea081026-0000-4000-8002-%')<>3
     OR (SELECT count(*) FROM public.event_analytics WHERE id::text LIKE 'ea081026-0000-4000-8002-%')<>3
     OR (SELECT count(*) FROM public.categories WHERE id::text LIKE 'ea081026-0000-4000-8002-%')<>1
     OR (SELECT count(*) FROM public.event_sources WHERE event_id::text LIKE 'ea081026-0000-4000-8002-%')<>2
     OR (SELECT count(*) FROM public.event_sources WHERE id='ea081026-0000-4000-8002-000000000301'
       AND event_id='ea081026-0000-4000-8002-000000000101' AND source_name='EventMap OW A source')<>1
     OR (SELECT count(*) FROM public.event_sources WHERE id='ea081026-0000-4000-8002-000000000302'
       AND event_id='ea081026-0000-4000-8002-000000000102' AND source_name='EventMap OW B source')<>1
     OR EXISTS (SELECT 1 FROM public.event_moderation_logs WHERE event_id::text LIKE 'ea081026-0000-4000-8002-%'
       OR reviewed_by::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.notifications WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%'
       OR related_event_id::text LIKE 'ea081026-0000-4000-8002-%') THEN
    RAISE EXCEPTION 'Unexpected fixture counts or guard-created source/log/notification side effect';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_analytics WHERE id='ea081026-0000-4000-8002-000000000801'
      AND event_id='ea081026-0000-4000-8002-000000000116' AND user_id IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.event_analytics WHERE id='ea081026-0000-4000-8002-000000000802'
      AND event_id='ea081026-0000-4000-8002-000000000117' AND user_id='ea081026-0000-4000-8002-000000000006')
     OR NOT EXISTS (SELECT 1 FROM public.event_analytics WHERE id='ea081026-0000-4000-8002-000000000803'
      AND event_id='ea081026-0000-4000-8002-000000000117' AND user_id IS NULL)
     OR (SELECT count(*) FROM public.saved_events WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%')<>1
     OR NOT EXISTS (SELECT 1 FROM public.saved_events WHERE user_id='ea081026-0000-4000-8002-000000000007'
       AND event_id='ea081026-0000-4000-8002-000000000117') THEN
    RAISE EXCEPTION 'Positive analytics/saved fixture identity/count mismatch';
  END IF;
END $fixture_results$;

ROLLBACK TO SAVEPOINT organizer_write_fixtures;
RELEASE SAVEPOINT organizer_write_fixtures;
DO $absence$
DECLARE rel regclass; remains boolean;
BEGIN
  FOREACH rel IN ARRAY ARRAY['auth.users'::regclass,'public.profiles'::regclass,
    'public.organizers'::regclass,'public.organizer_users'::regclass,'public.events'::regclass,
    'public.locations'::regclass,'public.event_analytics'::regclass,'public.categories'::regclass,
    'public.event_sources'::regclass,'public.event_moderation_logs'::regclass,'public.notifications'::regclass]
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE id::text LIKE $1)',rel)
      INTO remains USING 'ea081026-0000-4000-8002-%';
    IF remains THEN RAISE EXCEPTION 'Fixture survived savepoint rollback: %',rel; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.organizers WHERE slug LIKE 'eventmap-ow-org-ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.categories WHERE slug LIKE 'eventmap-ow-category-ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.organizer_users WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.saved_events WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%'
       OR event_id::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.event_sources WHERE event_id::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.event_moderation_logs WHERE event_id::text LIKE 'ea081026-0000-4000-8002-%'
       OR reviewed_by::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.notifications WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%'
       OR related_event_id::text LIKE 'ea081026-0000-4000-8002-%')
     OR EXISTS (SELECT 1 FROM public.event_analytics WHERE event_id::text LIKE 'ea081026-0000-4000-8002-%'
       OR user_id::text LIKE 'ea081026-0000-4000-8002-%') THEN
    RAISE EXCEPTION 'Generated/related fixtures survived savepoint rollback';
  END IF;
END $absence$;
ROLLBACK;

SELECT jsonb_build_object(
 'report_version','eventmap-organizer-write-hardening-tests-2026-10-08-v1',
 'valid_only_if','entire script completed without SQL error; client stopped on first error',
 'checks','PASS: reviewed installed catalog/ACL; INSERT protected fields/history; all UPDATE protected fields and NULL variants; content/workflow/history/attribution; OLD owner/dual membership; ten organization fields; identity/admin/maintenance; multirow statement atomicity; anon/location/analytics/saved RPC regressions; no source/log/notification side effects; full rollback assertions',
 'not_tested',jsonb_build_array('real JWT/Auth/signup/email','PostgREST/browser UI','A04 HTTP write transactions','concurrent revocation/edits/retries','distributed analytics dedup/rate limiting'),
 'fixture_absence',jsonb_build_object(
   'auth_users',(SELECT count(*) FROM auth.users WHERE id::text LIKE 'ea081026-0000-4000-8002-%'),
   'profiles',(SELECT count(*) FROM public.profiles WHERE id::text LIKE 'ea081026-0000-4000-8002-%'),
   'organizers',(SELECT count(*) FROM public.organizers WHERE slug LIKE 'eventmap-ow-org-ea081026-0000-4000-8002-%'),
   'memberships',(SELECT count(*) FROM public.organizer_users WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%'),
   'events',(SELECT count(*) FROM public.events WHERE id::text LIKE 'ea081026-0000-4000-8002-%'),
   'categories',(SELECT count(*) FROM public.categories WHERE id::text LIKE 'ea081026-0000-4000-8002-%'),
   'locations',(SELECT count(*) FROM public.locations WHERE id::text LIKE 'ea081026-0000-4000-8002-%'),
   'analytics',(SELECT count(*) FROM public.event_analytics WHERE id::text LIKE 'ea081026-0000-4000-8002-%'
     OR event_id::text LIKE 'ea081026-0000-4000-8002-%' OR user_id::text LIKE 'ea081026-0000-4000-8002-%'),
   'sources',(SELECT count(*) FROM public.event_sources WHERE id::text LIKE 'ea081026-0000-4000-8002-%' OR event_id::text LIKE 'ea081026-0000-4000-8002-%'),
   'saves',(SELECT count(*) FROM public.saved_events WHERE user_id::text LIKE 'ea081026-0000-4000-8002-%' OR event_id::text LIKE 'ea081026-0000-4000-8002-%'),
   'moderation_logs',(SELECT count(*) FROM public.event_moderation_logs WHERE id::text LIKE 'ea081026-0000-4000-8002-%'
     OR event_id::text LIKE 'ea081026-0000-4000-8002-%' OR reviewed_by::text LIKE 'ea081026-0000-4000-8002-%'),
   'notifications',(SELECT count(*) FROM public.notifications WHERE id::text LIKE 'ea081026-0000-4000-8002-%'
     OR user_id::text LIKE 'ea081026-0000-4000-8002-%' OR related_event_id::text LIKE 'ea081026-0000-4000-8002-%')
 )) AS verification;
