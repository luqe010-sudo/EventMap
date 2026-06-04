with candidates as (
  select
    city.id,
    city.slug,
    public.city_slugify(city.name) as base_slug
  from public.cities as city
  where city.slug <> public.city_slugify(city.name)
    and city.slug like public.city_slugify(city.name) || '-%'
),
safe_updates as (
  select candidate.*
  from candidates as candidate
  where not exists (
    select 1
    from public.cities as existing
    where existing.slug = candidate.base_slug
      and existing.id <> candidate.id
  )
  and (
    select count(*)
    from public.cities as same_name
    where public.city_slugify(same_name.name) = candidate.base_slug
  ) = 1
)
update public.cities as city
set
  slug = safe_updates.base_slug,
  updated_at = now()
from safe_updates
where city.id = safe_updates.id;
