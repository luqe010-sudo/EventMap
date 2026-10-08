-- DRAFT / REVIEW ONLY. NOT APPROVED, NOT EXECUTED. 2026-10-08.
-- Exact rollback for organizer-write-hardening-proposal.sql. Separately review
-- and approve: it restores the documented old organizer ownership/field gaps.
-- Location/analytics hardening, user rows and publication dates are retained.
-- ONE fresh dedicated postgres connection, STOP ON FIRST ERROR; ROLLBACK/close
-- on any error. Provide the FULL manifest returned by successful approved
-- deployment in this SAME connection before running this file, using safely
-- parameterized set_config(value=saved JSON, is_local=false).
-- A manifest synthesized from the current catalog is never acceptable.
-- Missing or changed inventory, recreated guard OIDs, source/ACL/trigger changes,
-- unrelated policy drift and the wrong database identity all fail closed.
-- A staging clone deliberately fails hosted identity/catalog pins; its reviewed
-- target-specific proposal, rollback and deployment manifest must be paired.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
SET LOCAL search_path = pg_catalog, public, extensions;
-- Lock exactly the two changed tables BEFORE catalog validation.
LOCK TABLE public.events, public.organizers IN ACCESS EXCLUSIVE MODE;
DO $rollback_guard$
DECLARE
  reviewed jsonb := $reviewed$
{
  "columns": [
    {
      "table_name": "events",
      "column_name": "id",
      "ordinal_position": 1,
      "is_nullable": "NO",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": "uuid_generate_v4()",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "title",
      "ordinal_position": 2,
      "is_nullable": "NO",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "slug",
      "ordinal_position": 3,
      "is_nullable": "NO",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "description",
      "ordinal_position": 4,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "short_description",
      "ordinal_position": 5,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "category_id",
      "ordinal_position": 6,
      "is_nullable": "YES",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "status",
      "ordinal_position": 7,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": "'published'::text",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "visibility",
      "ordinal_position": 8,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": "'public'::text",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "start_at",
      "ordinal_position": 9,
      "is_nullable": "NO",
      "data_type": "timestamp with time zone",
      "udt_schema": "pg_catalog",
      "udt_name": "timestamptz",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": 6,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "end_at",
      "ordinal_position": 10,
      "is_nullable": "YES",
      "data_type": "timestamp with time zone",
      "udt_schema": "pg_catalog",
      "udt_name": "timestamptz",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": 6,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "timezone",
      "ordinal_position": 11,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": "'Europe/Warsaw'::text",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "is_all_day",
      "ordinal_position": 12,
      "is_nullable": "YES",
      "data_type": "boolean",
      "udt_schema": "pg_catalog",
      "udt_name": "bool",
      "column_default": "false",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "location_id",
      "ordinal_position": 13,
      "is_nullable": "YES",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "organizer_id",
      "ordinal_position": 14,
      "is_nullable": "YES",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "price_type",
      "ordinal_position": 15,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": "'unknown'::text",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "price_min",
      "ordinal_position": 16,
      "is_nullable": "YES",
      "data_type": "numeric",
      "udt_schema": "pg_catalog",
      "udt_name": "numeric",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": 10,
      "numeric_scale": 2,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "price_max",
      "ordinal_position": 17,
      "is_nullable": "YES",
      "data_type": "numeric",
      "udt_schema": "pg_catalog",
      "udt_name": "numeric",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": 10,
      "numeric_scale": 2,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "currency",
      "ordinal_position": 18,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": "'PLN'::text",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "main_image_url",
      "ordinal_position": 19,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "source_quality_score",
      "ordinal_position": 20,
      "is_nullable": "YES",
      "data_type": "numeric",
      "udt_schema": "pg_catalog",
      "udt_name": "numeric",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": 5,
      "numeric_scale": 2,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "confidence_score",
      "ordinal_position": 21,
      "is_nullable": "YES",
      "data_type": "numeric",
      "udt_schema": "pg_catalog",
      "udt_name": "numeric",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": 5,
      "numeric_scale": 2,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "is_featured",
      "ordinal_position": 22,
      "is_nullable": "YES",
      "data_type": "boolean",
      "udt_schema": "pg_catalog",
      "udt_name": "bool",
      "column_default": "false",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "is_verified",
      "ordinal_position": 23,
      "is_nullable": "YES",
      "data_type": "boolean",
      "udt_schema": "pg_catalog",
      "udt_name": "bool",
      "column_default": "false",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "is_cancelled",
      "ordinal_position": 24,
      "is_nullable": "YES",
      "data_type": "boolean",
      "udt_schema": "pg_catalog",
      "udt_name": "bool",
      "column_default": "false",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "created_at",
      "ordinal_position": 25,
      "is_nullable": "YES",
      "data_type": "timestamp with time zone",
      "udt_schema": "pg_catalog",
      "udt_name": "timestamptz",
      "column_default": "now()",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": 6,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "updated_at",
      "ordinal_position": 26,
      "is_nullable": "YES",
      "data_type": "timestamp with time zone",
      "udt_schema": "pg_catalog",
      "udt_name": "timestamptz",
      "column_default": "now()",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": 6,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "published_at",
      "ordinal_position": 27,
      "is_nullable": "YES",
      "data_type": "timestamp with time zone",
      "udt_schema": "pg_catalog",
      "udt_name": "timestamptz",
      "column_default": "now()",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": 6,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "created_by",
      "ordinal_position": 28,
      "is_nullable": "YES",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "submitted_by_organizer_id",
      "ordinal_position": 29,
      "is_nullable": "YES",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "events",
      "column_name": "review_note",
      "ordinal_position": 30,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizer_users",
      "column_name": "id",
      "ordinal_position": 1,
      "is_nullable": "NO",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": "uuid_generate_v4()",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizer_users",
      "column_name": "organizer_id",
      "ordinal_position": 2,
      "is_nullable": "YES",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizer_users",
      "column_name": "user_id",
      "ordinal_position": 3,
      "is_nullable": "YES",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizer_users",
      "column_name": "role",
      "ordinal_position": 4,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": "'owner'::text",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizer_users",
      "column_name": "created_at",
      "ordinal_position": 5,
      "is_nullable": "YES",
      "data_type": "timestamp with time zone",
      "udt_schema": "pg_catalog",
      "udt_name": "timestamptz",
      "column_default": "now()",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": 6,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "id",
      "ordinal_position": 1,
      "is_nullable": "NO",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": "uuid_generate_v4()",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "name",
      "ordinal_position": 2,
      "is_nullable": "NO",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "slug",
      "ordinal_position": 3,
      "is_nullable": "NO",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "description",
      "ordinal_position": 4,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "website",
      "ordinal_position": 5,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "facebook_url",
      "ordinal_position": 6,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "instagram_url",
      "ordinal_position": 7,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "email",
      "ordinal_position": 8,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "phone",
      "ordinal_position": 9,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "logo_url",
      "ordinal_position": 10,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "type",
      "ordinal_position": 11,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "is_verified",
      "ordinal_position": 12,
      "is_nullable": "YES",
      "data_type": "boolean",
      "udt_schema": "pg_catalog",
      "udt_name": "bool",
      "column_default": "false",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "created_at",
      "ordinal_position": 13,
      "is_nullable": "YES",
      "data_type": "timestamp with time zone",
      "udt_schema": "pg_catalog",
      "udt_name": "timestamptz",
      "column_default": "now()",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": 6,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "organizers",
      "column_name": "updated_at",
      "ordinal_position": 14,
      "is_nullable": "YES",
      "data_type": "timestamp with time zone",
      "udt_schema": "pg_catalog",
      "udt_name": "timestamptz",
      "column_default": "now()",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": 6,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "profiles",
      "column_name": "id",
      "ordinal_position": 1,
      "is_nullable": "NO",
      "data_type": "uuid",
      "udt_schema": "pg_catalog",
      "udt_name": "uuid",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "profiles",
      "column_name": "role",
      "ordinal_position": 2,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": "'user'::text",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "profiles",
      "column_name": "display_name",
      "ordinal_position": 3,
      "is_nullable": "YES",
      "data_type": "text",
      "udt_schema": "pg_catalog",
      "udt_name": "text",
      "column_default": null,
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": null,
      "collation_schema": null,
      "collation_name": null
    },
    {
      "table_name": "profiles",
      "column_name": "created_at",
      "ordinal_position": 4,
      "is_nullable": "YES",
      "data_type": "timestamp with time zone",
      "udt_schema": "pg_catalog",
      "udt_name": "timestamptz",
      "column_default": "now()",
      "is_identity": "NO",
      "is_generated": "NEVER",
      "generation_expression": null,
      "numeric_precision": null,
      "numeric_scale": null,
      "datetime_precision": 6,
      "collation_schema": null,
      "collation_name": null
    }
  ],
  "relations": [
    {
      "relation_name": "events",
      "owner": "postgres",
      "explicit_acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "kind": "r",
      "persistence": "p",
      "rls_enabled": true,
      "rls_forced": false,
      "is_partition": false,
      "options": null
    },
    {
      "relation_name": "organizer_users",
      "owner": "postgres",
      "explicit_acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "kind": "r",
      "persistence": "p",
      "rls_enabled": true,
      "rls_forced": false,
      "is_partition": false,
      "options": null
    },
    {
      "relation_name": "organizers",
      "owner": "postgres",
      "explicit_acl": "{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "kind": "r",
      "persistence": "p",
      "rls_enabled": true,
      "rls_forced": false,
      "is_partition": false,
      "options": null
    },
    {
      "relation_name": "profiles",
      "owner": "postgres",
      "explicit_acl": "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}",
      "kind": "r",
      "persistence": "p",
      "rls_enabled": true,
      "rls_forced": false,
      "is_partition": false,
      "options": null
    }
  ],
  "constraints": [
    {
      "constraint_name": "events_category_id_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (category_id) REFERENCES categories(id)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "categories",
      "referenced_schema": "public",
      "relation_name": "events",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "events_created_by_auth_users_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "users",
      "referenced_schema": "auth",
      "relation_name": "events",
      "schema_name": "public",
      "validated": false
    },
    {
      "constraint_name": "events_created_by_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (created_by) REFERENCES auth.users(id)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "users",
      "referenced_schema": "auth",
      "relation_name": "events",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "events_location_id_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (location_id) REFERENCES locations(id)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "locations",
      "referenced_schema": "public",
      "relation_name": "events",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "events_organizer_id_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (organizer_id) REFERENCES organizers(id)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "organizers",
      "referenced_schema": "public",
      "relation_name": "events",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "events_pkey",
      "deferrable": false,
      "definition": "PRIMARY KEY (id)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "p",
      "no_inherit": true,
      "referenced_relation": null,
      "referenced_schema": null,
      "relation_name": "events",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "events_slug_key",
      "deferrable": false,
      "definition": "UNIQUE (slug)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "u",
      "no_inherit": true,
      "referenced_relation": null,
      "referenced_schema": null,
      "relation_name": "events",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "events_submitted_by_organizer_id_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (submitted_by_organizer_id) REFERENCES organizers(id)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "organizers",
      "referenced_schema": "public",
      "relation_name": "events",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "organizer_users_organizer_id_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE CASCADE",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "organizers",
      "referenced_schema": "public",
      "relation_name": "organizer_users",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "organizer_users_organizer_id_user_id_key",
      "deferrable": false,
      "definition": "UNIQUE (organizer_id, user_id)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "u",
      "no_inherit": true,
      "referenced_relation": null,
      "referenced_schema": null,
      "relation_name": "organizer_users",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "organizer_users_pkey",
      "deferrable": false,
      "definition": "PRIMARY KEY (id)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "p",
      "no_inherit": true,
      "referenced_relation": null,
      "referenced_schema": null,
      "relation_name": "organizer_users",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "organizer_users_user_id_auth_users_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "users",
      "referenced_schema": "auth",
      "relation_name": "organizer_users",
      "schema_name": "public",
      "validated": false
    },
    {
      "constraint_name": "organizer_users_user_id_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "users",
      "referenced_schema": "auth",
      "relation_name": "organizer_users",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "organizers_pkey",
      "deferrable": false,
      "definition": "PRIMARY KEY (id)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "p",
      "no_inherit": true,
      "referenced_relation": null,
      "referenced_schema": null,
      "relation_name": "organizers",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "organizers_slug_key",
      "deferrable": false,
      "definition": "UNIQUE (slug)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "u",
      "no_inherit": true,
      "referenced_relation": null,
      "referenced_schema": null,
      "relation_name": "organizers",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "profiles_id_auth_users_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "users",
      "referenced_schema": "auth",
      "relation_name": "profiles",
      "schema_name": "public",
      "validated": false
    },
    {
      "constraint_name": "profiles_id_fkey",
      "deferrable": false,
      "definition": "FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "f",
      "no_inherit": true,
      "referenced_relation": "users",
      "referenced_schema": "auth",
      "relation_name": "profiles",
      "schema_name": "public",
      "validated": true
    },
    {
      "constraint_name": "profiles_pkey",
      "deferrable": false,
      "definition": "PRIMARY KEY (id)",
      "inheritance_count": 0,
      "initially_deferred": false,
      "is_local": true,
      "kind": "p",
      "no_inherit": true,
      "referenced_relation": null,
      "referenced_schema": null,
      "relation_name": "profiles",
      "schema_name": "public",
      "validated": true
    }
  ],
  "policies": [
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "Allow insert for admin users",
      "qual": null,
      "roles": [
        "public"
      ],
      "schemaname": "public",
      "tablename": "categories",
      "with_check": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))"
    },
    {
      "cmd": "UPDATE",
      "permissive": "PERMISSIVE",
      "policyname": "Allow update for admin users",
      "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))",
      "roles": [
        "public"
      ],
      "schemaname": "public",
      "tablename": "categories",
      "with_check": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "categories public read",
      "qual": "true",
      "roles": [
        "anon",
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "categories",
      "with_check": null
    },
    {
      "cmd": "DELETE",
      "permissive": "PERMISSIVE",
      "policyname": "cities_delete_admin",
      "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "cities",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "cities_insert_admin_or_organizer",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "cities",
      "with_check": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'organizer'::text])))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "cities_select_all",
      "qual": "true",
      "roles": [
        "anon",
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "cities",
      "with_check": null
    },
    {
      "cmd": "UPDATE",
      "permissive": "PERMISSIVE",
      "policyname": "cities_update_admin",
      "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "cities",
      "with_check": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can read event analytics",
      "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))",
      "roles": [
        "public"
      ],
      "schemaname": "public",
      "tablename": "event_analytics",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "Anyone can insert event analytics",
      "qual": null,
      "roles": [
        "public"
      ],
      "schemaname": "public",
      "tablename": "event_analytics",
      "with_check": "(((user_id IS NULL) OR (user_id = ( SELECT auth.uid() AS uid))) AND (EXISTS ( SELECT 1\n   FROM events e\n  WHERE ((e.id = event_analytics.event_id) AND (e.status = 'published'::text) AND (e.visibility = 'public'::text) AND (e.is_cancelled IS NOT TRUE)))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Organizer members can read own event analytics",
      "qual": "(EXISTS ( SELECT 1\n   FROM (events e\n     JOIN organizer_users ou ON ((ou.organizer_id = e.submitted_by_organizer_id)))\n  WHERE ((e.id = event_analytics.event_id) AND (ou.user_id = auth.uid()))))",
      "roles": [
        "public"
      ],
      "schemaname": "public",
      "tablename": "event_analytics",
      "with_check": null
    },
    {
      "cmd": "ALL",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can manage moderation logs",
      "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))",
      "roles": [
        "public"
      ],
      "schemaname": "public",
      "tablename": "event_moderation_logs",
      "with_check": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Organizer members can read moderation logs",
      "qual": "(EXISTS ( SELECT 1\n   FROM (events e\n     JOIN organizer_users ou ON ((ou.organizer_id = e.submitted_by_organizer_id)))\n  WHERE ((e.id = event_moderation_logs.event_id) AND (ou.user_id = auth.uid()))))",
      "roles": [
        "public"
      ],
      "schemaname": "public",
      "tablename": "event_moderation_logs",
      "with_check": null
    },
    {
      "cmd": "ALL",
      "permissive": "PERMISSIVE",
      "policyname": "event sources admin all",
      "qual": "is_admin()",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "event_sources",
      "with_check": "is_admin()"
    },
    {
      "cmd": "ALL",
      "permissive": "PERMISSIVE",
      "policyname": "event sources organizer all own events",
      "qual": "(EXISTS ( SELECT 1\n   FROM (events e\n     JOIN organizer_users ou ON ((ou.organizer_id = e.submitted_by_organizer_id)))\n  WHERE ((e.id = event_sources.event_id) AND (ou.user_id = auth.uid()))))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "event_sources",
      "with_check": "(EXISTS ( SELECT 1\n   FROM (events e\n     JOIN organizer_users ou ON ((ou.organizer_id = e.submitted_by_organizer_id)))\n  WHERE ((e.id = event_sources.event_id) AND (ou.user_id = auth.uid()))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "event sources public read for published events",
      "qual": "(EXISTS ( SELECT 1\n   FROM events e\n  WHERE ((e.id = event_sources.event_id) AND (e.status = 'published'::text) AND (e.visibility = 'public'::text) AND (COALESCE(e.is_cancelled, false) = false))))",
      "roles": [
        "anon",
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "event_sources",
      "with_check": null
    },
    {
      "cmd": "ALL",
      "permissive": "PERMISSIVE",
      "policyname": "events admin all",
      "qual": "is_admin()",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "events",
      "with_check": "is_admin()"
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "events organizer insert own",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "events",
      "with_check": "((created_by = auth.uid()) AND (status = 'pending_review'::text) AND (visibility = 'public'::text) AND (submitted_by_organizer_id IN ( SELECT ou.organizer_id\n   FROM organizer_users ou\n  WHERE (ou.user_id = auth.uid()))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "events organizer read own",
      "qual": "(submitted_by_organizer_id IN ( SELECT ou.organizer_id\n   FROM organizer_users ou\n  WHERE (ou.user_id = auth.uid())))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "events",
      "with_check": null
    },
    {
      "cmd": "UPDATE",
      "permissive": "PERMISSIVE",
      "policyname": "events organizer update own",
      "qual": "(submitted_by_organizer_id IN ( SELECT ou.organizer_id\n   FROM organizer_users ou\n  WHERE (ou.user_id = auth.uid())))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "events",
      "with_check": "((status <> 'published'::text) AND (submitted_by_organizer_id IN ( SELECT ou.organizer_id\n   FROM organizer_users ou\n  WHERE (ou.user_id = auth.uid()))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "events public read published",
      "qual": "((status = 'published'::text) AND (visibility = 'public'::text) AND (COALESCE(is_cancelled, false) = false))",
      "roles": [
        "anon",
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "events",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "locations public read",
      "qual": "true",
      "roles": [
        "anon",
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "locations",
      "with_check": null
    },
    {
      "cmd": "DELETE",
      "permissive": "PERMISSIVE",
      "policyname": "locations_delete_admin",
      "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "locations",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "locations_insert_admin_or_organizer",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "locations",
      "with_check": "(is_admin() OR ((EXISTS ( SELECT 1\n   FROM profiles p\n  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'organizer'::text)))) AND (EXISTS ( SELECT 1\n   FROM organizer_users ou\n  WHERE (ou.user_id = ( SELECT auth.uid() AS uid))))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "locations_select_all",
      "qual": "true",
      "roles": [
        "anon",
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "locations",
      "with_check": null
    },
    {
      "cmd": "UPDATE",
      "permissive": "PERMISSIVE",
      "policyname": "locations_update_admin",
      "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "locations",
      "with_check": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))"
    },
    {
      "cmd": "ALL",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can manage notifications",
      "qual": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))",
      "roles": [
        "public"
      ],
      "schemaname": "public",
      "tablename": "notifications",
      "with_check": "(EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Users can read own notifications",
      "qual": "(user_id = auth.uid())",
      "roles": [
        "public"
      ],
      "schemaname": "public",
      "tablename": "notifications",
      "with_check": null
    },
    {
      "cmd": "UPDATE",
      "permissive": "PERMISSIVE",
      "policyname": "Users can update own notifications",
      "qual": "(user_id = auth.uid())",
      "roles": [
        "public"
      ],
      "schemaname": "public",
      "tablename": "notifications",
      "with_check": "(user_id = auth.uid())"
    },
    {
      "cmd": "ALL",
      "permissive": "PERMISSIVE",
      "policyname": "organizer users admin all",
      "qual": "is_admin()",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "organizer_users",
      "with_check": "is_admin()"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "organizer users admin read all",
      "qual": "is_admin()",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "organizer_users",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "organizer users read own",
      "qual": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "organizer_users",
      "with_check": null
    },
    {
      "cmd": "ALL",
      "permissive": "PERMISSIVE",
      "policyname": "organizers admin all",
      "qual": "is_admin()",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "organizers",
      "with_check": "is_admin()"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "organizers public read",
      "qual": "true",
      "roles": [
        "anon",
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "organizers",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "profiles admin read all",
      "qual": "is_admin()",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "profiles",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "profiles insert own safe",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "profiles",
      "with_check": "((id = ( SELECT auth.uid() AS uid)) AND ((role IS NULL) OR (role = ANY (ARRAY['user'::text, 'organizer'::text]))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "profiles read own",
      "qual": "(id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "profiles",
      "with_check": null
    },
    {
      "cmd": "UPDATE",
      "permissive": "PERMISSIVE",
      "policyname": "profiles update own safe",
      "qual": "(id = ( SELECT auth.uid() AS uid))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "profiles",
      "with_check": "((id = ( SELECT auth.uid() AS uid)) AND ((role IS NULL) OR (role = ANY (ARRAY['user'::text, 'organizer'::text])) OR ((role = 'admin'::text) AND is_admin())))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "saved_events admins read all",
      "qual": "is_admin()",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "saved_events",
      "with_check": null
    },
    {
      "cmd": "DELETE",
      "permissive": "PERMISSIVE",
      "policyname": "saved_events delete own",
      "qual": "(user_id = ( SELECT auth.uid() AS uid))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "saved_events",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "saved_events insert own public event",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "saved_events",
      "with_check": "((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1\n   FROM events\n  WHERE ((events.id = saved_events.event_id) AND (events.status = 'published'::text) AND (events.visibility = 'public'::text) AND (events.is_cancelled IS NOT TRUE)))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "saved_events organizers read event saves",
      "qual": "(EXISTS ( SELECT 1\n   FROM (events\n     JOIN organizer_users ON ((organizer_users.organizer_id = events.submitted_by_organizer_id)))\n  WHERE ((events.id = saved_events.event_id) AND (organizer_users.user_id = ( SELECT auth.uid() AS uid)))))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "saved_events",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "saved_events read own",
      "qual": "(user_id = ( SELECT auth.uid() AS uid))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "saved_events",
      "with_check": null
    }
  ],
  "functions": [
    {
      "name": "city_slugify",
      "arguments": "value text",
      "definition_md5": "f0f18487698bc339e823bc81e145c2f7",
      "owner": "postgres",
      "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "config": null,
      "language": "sql",
      "result_type": "text",
      "security_definer": false,
      "strict": false,
      "volatility": "i",
      "kind": "f",
      "parallel_mode": "u",
      "leakproof": false
    },
    {
      "name": "get_my_saved_events",
      "arguments": "p_event_id uuid",
      "definition_md5": "460f98be908fd43ba79fd5903aef2253",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "config": [
        "search_path=pg_catalog, public"
      ],
      "language": "sql",
      "result_type": "TABLE(event_id uuid, created_at timestamp with time zone)",
      "security_definer": true,
      "strict": false,
      "volatility": "s",
      "kind": "f",
      "parallel_mode": "u",
      "leakproof": false
    },
    {
      "name": "handle_new_user",
      "arguments": "",
      "definition_md5": "26085fa3b667ac7495ade91806ee8035",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,service_role=X/postgres}",
      "config": [
        "search_path=pg_catalog, public"
      ],
      "language": "plpgsql",
      "result_type": "trigger",
      "security_definer": true,
      "strict": false,
      "volatility": "v",
      "kind": "f",
      "parallel_mode": "u",
      "leakproof": false
    },
    {
      "name": "is_admin",
      "arguments": "",
      "definition_md5": "f7ab1aa8018aadea0df439f17b4641cf",
      "owner": "postgres",
      "acl": "{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "config": [
        "search_path=public"
      ],
      "language": "sql",
      "result_type": "boolean",
      "security_definer": true,
      "strict": false,
      "volatility": "v",
      "kind": "f",
      "parallel_mode": "u",
      "leakproof": false
    },
    {
      "name": "set_my_saved_event",
      "arguments": "p_event_id uuid, p_saved boolean",
      "definition_md5": "c918aa2f029d2b047ab8510b57de0564",
      "owner": "postgres",
      "acl": "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}",
      "config": [
        "search_path=pg_catalog, public"
      ],
      "language": "plpgsql",
      "result_type": "boolean",
      "security_definer": true,
      "strict": false,
      "volatility": "v",
      "kind": "f",
      "parallel_mode": "u",
      "leakproof": false
    }
  ],
  "roles": [
    {
      "bypass_rls": false,
      "can_login": false,
      "connection_limit": -1,
      "create_database": false,
      "create_role": false,
      "inherit": true,
      "replication": false,
      "role_name": "anon",
      "superuser": false
    },
    {
      "bypass_rls": false,
      "can_login": false,
      "connection_limit": -1,
      "create_database": false,
      "create_role": false,
      "inherit": true,
      "replication": false,
      "role_name": "authenticated",
      "superuser": false
    },
    {
      "bypass_rls": false,
      "can_login": true,
      "connection_limit": -1,
      "create_database": false,
      "create_role": false,
      "inherit": false,
      "replication": false,
      "role_name": "authenticator",
      "superuser": false
    },
    {
      "bypass_rls": false,
      "can_login": true,
      "connection_limit": -1,
      "create_database": false,
      "create_role": false,
      "inherit": false,
      "replication": false,
      "role_name": "cli_login_postgres",
      "superuser": false
    },
    {
      "bypass_rls": true,
      "can_login": true,
      "connection_limit": -1,
      "create_database": true,
      "create_role": true,
      "inherit": true,
      "replication": true,
      "role_name": "postgres",
      "superuser": false
    },
    {
      "bypass_rls": true,
      "can_login": false,
      "connection_limit": -1,
      "create_database": false,
      "create_role": false,
      "inherit": true,
      "replication": false,
      "role_name": "service_role",
      "superuser": false
    }
  ],
  "memberships": [
    {
      "admin_option": false,
      "granted_role": "anon",
      "grantor": "supabase_admin",
      "inherit_option": false,
      "member_role": "authenticator",
      "set_option": true
    },
    {
      "admin_option": true,
      "granted_role": "anon",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "postgres",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "authenticated",
      "grantor": "supabase_admin",
      "inherit_option": false,
      "member_role": "authenticator",
      "set_option": true
    },
    {
      "admin_option": true,
      "granted_role": "authenticated",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "postgres",
      "set_option": true
    },
    {
      "admin_option": true,
      "granted_role": "authenticator",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "postgres",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "authenticator",
      "grantor": "supabase_admin",
      "inherit_option": false,
      "member_role": "supabase_storage_admin",
      "set_option": true
    },
    {
      "admin_option": true,
      "granted_role": "pg_create_subscription",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "postgres",
      "set_option": true
    },
    {
      "admin_option": true,
      "granted_role": "pg_monitor",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "postgres",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "pg_monitor",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "supabase_etl_admin",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "pg_monitor",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "supabase_read_only_user",
      "set_option": true
    },
    {
      "admin_option": true,
      "granted_role": "pg_read_all_data",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "postgres",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "pg_read_all_data",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "supabase_etl_admin",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "pg_read_all_data",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "supabase_read_only_user",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "pg_read_all_settings",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "pg_monitor",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "pg_read_all_stats",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "pg_monitor",
      "set_option": true
    },
    {
      "admin_option": true,
      "granted_role": "pg_signal_backend",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "postgres",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "pg_stat_scan_tables",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "pg_monitor",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "postgres",
      "grantor": "supabase_admin",
      "inherit_option": false,
      "member_role": "cli_login_postgres",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "service_role",
      "grantor": "supabase_admin",
      "inherit_option": false,
      "member_role": "authenticator",
      "set_option": true
    },
    {
      "admin_option": true,
      "granted_role": "service_role",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "postgres",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "supabase_privileged_role",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "postgres",
      "set_option": true
    },
    {
      "admin_option": false,
      "granted_role": "supabase_privileged_role",
      "grantor": "supabase_admin",
      "inherit_option": true,
      "member_role": "supabase_etl_admin",
      "set_option": true
    }
  ],
  "column_acl": [],
  "triggers": [],
  "guard_functions": [],
  "identity": {
    "database": "postgres",
    "database_oid": "5",
    "system_identifier": "7642734024280108049",
    "auth_uid_md5": "ea3b41bf29e2ad573067939329aa088e"
  }
}
$reviewed$::jsonb;
  manifest jsonb;
  actual jsonb;
