create or replace function public.city_slugify(value text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        translate(
          lower(trim(coalesce(value, ''))),
          'ąćęłńóśźż',
          'acelnoszz'
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '(^-+|-+$)',
      '',
      'g'
    ),
    ''
  );
$$;

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  county text,
  voivodeship text,
  latitude double precision,
  longitude double precision,
  is_active boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone
);

create unique index if not exists cities_slug_unique_idx
on public.cities (slug);

create index if not exists cities_active_slug_idx
on public.cities (is_active, slug);

alter table public.locations
add column if not exists city_id uuid;

alter table public.city_pages
add column if not exists city_id uuid;

with raw_cities as (
  select
    trim(city) as name,
    nullif(trim(county), '') as county,
    nullif(trim(voivodeship), '') as voivodeship,
    latitude,
    longitude,
    true as is_active,
    2 as source_priority
  from public.locations
  where nullif(trim(city), '') is not null

  union all

  select
    trim(city) as name,
    nullif(trim(county), '') as county,
    nullif(trim(voivodeship), '') as voivodeship,
    latitude,
    longitude,
    coalesce(is_active, true) as is_active,
    1 as source_priority
  from public.city_pages
  where nullif(trim(city), '') is not null
),
ranked as (
  select
    *,
    public.city_slugify(name) as base_slug,
    row_number() over (
      partition by public.city_slugify(name), coalesce(public.city_slugify(county), ''), coalesce(public.city_slugify(voivodeship), '')
      order by source_priority, latitude nulls last, longitude nulls last
    ) as rank_in_region
  from raw_cities
),
deduped as (
  select
    name,
    county,
    voivodeship,
    latitude,
    longitude,
    is_active,
    base_slug
  from ranked
  where rank_in_region = 1
),
disambiguated as (
  select
    *,
    case
      when name_count = 1 then base_slug
      when county is not null then concat(base_slug, '-', public.city_slugify(county))
      when voivodeship is not null then concat(base_slug, '-', public.city_slugify(voivodeship))
      else base_slug
    end as preferred_slug
  from (
    select
      *,
      count(*) over (partition by base_slug) as name_count
    from deduped
  ) as unique_city_names
),
slugged as (
  select
    *,
    row_number() over (partition by preferred_slug order by name, county nulls last, voivodeship nulls last) as slug_rank
  from disambiguated
)
insert into public.cities (name, slug, county, voivodeship, latitude, longitude, is_active)
select
  name,
  case when slug_rank = 1 then preferred_slug else concat(preferred_slug, '-', slug_rank::text) end,
  county,
  voivodeship,
  latitude,
  longitude,
  is_active
from slugged
where base_slug is not null
on conflict (slug) do update
set
  name = excluded.name,
  county = coalesce(public.cities.county, excluded.county),
  voivodeship = coalesce(public.cities.voivodeship, excluded.voivodeship),
  latitude = coalesce(public.cities.latitude, excluded.latitude),
  longitude = coalesce(public.cities.longitude, excluded.longitude),
  is_active = public.cities.is_active or excluded.is_active,
  updated_at = now();

update public.locations as location
set city_id = city.id
from public.cities as city
where location.city_id is null
  and nullif(trim(location.city), '') is not null
  and public.city_slugify(location.city) = public.city_slugify(city.name)
  and (
    location.county is null
    or city.county is null
    or public.city_slugify(location.county) = public.city_slugify(city.county)
  )
  and (
    location.voivodeship is null
    or city.voivodeship is null
    or public.city_slugify(location.voivodeship) = public.city_slugify(city.voivodeship)
  );

update public.city_pages as city_page
set city_id = city.id
from public.cities as city
where city_page.city_id is null
  and nullif(trim(city_page.city), '') is not null
  and public.city_slugify(city_page.city) = public.city_slugify(city.name)
  and (
    city_page.county is null
    or city.county is null
    or public.city_slugify(city_page.county) = public.city_slugify(city.county)
  )
  and (
    city_page.voivodeship is null
    or city.voivodeship is null
    or public.city_slugify(city_page.voivodeship) = public.city_slugify(city.voivodeship)
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'locations_city_id_fkey'
  ) then
    alter table public.locations
      add constraint locations_city_id_fkey
      foreign key (city_id)
      references public.cities(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'city_pages_city_id_fkey'
  ) then
    alter table public.city_pages
      add constraint city_pages_city_id_fkey
      foreign key (city_id)
      references public.cities(id)
      on delete cascade;
  end if;
end $$;

create index if not exists locations_city_id_idx
on public.locations (city_id);

create unique index if not exists city_pages_city_id_unique_idx
on public.city_pages (city_id)
where city_id is not null;

drop view if exists public.city_page_event_counts cascade;

alter table public.locations
  drop column if exists city;

alter table public.city_pages
  drop column if exists city,
  drop column if exists county,
  drop column if exists voivodeship,
  drop column if exists latitude,
  drop column if exists longitude,
  drop column if exists slug,
  drop column if exists is_active;

create or replace view public.city_page_event_counts as
select
  city_page.id as city_page_id,
  city.id as city_id,
  city.name as city,
  count(event.id)::int as event_count
from public.city_pages as city_page
join public.cities as city
  on city.id = city_page.city_id
left join public.locations as location
  on location.city_id = city.id
left join public.events as event
  on event.location_id = location.id
group by city_page.id, city.id, city.name;
