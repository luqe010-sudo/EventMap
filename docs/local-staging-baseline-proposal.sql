-- REVIEW-ONLY PROPOSAL. No SQL in this file has been executed.
-- Target: a dedicated EMPTY LOCAL Supabase PostgreSQL 17 database.
-- Sources (metadata only, collected 2026-10-06):
--   scratch/security-audit/staging-preflight-2026-10-06-readonly.json
--   scratch/security-audit/local-staging-columns-2026-10-06-readonly.json
-- Reproduces current application schema and object ACLs; this is NOT A04's
-- receipt/write_version/writer-RPC migration. No production/Auth data or fixtures.
--
-- After separate review and approval, the caller must set this session flag:
--   SET eventmap.staging_baseline = 'local-empty-only';
-- The script deliberately does not set its own authorization flag.
-- The caller must separately verify its connection is the dedicated local
-- Supabase database (host 127.0.0.1, mapped port 54332). SQL inside Docker sees
-- the container address/port; this guard cannot prove host-side locality.
-- It refuses existing app relations/functions/trigger, even when tables are empty.
-- It does not recreate managed auth.users, roles, memberships, platform schemas,
-- extensions, global/default privileges, or extension-owned spatial_ref_sys/views.
-- Prerequisites: initialized local Supabase 17; managed Auth helpers/roles; PostGIS
-- already installed in public (source 3.3.7), uuid-ossp in extensions (source 1.1).
-- pgcrypto (source 1.3) is a platform prerequisite; UUID defaults use the PostgreSQL
-- core pg_catalog.gen_random_uuid() and extensions.uuid_generate_v4().
-- Local platform extension versions must be checked separately for compatibility.
--
-- Preserved deliberately: source FK names including five duplicate NOT VALID
-- auth.users FKs; current policy/ACL breadth; owner-context city_page_event_counts
-- view and its source definition (counts all linked events). Security/behavior
-- improvements to these objects require separate changes, not baseline drift.
-- Existing platform default ACLs may differ: new app object ACLs are cleared and
-- explicitly restored below, without changing any global/default privileges.
-- No Realtime subscriptions are used by current repo; publication/replica identity
-- metadata, comments, database locale, and platform internals are outside this
-- application baseline. Default collation is inherited from the local database.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public, extensions;

DO $eventmap_baseline_guard$
DECLARE
  object_name text;
  role_name text;
BEGIN
  IF current_setting('eventmap.staging_baseline', true)
      IS DISTINCT FROM 'local-empty-only' THEN
    RAISE EXCEPTION 'Baseline requires explicit eventmap.staging_baseline=local-empty-only';
  END IF;
  IF current_setting('server_version_num')::integer < 170000
     OR current_setting('server_version_num')::integer >= 180000 THEN
    RAISE EXCEPTION 'This proposal requires Supabase PostgreSQL 17';
  END IF;
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run only as the local Supabase postgres owner';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['postgres','anon','authenticated','service_role']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      RAISE EXCEPTION 'Missing managed Supabase role: %', role_name;
    END IF;
  END LOOP;
  IF to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL
     OR to_regprocedure('auth.role()') IS NULL
     OR to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE EXCEPTION 'Initialized managed Supabase Auth is required';
  END IF;
  IF NOT has_table_privilege(current_user, 'auth.users', 'REFERENCES')
     OR NOT has_table_privilege(current_user, 'auth.users', 'TRIGGER') THEN
    RAISE EXCEPTION 'Local postgres needs REFERENCES and TRIGGER on managed auth.users';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension e
    JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'postgis' AND n.nspname = 'public'
  ) OR to_regtype('public.geography') IS NULL THEN
    RAISE EXCEPTION 'Install compatible PostGIS in public separately before baseline';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension e
    JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'uuid-ossp' AND n.nspname = 'extensions'
  ) OR to_regprocedure('extensions.uuid_generate_v4()') IS NULL THEN
    RAISE EXCEPTION 'Managed uuid-ossp in extensions is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension e
    JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto' AND n.nspname = 'extensions'
  )
     OR to_regprocedure('pg_catalog.gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'Managed pgcrypto and PostgreSQL UUID support are required';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role']
  LOOP
    IF NOT has_schema_privilege(role_name, 'public', 'USAGE')
       OR NOT has_schema_privilege(role_name, 'extensions', 'USAGE') THEN
      RAISE EXCEPTION 'Managed schema USAGE prerequisites missing for %', role_name;
    END IF;
  END LOOP;
  FOREACH object_name IN ARRAY ARRAY['categories','cities','organizers','tags','scraping_sources','profiles','notification_preferences','organizer_users','locations','city_pages','raw_scraped_items','events','event_sources','event_tags','saved_events','event_analytics','event_moderation_logs','notifications','city_page_event_counts']
  LOOP
    IF to_regclass(format('public.%I', object_name)) IS NOT NULL THEN
      RAISE EXCEPTION 'Expected blank local app schema; relation public.% exists', object_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('city_slugify','get_my_saved_events','handle_new_user','is_admin','set_my_saved_event')) THEN
    RAISE EXCEPTION 'Expected blank local app schema; application functions already exist';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
      WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created') THEN
    RAISE EXCEPTION 'Application Auth trigger already exists';
  END IF;
