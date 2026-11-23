-- Proposal only. See organizer-account-upgrade-proposal.md for preflight and rollout.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = pg_catalog, pg_temp;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR 3 <> (
    SELECT count(*)
    FROM pg_catalog.pg_class AS relation
    WHERE relation.relnamespace = 'public'::regnamespace
      AND relation.relname IN ('profiles', 'organizers', 'organizer_users')
      AND relation.relkind = 'r'
      AND relation.relowner = 'postgres'::regrole
      AND relation.relrowsecurity AND NOT relation.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'Review organizer account table ownership and RLS';
  END IF;

  IF NOT pg_catalog.has_table_privilege(current_user, 'auth.users', 'SELECT') OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'auth.users'::regclass
      AND attribute.attname = 'is_anonymous'
      AND attribute.atttypid = 'boolean'::regtype
      AND NOT attribute.attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.organizers'::regclass
      AND constraint_row.contype = 'u'
      AND constraint_row.convalidated AND NOT constraint_row.condeferrable
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid) = 'UNIQUE (slug)'
  ) THEN
    RAISE EXCEPTION 'Review the Auth user and organizer slug schema';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.pronamespace = 'public'::regnamespace
      AND procedure_row.proname = 'upgrade_my_organizer_account'
  ) THEN
    RAISE EXCEPTION 'The organizer account RPC name is already in use';
  END IF;
END;
$preflight$;

CREATE FUNCTION public.upgrade_my_organizer_account(p_organizer_name text)
RETURNS uuid
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $upgrade$
DECLARE
  caller_id uuid := auth.uid();
  organizer_name text;
  profile_role text;
  target_organizer_id uuid;
  new_organizer_id uuid;
  base_slug text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM auth.users AS account
    WHERE account.id = caller_id AND account.is_anonymous IS NOT TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  organizer_name := pg_catalog.regexp_replace(p_organizer_name, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  IF organizer_name IS NULL OR organizer_name = '' OR pg_catalog.char_length(organizer_name) > 200
    OR organizer_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid organizer name' USING ERRCODE = '22023';
  END IF;

  -- A missing profile is initialized only for the authenticated caller. The
  -- primary key serializes concurrent initialization and the row lock serializes upgrades.
  INSERT INTO public.profiles (id, display_name, role)
    VALUES (caller_id, organizer_name, 'user')
    ON CONFLICT (id) DO NOTHING;

  SELECT profile.role INTO profile_role
    FROM public.profiles AS profile WHERE profile.id = caller_id FOR UPDATE;

  IF profile_role IS DISTINCT FROM 'user' AND profile_role IS DISTINCT FROM 'organizer' THEN
    RAISE EXCEPTION 'This account cannot be upgraded' USING ERRCODE = '42501';
  END IF;

  SELECT membership.organizer_id INTO target_organizer_id
    FROM public.organizer_users AS membership
    WHERE membership.user_id = caller_id AND membership.organizer_id IS NOT NULL
    ORDER BY (membership.role IS NOT DISTINCT FROM 'owner') DESC,
      membership.created_at ASC NULLS LAST, membership.id
    LIMIT 1 FOR KEY SHARE;

  IF profile_role = 'organizer' AND target_organizer_id IS NOT NULL THEN
    RETURN target_organizer_id;
  END IF;
  IF profile_role <> 'user' OR target_organizer_id IS NOT NULL THEN
    RAISE EXCEPTION 'This account requires membership review' USING ERRCODE = '42501';
  END IF;

  base_slug := pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.translate(organizer_name, 'ĄĆĘŁŃÓŚŹŻąćęłńóśźż', 'ACELNOSZZacelnoszz') COLLATE pg_catalog."C"),
    '[^a-z0-9]+', '-', 'g'), '-');
  base_slug := COALESCE(NULLIF(base_slug, ''), 'organizator');
  new_organizer_id := pg_catalog.gen_random_uuid();

  INSERT INTO public.organizers (id, name, slug, is_verified)
    VALUES (new_organizer_id, organizer_name, base_slug, false)
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO target_organizer_id;
  IF NOT FOUND THEN
    INSERT INTO public.organizers (id, name, slug, is_verified)
      VALUES (new_organizer_id, organizer_name,
        pg_catalog.rtrim(pg_catalog.left(base_slug, 167), '-') || '-' || pg_catalog.replace(new_organizer_id::text, '-', ''), false)
      RETURNING id INTO target_organizer_id;
  END IF;
  IF target_organizer_id IS DISTINCT FROM new_organizer_id THEN
    RAISE EXCEPTION 'Organizer was not created';
  END IF;

  INSERT INTO public.organizer_users (organizer_id, user_id, role)
    VALUES (target_organizer_id, caller_id, 'owner');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organizer membership was not created';
  END IF;

  UPDATE public.profiles AS profile SET role = 'organizer'
    WHERE profile.id = caller_id AND profile.role = 'user'
    RETURNING profile.role INTO profile_role;
  IF profile_role IS DISTINCT FROM 'organizer' THEN
    RAISE EXCEPTION 'Organizer profile was not updated';
  END IF;

  RETURN target_organizer_id;
END;
$upgrade$;

REVOKE ALL ON FUNCTION public.upgrade_my_organizer_account(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upgrade_my_organizer_account(text) TO authenticated;

DO $access$
DECLARE
  rpc_oid oid := 'public.upgrade_my_organizer_account(text)'::regprocedure;
BEGIN
  IF pg_catalog.has_function_privilege('anon', rpc_oid, 'EXECUTE')
    OR pg_catalog.has_function_privilege('service_role', rpc_oid, 'EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated', rpc_oid, 'EXECUTE')
    OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc AS rpc
      CROSS JOIN LATERAL pg_catalog.aclexplode(rpc.proacl) AS access
      WHERE rpc.oid = rpc_oid AND access.grantee NOT IN (rpc.proowner, 'authenticated'::regrole)
    ) THEN
    RAISE EXCEPTION 'Unexpected organizer account RPC permissions';
  END IF;
END;
$access$;

COMMIT;
