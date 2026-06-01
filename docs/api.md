# API

Aplikacja nie definiuje klasycznego REST API dla wydarzeń. Komunikacja z bazą odbywa się przez Supabase JS w warstwie `lib/` oraz przez Next.js server actions.

## Route handlers

### `POST /auth/sign-out`

Plik: `app/auth/sign-out/route.ts`

Działanie:

- tworzy klienta Supabase SSR przez `createSupabaseUserClient()`;
- wykonuje `supabase.auth.signOut()`;
- przekierowuje na `/`.

Navbar wysyła formularz `POST` do tej ścieżki.

## Server actions

### Auth

Plik: `lib/auth-actions.ts`

- `signInAction(formData)` - loguje przez `supabase.auth.signInWithPassword({ email, password })` i przekierowuje na `/`.
- `signOutAction()` - wykonuje `supabase.auth.signOut()` i przekierowuje na `/`. W aktualnym UI używany jest route handler `/auth/sign-out`.

### Admin events

Plik: `lib/admin-events.ts`

- `adminCreateEventAction(formData)` - tworzy wydarzenie jako admin.
- `adminUpdateEventAction(eventId, formData)` - aktualizuje dowolne wydarzenie.
- `adminSetEventStatusAction(eventId, status)` - zmienia status i ustawia `published_at` przy publikacji.
- `adminDeleteEventAction(eventId)` - usuwa powiązane `event_sources`, `event_tags`, `saved_events`, a potem `events`.

### Organizer events

Plik: `lib/organizer-events.ts`

- `organizerCreateEventAction(formData)` - tworzy wydarzenie organizatora ze statusem `pending_review`.
- `organizerUpdateEventAction(eventId, formData)` - aktualizuje tylko własne wydarzenie; opublikowane wydarzenie wraca do `pending_review`.

### Admin organizers

Plik: `lib/admin-organizers.ts`

- `adminCreateOrganizerAction(formData)` - tworzy organizatora.
- `adminUpdateOrganizerAction(organizerId, formData)` - aktualizuje organizatora.
- `saveOrganizerOwner()` - wewnętrznie dodaje wpis `organizer_users` z rolą `owner`, jeśli podano `owner_user_id` i powiązanie jeszcze nie istnieje.

## Funkcje odczytu danych

### Publiczne wydarzenia

Plik: `lib/events.ts`

- `listEvents(options)` - pobiera wydarzenia publiczne.
- `getEventBySlug(slug)` - pobiera szczegóły publicznego wydarzenia.
- `listCategories()` - pobiera kategorie.
- `getCategoryBySlugFromDb(slug)` - pobiera kategorię po slugu.
- `getCityPageBySlug(slug)` - pobiera aktywną stronę miasta.
- `getHomeData()` - pobiera wydarzenia od początku bieżącego dnia i kategorie.

Główne zapytanie wydarzeń wybiera:

- pola `events`;
- `category:categories(...)`;
- `location:locations(...)`;
- `organizer:organizers!events_organizer_id_fkey(...)`;
- `sources:event_sources(...)`.

Filtry publiczne:

- `status = "published"`;
- `visibility = "public"`;
- domyślnie `is_cancelled is null` albo `is_cancelled = false`;
- sortowanie po `start_at` rosnąco.

### Admin

Plik: `lib/admin-events.ts`

- `getAdminDashboard()` - liczy `pending_review`, `published`, `rejected` i pobiera ostatnie wydarzenia.
- `listAdminEvents()` - pobiera do 250 wydarzeń dla tabeli admina.
- `getAdminEventEditorOptions()` - pobiera kategorie, organizatorów i lokalizacje do formularza.
- `getAdminEventForEdit(id)` - pobiera wydarzenie z relacjami do edycji.

Plik: `lib/admin-organizers.ts`

- `listAdminOrganizers()`.
- `getAdminOrganizerForEdit(id)`.

### Organizator

Plik: `lib/organizer-events.ts`

- `getOrganizerDashboard()`.
- `listOrganizerEvents()`.
- `getOrganizerEventEditorOptions()`.
- `getOrganizerEventForEdit(eventId)`.

Wszystkie te funkcje ograniczają dostęp do `submitted_by_organizer_id` powiązanych z użytkownikiem przez `organizer_users`.

## Brakujące lub niepotwierdzone API

- Brak endpointów API dla zewnętrznych klientów.
- Brak endpointów webhooków.
- Brak server action do rejestracji użytkownika.
- Brak API do zapisanych wydarzeń i powiadomień mimo obecności tabel.
- Brak API scrapingu/AI w kodzie aplikacji.