END;
$eventmap_baseline_guard$;

-- 1. Tables: catalog types/typmods, source column order/defaults/nullability.
CREATE TABLE public."categories" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "name" "pg_catalog"."text" NOT NULL,
  "slug" "pg_catalog"."text" NOT NULL,
  "icon" "pg_catalog"."text",
  "color" "pg_catalog"."text",
  "parent_id" "pg_catalog"."uuid",
  "sort_order" "pg_catalog"."int4" DEFAULT 0,
  "created_at" "pg_catalog"."timestamptz" DEFAULT now()
);
ALTER TABLE public."categories" OWNER TO postgres;

CREATE TABLE public."cities" (
  "id" "pg_catalog"."uuid" DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "name" "pg_catalog"."text" NOT NULL,
  "slug" "pg_catalog"."text" NOT NULL,
  "county" "pg_catalog"."text",
  "voivodeship" "pg_catalog"."text",
  "latitude" "pg_catalog"."float8",
  "longitude" "pg_catalog"."float8",
  "is_active" "pg_catalog"."bool" DEFAULT true NOT NULL,
  "created_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "updated_at" "pg_catalog"."timestamptz"
);
ALTER TABLE public."cities" OWNER TO postgres;

CREATE TABLE public."organizers" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "name" "pg_catalog"."text" NOT NULL,
  "slug" "pg_catalog"."text" NOT NULL,
  "description" "pg_catalog"."text",
  "website" "pg_catalog"."text",
  "facebook_url" "pg_catalog"."text",
  "instagram_url" "pg_catalog"."text",
  "email" "pg_catalog"."text",
  "phone" "pg_catalog"."text",
  "logo_url" "pg_catalog"."text",
  "type" "pg_catalog"."text",
  "is_verified" "pg_catalog"."bool" DEFAULT false,
  "created_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "updated_at" "pg_catalog"."timestamptz" DEFAULT now()
);
ALTER TABLE public."organizers" OWNER TO postgres;

CREATE TABLE public."tags" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "name" "pg_catalog"."text" NOT NULL,
  "slug" "pg_catalog"."text" NOT NULL,
  "created_at" "pg_catalog"."timestamptz" DEFAULT now()
);
ALTER TABLE public."tags" OWNER TO postgres;

CREATE TABLE public."scraping_sources" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "name" "pg_catalog"."text" NOT NULL,
  "url" "pg_catalog"."text" NOT NULL,
  "source_type" "pg_catalog"."text",
  "city" "pg_catalog"."text",
  "county" "pg_catalog"."text",
  "voivodeship" "pg_catalog"."text",
  "scraping_enabled" "pg_catalog"."bool" DEFAULT true,
  "scraping_frequency" "pg_catalog"."text" DEFAULT 'daily'::text,
  "last_scraped_at" "pg_catalog"."timestamptz",
  "last_success_at" "pg_catalog"."timestamptz",
  "last_error" "pg_catalog"."text",
  "quality_score" "pg_catalog"."numeric"(5,2),
  "created_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "updated_at" "pg_catalog"."timestamptz" DEFAULT now()
);
ALTER TABLE public."scraping_sources" OWNER TO postgres;

CREATE TABLE public."profiles" (
  "id" "pg_catalog"."uuid" NOT NULL,
  "role" "pg_catalog"."text" DEFAULT 'user'::text,
  "display_name" "pg_catalog"."text",
  "created_at" "pg_catalog"."timestamptz" DEFAULT now()
);
ALTER TABLE public."profiles" OWNER TO postgres;

CREATE TABLE public."notification_preferences" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "user_id" "pg_catalog"."uuid" NOT NULL,
  "city" "pg_catalog"."text",
  "latitude" "pg_catalog"."numeric"(10,7),
  "longitude" "pg_catalog"."numeric"(10,7),
  "radius_km" "pg_catalog"."int4" DEFAULT 25,
  "categories" "pg_catalog"."jsonb",
  "tags" "pg_catalog"."jsonb",
  "days_ahead" "pg_catalog"."int4" DEFAULT 14,
  "channel" "pg_catalog"."text" DEFAULT 'email'::text,
  "frequency" "pg_catalog"."text" DEFAULT 'weekly'::text,
  "is_active" "pg_catalog"."bool" DEFAULT true,
  "created_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "updated_at" "pg_catalog"."timestamptz" DEFAULT now()
);
ALTER TABLE public."notification_preferences" OWNER TO postgres;

CREATE TABLE public."organizer_users" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "organizer_id" "pg_catalog"."uuid",
  "user_id" "pg_catalog"."uuid",
  "role" "pg_catalog"."text" DEFAULT 'owner'::text,
  "created_at" "pg_catalog"."timestamptz" DEFAULT now()
);
ALTER TABLE public."organizer_users" OWNER TO postgres;

