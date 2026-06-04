alter table public.cities enable row level security;

grant select on public.cities to anon, authenticated;
grant insert, update, delete on public.cities to authenticated;

drop policy if exists "cities_select_all" on public.cities;
drop policy if exists "cities_insert_admin_or_organizer" on public.cities;
drop policy if exists "cities_update_admin" on public.cities;
drop policy if exists "cities_delete_admin" on public.cities;

create policy "cities_select_all"
on public.cities
for select
to anon, authenticated
using (true);

create policy "cities_insert_admin_or_organizer"
on public.cities
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

create policy "cities_update_admin"
on public.cities
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

create policy "cities_delete_admin"
on public.cities
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
