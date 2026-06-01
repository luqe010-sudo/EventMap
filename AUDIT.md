# AUDIT

Data audytu: 2026-06-01

Zakres:

- kod aplikacji w `app/`, `components/`, `lib/`;
- wygenerowana dokumentacja w `docs/` i `AGENTS.md`;
- typy Supabase w `database.types.ts`;
- konfiguracja projektu (`package.json`, `next.config.ts`, `tsconfig.json`, `middleware.ts`).

Nie modyfikowano kodu aplikacji. Sprawdzono kompilację TypeScript komendą:

```bash
npx tsc --noEmit
```

Wynik: bez błędów.

## Executive summary

Projekt jest spójny funkcjonalnie i ma wyraźną warstwę zapytań Supabase w `lib/`, ale widać kilka obszarów długu:

- część helperów i importów jest martwa po migracji z danych demo do Supabase;
- tabele techniczne (`scraping_sources`, `raw_scraped_items`) oraz funkcje użytkownika (`saved_events`, `notification_preferences`, `tags`) istnieją w typach, ale nie mają aktualnej funkcjonalności UI/API;
- routing `/wydarzenia/[city]` obsługuje jednocześnie slug wydarzenia i slug miasta, co jest źródłem kolizji architektonicznych;
- admin i organizer mają zdublowaną logikę tworzenia lokalizacji, payloadu wydarzenia i zapisu źródła;
- repozytorium nie zawiera migracji, indeksów ani polityk RLS, więc stan bazy trzeba traktować jako wymagający potwierdzenia w Supabase;
- brakuje kilku relacji logicznych do `auth.users`, których `database.types.ts` nie pokazuje w schemacie `public`.

## Martwe funkcje i nieużywane elementy kodu

### Wysokie prawdopodobieństwo martwego kodu

| Element | Lokalizacja | Uzasadnienie |
| --- | --- | --- |
| `buildDemoEvents()` | `lib/events.ts` | Zwraca pustą tablicę, nie jest importowana w aplikacji. Prawdopodobnie pozostałość po danych demo. |
| `signOutAction()` | `lib/auth-actions.ts` | Nie jest używana przez UI; wylogowanie idzie przez `POST /auth/sign-out` w `components/NavbarClient.tsx`. |
| `getCategoryBySlug()` | `lib/slugs.ts` | Nie jest używana; obecne strony kategorii korzystają z `getCategoryBySlugFromDb()` w `lib/events.ts`. |
| `getLocationBySlug()` | `lib/slugs.ts` | Nie jest używana w aktualnym routingu. |
| `getEventBySlug(slug, events)` | `lib/slugs.ts` | Nazwa koliduje znaczeniowo z aktywną funkcją `getEventBySlug()` w `lib/events.ts`; lokalny helper nie jest używany. |
| `categoryCityPath()` | `lib/slugs.ts` | Nie jest używana; aktualny routing kategorii nie generuje ścieżki z miastem poza query w legacy redirect. |
| `radiusPresets` i `RadiusPreset` | `lib/filters.ts` | Nie są używane przez `SearchPanel`, `HomePage` ani `EventExplorer`; UI używa slidera. |
| `groupByDateLabel()` | `lib/filters.ts` | Nie jest używana w aktualnych komponentach list. |
| `countEventsByCity()` | `lib/filters.ts` | Nie jest używana w aktualnych komponentach. |
| `EventFormState` i `emptyEventFormState` | `lib/event-editor.ts` | Nie są używane przez formularze ani server actions. |

### Nieużywane importy / zmienne

| Element | Lokalizacja | Uzasadnienie |
| --- | --- | --- |
| `useRef` | `components/HomePage.tsx` | Importowany z React, ale nieużyty. |
| `normalizeText` | `components/EventExplorer.tsx` | Importowany z `lib/filters`, ale nieużyty. |
| `categories`, `categoryToSlug`, `toSlug`, `footerCities` | `components/Footer.tsx` | Importy i stała nie są używane w komponencie. |

TypeScript nie zgłasza tych przypadków, bo `tsconfig.json` nie ma `noUnusedLocals` ani `noUnusedParameters`.