CREATE TABLE public."locations" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "name" "pg_catalog"."text",
  "address" "pg_catalog"."text",
  "municipality" "pg_catalog"."text",
  "county" "pg_catalog"."text",
  "voivodeship" "pg_catalog"."text",
  "postal_code" "pg_catalog"."text",
  "latitude" "pg_catalog"."numeric"(10,7),
  "longitude" "pg_catalog"."numeric"(10,7),
  "geom" "public"."geography"(Point,4326),
  "google_maps_url" "pg_catalog"."text",
  "place_id" "pg_catalog"."text",
  "created_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "updated_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "city_id" "pg_catalog"."uuid"
);
ALTER TABLE public."locations" OWNER TO postgres;

CREATE TABLE public."city_pages" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "meta_title" "pg_catalog"."text",
  "meta_description" "pg_catalog"."text",
  "intro_text" "pg_catalog"."text",
  "created_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "updated_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "city_id" "pg_catalog"."uuid"
);
ALTER TABLE public."city_pages" OWNER TO postgres;

CREATE TABLE public."raw_scraped_items" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "scraping_source_id" "pg_catalog"."uuid",
  "source_url" "pg_catalog"."text",
  "raw_html" "pg_catalog"."text",
  "raw_text" "pg_catalog"."text",
  "raw_json" "pg_catalog"."jsonb",
  "content_hash" "pg_catalog"."text",
  "detected_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "processed_at" "pg_catalog"."timestamptz",
  "processing_status" "pg_catalog"."text" DEFAULT 'pending'::text,
  "error_message" "pg_catalog"."text"
);
ALTER TABLE public."raw_scraped_items" OWNER TO postgres;

CREATE TABLE public."events" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "title" "pg_catalog"."text" NOT NULL,
  "slug" "pg_catalog"."text" NOT NULL,
  "description" "pg_catalog"."text",
  "short_description" "pg_catalog"."text",
  "category_id" "pg_catalog"."uuid",
  "status" "pg_catalog"."text" DEFAULT 'published'::text,
  "visibility" "pg_catalog"."text" DEFAULT 'public'::text,
  "start_at" "pg_catalog"."timestamptz" NOT NULL,
  "end_at" "pg_catalog"."timestamptz",
  "timezone" "pg_catalog"."text" DEFAULT 'Europe/Warsaw'::text,
  "is_all_day" "pg_catalog"."bool" DEFAULT false,
  "location_id" "pg_catalog"."uuid",
  "organizer_id" "pg_catalog"."uuid",
  "price_type" "pg_catalog"."text" DEFAULT 'unknown'::text,
  "price_min" "pg_catalog"."numeric"(10,2),
  "price_max" "pg_catalog"."numeric"(10,2),
  "currency" "pg_catalog"."text" DEFAULT 'PLN'::text,
  "main_image_url" "pg_catalog"."text",
  "source_quality_score" "pg_catalog"."numeric"(5,2),
  "confidence_score" "pg_catalog"."numeric"(5,2),
  "is_featured" "pg_catalog"."bool" DEFAULT false,
  "is_verified" "pg_catalog"."bool" DEFAULT false,
  "is_cancelled" "pg_catalog"."bool" DEFAULT false,
  "created_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "updated_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "published_at" "pg_catalog"."timestamptz" DEFAULT now(),
  "created_by" "pg_catalog"."uuid",
  "submitted_by_organizer_id" "pg_catalog"."uuid",
  "review_note" "pg_catalog"."text"
);
ALTER TABLE public."events" OWNER TO postgres;

CREATE TABLE public."event_sources" (
  "id" "pg_catalog"."uuid" DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "event_id" "pg_catalog"."uuid" NOT NULL,
  "source_type" "pg_catalog"."text" NOT NULL,
  "source_name" "pg_catalog"."text",
  "source_url" "pg_catalog"."text",
  "external_id" "pg_catalog"."text",
  "raw_title" "pg_catalog"."text",
  "raw_description" "pg_catalog"."text",
  "raw_date" "pg_catalog"."text",
  "raw_location" "pg_catalog"."text",
  "raw_image_url" "pg_catalog"."text",
  "scraped_at" "pg_catalog"."timestamptz",
  "last_seen_at" "pg_catalog"."timestamptz",
  "is_active" "pg_catalog"."bool" DEFAULT true,
  "confidence_score" "pg_catalog"."numeric"(5,2),
  "created_at" "pg_catalog"."timestamptz" DEFAULT now()
);
ALTER TABLE public."event_sources" OWNER TO postgres;

CREATE TABLE public."event_tags" (
  "event_id" "pg_catalog"."uuid" NOT NULL,
  "tag_id" "pg_catalog"."uuid" NOT NULL
);
ALTER TABLE public."event_tags" OWNER TO postgres;

CREATE TABLE public."saved_events" (
  "user_id" "pg_catalog"."uuid" NOT NULL,
  "event_id" "pg_catalog"."uuid" NOT NULL,
  "created_at" "pg_catalog"."timestamptz" DEFAULT now()
);
ALTER TABLE public."saved_events" OWNER TO postgres;

