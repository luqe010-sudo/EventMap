-- EventMap: RLS for user profiles and saved events.
--
-- Apply manually in Supabase SQL Editor after reviewing the comments below.
-- This script is idempotent for the policies and index it creates.
-- It does not create or rename tables/columns.

begin;

-- -----------------------------------------------------------------------------
-- profiles
-- Existing remote policies (checked 2026-06-22) are intentionally preserved:
--   - "profiles read own"
--   - "profiles admin read all"
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "profiles insert own safe" on public.profiles;
drop policy if exists "profiles update own safe" on public.profiles;

create policy "profiles insert own safe"
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
  and (role is null or role in ('user', 'organizer'))
);

create policy "profiles update own safe"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
  and (
    role is null
    or role in ('user', 'organizer')
    or (role = 'admin' and public.is_admin())
  )
);

-- No DELETE policy is added for profiles. Account deletion should be a separate
-- Auth flow so that auth.users and dependent rows are removed consistently.

-- -----------------------------------------------------------------------------
-- saved_events
-- Users manage only their own rows. Organizers may read event_id/created_at for
-- saves concerning events submitted by one of their organizer memberships; this
-- preserves aggregate organizer statistics without exposing saved_events.user_id.
-- -----------------------------------------------------------------------------

alter table public.saved_events enable row level security;

revoke all on table public.saved_events from anon;
revoke all on table public.saved_events from authenticated;

grant select (event_id, created_at) on public.saved_events to authenticated;
grant insert (user_id, event_id) on public.saved_events to authenticated;
grant delete on table public.saved_events to authenticated;

create unique index if not exists saved_events_unique_user_event_idx
on public.saved_events (user_id, event_id);

drop policy if exists "saved_events read own" on public.saved_events;
drop policy if exists "saved_events insert own public event" on public.saved_events;
drop policy if exists "saved_events delete own" on public.saved_events;
drop policy if exists "saved_events organizers read event saves" on public.saved_events;
drop policy if exists "saved_events admins read all" on public.saved_events;

create policy "saved_events read own"
on public.saved_events
for select
to authenticated
using (
  user_id = (select auth.uid())
);

create policy "saved_events insert own public event"
on public.saved_events
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.events
    where events.id = saved_events.event_id
      and events.status = 'published'
      and events.visibility = 'public'
      and events.is_cancelled is not true
  )
);

create policy "saved_events delete own"
on public.saved_events
for delete
to authenticated
using (
  user_id = (select auth.uid())
);

create policy "saved_events organizers read event saves"
on public.saved_events
for select
to authenticated
using (
  exists (
    select 1
    from public.events
    join public.organizer_users
      on organizer_users.organizer_id = events.submitted_by_organizer_id
    where events.id = saved_events.event_id
      and organizer_users.user_id = (select auth.uid())
  )
);

create policy "saved_events admins read all"
on public.saved_events
for select
to authenticated
using (
  public.is_admin()
);

-- authenticated does not receive SELECT on user_id. This intentionally keeps
-- identities private from organizer statistics. RLS determines row ownership,
-- so application SELECT/DELETE queries should not filter by user_id themselves.

commit;

-- Optional read-only verification after applying:
--
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('profiles', 'saved_events')
-- order by tablename, policyname;