## Nieużywane tabele lub tabele bez pełnej funkcji

Ocena na podstawie realnych odwołań `.from("...")` i dokumentacji.

### Nie używane przez aplikację

| Tabela | Status | Uwagi |
| --- | --- | --- |
| `scraping_sources` | Nie używana w kodzie aplikacji | Istnieje w typach i dokumentacji jako przyszła część scrapingu. Brak UI, jobs, API i server actions. |
| `raw_scraped_items` | Nie używana w kodzie aplikacji | Brak pipeline'u pobierania/przetwarzania. |
| `notification_preferences` | Nie używana w kodzie aplikacji | Brak UI/API preferencji powiadomień. |
| `tags` | Nie używana funkcjonalnie | `EventItem.tags` zawsze jest pustą tablicą; brak pobierania tagów wydarzenia. |

### Używane tylko pomocniczo / cleanup

| Tabela | Obecne użycie | Ryzyko |
| --- | --- | --- |
| `event_tags` | Tylko usuwanie w `adminDeleteEventAction()` | Brak funkcji dodawania/wyświetlania tagów. |
| `saved_events` | Tylko usuwanie w `adminDeleteEventAction()` | Brak funkcji zapisywania wydarzeń mimo tabeli. |

### Wymagająca potwierdzenia

| Element | Status |
| --- | --- |
| `ai_extractions` | Wymienione w wymaganiach, ale nie występuje w `database.types.ts` i nie jest używane w kodzie. |

## Nieużywane endpointy

### Aktywne endpointy

| Endpoint | Lokalizacja | Użycie |
| --- | --- | --- |
| `POST /auth/sign-out` | `app/auth/sign-out/route.ts` | Używany przez formularze wylogowania w `components/NavbarClient.tsx`. |

### Brak nieużywanych route handlers

Nie znaleziono dodatkowych route handlers API poza `/auth/sign-out`.

### Legacy route'y

| Route | Lokalizacja | Ocena |
| --- | --- | --- |
| `app/[category]/page.tsx` | redirect do `/kategoria/[category]` | Nie jest martwy technicznie; działa jako kompatybilność starych URL-i. |
| `app/[category]/[city]/page.tsx` | redirect do `/kategoria/[category]?city=...` | Kompatybilność, ale docelowy `?city=` nie jest obecnie czytany przez `app/kategoria/[slug]/page.tsx`, więc redirect traci efekt filtrowania miasta. |
| `app/[category]/[city]/[event]/page.tsx` | redirect do `/wydarzenia/[event]` | Kompatybilność starych URL-i. |

## Duplikaty logiki

### Tworzenie payloadu wydarzenia

Duplikacja:

- `buildEventPayload()` w `lib/admin-events.ts`;
- `buildOrganizerEventPayload()` w `lib/organizer-events.ts`.

Wspólne pola:

- `title`, `slug`, `description`, `short_description`;
- `start_at`, `end_at`, `is_all_day`;
- `category_id`, `location_id`;
- `price_type`, `price_min`, `price_max`, `currency`;
- `main_image_url`;
- `status`, `visibility`, `published_at`;
- `created_by`.

Różnice biznesowe są realne, ale większość parsowania formularza jest identyczna. To zwiększa ryzyko, że przyszłe pole wydarzenia zostanie dodane w jednym panelu, a pominięte w drugim.

### Tworzenie lokalizacji

Duplikacja:

- `resolveLocationId()` w `lib/admin-events.ts`;
- `resolveOrganizerLocationId()` w `lib/organizer-events.ts`.

Obie funkcje:

- czytają `location_id`;
- w razie braku tworzą `locations`;
- zapisują `name`, `city`, `address`, `latitude`, `longitude`.

### Zapis źródła wydarzenia

Duplikacja:

- `saveEventSource()` w `lib/admin-events.ts`;
- `saveOrganizerEventSource()` w `lib/organizer-events.ts`.

Różni się głównie domyślny `source_type`: `manual` vs `organizer`.

### Liczenie statusów

Admin liczy wybrane statusy przez osobne zapytania `countEventsByStatus()`, a organizator liczy statusy w pamięci po pobraniu listy. To nie jest błąd, ale warto ujednolicić przy większej skali.