CREATE TABLE public."event_analytics" (
  "id" "pg_catalog"."uuid" DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "event_id" "pg_catalog"."uuid" NOT NULL,
  "event_type" "pg_catalog"."text" NOT NULL,
  "user_id" "pg_catalog"."uuid",
  "session_id" "pg_catalog"."text",
  "created_at" "pg_catalog"."timestamptz" DEFAULT now() NOT NULL
);
ALTER TABLE public."event_analytics" OWNER TO postgres;

CREATE TABLE public."event_moderation_logs" (
  "id" "pg_catalog"."uuid" DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "event_id" "pg_catalog"."uuid" NOT NULL,
  "reviewed_by" "pg_catalog"."uuid",
  "old_status" "pg_catalog"."text",
  "new_status" "pg_catalog"."text" NOT NULL,
  "note" "pg_catalog"."text",
  "created_at" "pg_catalog"."timestamptz" DEFAULT now() NOT NULL
);
ALTER TABLE public."event_moderation_logs" OWNER TO postgres;

CREATE TABLE public."notifications" (
  "id" "pg_catalog"."uuid" DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "user_id" "pg_catalog"."uuid" NOT NULL,
  "title" "pg_catalog"."text" NOT NULL,
  "message" "pg_catalog"."text",
  "type" "pg_catalog"."text",
  "is_read" "pg_catalog"."bool" DEFAULT false NOT NULL,
  "related_event_id" "pg_catalog"."uuid",
  "created_at" "pg_catalog"."timestamptz" DEFAULT now() NOT NULL
);
ALTER TABLE public."notifications" OWNER TO postgres;

