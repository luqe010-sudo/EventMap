-- EventMap Supabase maintenance SQL
-- Generated from the current application queries.
-- Review before running in Supabase SQL Editor.
-- Do not run the optional FK/unique sections if existing data contains duplicates or orphan rows.

begin;

-- Public event listing and detail queries.
create index if not exists events_public_start_at_idx
on public.events (start_at)
where status = 'published'
  and visibility = 'public'
  and (is_cancelled is null or is_cancelled = false);

create index if not exists events_category_start_at_idx
on public.events (category_id, start_at);

create index if not exists events_status_created_at_idx
on public.events (status, created_at desc);

create index if not exists events_created_at_idx
on public.events (created_at desc);

create index if not exists events_submitted_by_organizer_start_at_idx
on public.events (submitted_by_organizer_id, start_at desc);

-- Slugs used by route lookups.
create unique index if not exists events_slug_unique_idx
on public.events (slug);

create unique index if not exists categories_slug_unique_idx
on public.categories (slug);

create unique index if not exists city_pages_slug_unique_idx
on public.city_pages (slug);

create unique index if not exists organizers_slug_unique_idx
on public.organizers (slug);

-- Form option lists and city/category lookups.
create index if not exists categories_sort_name_idx
on public.categories (sort_order, name);

create index if not exists city_pages_active_slug_idx
on public.city_pages (is_active, slug);

create index if not exists organizers_name_idx
on public.organizers (name);

create index if not exists locations_city_idx
on public.locations (city);

-- Organizer access and relation cleanup.
create index if not exists organizer_users_user_id_idx
on public.organizer_users (user_id);

create index if not exists organizer_users_organizer_id_idx
on public.organizer_users (organizer_id);

create unique index if not exists organizer_users_unique_user_organizer_idx
on public.organizer_users (user_id, organizer_id);

create index if not exists event_sources_event_id_created_at_idx
on public.event_sources (event_id, created_at);

create unique index if not exists event_tags_unique_event_tag_idx
on public.event_tags (event_id, tag_id);

create unique index if not exists saved_events_unique_user_event_idx
on public.saved_events (user_id, event_id);

commit;

-- Optional FK constraints to Supabase Auth.
-- Run only after checking that all referenced user IDs exist in auth.users.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_id_auth_users_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_auth_users_fkey
      foreign key (id) references auth.users(id)
      on delete cascade
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizer_users_user_id_auth_users_fkey'
  ) then
    alter table public.organizer_users
      add constraint organizer_users_user_id_auth_users_fkey
      foreign key (user_id) references auth.users(id)
      on delete cascade
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_created_by_auth_users_fkey'
  ) then
    alter table public.events
      add constraint events_created_by_auth_users_fkey
      foreign key (created_by) references auth.users(id)
      on delete set null
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'saved_events_user_id_auth_users_fkey'
  ) then
    alter table public.saved_events
      add constraint saved_events_user_id_auth_users_fkey
      foreign key (user_id) references auth.users(id)
      on delete cascade
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notification_preferences_user_id_auth_users_fkey'
  ) then
    alter table public.notification_preferences
      add constraint notification_preferences_user_id_auth_users_fkey
      foreign key (user_id) references auth.users(id)
      on delete cascade
      not valid;
  end if;
end $$;

-- After verifying data, validate constraints one by one:
-- alter table public.profiles validate constraint profiles_id_auth_users_fkey;
-- alter table public.organizer_users validate constraint organizer_users_user_id_auth_users_fkey;
-- alter table public.events validate constraint events_created_by_auth_users_fkey;
-- alter table public.saved_events validate constraint saved_events_user_id_auth_users_fkey;
-- alter table public.notification_preferences validate constraint notification_preferences_user_id_auth_users_fkey;