## Potencjalne błędy architektoniczne

### 1. Kolizja URL wydarzenia i strony miasta

Lokalizacja: `app/wydarzenia/[city]/page.tsx`

Ten sam route obsługuje:

- szczegóły wydarzenia po `events.slug`;
- stronę miasta po `city_pages.slug`.

Kod najpierw sprawdza wydarzenie:

```ts
const event = await getEventBySlug(slug);
```

Dopiero potem sprawdza `city_pages`.

Ryzyko:

- jeśli `events.slug` będzie taki sam jak `city_pages.slug`, strona miasta zostanie przykryta przez wydarzenie;
- nazwa parametru `city` jest myląca dla szczegółów wydarzenia;
- trudniej dodać osobne cache/metadata/routing policies.

Rekomendacja:

- rozdzielić route'y, np. `/wydarzenie/[slug]` dla szczegółów i `/wydarzenia/[citySlug]` dla miast, albo wprowadzić inny jednoznaczny prefiks.

### 2. Publiczny filtr kategorii po join może być nieskuteczny

Lokalizacja: `lib/events.ts`

W `listEvents()` jest wariant:

```ts
query = query.eq("categories.slug", options.categorySlug);
```

Ten warunek filtruje po tabeli z relacji. W Supabase/PostgREST filtrowanie po tabeli zagnieżdżonej wymaga poprawnego join hint i często `!inner`, inaczej może nie zawężać głównej tabeli zgodnie z oczekiwaniem.

Obecnie główna strona kategorii używa bezpieczniejszej ścieżki: najpierw pobiera kategorię po slugu, potem `listEvents({ categoryId })`. Sam wariant `categorySlug` jest jednak ryzykowny, jeśli zostanie użyty.

### 3. Publiczny filtr miasta po join może być nieskuteczny

Lokalizacja: `lib/events.ts`

Analogicznie:

```ts
query = query.ilike("locations.city", options.city);
```

Bez `!inner` i bez indeksu funkcyjnego na mieście może nie działać lub działać wolno. W obecnym kodzie strony miast pobierają większy zestaw wydarzeń i filtrują w JS, więc ten wariant wydaje się obecnie nieużywany.

### 4. Filtrowanie promienia odbywa się po stronie klienta

Lokalizacje:

- `lib/events.ts`
- `lib/filters.ts`
- `app/wydarzenia/[city]/page.tsx`

Kod pobiera ograniczony zestaw wydarzeń (`limit: 120`, `200`, `250`) i dopiero potem liczy dystans w JS. Przy rosnącej bazie może to:

- pomijać wydarzenia, które są blisko, ale nie zmieściły się w limicie;
- generować nieprecyzyjne wyniki dla miast;
- utrudniać paginację.

Rekomendacja:

- dodać RPC/PostGIS do zapytań promienia albo widok/funkcję `nearby_events`.

### 5. Brak paginacji i filtrów po stronie bazy dla publicznej listy

Strona główna pobiera do 120 wydarzeń od początku dnia, a potem filtruje w przeglądarce. To jest proste dla MVP, ale przy produkcji lepiej przenieść część filtrów do Supabase:

- data;
- kategoria;
- miasto/promień;
- darmowe/płatne;
- paginacja.

### 6. Admin delete ignoruje błędy cleanupu części relacji

Lokalizacja: `lib/admin-events.ts`

`adminDeleteEventAction()` wykonuje:

```ts
await supabase.from("event_sources").delete().eq("event_id", eventId);
await supabase.from("event_tags").delete().eq("event_id", eventId);
await supabase.from("saved_events").delete().eq("event_id", eventId);
```

Błędy tych trzech operacji nie są sprawdzane. Dopiero błąd usunięcia `events` rzuca wyjątek.

Ryzyko:

- przy problemie RLS lub FK użytkownik zobaczy częściowy sukces/porażkę trudną do diagnozy;
- jeśli nie ma cascade, usunięcie `events` może się nie udać przez pozostałe rekordy.

### 7. Organizator z rolą admina w `requireOrganizerAccess()` nie ma memberships

Lokalizacja: `lib/auth.ts`

