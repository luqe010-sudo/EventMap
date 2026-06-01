# Current Features

## Publiczne przeglądanie wydarzeń

Strona główna `/`:

- pobiera wydarzenia z Supabase przez `getHomeData()`;
- pokazuje hero, panel wyszukiwania, sticky filter bar oraz układ 70/30 z lewą kolumną wydarzeń i prawym sidebarem;
- w lewej kolumnie pokazuje wyróżnione wydarzenia nad listą wydarzeń;
- w prawym sidebarze pokazuje jedną mapę Leaflet, powiadomienia, nadchodzące wydarzenia i popularne kategorie;
- filtruje po dacie, promieniu, kategorii i opcji darmowych wydarzeń;
- pozwala wybrać lokalizację z autouzupełniania albo GPS;
- sortuje po odległości albo dacie.

Widok `EventExplorer`:

- jest używany na stronach kategorii i miasta;
- pokazuje listę i mapę Leaflet;
- pozwala wybrać wydarzenie i zobaczyć szczegóły w panelu.

## Szczegóły wydarzenia

URL:

```text
/wydarzenie/[slug]
```

Technicznie obsługiwane przez `app/wydarzenie/[slug]/page.tsx`. Stary format `/wydarzenia/[slug]` przekierowuje na nowy adres, jeśli slug odpowiada wydarzeniu.

Szczegóły pokazują:

- obraz;
- kategorię;
- tytuł;
- organizatora;
- opis;
- datę;
- lokalizację;
- cenę;
- mapę;
- link Google Maps, jeśli `locations.google_maps_url` istnieje;
- sekcję źródeł, jeśli wydarzenie ma `event_sources`.

## Strony miast

URL:

```text
/wydarzenia/[citySlug]
```

Strona korzysta z `city_pages`:

- tylko `is_active = true`;
- metadata z `meta_title` i `meta_description`;
- lokalizacja z `latitude` i `longitude`;
- wydarzenia z tego samego miasta albo w promieniu 50 km.

## Kategorie

URL:

```text
/kategoria/[slug]
```

Strona:

- pobiera kategorię z `categories`;
- pobiera wydarzenia przez `category_id`;
- generuje metadata i JSON-LD `CollectionPage`;
- renderuje `EventExplorer`.

## Login i sesja

- `/login` ma formularz email/hasło.
- `signInAction()` używa Supabase Auth.
- Wylogowanie idzie przez `POST /auth/sign-out`.
- Navbar pokazuje link do panelu dla roli `admin` albo `organizer`.

## Panel admina

`/admin`:

- liczniki `pending_review`, `published`, `rejected`;
- ostatnio dodane wydarzenia;
- linki do wydarzeń i organizatorów.

`/admin/events`:

- tabela wydarzeń;
- akcje: edytuj, opublikuj, odrzuć, archiwizuj, usuń.

`/admin/events/new` i `/admin/events/[id]/edit`:

- formularz wydarzenia;
- status dostępny tylko dla admina;
- wybór kategorii, organizatora i lokalizacji;
- możliwość utworzenia lokalizacji z formularza;
- zapis źródła wydarzenia.

`/admin/organizers`:

- tabela organizatorów;
- link do edycji.

`/admin/organizers/new` i `/admin/organizers/[id]/edit`:

- formularz organizatora;
- możliwość podania `owner_user_id` i utworzenia powiązania w `organizer_users`.

## Panel organizatora

`/organizer`:

- pokazuje statusy wydarzeń;
- pokazuje wydarzenia powiązane z organizatorami użytkownika;
- pokazuje empty state, jeśli konto ma rolę `organizer`, ale nie ma wpisu w `organizer_users`.

`/organizer/events/new`:

- dodaje wydarzenie ze statusem `pending_review`;
- przypisuje wydarzenie do organizatora użytkownika.

`/organizer/events/[id]/edit`:

- edytuje tylko własne wydarzenie;
- po edycji opublikowanego wydarzenia ustawia `pending_review`.

## Stany techniczne

- Globalne `loading.tsx` i `error.tsx`.
- Dynamiczne ładowanie map bez SSR.
- JSON-LD dla wydarzenia, strony miasta i kategorii.
- Przykładowe wydarzenia demo można dodać przez `supabase/seed-demo-events.sql`; seed używa slugów `demo-*` i jest idempotentny.

## Niezaimplementowane mimo tabel w bazie

- UI zapisanych wydarzeń z `saved_events`.
- UI preferencji powiadomień z `notification_preferences`.
- Scraper i panel źródeł scrapingu.
- AI extraction pipeline.
- Rejestracja użytkowników.
- Reset hasła.
- Upload obrazów do Supabase Storage.
- Testy automatyczne.
