do $$
declare
  demo_organizer_id uuid;
begin
  select id
  into demo_organizer_id
  from organizers
  order by created_at nulls last
  limit 1;

  if demo_organizer_id is null then
    raise exception 'Cannot seed demo events: organizers table is empty.';
  end if;

  insert into locations (name, address, city, voivodeship, latitude, longitude, google_maps_url)
  select *
  from (
    values
      ('Plac przed Lodz Fabryczna', 'pl. Bronislawa Salacinskiego 1', 'Lodz', 'lodzkie', 51.7687, 19.4690, 'https://www.google.com/maps/search/?api=1&query=51.7687%2C19.469'),
      ('Rynek Trybunalski', 'Rynek Trybunalski', 'Piotrkow Trybunalski', 'lodzkie', 51.4052, 19.7038, 'https://www.google.com/maps/search/?api=1&query=51.4052%2C19.7038'),
      ('Nowy Rynek', 'Nowy Rynek', 'Lowicz', 'lodzkie', 52.1071, 19.9447, 'https://www.google.com/maps/search/?api=1&query=52.1071%2C19.9447'),
      ('Park Traugutta', 'Park im. Romualda Traugutta', 'Kutno', 'lodzkie', 52.2323, 19.3576, 'https://www.google.com/maps/search/?api=1&query=52.2323%2C19.3576'),
      ('Park Miejski', 'ul. Sienkiewicza', 'Skierniewice', 'lodzkie', 51.9572, 20.1464, 'https://www.google.com/maps/search/?api=1&query=51.9572%2C20.1464'),
      ('Rynek w Sieradzu', 'Rynek', 'Sieradz', 'lodzkie', 51.5958, 18.7302, 'https://www.google.com/maps/search/?api=1&query=51.5958%2C18.7302'),
      ('Amfiteatr nad Wisla', 'Rybaki 15', 'Plock', 'mazowieckie', 52.5463, 19.6855, 'https://www.google.com/maps/search/?api=1&query=52.5463%2C19.6855')
  ) as seed(name, address, city, voivodeship, latitude, longitude, google_maps_url)
  where not exists (
    select 1
    from locations
    where locations.name = seed.name
      and locations.city = seed.city
  );

  insert into events (
    title,
    slug,
    description,
    short_description,
    start_at,
    end_at,
    is_all_day,
    main_image_url,
    price_type,
    price_min,
    price_max,
    currency,
    status,
    visibility,
    is_featured,
    is_verified,
    is_cancelled,
    category_id,
    location_id,
    organizer_id,
    published_at,
    timezone,
    confidence_score,
    source_quality_score
  )
  select
    seed.title,
    seed.slug,
    seed.description,
    seed.short_description,
    seed.start_at::timestamptz,
    seed.end_at::timestamptz,
    false,
    '/background.png',
    seed.price_type,
    seed.price_min,
    seed.price_max,
    'PLN',
    'published',
    'public',
    seed.is_featured,
    true,
    false,
    categories.id,
    locations.id,
    demo_organizer_id,
    now(),
    'Europe/Warsaw',
    1,
    1
  from (
    values
      ('Letni koncert na placu', 'demo-letni-koncert-na-placu', 'Plenerowy koncert z muzyka indie, pop i klasykami do wspolnego spiewania. Wydarzenie demonstracyjne dodane do EventMap.', 'Wieczorny koncert lokalnych zespolow w centrum Lodzi.', '2026-06-03T18:30:00+02:00', '2026-06-03T21:00:00+02:00', 'Koncert', 'Plac przed Lodz Fabryczna', 'Lodz', true, 'free', null::numeric, null::numeric),
      ('Rodzinny piknik miejski', 'demo-rodzinny-piknik-miejski', 'Piknik z grami terenowymi, warsztatami plastycznymi i mala scena dla dzieci. Wydarzenie demonstracyjne dodane do EventMap.', 'Animacje, warsztaty i strefa odpoczynku dla rodzin.', '2026-06-06T11:00:00+02:00', '2026-06-06T16:00:00+02:00', 'Rodzina', 'Rynek Trybunalski', 'Piotrkow Trybunalski', true, 'free', null::numeric, null::numeric),
      ('Jarmark rekodziela i smakow', 'demo-jarmark-rekodziela-i-smakow', 'Niedzielny jarmark na rynku z ceramika, bizuteria, miodami i produktami od okolicznych wystawcow. Wydarzenie demonstracyjne dodane do EventMap.', 'Lokalni tworcy, jedzenie regionalne i stoiska z prezentami.', '2026-06-07T10:00:00+02:00', '2026-06-07T17:00:00+02:00', 'Targi', 'Nowy Rynek', 'Lowicz', true, 'free', null::numeric, null::numeric),
      ('Bieg po zielonym parku', 'demo-bieg-po-zielonym-parku', 'Trasa przez park, elektroniczny pomiar czasu i medal pamiatkowy na mecie. Wydarzenie demonstracyjne dodane do EventMap.', 'Rekreacyjny bieg 5 km dla poczatkujacych i zaawansowanych.', '2026-06-10T09:30:00+02:00', '2026-06-10T12:00:00+02:00', 'Sport', 'Park Traugutta', 'Kutno', false, 'paid', 25::numeric, 25::numeric),
      ('Wieczor teatralny pod chmurka', 'demo-wieczor-teatralny-pod-chmurka', 'Letni spektakl w parku miejskim z krotkim spotkaniem z zespolem po przedstawieniu. Wydarzenie demonstracyjne dodane do EventMap.', 'Spektakl plenerowy i rozmowa z aktorami po pokazie.', '2026-06-05T20:00:00+02:00', '2026-06-05T22:00:00+02:00', 'Kultura', 'Park Miejski', 'Skierniewice', true, 'free', null::numeric, null::numeric),
      ('Swieto plonow i muzyki ludowej', 'demo-swieto-plonow-i-muzyki-ludowej', 'Rodzinne wydarzenie z regionalnym jedzeniem, wystepami i prezentacja lokalnych gospodarstw. Wydarzenie demonstracyjne dodane do EventMap.', 'Korowod, stoiska kol gospodyn i koncert kapeli.', '2026-06-14T13:00:00+02:00', '2026-06-14T19:30:00+02:00', 'Dozynki', 'Rynek w Sieradzu', 'Sieradz', false, 'free', null::numeric, null::numeric),
      ('Festyn nad Wisla', 'demo-festyn-nad-wisla', 'Festyn miejski nad rzeka z koncertami, strefa gastronomiczna i aktywnosciami dla mieszkancow. Wydarzenie demonstracyjne dodane do EventMap.', 'Popoludnie z muzyka, food truckami i pokazem swiatel.', '2026-06-20T15:00:00+02:00', '2026-06-20T22:00:00+02:00', 'Festyn', 'Amfiteatr nad Wisla', 'Plock', false, 'free', null::numeric, null::numeric)
  ) as seed(title, slug, description, short_description, start_at, end_at, category_name, location_name, location_city, is_featured, price_type, price_min, price_max)
  join categories on categories.name = seed.category_name
  join locations on locations.name = seed.location_name and locations.city = seed.location_city
  where not exists (
    select 1
    from events
    where events.slug = seed.slug
  );

  insert into event_sources (
    event_id,
    source_type,
    source_name,
    source_url,
    last_seen_at,
    raw_title,
    raw_description,
    raw_date,
    is_active,
    confidence_score
  )
  select
    events.id,
    'manual',
    'EventMap demo seed',
    'https://eventmap.pl',
    now(),
    events.title,
    events.short_description,
    events.start_at::text,
    true,
    1
  from events
  where events.slug like 'demo-%'
    and not exists (
      select 1
      from event_sources
      where event_sources.event_id = events.id
        and event_sources.source_name = 'EventMap demo seed'
    );
end $$;
