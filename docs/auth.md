# Auth

## Mechanizm logowania

Aplikacja używa Supabase Auth. Formularz `/login` wysyła dane do server action `signInAction()` z `lib/auth-actions.ts`.

`signInAction()`:

1. Odczytuje `email` i `password` z `FormData`.
2. Wywołuje `supabase.auth.signInWithPassword()`.
3. Po sukcesie przekierowuje na `/`.
4. Po błędzie rzuca wyjątek z komunikatem Supabase.

W kodzie nie ma formularza rejestracji ani resetowania hasła.

## Sesja SSR

`lib/supabase-user.ts` tworzy klienta Supabase przez `createServerClient` z `@supabase/ssr`. Klient korzysta z cookies Next.js.

`middleware.ts`:

- tworzy Supabase SSR client;
- wywołuje `supabase.auth.getUser()`;
- synchronizuje cookies odpowiedzi;
- działa dla ścieżek innych niż statyczne assety i obrazy.

## Profil użytkownika

`getCurrentUserContext()` w `lib/auth.ts`:

1. Pobiera aktualnego użytkownika przez `supabase.auth.getUser()`.
2. Jeśli nie ma użytkownika, zwraca `null`.
3. Pobiera rekord z `profiles` po `id = auth.users.id`.
4. Zwraca `{ userId, profile }`.

Kod zakłada role w `profiles.role`:

- `admin`
- `organizer`
- `user`

## Dostęp admina

`requireAdmin()`:

- przekierowuje niezalogowanych na `/login`;
- przekierowuje użytkowników bez `profile.role === "admin"` na `/`;
- zwraca kontekst admina dla dalszych zapytań.

Użycie:

- `getAdminDashboard()`
- `listAdminEvents()`
- `getAdminEventEditorOptions()`
- `getAdminEventForEdit()`
- akcje tworzenia/edycji/statusu/usuwania wydarzeń;
- akcje i listy organizatorów.

## Dostęp organizatora

`requireOrganizerAccess()`:

- przekierowuje niezalogowanych na `/login`;
- dla admina zwraca `isAdmin: true`, ale bez memberships;
- dla roli innej niż `organizer` przekierowuje na `/`;
- dla organizatora pobiera `organizer_users` przez `listOrganizerMemberships(userId)`;
- jeśli konto organizatora nie ma memberships, panel pokazuje empty state "Brakuje organizatora".

W praktyce funkcje organizatora wymagają memberships, bo operują na `submitted_by_organizer_id`.

## Navbar

`components/Navbar.tsx` jest server componentem:

- pobiera użytkownika przez Supabase;
- jeśli nie ma użytkownika, przekazuje `isLoggedIn: false`;
- jeśli użytkownik jest zalogowany, pobiera `profiles.display_name` i `profiles.role`;
- `NavbarClient` pokazuje link `Panel` dla `admin` albo `organizer`;
- wylogowanie odbywa się formularzem `POST /auth/sign-out`.

## Wymagane RLS policies

Repozytorium nie zawiera definicji RLS, więc faktyczny stan wymaga potwierdzenia. Kod wymaga przynajmniej:

- użytkownik może odczytać swój rekord `profiles`;
- admin może odczytywać i zapisywać tabele zarządcze;
- organizator może odczytywać swoje `organizer_users`;
- organizator może tworzyć i edytować wydarzenia tylko dla powiązanych `organizer_id`;
- publiczny klient może czytać opublikowane publiczne wydarzenia i relacje potrzebne na frontendzie;
- akcje admina/organizatora mogą tworzyć `locations` i `event_sources`.

## Elementy wymagające potwierdzenia

- Czy istnieje trigger tworzący `profiles` po utworzeniu użytkownika.
- Czy `profiles.id` ma FK do `auth.users.id`.
- Czy `organizer_users.user_id` ma FK do `auth.users.id`.
- Czy w Supabase włączone są wyłącznie logowania email/hasło, czy także inni providerzy.