Dla admina funkcja zwraca:

```ts
memberships: []
isAdmin: true
```

Kod panelu organizatora wymaga jednak memberships i pokaże adminowi "Brakuje organizatora". To może być poprawne biznesowo, ale nazwa `requireOrganizerAccess()` sugeruje, że admin ma dostęp. Zachowanie wymaga decyzji.

### 8. Formularz wydarzenia nie waliduje wymaganej kategorii i organizatora po stronie UI

Lokalizacja: `components/EventEditorForm.tsx`

`category_id` dopuszcza pustą wartość, a `organizer_id` zależy od listy opcji. Kod zapisujący też przyjmuje `null`. Jeśli reguła biznesowa wymaga kategorii i organizatora, brakuje walidacji aplikacyjnej lub constraintów.

### 9. Brak obsługi wielu źródeł w formularzu

Szczegóły wydarzenia potrafią pokazać wiele `event_sources`, ale formularz admina/organizatora edytuje tylko pierwszy rekord źródła:

- `saveEventSource()`;
- `saveOrganizerEventSource()`.

To jest niespójność modelu i UI.

### 10. Kod zawiera problemy kodowania znaków

W wielu plikach widoczne są zniekształcone polskie znaki, np. `BezpĹ‚atne`, `ĹĂłdĹş`, `ZnajdĹş`. To nie blokuje kompilacji, ale wpływa na jakość UI, SEO i treść dokumentacji/metadata.

## Brakujące indeksy Supabase

Repozytorium nie zawiera migracji ani definicji indeksów, więc nie da się potwierdzić, które indeksy istnieją w Supabase. Poniżej lista indeksów wynikająca z realnych zapytań w kodzie. Traktować jako rekomendacje do weryfikacji w bazie, nie jako automatyczną migrację.

### Wydarzenia publiczne

Używane przez:

- `listEvents()`;
- `getHomeData()`;
- `/kategoria/[slug]`;
- `/wydarzenia/[city]`;
- `getEventBySlug()`.

Propozycje:

```sql
create index if not exists events_public_start_at_idx
on public.events (start_at)
where status = 'published'
  and visibility = 'public'
  and coalesce(is_cancelled, false) = false;

create unique index if not exists events_slug_idx
on public.events (slug);

create index if not exists events_category_start_at_idx
on public.events (category_id, start_at);

create index if not exists events_status_created_at_idx
on public.events (status, created_at desc);
```

### Panele admina i organizatora

Używane przez:

- `listAdminEvents()`;
- `getAdminDashboard()`;
- `listOrganizerEvents()`;
- `getOrganizerEventForEdit()`;
- `adminSetEventStatusAction()`.

Propozycje:

```sql
create index if not exists events_submitted_by_organizer_start_at_idx
on public.events (submitted_by_organizer_id, start_at desc);

create index if not exists events_status_idx
on public.events (status);

create index if not exists events_created_at_idx
on public.events (created_at desc);
```

### Kategorie, miasta, organizatorzy

Używane przez:

- `getCategoryBySlugFromDb()`;
- `listCategories()`;
- `getCityPageBySlug()`;
- `listAdminOrganizers()`;
- formularze edycji.

Propozycje:

```sql
create unique index if not exists categories_slug_idx
on public.categories (slug);

create index if not exists categories_sort_name_idx
on public.categories (sort_order, name);

create unique index if not exists city_pages_slug_idx
on public.city_pages (slug);

create index if not exists city_pages_active_slug_idx
on public.city_pages (is_active, slug);

create unique index if not exists organizers_slug_idx
on public.organizers (slug);

create index if not exists organizers_name_idx
on public.organizers (name);
```

### Lokalizacje

Używane przez:

- formularze admina/organizatora;
- publiczne relacje wydarzeń;
- potencjalnie przyszłe filtrowanie miasta.

Propozycje:

```sql
create index if not exists locations_city_idx
on public.locations (city);

create index if not exists locations_city_lower_idx
on public.locations (lower(city));

create index if not exists locations_geom_gist_idx
on public.locations using gist (geom);
```

`locations_geom_gist_idx` ma sens tylko, jeśli `geom` jest realnie używany w zapytaniach PostGIS.

