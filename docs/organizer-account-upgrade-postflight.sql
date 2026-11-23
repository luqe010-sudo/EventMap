-- Catalog-only verification. All five columns should be true after deployment.
WITH rpc AS (
  SELECT p.oid, p.proowner, p.proacl, p.prosecdef, p.proconfig
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.upgrade_my_organizer_account(text)')
)
SELECT
  EXISTS (SELECT 1 FROM rpc) AS function_exists,
  EXISTS (
    SELECT 1 FROM rpc
    WHERE proowner = 'postgres'::pg_catalog.regrole AND prosecdef
      AND proconfig = ARRAY['search_path=pg_catalog, pg_temp']
  ) AS owner_and_security_match,
  EXISTS (
    SELECT 1 FROM rpc
    WHERE pg_catalog.md5(pg_catalog.replace(pg_catalog.pg_get_functiondef(oid), pg_catalog.chr(13) || pg_catalog.chr(10), pg_catalog.chr(10)))
      = '5b6e3988371fd90139de48090b9b4dd0'
  ) AS reviewed_definition_matches,
  EXISTS (
    SELECT 1 FROM rpc
    WHERE pg_catalog.has_function_privilege('authenticated', oid, 'EXECUTE')
      AND NOT pg_catalog.has_function_privilege('anon', oid, 'EXECUTE')
      AND NOT pg_catalog.has_function_privilege('service_role', oid, 'EXECUTE')
  ) AS effective_execute_matches,
  EXISTS (
    SELECT 1 FROM rpc
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_catalog.aclexplode(rpc.proacl) AS acl
      WHERE acl.grantee <> rpc.proowner AND (
        acl.grantee <> 'authenticated'::pg_catalog.regrole OR acl.is_grantable
      )
    )
  ) AS direct_grants_match;
