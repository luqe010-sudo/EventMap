# AGENTS.md

## Opis projektu

EventMap to portal lokalnych wydarzeń w Polsce. Użytkownik ma szybko znaleźć wydarzenie po dacie, mieście, kategorii, promieniu i cenie. Aplikacja ma publiczne przeglądanie wydarzeń oraz panele dla admina i organizatora.

Najważniejsza tabela domenowa to `events`, a publiczny frontend pokazuje tylko opublikowane, publiczne i nieanulowane wydarzenia.

## Stack technologiczny

- Next.js 15, App Router.
- React 19.
- TypeScript strict.
- Supabase JS v2.
- `@supabase/ssr` dla sesji SSR.
- PostgreSQL/Supabase z typami w `database.types.ts`.
- PostGIS jest obecny w typach bazy, ale kod aplikacji liczy odległość w JavaScripcie.
- MapLibre GL JS dla map; markery wydarzeń są renderowane jako GeoJSON source z włączonym clusteringiem.
- CSS globalny w `app/globals.css`.

## Struktura aplikacji

- `app/` - route'y Next.js.
- `components/` - komponenty UI.
- `lib/events.ts` - publiczne zapytania wydarzeń.
- `lib/auth.ts` - profile, role i guardy dostępu.
- `lib/auth-actions.ts` - logowanie i wylogowanie.
- `lib/admin-events.ts` - logika panelu admina dla wydarzeń.
- `lib/admin-organizers.ts` - logika panelu admina dla organizatorów.
- `lib/organizer-events.ts` - logika panelu organizatora.
- `lib/event-editor.ts` - wspólne typy/statusy/pomocniki formularzy wydarzeń.
- `lib/filters.ts` - filtrowanie client-side.
- `lib/supabase-config.ts` - wspólna konfiguracja URL i klucza Supabase; normalizuje `NEXT_PUBLIC_SUPABASE_URL` do originu.
- `lib/supabase.ts` - publiczny klient Supabase bez sesji.
- `lib/supabase-user.ts` - klient Supabase SSR z cookies.
- Sesja Supabase jest obsługiwana przez `lib/supabase-user.ts` w server components, server actions i route handlers; globalny `middleware.ts` nie jest obecnie używany.
- `database.types.ts` - wygenerowane typy z Supabase.

## Struktura bazy danych

Tabele z `database.types.ts`:

- `events` - wydarzenia.
- `categories` - kategorie.
- `locations` - miejsca i współrzędne.
- `organizers` - organizatorzy.
- `event_sources` - źródła wydarzenia.
- `tags` i `event_tags` - tagi wydarzeń.
- `profiles` - profil i rola użytkownika.
- `organizer_users` - powiązanie użytkownika z organizatorem.
- `city_pages` - strony SEO miast.
- `scraping_sources` i `raw_scraped_items` - dane techniczne pod scraping.
- `saved_events` - zapisane wydarzenia.
- `notification_preferences` - preferencje powiadomień.

Tabela `ai_extractions` była wymieniana w wymaganiach, ale nie występuje w aktualnym `database.types.ts`; wymaga potwierdzenia.

Najważniejsze relacje:

- `events.category_id -> categories.id`
- `events.location_id -> locations.id`
- `events.organizer_id -> organizers.id`
- `events.submitted_by_organizer_id -> organizers.id`
- `event_sources.event_id -> events.id`
- `event_tags.event_id -> events.id`
- `event_tags.tag_id -> tags.id`
- `organizer_users.organizer_id -> organizers.id`
- `raw_scraped_items.scraping_source_id -> scraping_sources.id`
- `saved_events.event_id -> events.id`

## Najważniejsze reguły biznesowe

- Publiczne strony pokazują tylko `events.status = 'published'`, `events.visibility = 'public'` i `is_cancelled` różne od `true`.
- Strona główna ma fallback dla błędów publicznych zapytań Supabase: zamiast wywracać render, loguje błąd i pokazuje pusty stan/fallbackowe kategorie.
- Globalny navbar nie powinien wywracać layoutu przy błędzie Supabase Auth albo profilu; renderuje wtedy stan niezalogowany i loguje błąd po stronie serwera.
- Mapy powinny zachować polskie etykiety, clustering markerów i ikony kategorii na pineskach.
- Admin może widzieć i edytować wszystkie wydarzenia.
- Admin może ustawiać statusy: `draft`, `pending_review`, `published`, `rejected`, `archived`.
- Organizator widzi tylko wydarzenia z `submitted_by_organizer_id` powiązanym z jego kontem przez `organizer_users`.
- Organizator tworzy wydarzenia zawsze jako `pending_review`.
- Organizator nie może sam publikować wydarzeń.
- Edycja opublikowanego wydarzenia przez organizatora cofa status do `pending_review`.
- Kategorie muszą istnieć w tabeli `categories`, aby formularze mogły zapisywać `category_id`.
- Jeśli formularz wydarzenia nie wybierze istniejącej lokalizacji, kod może utworzyć rekord `locations`.
- Źródło wydarzenia jest zapisywane w `event_sources`; przy edycji aktualizowany jest pierwszy istniejący rekord źródła.

## Instrukcja dla kolejnych sesji AI

1. Przed zmianami przeanalizuj rzeczywisty kod i `database.types.ts`; nie zgaduj struktury bazy.
2. Nie twórz nowych tabel bez pytania użytkownika.
3. Nie zmieniaj nazw kolumn bez pytania użytkownika.
4. Jeśli potrzebna jest migracja SQL, zaproponuj ją osobno i nie wykonuj automatycznie.
5. Nie mieszaj zapytań Supabase bezpośrednio w komponentach UI, jeśli można dodać funkcję w `lib/`.
6. Dla publicznych wydarzeń zachowaj filtry `published`, `public`, nieanulowane.
7. Dla paneli admina i organizatora sprawdzaj rolę po stronie serwera.
8. Organizator nigdy nie powinien móc zmienić `submitted_by_organizer_id` na cudzy.
9. Po zmianie struktury bazy wygeneruj ponownie `database.types.ts`.
10. Nie zapisuj sekretów Supabase service role w kodzie ani w zmiennych `NEXT_PUBLIC_*`.
11. RLS policies nie są w repozytorium; ich aktualny stan zawsze wymaga potwierdzenia w Supabase.
12. Dokumentację techniczną utrzymuj w `docs/`.
13. Przy zmianach publicznego UI aktualizuj `docs/current-features.md`; przy zmianach konfiguracji/runtime aktualizuj `docs/architecture.md` i `docs/deployment.md`.