BEGIN
  IF current_user::text <> 'postgres' OR session_user::text <> 'postgres'
     OR current_database() <> 'postgres'
     OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
     OR current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'Requires the reviewed PostgreSQL 17 dedicated postgres session';
  END IF;
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '7642734024280108049'
     OR (SELECT oid::text FROM pg_database WHERE datname=current_database()) <> '5'
     OR md5(pg_get_functiondef('auth.uid()'::regprocedure)) <> 'ea3b41bf29e2ad573067939329aa088e' THEN
    RAISE EXCEPTION 'Database identity or auth.uid drift; stop and review the target';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
      AND (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole))
     OR has_parameter_privilege('anon','session_replication_role','SET')
     OR has_parameter_privilege('authenticated','session_replication_role','SET')
     OR pg_has_role('anon','postgres','MEMBER') OR pg_has_role('anon','service_role','MEMBER')
     OR pg_has_role('authenticated','postgres','MEMBER') OR pg_has_role('authenticated','service_role','MEMBER') THEN
    RAISE EXCEPTION 'Unsafe client role privileges';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid IN ('public.events'::regclass,'public.organizers'::regclass)
      OR inhparent IN ('public.events'::regclass,'public.organizers'::regclass))
     OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class IN ('public.events'::regclass,'public.organizers'::regclass)
       AND rulename <> '_RETURN') THEN
    RAISE EXCEPTION 'Unexpected inheritance or rewrite rules on changed tables';
  END IF;
  manifest := NULLIF(current_setting('eventmap.organizer_write_manifest',true),'')::jsonb;
  IF manifest IS NULL OR manifest->>'format' IS DISTINCT FROM 'eventmap-organizer-write-v1'
     OR manifest->>'source_catalog_sha256' IS DISTINCT FROM
       '6860e45f7d171bcb9681d2c36f51a4bc8413f1bc2d052decd27ca747fd7022a5'
     OR manifest->'baseline' IS DISTINCT FROM reviewed OR manifest->'applied' IS NULL THEN
    RAISE EXCEPTION 'Missing or unreviewed successful deployment manifest';
  END IF;
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
  IF actual IS DISTINCT FROM manifest->'applied' THEN
    RAISE EXCEPTION 'Applied catalog drift; exact rollback refused'
      USING DETAIL=(SELECT string_agg(k,', ' ORDER BY k) FROM jsonb_object_keys(actual) k
        WHERE actual->k IS DISTINCT FROM manifest->'applied'->k);
  END IF;
  IF jsonb_array_length(actual->'guard_functions') <> 2
     OR jsonb_array_length(actual->'triggers') <> 2 THEN
    RAISE EXCEPTION 'Guard installation inventory is incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(actual->'guard_functions') f WHERE
      f->>'arguments' <> '' OR f->>'owner' <> 'postgres' OR f->>'language' <> 'plpgsql'
      OR f->>'result_type' <> 'trigger' OR (f->>'security_definer')::boolean
      OR f->'config' IS DISTINCT FROM '["search_path=pg_catalog"]'::jsonb
      OR f->>'acl' <> '{postgres=X/postgres}'
      OR f->>'source_md5' IS DISTINCT FROM CASE f->>'name'
        WHEN 'guard_organizer_event_write' THEN 'e739491ae6b54a2b294e232e5602080f'
        WHEN 'guard_organizer_profile_write' THEN 'b5e3e36284a89ee0fdc5336d566ae825' ELSE NULL END)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(actual->'triggers') t WHERE
      t->>'enabled' <> 'O' OR t->>'update_columns' <> '' OR (t->>'argument_count')::integer <> 0
      OR (t->>'has_when')::boolean
      OR NOT ((t->>'table_name'='events' AND t->>'trigger_name'='events_guard_organizer_write'
        AND (t->>'type')::integer=23 AND t->>'function_identity'='public.guard_organizer_event_write()')
        OR (t->>'table_name'='organizers' AND t->>'trigger_name'='organizers_guard_organizer_write'
        AND (t->>'type')::integer=19 AND t->>'function_identity'='public.guard_organizer_profile_write()'))) THEN
    RAISE EXCEPTION 'Guard function body, configuration, ACL or trigger drift';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
      WHERE n.nspname='public' AND p.proname IN ('guard_organizer_event_write','guard_organizer_profile_write')
        AND acl.grantee <> (SELECT oid FROM pg_roles WHERE rolname='postgres'))
     OR has_function_privilege('anon','public.guard_organizer_event_write()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_organizer_event_write()','EXECUTE')
     OR has_function_privilege('anon','public.guard_organizer_profile_write()','EXECUTE')
     OR has_function_privilege('authenticated','public.guard_organizer_profile_write()','EXECUTE')
     OR has_table_privilege('anon','public.events','TRUNCATE')
     OR has_table_privilege('authenticated','public.events','TRUNCATE')
     OR has_table_privilege('anon','public.organizers','TRUNCATE')
     OR has_table_privilege('authenticated','public.organizers','TRUNCATE')
     OR has_table_privilege('anon','public.events','TRIGGER')
     OR has_table_privilege('authenticated','public.events','TRIGGER')
     OR has_table_privilege('anon','public.organizers','TRIGGER')
     OR has_table_privilege('authenticated','public.organizers','TRIGGER') THEN
    RAISE EXCEPTION 'Client effective ACL is broader than the reviewed package';
  END IF;
