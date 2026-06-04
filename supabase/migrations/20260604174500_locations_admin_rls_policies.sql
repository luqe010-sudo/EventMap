alter table public.locations enable row level security;

grant select on public.locations to anon, authenticated;
grant insert, update, delete on public.locations to authenticated;

drop policy if exists "locations_select_all" on public.locations;
drop policy if exists "locations_insert_admin_or_organizer" on public.locations;
drop policy if exists "locations_update_admin" on public.locations;
drop policy if exists "locations_delete_admin" on public.locations;

create policy "locations_select_all"
on public.locations
for select
to anon, authenticated
using (true);

create policy "locations_insert_admin_or_organizer"
on public.locations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'organizer')
  )
);

create policy "locations_update_admin"
on public.locations
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "locations_delete_admin"
on public.locations
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