-- 2. Primary/unique/check constraints, then all foreign keys.
ALTER TABLE public."categories" ADD CONSTRAINT "categories_pkey" PRIMARY KEY (id);
ALTER TABLE public."categories" ADD CONSTRAINT "categories_slug_key" UNIQUE (slug);
ALTER TABLE public."cities" ADD CONSTRAINT "cities_pkey" PRIMARY KEY (id);
ALTER TABLE public."city_pages" ADD CONSTRAINT "city_pages_pkey" PRIMARY KEY (id);
ALTER TABLE public."event_analytics" ADD CONSTRAINT "event_analytics_event_type_check" CHECK ((event_type = ANY (ARRAY['view'::text, 'phone_click'::text, 'website_click'::text, 'ticket_click'::text, 'map_click'::text, 'share_click'::text, 'save_click'::text])));
ALTER TABLE public."event_analytics" ADD CONSTRAINT "event_analytics_pkey" PRIMARY KEY (id);
ALTER TABLE public."event_moderation_logs" ADD CONSTRAINT "event_moderation_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."event_sources" ADD CONSTRAINT "event_sources_pkey" PRIMARY KEY (id);
ALTER TABLE public."event_tags" ADD CONSTRAINT "event_tags_pkey" PRIMARY KEY (event_id, tag_id);
ALTER TABLE public."events" ADD CONSTRAINT "events_pkey" PRIMARY KEY (id);
ALTER TABLE public."events" ADD CONSTRAINT "events_slug_key" UNIQUE (slug);
ALTER TABLE public."locations" ADD CONSTRAINT "locations_pkey" PRIMARY KEY (id);
ALTER TABLE public."notification_preferences" ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."organizer_users" ADD CONSTRAINT "organizer_users_organizer_id_user_id_key" UNIQUE (organizer_id, user_id);
ALTER TABLE public."organizer_users" ADD CONSTRAINT "organizer_users_pkey" PRIMARY KEY (id);
ALTER TABLE public."organizers" ADD CONSTRAINT "organizers_pkey" PRIMARY KEY (id);
ALTER TABLE public."organizers" ADD CONSTRAINT "organizers_slug_key" UNIQUE (slug);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."raw_scraped_items" ADD CONSTRAINT "raw_scraped_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."saved_events" ADD CONSTRAINT "saved_events_pkey" PRIMARY KEY (user_id, event_id);
ALTER TABLE public."scraping_sources" ADD CONSTRAINT "scraping_sources_pkey" PRIMARY KEY (id);
ALTER TABLE public."tags" ADD CONSTRAINT "tags_pkey" PRIMARY KEY (id);
ALTER TABLE public."tags" ADD CONSTRAINT "tags_slug_key" UNIQUE (slug);
ALTER TABLE public."categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES categories(id);
ALTER TABLE public."city_pages" ADD CONSTRAINT "city_pages_city_id_fkey" FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE;
ALTER TABLE public."event_analytics" ADD CONSTRAINT "event_analytics_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_analytics" ADD CONSTRAINT "event_analytics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."event_moderation_logs" ADD CONSTRAINT "event_moderation_logs_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_moderation_logs" ADD CONSTRAINT "event_moderation_logs_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."event_sources" ADD CONSTRAINT "event_sources_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_tags" ADD CONSTRAINT "event_tags_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_tags" ADD CONSTRAINT "event_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
ALTER TABLE public."events" ADD CONSTRAINT "events_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id);
ALTER TABLE public."events" ADD CONSTRAINT "events_created_by_auth_users_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public."events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public."events" ADD CONSTRAINT "events_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id);
ALTER TABLE public."events" ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY (organizer_id) REFERENCES organizers(id);
ALTER TABLE public."events" ADD CONSTRAINT "events_submitted_by_organizer_id_fkey" FOREIGN KEY (submitted_by_organizer_id) REFERENCES organizers(id);
ALTER TABLE public."locations" ADD CONSTRAINT "locations_city_id_fkey" FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE public."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_auth_users_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_related_event_id_fkey" FOREIGN KEY (related_event_id) REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."organizer_users" ADD CONSTRAINT "organizer_users_organizer_id_fkey" FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE CASCADE;
ALTER TABLE public."organizer_users" ADD CONSTRAINT "organizer_users_user_id_auth_users_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."organizer_users" ADD CONSTRAINT "organizer_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_auth_users_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."raw_scraped_items" ADD CONSTRAINT "raw_scraped_items_scraping_source_id_fkey" FOREIGN KEY (scraping_source_id) REFERENCES scraping_sources(id);
ALTER TABLE public."saved_events" ADD CONSTRAINT "saved_events_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."saved_events" ADD CONSTRAINT "saved_events_user_id_auth_users_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."saved_events" ADD CONSTRAINT "saved_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- 3. Non-constraint indexes; constraint-owned indexes were created above.
CREATE UNIQUE INDEX categories_slug_unique_idx ON public.categories USING btree (slug);
CREATE INDEX categories_sort_name_idx ON public.categories USING btree (sort_order, name);
CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);
CREATE INDEX cities_active_slug_idx ON public.cities USING btree (is_active, slug);
CREATE UNIQUE INDEX cities_slug_unique_idx ON public.cities USING btree (slug);
CREATE UNIQUE INDEX city_pages_city_id_unique_idx ON public.city_pages USING btree (city_id) WHERE (city_id IS NOT NULL);
CREATE INDEX event_analytics_event_id_created_at_idx ON public.event_analytics USING btree (event_id, created_at DESC);
CREATE INDEX event_analytics_event_type_idx ON public.event_analytics USING btree (event_type);
CREATE INDEX event_analytics_session_id_idx ON public.event_analytics USING btree (session_id);
CREATE INDEX event_moderation_logs_event_id_created_at_idx ON public.event_moderation_logs USING btree (event_id, created_at DESC);
CREATE INDEX event_moderation_logs_reviewed_by_idx ON public.event_moderation_logs USING btree (reviewed_by);
CREATE INDEX event_sources_event_id_created_at_idx ON public.event_sources USING btree (event_id, created_at);
CREATE INDEX idx_event_sources_event ON public.event_sources USING btree (event_id);
CREATE UNIQUE INDEX event_tags_unique_event_tag_idx ON public.event_tags USING btree (event_id, tag_id);
CREATE INDEX events_category_start_at_idx ON public.events USING btree (category_id, start_at);
CREATE INDEX events_created_at_idx ON public.events USING btree (created_at DESC);
CREATE INDEX events_location_id_idx ON public.events USING btree (location_id);
CREATE INDEX events_public_start_at_idx ON public.events USING btree (start_at) WHERE ((status = 'published'::text) AND (visibility = 'public'::text) AND ((is_cancelled IS NULL) OR (is_cancelled = false)));
CREATE UNIQUE INDEX events_slug_unique_idx ON public.events USING btree (slug);
CREATE INDEX events_status_created_at_idx ON public.events USING btree (status, created_at DESC);
CREATE INDEX events_submitted_by_organizer_start_at_idx ON public.events USING btree (submitted_by_organizer_id, start_at DESC);
CREATE INDEX idx_events_category ON public.events USING btree (category_id);
CREATE INDEX idx_events_location ON public.events USING btree (location_id);
CREATE INDEX idx_events_start_at ON public.events USING btree (start_at);
CREATE INDEX idx_events_status ON public.events USING btree (status);
CREATE INDEX idx_locations_geom ON public.locations USING gist (geom);
CREATE INDEX locations_city_id_idx ON public.locations USING btree (city_id);
CREATE INDEX notifications_related_event_id_idx ON public.notifications USING btree (related_event_id);
CREATE INDEX notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX organizer_users_organizer_id_idx ON public.organizer_users USING btree (organizer_id);
CREATE UNIQUE INDEX organizer_users_unique_user_organizer_idx ON public.organizer_users USING btree (user_id, organizer_id);
CREATE INDEX organizer_users_user_id_idx ON public.organizer_users USING btree (user_id);
CREATE INDEX idx_organizers_slug ON public.organizers USING btree (slug);
CREATE INDEX organizers_name_idx ON public.organizers USING btree (name);
CREATE UNIQUE INDEX organizers_slug_unique_idx ON public.organizers USING btree (slug);
CREATE INDEX idx_raw_scraped_items_hash ON public.raw_scraped_items USING btree (content_hash);
CREATE INDEX idx_raw_scraped_items_status ON public.raw_scraped_items USING btree (processing_status);
CREATE UNIQUE INDEX saved_events_unique_user_event_idx ON public.saved_events USING btree (user_id, event_id);