END $rollback_guard$;

-- Restore narrow event policies while both guards are still attached.
ALTER POLICY "events organizer insert own" ON public.events
  WITH CHECK (
    (created_by=auth.uid()) AND (status='pending_review'::text) AND (visibility='public'::text)
    AND (submitted_by_organizer_id IN (
      SELECT ou.organizer_id FROM public.organizer_users ou WHERE ou.user_id=auth.uid()))
  );
ALTER POLICY "events organizer update own" ON public.events
  USING (submitted_by_organizer_id IN (
    SELECT ou.organizer_id FROM public.organizer_users ou WHERE ou.user_id=auth.uid()))
  WITH CHECK (
    (status <> 'published'::text) AND (submitted_by_organizer_id IN (
      SELECT ou.organizer_id FROM public.organizer_users ou WHERE ou.user_id=auth.uid()))
  );
DROP POLICY "organizers organizer update own" ON public.organizers;
DROP TRIGGER events_guard_organizer_write ON public.events;
DROP TRIGGER organizers_guard_organizer_write ON public.organizers;
DROP FUNCTION public.guard_organizer_event_write() RESTRICT;
DROP FUNCTION public.guard_organizer_profile_write() RESTRICT;
-- Restore only the eight non-grantable postgres privilege entries removed above.
GRANT TRUNCATE, TRIGGER ON TABLE public.events, public.organizers TO anon, authenticated;

DO $rollback_verify$
DECLARE
  actual jsonb;
  manifest jsonb := current_setting('eventmap.organizer_write_manifest')::jsonb;
BEGIN
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
  IF actual IS DISTINCT FROM manifest->'baseline' THEN
    RAISE EXCEPTION 'Exact catalog restoration failed; entire rollback is aborted'
      USING DETAIL=(SELECT string_agg(k,', ' ORDER BY k) FROM jsonb_object_keys(actual) k
        WHERE actual->k IS DISTINCT FROM manifest->'baseline'->k);
  END IF;
  PERFORM set_config('eventmap.organizer_write_rollback_verified','true',false);
END $rollback_verify$;
COMMIT;
SELECT current_setting('eventmap.organizer_write_rollback_verified')::boolean AS exact_rollback_verified;
