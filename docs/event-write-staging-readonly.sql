-- EventMap / A04: supplemental schema-only catalog audit, PostgreSQL 17.
-- Prepared 2026-10-06. This file has NOT been executed by its author.
-- One SELECT; no DDL/DML, application rows, passwords, tokens, or sequence values.
-- Production use is read-only. Confirm the project separately before execution.
-- Prefer a client-controlled READ ONLY transaction and an administrative catalog
-- reader. No RPC, trigger, extension installer, or application writer is invoked.
-- Existing CLI interface: supabase db query --linked --file <this file>.
-- Keep the result in ignored scratch/security-audit/, inspect it, then redact
-- before sharing: stored function/default/policy text can itself contain secrets.
-- Never export pg_authid, full role settings, auth.users rows, or Vault contents.
--
-- Why this is an audit instead of an executable A04 migration:
-- * The 2026-10-06 public snapshot did not capture owners, private schemas,
--   effective privileges, role memberships, extension placement, or default ACLs.
-- * A dedicated NOLOGIN RPC owner, private receipts, version column, and grants
--   require a reviewed migration and the separate approval specified in AGENTS.md.
-- * The upload attestation/server-channel contract and inventory/cutover of all
--   event writers (including importers), locations and notification is_read remain
--   implementation decisions. Catalog queries cannot resolve these decisions.
-- * Auth fixtures need the real managed auth.users structure and registration
--   trigger; guessing INSERT fixtures would not be a valid synthetic test.
--
-- Combine this output with docs/security-audit-readonly.sql, collected in the same
-- controlled read-only snapshot/window. Together they support a MANUALLY REVIEWED
-- application schema baseline without pg_dump. The existing audit supplies public
-- columns, constraint/index/trigger/policy definitions and custom function bodies.
-- It is NOT a restorable dump or automatic migration generator. Definitions,
-- dependency order, platform Auth/extension prerequisites, ownership, ACLs and
-- RLS must be reviewed before producing any executable baseline. No managed
-- auth objects/roles should be recreated blindly in staging. No test data here.
-- Missing objects appear as absent rows/null flags, never synthetic substitutes.
-- This supplement supplies owners/ACLs and additional metadata, not a DDL dump.
-- The baseline scope is non-extension public relations/routines/types, an existing
-- private.event_write_receipts if any, and metadata of managed auth.users.
-- Other private relations, extension objects, FDW options, data, comments, event
-- triggers, publications/subscriptions, storage and Auth service configuration
-- are outside this selected baseline. Extension-owned objects are identified by
-- prerequisites instead of copying their DDL. Function text may have dependencies
-- not recorded by pg_depend; the dependency report is not an execution ordering.
--
-- PG17 catalog/privilege semantics (official references):
-- https://www.postgresql.org/docs/17/catalog-pg-auth-members.html
-- https://www.postgresql.org/docs/17/catalog-pg-default-acl.html
-- https://www.postgresql.org/docs/17/catalog-pg-extension.html
-- https://www.postgresql.org/docs/17/functions-info.html
-- Effective privileges below include owner/PUBLIC/inherited privileges and
-- superuser behavior. They do not simulate a JWT, SET ROLE, or RLS row access.
-- A null object ACL uses hard-wired defaults, NOT today's pg_default_acl rows.
-- Default ACLs only affect subsequently created objects. Membership flags are
-- retained separately because INHERIT and SET privileges differ in PostgreSQL 17.