-- 4. Current custom functions (including deployed Auth/saved-event hotfixes).
CREATE FUNCTION public.city_slugify(value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(
    regexp_replace(
      regexp_replace(
        translate(
          lower(trim(coalesce(value, ''))),
          'ąćęłńóśźż',
          'acelnoszz'
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '(^-+|-+$)',
      '',
      'g'
    ),
    ''
  );
$function$;
ALTER FUNCTION public."city_slugify"(value text) OWNER TO postgres;

CREATE FUNCTION public.get_my_saved_events(p_event_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(event_id uuid, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select s.event_id, s.created_at
  from public.saved_events as s
  where s.user_id = (select auth.uid())
    and (p_event_id is null or s.event_id = p_event_id)
  order by s.created_at desc, s.event_id;
$function$;
ALTER FUNCTION public."get_my_saved_events"(p_event_id uuid) OWNER TO postgres;

CREATE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  new_org_id uuid;
  user_display_name text;
  user_role text;
  org_name text;
  org_slug text;
begin
  user_display_name := coalesce(new.raw_user_meta_data->>'display_name', 'Użytkownik');
  user_role := case
    when new.raw_user_meta_data->>'role' = 'organizer' then 'organizer'
    else 'user'
  end;

  insert into public.profiles (id, display_name, role)
  values (new.id, user_display_name, user_role)
  on conflict (id) do update
  set display_name = user_display_name, role = user_role;

  if user_role = 'organizer' then
    org_name := coalesce(new.raw_user_meta_data->>'organizer_name', user_display_name);
    org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
    org_slug := trim(both '-' from org_slug);

    insert into public.organizers (name, slug, email, is_verified)
    values (org_name, org_slug, new.email, false)
    returning id into new_org_id;

    insert into public.organizer_users (organizer_id, user_id, role)
    values (new_org_id, new.id, 'owner');
  end if;

  return new;
end;
$function$;
ALTER FUNCTION public."handle_new_user"() OWNER TO postgres;

CREATE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$function$;
ALTER FUNCTION public."is_admin"() OWNER TO postgres;

CREATE FUNCTION public.set_my_saved_event(p_event_id uuid, p_saved boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_event_id is null or p_saved is null then
    raise exception 'Event and save state are required' using errcode = '22023';
  end if;

  if p_saved then
    -- Lock the event row while validating and saving to avoid a concurrent
    -- cancellation/unpublication between the check and the insert.
    perform 1 from public.events as e
    where e.id = p_event_id and e.status = 'published'
      and e.visibility = 'public' and e.is_cancelled is not true
    for share;
    if not found then
      raise exception 'Event is not publicly available' using errcode = '42501';
    end if;
    insert into public.saved_events (user_id, event_id)
      values (caller_id, p_event_id)
      on conflict (user_id, event_id) do nothing;
  else
    delete from public.saved_events as s
      where s.user_id = caller_id and s.event_id = p_event_id;
  end if;
  return p_saved;
end;
$function$;
ALTER FUNCTION public."set_my_saved_event"(p_event_id uuid, p_saved boolean) OWNER TO postgres;

-- 5. Current application view; owner-context behavior preserved.
CREATE VIEW public."city_page_event_counts" AS
 SELECT city_page.id AS city_page_id,
    city.id AS city_id,
    city.name AS city,
    (count(event.id))::integer AS event_count
   FROM (((city_pages city_page
     JOIN cities city ON ((city.id = city_page.city_id)))
     LEFT JOIN locations location ON ((location.city_id = city.id)))
     LEFT JOIN events event ON ((event.location_id = location.id)))
  GROUP BY city_page.id, city.id, city.name;
ALTER VIEW public."city_page_event_counts" OWNER TO postgres;

-- 6. Source RLS flags and all 43 policies, after their function dependencies.
ALTER TABLE public."categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."categories" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."cities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cities" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizers" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tags" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."scraping_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."scraping_sources" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notification_preferences" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizer_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizer_users" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."locations" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."city_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."city_pages" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."raw_scraped_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."raw_scraped_items" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."events" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."event_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_sources" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."event_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_tags" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."saved_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."saved_events" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."event_analytics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_analytics" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."event_moderation_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_moderation_logs" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" NO FORCE ROW LEVEL SECURITY;
CREATE POLICY "Allow insert for admin users" ON public."categories" AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Allow update for admin users" ON public."categories" AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "categories public read" ON public."categories" AS PERMISSIVE FOR SELECT TO "anon", "authenticated"
  USING (true);
CREATE POLICY "cities_delete_admin" ON public."cities" AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "cities_insert_admin_or_organizer" ON public."cities" AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'organizer'::text]))))));
CREATE POLICY "cities_select_all" ON public."cities" AS PERMISSIVE FOR SELECT TO "anon", "authenticated"
  USING (true);
