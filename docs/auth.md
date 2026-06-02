# Auth

## Mechanizm logowania

Aplikacja uzywa Supabase Auth. Formularz `/login` renderuje `components/LoginForm.tsx`, ktory wywoluje `signInFormAction()` z `lib/auth-actions.ts` przez `useActionState()`.

`signInFormAction()`:

1. Odczytuje `email` i `password` z `FormData`.
2. Wywoluje `supabase.auth.signInWithPassword()`.
3. Po sukcesie przekierowuje na `/`.
4. Po bledzie zwraca stan formularza z komunikatem, zeby zwykly blad logowania nie powodowal 500 w Server Components.

`signInAction(formData)` zostaje dostepna jako prosty wariant tej samej logiki.

## Rejestracja

Aplikacja ma formularz `/register`, ktory wywoluje `signUpAction()` z `lib/auth-actions.ts`.

`signUpAction()`:

1. Tworzy uzytkownika przez `supabase.auth.signUp()`.
2. Zapisuje `display_name`, `role` i opcjonalna nazwe organizatora w metadanych Auth.
3. Gdy Supabase zwroci sesje, zapisuje/aktualizuje rekord w `profiles`.
4. Dla roli `organizer` tworzy rekord w `organizers` i powiazanie w `organizer_users`, jesli nie istnieje.

Jesli logowanie zwroci blad `Email not confirmed`, kod pokazuje komunikat w formularzu. Przy rejestracji bez weryfikacji email trzeba potwierdzic konfiguracje Supabase Auth, bo repozytorium nie zawiera ustawien panelu Supabase.

## Sesja SSR

`lib/supabase-user.ts` tworzy klienta Supabase przez `createServerClient` z `@supabase/ssr`. Klient korzysta z cookies Next.js.

Globalny `middleware.ts` nie jest obecnie uzywany. Sesja jest odczytywana w server components, server actions i route handlers przez `createSupabaseUserClient()`.

## Profil uzytkownika

`getCurrentUserContext()` w `lib/auth.ts`:

1. Pobiera aktualnego uzytkownika przez `supabase.auth.getUser()`.
2. Jesli nie ma uzytkownika, zwraca `null`.
3. Pobiera rekord z `profiles` po `id = auth.users.id`.
4. Zwraca `{ userId, profile }`.

Kod zaklada role w `profiles.role`:

- `admin`
- `organizer`
- `user`

## Dostep admina

`requireAdmin()`:

- przekierowuje niezalogowanych na `/login`;
- przekierowuje uzytkownikow bez `profile.role === "admin"` na `/`;
- zwraca kontekst admina dla dalszych zapytan.

## Dostep organizatora

`requireOrganizerAccess()`:

- przekierowuje niezalogowanych na `/login`;
- dla admina zwraca `isAdmin: true`, ale bez memberships;
- dla roli innej niz `organizer` przekierowuje na `/`;
- dla organizatora pobiera `organizer_users` przez `listOrganizerMemberships(userId)`;
- jesli konto organizatora nie ma memberships, panel pokazuje empty state "Brakuje organizatora".

W praktyce funkcje organizatora wymagaja memberships, bo operuja na `submitted_by_organizer_id`.

## Navbar

`components/Navbar.tsx` jest server componentem:

- pobiera uzytkownika przez Supabase;
- jesli nie ma uzytkownika, przekazuje `isLoggedIn: false`;
- jesli uzytkownik jest zalogowany, pobiera `profiles.display_name` i `profiles.role`;
- `NavbarClient` pokazuje link `Panel` dla `admin` albo `organizer`;
- wylogowanie odbywa sie formularzem `POST /auth/sign-out`.

## Wymagane RLS policies

Repozytorium nie zawiera definicji RLS, wiec faktyczny stan wymaga potwierdzenia. Kod wymaga przynajmniej:

- uzytkownik moze odczytac swoj rekord `profiles`;
- uzytkownik moze utworzyc lub zaktualizowac swoj rekord `profiles` podczas rejestracji;
- organizator moze odczytywac swoje `organizer_users`;
- organizator moze tworzyc powiazanie `organizer_users` dla siebie podczas rejestracji albo istnieje trigger/service flow, ktory robi to za aplikacje;
- admin moze odczytywac i zapisywac tabele zarzadcze;
- organizator moze tworzyc i edytowac wydarzenia tylko dla powiazanych `organizer_id`;
- publiczny klient moze czytac opublikowane publiczne wydarzenia i relacje potrzebne na frontendzie;
- akcje admina/organizatora moga tworzyc `locations` i `event_sources`.

## Elementy wymagajace potwierdzenia

- Czy Supabase Auth ma wylaczone potwierdzanie email dla scenariusza rejestracji bez weryfikacji.
- Czy istnieje trigger tworzacy `profiles` po utworzeniu uzytkownika.
- Czy `profiles.id` ma FK do `auth.users.id`.
- Czy `organizer_users.user_id` ma FK do `auth.users.id`.
- Czy w Supabase wlaczone sa wylacznie logowania email/haslo, czy takze inni providerzy.