with
runtime_roles as (
  select r.oid, r.rolname
  from pg_catalog.pg_roles r
  where r.rolname in ('anon', 'authenticated', 'service_role', 'authenticator')
),
user_schemas as (
  select n.*
  from pg_catalog.pg_namespace n
  where n.nspname <> 'information_schema' and n.nspname !~ '^pg_'
),
scoped_relations as (
  select c.*, n.nspname as schema_name
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v', 'm', 'S', 'f') and (
    (n.nspname = 'public' and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_class'::regclass
        and d.objid = c.oid and d.deptype = 'e'
    ))
    or (n.nspname = 'private' and c.relname = 'event_write_receipts')
    or (n.nspname = 'auth' and c.relname = 'users')
  )
),
scoped_functions as (
  select p.*, n.nspname as schema_name,
    exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_proc'::regclass
        and d.objid = p.oid and d.deptype = 'e'
    ) as extension_owned
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where p.prokind in ('f', 'p') and (
    (n.nspname = 'public' and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_proc'::regclass
        and d.objid = p.oid and d.deptype = 'e'
    ))
    or p.oid in (
      select t.tgfoid from pg_catalog.pg_trigger t
      join scoped_relations c on c.oid = t.tgrelid
      where not t.tgisinternal
    )
    or (n.nspname = 'auth' and p.proname in ('uid', 'role', 'jwt'))
    or p.proname in ('digest', 'sha256', 'gen_random_uuid', 'uuid_generate_v4')
  )
),
scoped_types as (
  select t.*, n.nspname as schema_name
  from pg_catalog.pg_type t
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname in ('public', 'private') and t.typtype in ('e', 'd', 'r', 'm')
    and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_type'::regclass
        and d.objid = t.oid and d.deptype = 'e'
    )
)
select pg_catalog.jsonb_build_object(
  'audit_version', 'event-write-staging-readonly-v1',
  'combine_with', 'docs/security-audit-readonly.sql; same snapshot/window',
  'collected_at', pg_catalog.transaction_timestamp(),
  'database', pg_catalog.current_database(),
  'session_role', session_user,
  'effective_role', current_user,
  'server_version', pg_catalog.current_setting('server_version'),
  'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
  'session_search_path', pg_catalog.current_setting('search_path'),
  'coverage', pg_catalog.jsonb_build_object(
    'application_baseline', 'non-extension public objects; selected private receipts if present',
    'managed_auth', 'auth.users metadata only; prerequisite, not a recreation script',
    'acl', 'explicit/default-expanded ACLs plus selected runtime effective privileges',
    'data', 'none; no Auth/application rows, sequence last_value or credentials',
    'restore_ready', false,
    'remaining_decisions', pg_catalog.jsonb_build_array(
      'approved RPC owner/receipts/version design and grant boundaries',
      'image upload attestation or authenticated constrained server channel',
      'inventory and coordinated cutover of every event/location/source/moderation writer',
      'notification is_read path, managed Auth fixtures and staging behavioral tests'
    )
  ),
  'presence', pg_catalog.jsonb_build_object(
    'private_schema', exists (select 1 from user_schemas where nspname = 'private'),
    'receipts_relation', exists (select 1 from scoped_relations
      where schema_name = 'private' and relname = 'event_write_receipts'),
    'write_version_column', exists (
      select 1 from scoped_relations c
      join pg_catalog.pg_attribute a on a.attrelid = c.oid
      where c.schema_name = 'public' and c.relname = 'events'
        and a.attname = 'write_version' and a.attnum > 0 and not a.attisdropped
    ),
    'auth_users_relation', exists (select 1 from scoped_relations
      where schema_name = 'auth' and relname = 'users')
  ),
  'roles', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.role_name) from (
    select r.rolname as role_name, r.rolsuper as superuser, r.rolinherit as inherit,
      r.rolcreaterole as create_role, r.rolcreatedb as create_database,
      r.rolcanlogin as can_login, r.rolreplication as replication,
      r.rolbypassrls as bypass_rls, r.rolconnlimit as connection_limit
    from pg_catalog.pg_roles r
  ) x),
  'memberships', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.granted_role, x.member_role, x.grantor) from (
    select parent.rolname as granted_role, member.rolname as member_role,
      grantor.rolname as grantor, m.admin_option, m.inherit_option, m.set_option
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles parent on parent.oid = m.roleid
    join pg_catalog.pg_roles member on member.oid = m.member
    join pg_catalog.pg_roles grantor on grantor.oid = m.grantor
  ) x),
  'schemas', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.schema_name) from (
    select n.nspname as schema_name, pg_catalog.pg_get_userbyid(n.nspowner) as owner,
      n.nspacl::text as explicit_acl
    from user_schemas n
  ) x),
  'schema_acl', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.grantee, x.privilege_type) from (
    select n.nspname as schema_name, pg_catalog.pg_get_userbyid(a.grantor) as grantor,
      case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as grantee,
      a.privilege_type, a.is_grantable
    from user_schemas n cross join lateral pg_catalog.aclexplode(
      coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) a
  ) x),
  'effective_schema_privileges', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.role_name) from (
    select n.nspname as schema_name, r.rolname as role_name,
      pg_catalog.has_schema_privilege(r.oid, n.oid, 'USAGE') as usage,
      pg_catalog.has_schema_privilege(r.oid, n.oid, 'CREATE') as create_objects
    from user_schemas n cross join runtime_roles r
  ) x),
  'extensions', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.extension_name) from (
    select e.extname as extension_name, e.extversion as version, n.nspname as schema_name,
      pg_catalog.pg_get_userbyid(e.extowner) as owner, e.extrelocatable as relocatable,
      (select pg_catalog.jsonb_agg(pg_catalog.pg_describe_object(
        'pg_catalog.pg_class'::regclass, object_oid, 0) order by object_oid)
        from pg_catalog.unnest(e.extconfig) as q(object_oid)) as configuration_relations
    from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid = e.extnamespace
  ) x),
  'default_acl', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.creator_role, x.schema_name, x.object_type, x.grantee, x.privilege_type) from (
    select pg_catalog.pg_get_userbyid(d.defaclrole) as creator_role,
      case when d.defaclnamespace = 0 then '<global>' else n.nspname end as schema_name,
      d.defaclobjtype as object_type, d.defaclacl::text as explicit_acl,
      pg_catalog.pg_get_userbyid(a.grantor) as grantor,
      case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as grantee,
      a.privilege_type, a.is_grantable
    from pg_catalog.pg_default_acl d
    left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
    left join lateral pg_catalog.aclexplode(d.defaclacl) a on true
  ) x),
  'safe_role_settings', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.database_name, x.role_name, x.setting_name) from (
    select case when s.setdatabase = 0 then '<all>' else db.datname end as database_name,
      case when s.setrole = 0 then '<all>' else r.rolname end as role_name,
      pg_catalog.split_part(setting, '=', 1) as setting_name,
      pg_catalog.substr(setting, pg_catalog.strpos(setting, '=') + 1) as setting_value
    from pg_catalog.pg_db_role_setting s
    left join pg_catalog.pg_database db on db.oid = s.setdatabase
    left join pg_catalog.pg_roles r on r.oid = s.setrole
    cross join lateral pg_catalog.unnest(s.setconfig) q(setting)
    where pg_catalog.split_part(setting, '=', 1) in (
      'search_path', 'pgrst.db_schemas', 'pgrst.db_extra_search_path', 'row_security')
  ) x),
  'relations', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.relation_name) from (
    select c.schema_name, c.relname as relation_name, c.relkind as kind,
      pg_catalog.pg_get_userbyid(c.relowner) as owner,
      c.relpersistence as persistence, c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced, c.relispartition as is_partition,
      c.reloptions as options, c.relacl::text as explicit_acl,
      case when c.relkind = 'p' then pg_catalog.pg_get_partkeydef(c.oid) end as partition_key,
      case when c.relispartition then pg_catalog.pg_get_expr(c.relpartbound, c.oid) end as partition_bound,
      case when c.relkind in ('v', 'm') then pg_catalog.pg_get_viewdef(c.oid, false) end as view_definition,
      (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'schema', pn.nspname, 'name', pc.relname, 'sequence', i.inhseqno) order by i.inhseqno)
        from pg_catalog.pg_inherits i join pg_catalog.pg_class pc on pc.oid = i.inhparent
        join pg_catalog.pg_namespace pn on pn.oid = pc.relnamespace where i.inhrelid = c.oid) as parents
    from scoped_relations c
  ) x),
  'auth_users_columns', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.relation_name, x.position) from (
    select c.schema_name, c.relname as relation_name, a.attnum as position,
      a.attname as column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
      tn.nspname as type_schema, t.typname as type_name, a.attnotnull as not_null,
      pg_catalog.pg_get_expr(d.adbin, d.adrelid, false) as default_or_generation_expression,
      a.attidentity as identity_kind, a.attgenerated as generated_kind,
      case when a.attcollation <> 0 then cn.nspname end as collation_schema,
      case when a.attcollation <> 0 then coll.collname end as collation_name,
      a.attacl::text as explicit_acl
    from scoped_relations c join pg_catalog.pg_attribute a on a.attrelid = c.oid
    join pg_catalog.pg_type t on t.oid = a.atttypid
    join pg_catalog.pg_namespace tn on tn.oid = t.typnamespace
    left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    left join pg_catalog.pg_collation coll on coll.oid = a.attcollation
    left join pg_catalog.pg_namespace cn on cn.oid = coll.collnamespace
    where a.attnum > 0 and not a.attisdropped
      and c.schema_name = 'auth' and c.relname = 'users'
  ) x),
  'relation_acl', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.relation_name, x.grantee, x.privilege_type) from (
    select c.schema_name, c.relname as relation_name, pg_catalog.pg_get_userbyid(a.grantor) as grantor,
      case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as grantee,
      a.privilege_type, a.is_grantable
    from scoped_relations c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,
      pg_catalog.acldefault(case when c.relkind = 'S' then 's'::"char" else 'r'::"char" end, c.relowner))) a
  ) x),
  'column_acl', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.relation_name, x.column_name, x.grantee, x.privilege_type) from (
    select c.schema_name, c.relname as relation_name, col.attname as column_name,
      pg_catalog.pg_get_userbyid(a.grantor) as grantor,
      case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as grantee,
      a.privilege_type, a.is_grantable
    from scoped_relations c join pg_catalog.pg_attribute col on col.attrelid = c.oid
    cross join lateral pg_catalog.aclexplode(col.attacl) a
    where col.attnum > 0 and not col.attisdropped and c.relkind <> 'S'
  ) x),
  'effective_relation_privileges', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.relation_name, x.role_name, x.privilege_type) from (
    select c.schema_name, c.relname as relation_name, r.rolname as role_name, p.privilege_type,
      pg_catalog.has_table_privilege(r.oid, c.oid, p.privilege_type) as allowed
    from scoped_relations c cross join runtime_roles r
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) p(privilege_type)
    where c.relkind <> 'S'
  ) x),
  'effective_column_privileges', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.relation_name, x.position, x.role_name, x.privilege_type) from (
    select c.schema_name, c.relname as relation_name, a.attnum as position,
      a.attname as column_name, r.rolname as role_name, p.privilege_type,
      pg_catalog.has_column_privilege(r.oid, c.oid, a.attnum, p.privilege_type) as allowed
    from scoped_relations c join pg_catalog.pg_attribute a on a.attrelid = c.oid
    cross join runtime_roles r
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) p(privilege_type)
    where a.attnum > 0 and not a.attisdropped and c.relkind <> 'S'
  ) x),
  'constraints', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.relation_name, x.constraint_name) from (
    select n.nspname as schema_name, c.relname as relation_name, k.conname as constraint_name,
      k.contype as kind, k.convalidated as validated, k.condeferrable as deferrable,
      k.condeferred as initially_deferred, k.conislocal as is_local,
      k.coninhcount as inheritance_count, k.connoinherit as no_inherit,
      rn.nspname as referenced_schema, rc.relname as referenced_relation,
      pg_catalog.pg_get_constraintdef(k.oid, false) as definition
    from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid = k.conrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    left join pg_catalog.pg_class rc on rc.oid = k.confrelid
    left join pg_catalog.pg_namespace rn on rn.oid = rc.relnamespace
    where k.conrelid in (select oid from scoped_relations)
      or k.confrelid in (select oid from scoped_relations)
  ) x),
  'index_state', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.relation_name, x.index_name) from (
    select c.schema_name, c.relname as relation_name, ic.relname as index_name,
      i.indisunique as is_unique, i.indisprimary as is_primary,
      i.indisvalid as valid, i.indisready as ready, i.indislive as live,
      k.conname as owning_constraint,
      case when c.schema_name = 'auth' then pg_catalog.pg_get_indexdef(i.indexrelid, 0, false) end as auth_index_definition
    from scoped_relations c join pg_catalog.pg_index i on i.indrelid = c.oid
    join pg_catalog.pg_class ic on ic.oid = i.indexrelid
    left join pg_catalog.pg_constraint k on k.conindid = i.indexrelid
      and k.conrelid = c.oid and k.contype in ('p', 'u', 'x')
  ) x),
  'functions', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.function_name, x.identity_arguments) from (
    select p.schema_name, p.proname as function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
      pg_catalog.pg_get_function_result(p.oid) as result_type,
      pg_catalog.pg_get_userbyid(p.proowner) as owner, l.lanname as language,
      p.prokind as kind, p.prosecdef as security_definer, p.proleakproof as leakproof,
      p.provolatile as volatility, p.proparallel as parallel_mode,
      p.proisstrict as strict, p.extension_owned, p.proacl::text as explicit_acl,
      (select pg_catalog.jsonb_agg(setting order by setting)
        from pg_catalog.unnest(p.proconfig) q(setting)
        where pg_catalog.split_part(setting, '=', 1) in (
          'search_path', 'row_security', 'statement_timeout', 'lock_timeout',
          'default_transaction_isolation')) as safe_configuration
    from scoped_functions p join pg_catalog.pg_language l on l.oid = p.prolang
  ) x),
  'function_acl', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.function_name, x.identity_arguments, x.grantee) from (
    select p.schema_name, p.proname as function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
      pg_catalog.pg_get_userbyid(a.grantor) as grantor,
      case when a.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as grantee,
      a.privilege_type, a.is_grantable
    from scoped_functions p cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
  ) x),
  'effective_function_privileges', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.function_name, x.identity_arguments, x.role_name) from (
    select p.schema_name, p.proname as function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
      r.rolname as role_name, pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE') as execute
    from scoped_functions p cross join runtime_roles r
  ) x),
  'effective_sequence_privileges', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.sequence_name, x.role_name, x.privilege_type) from (
    select c.schema_name, c.relname as sequence_name, r.rolname as role_name, p.privilege_type,
      pg_catalog.has_sequence_privilege(r.oid, c.oid, p.privilege_type) as allowed
    from scoped_relations c cross join runtime_roles r
    cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) p(privilege_type)
    where c.relkind = 'S'
  ) x),
  'sequences', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.sequence_name) from (
    select c.schema_name, c.relname as sequence_name,
      pg_catalog.format_type(s.seqtypid, -1) as data_type, s.seqstart as start_value,
      s.seqincrement as increment, s.seqmin as minimum, s.seqmax as maximum,
      s.seqcache as cache, s.seqcycle as cycle,
      (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'kind', d.deptype, 'column', pg_catalog.pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid)))
        from pg_catalog.pg_depend d where d.classid = 'pg_catalog.pg_class'::regclass
          and d.objid = c.oid and d.refclassid = 'pg_catalog.pg_class'::regclass
          and d.deptype in ('a', 'i')) as owned_by
    from scoped_relations c join pg_catalog.pg_sequence s on s.seqrelid = c.oid
  ) x),
  'application_types', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.schema_name, x.type_name) from (
    select t.schema_name, t.typname as type_name, t.typtype as kind,
      pg_catalog.pg_get_userbyid(t.typowner) as owner, t.typacl::text as explicit_acl,
      case when t.typtype = 'd' then pg_catalog.format_type(t.typbasetype, t.typtypmod) end as domain_base_type,
      t.typnotnull as domain_not_null, t.typdefault as domain_default,
      (select pg_catalog.jsonb_agg(e.enumlabel order by e.enumsortorder)
        from pg_catalog.pg_enum e where e.enumtypid = t.oid) as enum_labels,
      (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', k.conname, 'validated', k.convalidated,
        'definition', pg_catalog.pg_get_constraintdef(k.oid, false)) order by k.conname)
        from pg_catalog.pg_constraint k where k.contypid = t.oid) as domain_constraints,
      (select pg_catalog.to_jsonb(r) from (
        select pg_catalog.format_type(pr.rngsubtype, -1) as subtype,
          pg_catalog.pg_describe_object('pg_catalog.pg_opclass'::regclass, pr.rngsubopc, 0) as subtype_opclass,
          case when pr.rngcollation <> 0 then pg_catalog.pg_describe_object(
            'pg_catalog.pg_collation'::regclass, pr.rngcollation, 0) end as collation,
          pr.rngcanonical::regprocedure::text as canonical_function,
          pr.rngsubdiff::regprocedure::text as difference_function,
          pg_catalog.format_type(pr.rngtypid, -1) as range_type,
          pg_catalog.format_type(pr.rngmultitypid, -1) as multirange_type
        from pg_catalog.pg_range pr where pr.rngtypid = t.oid or pr.rngmultitypid = t.oid
      ) r) as range_parameters
    from scoped_types t
  ) x),
  'dependencies', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    order by x.object, x.referenced_object, x.kind) from (
    select pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid) as object,
      pg_catalog.pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) as referenced_object,
      d.deptype as kind
    from pg_catalog.pg_depend d where (
      (d.classid = 'pg_catalog.pg_class'::regclass and d.objid in (select oid from scoped_relations))
      or (d.classid = 'pg_catalog.pg_proc'::regclass and d.objid in (select oid from scoped_functions))
      or (d.classid = 'pg_catalog.pg_type'::regclass and d.objid in (select oid from scoped_types))
    )
  ) x)
) as audit;