CREATE POLICY "cities_update_admin" ON public."cities" AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can read event analytics" ON public."event_analytics" AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Anyone can insert event analytics" ON public."event_analytics" AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (((user_id IS NULL) OR (user_id = auth.uid())));
CREATE POLICY "Organizer members can read own event analytics" ON public."event_analytics" AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM (events e
     JOIN organizer_users ou ON ((ou.organizer_id = e.submitted_by_organizer_id)))
  WHERE ((e.id = event_analytics.event_id) AND (ou.user_id = auth.uid())))));
CREATE POLICY "Admins can manage moderation logs" ON public."event_moderation_logs" AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Organizer members can read moderation logs" ON public."event_moderation_logs" AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM (events e
     JOIN organizer_users ou ON ((ou.organizer_id = e.submitted_by_organizer_id)))
  WHERE ((e.id = event_moderation_logs.event_id) AND (ou.user_id = auth.uid())))));
CREATE POLICY "event sources admin all" ON public."event_sources" AS PERMISSIVE FOR ALL TO "authenticated"
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "event sources organizer all own events" ON public."event_sources" AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (events e
     JOIN organizer_users ou ON ((ou.organizer_id = e.submitted_by_organizer_id)))
  WHERE ((e.id = event_sources.event_id) AND (ou.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (events e
     JOIN organizer_users ou ON ((ou.organizer_id = e.submitted_by_organizer_id)))
  WHERE ((e.id = event_sources.event_id) AND (ou.user_id = auth.uid())))));
CREATE POLICY "event sources public read for published events" ON public."event_sources" AS PERMISSIVE FOR SELECT TO "anon", "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_sources.event_id) AND (e.status = 'published'::text) AND (e.visibility = 'public'::text) AND (COALESCE(e.is_cancelled, false) = false)))));
CREATE POLICY "events admin all" ON public."events" AS PERMISSIVE FOR ALL TO "authenticated"
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "events organizer insert own" ON public."events" AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((created_by = auth.uid()) AND (status = 'pending_review'::text) AND (visibility = 'public'::text) AND (submitted_by_organizer_id IN ( SELECT ou.organizer_id
   FROM organizer_users ou
  WHERE (ou.user_id = auth.uid())))));
CREATE POLICY "events organizer read own" ON public."events" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((submitted_by_organizer_id IN ( SELECT ou.organizer_id
   FROM organizer_users ou
  WHERE (ou.user_id = auth.uid()))));
CREATE POLICY "events organizer update own" ON public."events" AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((submitted_by_organizer_id IN ( SELECT ou.organizer_id
   FROM organizer_users ou
  WHERE (ou.user_id = auth.uid()))))
  WITH CHECK (((status <> 'published'::text) AND (submitted_by_organizer_id IN ( SELECT ou.organizer_id
   FROM organizer_users ou
  WHERE (ou.user_id = auth.uid())))));
CREATE POLICY "events public read published" ON public."events" AS PERMISSIVE FOR SELECT TO "anon", "authenticated"
  USING (((status = 'published'::text) AND (visibility = 'public'::text) AND (COALESCE(is_cancelled, false) = false)));
CREATE POLICY "locations authenticated insert" ON public."locations" AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (true);
CREATE POLICY "locations public read" ON public."locations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated"
  USING (true);
CREATE POLICY "locations_delete_admin" ON public."locations" AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "locations_insert_admin_or_organizer" ON public."locations" AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'organizer'::text]))))));
CREATE POLICY "locations_select_all" ON public."locations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated"
  USING (true);
CREATE POLICY "locations_update_admin" ON public."locations" AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can manage notifications" ON public."notifications" AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Users can read own notifications" ON public."notifications" AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((user_id = auth.uid()));
CREATE POLICY "Users can update own notifications" ON public."notifications" AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "organizer users admin all" ON public."organizer_users" AS PERMISSIVE FOR ALL TO "authenticated"
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "organizer users admin read all" ON public."organizer_users" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (is_admin());
CREATE POLICY "organizer users read own" ON public."organizer_users" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((user_id = auth.uid()));
CREATE POLICY "organizers admin all" ON public."organizers" AS PERMISSIVE FOR ALL TO "authenticated"
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "organizers public read" ON public."organizers" AS PERMISSIVE FOR SELECT TO "anon", "authenticated"
  USING (true);
CREATE POLICY "profiles admin read all" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (is_admin());
CREATE POLICY "profiles insert own safe" ON public."profiles" AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((id = ( SELECT auth.uid() AS uid)) AND ((role IS NULL) OR (role = ANY (ARRAY['user'::text, 'organizer'::text])))));
CREATE POLICY "profiles read own" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((id = auth.uid()));
CREATE POLICY "profiles update own safe" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((id = ( SELECT auth.uid() AS uid)))
  WITH CHECK (((id = ( SELECT auth.uid() AS uid)) AND ((role IS NULL) OR (role = ANY (ARRAY['user'::text, 'organizer'::text])) OR ((role = 'admin'::text) AND is_admin()))));
