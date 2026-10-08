-- EventMap local staging: exact application column types from PostgreSQL 17.
-- Metadata-only SELECT; no application/Auth rows, DDL, DML or sequences.
-- Reviewed separately before use. Store output only in ignored scratch/.
-- The CLI does not enforce READ ONLY mode; this statement only reads catalogs.
SELECT pg_catalog.jsonb_build_object(
  'collected_at', pg_catalog.statement_timestamp(),
  'server_version', pg_catalog.current_setting('server_version'),
  'columns', pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'schema_name', n.nspname,
    'relation_name', c.relname,
    'position', a.attnum,
    'column_name', a.attname,
    'type_schema', tn.nspname,
    'type_name', t.typname,
    'formatted_type', pg_catalog.format_type(a.atttypid, a.atttypmod),
    'type_modifier', a.atttypmod,
    'array_dimensions', a.attndims,
    'not_null', a.attnotnull,
    'identity_kind', a.attidentity,
    'generated_kind', a.attgenerated,
    'default_or_generation_expression', pg_catalog.pg_get_expr(ad.adbin, ad.adrelid),
    'collation_schema', cn.nspname,
    'collation_name', co.collname,
    'storage_kind', a.attstorage,
    'compression_kind', a.attcompression,
    'attribute_options', a.attoptions
  ) ORDER BY c.relname, a.attnum)
) AS audit
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
JOIN pg_catalog.pg_namespace tn ON tn.oid = t.typnamespace
LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
LEFT JOIN pg_catalog.pg_collation co ON co.oid = a.attcollation
LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid = co.collnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_depend x
    WHERE x.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
      AND x.objid = c.oid AND x.objsubid = 0 AND x.deptype = 'e'
  );
