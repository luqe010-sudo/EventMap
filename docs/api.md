# API

Aplikacja nie definiuje klasycznego REST API dla wydarzeń. Komunikacja z bazą odbywa się przez Supabase JS w warstwie `lib/` oraz przez Next.js server actions.

## Route handlers

### `GET /auth/callback`

Plik: `app/auth/callback/route.ts`

- odbiera kod Google OAuth;
- wymienia kod na sesje Supabase przez PKCE;
- uzupelnia brakujacy profil i opcjonalne powiazanie organizatora;
- przekierowuje na `/` albo `/organizer`.

### `POST /auth/sign-out`

Plik: `app/auth/sign-out/route.ts`

Działanie:

- tworzy klienta Supabase SSR przez `createSupabaseUserClient()`;
- wykonuje `supabase.auth.signOut()`;
- przekierowuje na `/`.

Navbar wysyła formularz `POST` do tej ścieżki.

### `GET /api/account/saved-events`

- zwraca `{ isLoggedIn, eventIds }` dla aktualnej sesji;
- jest używany przez ikony serca na publicznych kartach wydarzeń;
- nie przyjmuje `user_id` od klienta.

## Server actions

### Auth

Plik: `lib/auth-actions.ts`

- `signInAction(formData)` - loguje przez `supabase.auth.signInWithPassword({ email, password })`, po sukcesie przekierowuje na `/`, a po bledzie zwraca stan formularza zamiast rzucac wyjatek RSC.
- `signInFormAction(previousState, formData)` - wariant dla formularza `/login` opartego o `useActionState()`.
- `signInWithGoogleAction(formData)` - rozpoczyna Google OAuth, zapisuje krotkotrwaly stan rejestracji w cookie HttpOnly i ustawia callback `/auth/callback`.
- `completeGoogleOnboardingAction(previousState, formData)` - po pierwszym logowaniu Google waliduje zgody i role, tworzy/uzupelnia profil oraz opcjonalnego organizatora.
- `signUpAction(formData)` - rejestruje uzytkownika przez Supabase Auth, tworzy/aktualizuje `profiles`, a dla roli `organizer` tworzy `organizers` i `organizer_users`.
- Wylogowanie jest obslugiwane przez route handler `/auth/sign-out`.

### Konto użytkownika

Plik: `lib/user-account-actions.ts`

- `updateUserProfileAction(previousState, formData)` - aktualizuje `profiles.display_name` zalogowanego użytkownika.
- `toggleSavedEventAction(eventId, shouldSave)` - dodaje albo usuwa własny rekord `saved_events`; przed zapisem weryfikuje publiczny status wydarzenia.
- `removeSavedEventAction(eventId)` - usuwa zapis z listy `/account` albo `/organizer/saved`, zależnie od roli.

### Admin events

Plik: `lib/admin-events.ts`

- `adminCreateEventAction(formData)` - tworzy wydarzenie jako admin.
- `adminUpdateEventAction(eventId, formData)` - aktualizuje dowolne wydarzenie.
- `adminSetEventStatusAction(eventId, status)` - zmienia status i ustawia `published_at` przy publikacji.
- `adminDeleteEventAction(eventId)` - usuwa powiązane `event_sources`, `event_tags`, `saved_events`, a potem `events`.

### Admin locations

Plik: `lib/admin-locations.ts`

- `adminCreateLocationAction(formData)` - tworzy lokalizacje.
- `adminUpdateLocationAction(locationId, formData)` - aktualizuje lokalizacje, w tym pinezke i dane administracyjne.
- `adminDeleteLocationAction(locationId)` - usuwa lokalizacje tylko wtedy, gdy nie ma przypisanych wydarzen.

### Admin city pages

Plik: `lib/admin-city-pages.ts`

- `adminCreateCityPageAction(formData)` - tworzy strone lokalna SEO.
- `adminUpdateCityPageAction(cityPageId, formData)` - aktualizuje aktywnosc, slug, metadata, tekst wstepny i centrum miasta.

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
- `listAdminReviewEvents()` - pobiera wydarzenia ze statusem `draft` albo `pending_review`.
- `getAdminEventEditorOptions()` - pobiera kategorie, organizatorów i lokalizacje do formularza.
- `getAdminEventForEdit(id)` - pobiera wydarzenie z relacjami do edycji.

Plik: `lib/admin-organizers.ts`

- `listAdminOrganizers()`.
- `getAdminOrganizerForEdit(id)`.

Plik: `lib/admin-locations.ts`

- `listAdminLocations()` - pobiera lokalizacje, liczy przypisane wydarzenia i oznacza potencjalne duplikaty.
- `getAdminLocationForEdit(id)` - pobiera lokalizacje do formularza edycji.

Plik: `lib/admin-city-pages.ts`

- `listAdminCityPages()` - pobiera strony miast i liczy wydarzenia przez `locations.city_id`.
- `getAdminCityPageForEdit(id)` - pobiera strone miasta do formularza edycji.

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