CREATE POLICY "saved_events admins read all" ON public."saved_events" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (is_admin());
CREATE POLICY "saved_events delete own" ON public."saved_events" AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "saved_events insert own public event" ON public."saved_events" AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM events
  WHERE ((events.id = saved_events.event_id) AND (events.status = 'published'::text) AND (events.visibility = 'public'::text) AND (events.is_cancelled IS NOT TRUE))))));
CREATE POLICY "saved_events organizers read event saves" ON public."saved_events" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (events
     JOIN organizer_users ON ((organizer_users.organizer_id = events.submitted_by_organizer_id)))
  WHERE ((events.id = saved_events.event_id) AND (organizer_users.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "saved_events read own" ON public."saved_events" AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

-- 7. Normalize only these newly created objects' ACLs, then apply source grants.
-- This removes any local default grants without editing global/default ACLs.
DO $eventmap_object_acl$
DECLARE
  object_acl record;
  target_grantee text;
BEGIN
  FOR object_acl IN
    SELECT DISTINCT n.nspname, c.relname, a.grantee, r.rolname
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))) a
    LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee
    WHERE n.nspname='public' AND c.relname IN ('categories','cities','organizers','tags','scraping_sources','profiles','notification_preferences','organizer_users','locations','city_pages','raw_scraped_items','events','event_sources','event_tags','saved_events','event_analytics','event_moderation_logs','notifications','city_page_event_counts')
  LOOP
    target_grantee := CASE WHEN object_acl.grantee=0 THEN 'PUBLIC'
      ELSE quote_ident(object_acl.rolname) END;
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %s',
      object_acl.nspname, object_acl.relname, target_grantee);
  END LOOP;
  FOR object_acl IN
    SELECT DISTINCT n.nspname, p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
      a.grantee, r.rolname
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee
    WHERE n.nspname='public' AND p.proname IN ('city_slugify','get_my_saved_events','handle_new_user','is_admin','set_my_saved_event')
  LOOP
    target_grantee := CASE WHEN object_acl.grantee=0 THEN 'PUBLIC'
      ELSE quote_ident(object_acl.rolname) END;
    EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %I.%I(%s) FROM %s',
      object_acl.nspname, object_acl.proname, object_acl.args, target_grantee);
  END LOOP;
END;
$eventmap_object_acl$;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."categories" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."categories" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."categories" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."categories" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."cities" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."cities" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."cities" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."cities" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."city_page_event_counts" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."city_page_event_counts" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."city_page_event_counts" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."city_page_event_counts" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."city_pages" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."city_pages" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."city_pages" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."city_pages" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_analytics" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_analytics" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_analytics" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_analytics" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_moderation_logs" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_moderation_logs" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_moderation_logs" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_moderation_logs" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_sources" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_sources" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_sources" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_sources" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_tags" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_tags" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_tags" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."event_tags" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."events" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."events" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."events" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."events" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."locations" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."locations" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."locations" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."locations" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."notification_preferences" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."notification_preferences" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."notification_preferences" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."notification_preferences" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."notifications" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."notifications" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."notifications" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."notifications" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."organizer_users" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."organizer_users" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."organizer_users" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."organizer_users" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."organizers" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."organizers" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."organizers" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."organizers" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."raw_scraped_items" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."raw_scraped_items" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."raw_scraped_items" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."raw_scraped_items" TO "service_role";
GRANT DELETE ON TABLE public."saved_events" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."saved_events" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."saved_events" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."scraping_sources" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."scraping_sources" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."scraping_sources" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."scraping_sources" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tags" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tags" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tags" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tags" TO "service_role";
GRANT SELECT ("created_at", "event_id") ON TABLE public."saved_events" TO "authenticated";
GRANT INSERT ("event_id", "user_id") ON TABLE public."saved_events" TO "authenticated";
GRANT EXECUTE ON FUNCTION public."city_slugify"(value text) TO "anon";
GRANT EXECUTE ON FUNCTION public."city_slugify"(value text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public."city_slugify"(value text) TO "postgres";
GRANT EXECUTE ON FUNCTION public."city_slugify"(value text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public."city_slugify"(value text) TO "service_role";
GRANT EXECUTE ON FUNCTION public."get_my_saved_events"(p_event_id uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public."get_my_saved_events"(p_event_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public."get_my_saved_events"(p_event_id uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO "service_role";
GRANT EXECUTE ON FUNCTION public."is_admin"() TO "anon";
GRANT EXECUTE ON FUNCTION public."is_admin"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."is_admin"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."is_admin"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public."is_admin"() TO "service_role";
GRANT EXECUTE ON FUNCTION public."set_my_saved_event"(p_event_id uuid, p_saved boolean) TO "authenticated";
GRANT EXECUTE ON FUNCTION public."set_my_saved_event"(p_event_id uuid, p_saved boolean) TO "postgres";
GRANT EXECUTE ON FUNCTION public."set_my_saved_event"(p_event_id uuid, p_saved boolean) TO "service_role";

-- 8. Application trigger; managed Auth table columns/data are not recreated.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- CREATE TRIGGER defaults to enabled O, matching the source trigger state.

-- All changes above are atomic. No application/Auth rows have been inserted.
-- Separate approval and local isolation verification remain required before use.
COMMIT;
