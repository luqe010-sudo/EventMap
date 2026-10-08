-- APPROVED AND APPLIED to EventMap on 2026-10-05 after explicit user approval.
-- Historical filename retained to preserve audit/report links.
-- Do not reapply automatically; review current deployed definition first.
-- Based on the deployed public.handle_new_user() inspected on 2026-10-05.
-- Prevents account creation metadata from assigning an administrator role.
-- Does not modify existing users, tables, columns or row-level policies.
-- Organiser creation and the current slug behaviour are preserved.

begin;
set local lock_timeout = '5s';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
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

-- Trigger execution does not need direct API EXECUTE grants for these roles.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;

-- Read-only verification after applying:
-- select pg_get_functiondef('public.handle_new_user()'::regprocedure);
-- select has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
--        has_function_privilege('authenticated', 'public.handle_new_user()', 'execute');
-- In staging, verify user / organizer / invalid / admin signup metadata and
-- confirm that only user or organizer profiles can be created by signup.