### Relacje i tabele łączące

Używane przez:

- memberships organizatora;
- źródła wydarzenia;
- cleanup przy usuwaniu wydarzeń.

Propozycje:

```sql
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
```

## Brakujące relacje między tabelami

Na podstawie `database.types.ts` relacje publiczne istnieją dla:

- `categories.parent_id -> categories.id`;
- `event_sources.event_id -> events.id`;
- `event_tags.event_id -> events.id`;
- `event_tags.tag_id -> tags.id`;
- `events.category_id -> categories.id`;
- `events.location_id -> locations.id`;
- `events.organizer_id -> organizers.id`;
- `events.submitted_by_organizer_id -> organizers.id`;
- `organizer_users.organizer_id -> organizers.id`;
- `raw_scraped_items.scraping_source_id -> scraping_sources.id`;
- `saved_events.event_id -> events.id`.

Relacje logicznie potrzebne, ale nieobecne w typach publicznych:

| Relacja | Dlaczego potrzebna |
| --- | --- |
| `profiles.id -> auth.users.id` | Kod zakłada `profiles.id = auth.users.id`. |
| `organizer_users.user_id -> auth.users.id` | Kod filtruje membership po `user_id`. |
| `events.created_by -> auth.users.id` | Kod zapisuje `created_by` przy tworzeniu wydarzeń. |
| `saved_events.user_id -> auth.users.id` | Tabela zapisanych wydarzeń jest per użytkownik. |
| `notification_preferences.user_id -> auth.users.id` | Preferencje powiadomień są per użytkownik. |

Relacje, które warto rozważyć:

| Relacja | Uwagi |
| --- | --- |
| `event_sources` do `scraping_sources` | W tabeli `event_sources` jest `external_id` i dane raw, ale nie ma jawnego `scraping_source_id`. Jeśli źródło wydarzenia ma być śledzone względem konfiguracji scrapingu, brakuje tej relacji. |
| `raw_scraped_items` do `events` albo `ai_extractions` | Obecnie `raw_scraped_items` nie ma połączenia z zaakceptowanym wydarzeniem; może to utrudnić audyt pochodzenia danych. |
| `ai_extractions` do `raw_scraped_items` i `events` | Tabela nie istnieje w aktualnych typach, choć jest w wymaganiach produktu. |

Uwaga: relacje do `auth.users` mogą istnieć w Supabase, ale nie są widoczne w `database.types.ts` wygenerowanym dla schematu `public`. Wymaga to potwierdzenia bezpośrednio w bazie.

## RLS i bezpieczeństwo

Repozytorium nie zawiera polityk RLS. Z punktu widzenia kodu szczególnie ważne są:

- publiczny odczyt tylko `published/public/not cancelled`;
- admin all-access dla `events`, `organizers`, `locations`, `event_sources`, `event_tags`, `saved_events`;
- organizer insert/update tylko dla własnych `submitted_by_organizer_id`;
- użytkownik może czytać własny `profiles`;
- użytkownik organizatora może czytać własne `organizer_users`;
- brak możliwości ustawienia `submitted_by_organizer_id` na cudzy organizer przez organizatora.

Bez potwierdzonych RLS aplikacja polega głównie na server actions. To nie wystarczy, jeśli klient publiczny ma bezpośredni klucz publishable i tabele mają zbyt szerokie polityki.

## Rekomendowana kolejność działań

1. Zweryfikować i dodać RLS policies w Supabase, zanim aplikacja dostanie więcej danych produkcyjnych.
2. Dodać indeksy dla publicznych list wydarzeń, slugów i membershipów organizatora.
3. Rozdzielić routing wydarzenia i miasta albo wymusić unikalność slugów między `events` i `city_pages`.
4. Wydzielić wspólną logikę formularza wydarzenia dla admina i organizatora.
5. Podjąć decyzję o tabelach nieużywanych: usunąć z zakresu MVP albo zaimplementować UI/API.
6. Włączyć `noUnusedLocals` w TypeScript albo reguły ESLint dla martwych importów.
7. Naprawić kodowanie polskich znaków w plikach UI i dokumentach.
