# Auth

## Mechanizm logowania

Aplikacja uzywa Supabase Auth. Formularz `/login` renderuje `components/LoginForm.tsx`, ktory wywoluje `signInFormAction()` z `lib/auth-actions.ts` przez `useActionState()`.

`signInFormAction()`:

1. Odczytuje `email` i `password` z `FormData`.
2. Wywoluje `supabase.auth.signInWithPassword()`.
3. Po sukcesie przekierowuje na `/`.
4. Po bledzie zwraca stan formularza z komunikatem, zeby zwykly blad logowania nie powodowal 500 w Server Components.

`signInAction(formData)` zostaje dostepna jako prosty wariant tej samej logiki.

### Google OAuth

Ekrany `/login` i `/register` udostepniaja logowanie przez Google. `signInWithGoogleAction()` wywoluje `supabase.auth.signInWithOAuth({ provider: "google" })` i kieruje dostawce do `/auth/callback`.

Route handler `/auth/callback`:

1. Wymienia kod OAuth na sesje przez `exchangeCodeForSession()`.
2. Pobiera zweryfikowanego uzytkownika przez `auth.getUser()`.
3. Rozpoznaje pierwsze logowanie Google rowniez wtedy, gdy trigger Supabase zdazyl automatycznie utworzyc `profiles`.
4. Jesli uzytkownik rozpoczal zwykle logowanie, ale Google dopiero utworzylo jego konto, przekierowuje na obowiazkowy `/auth/onboarding`.
5. Onboarding wymaga akceptacji regulaminu, potwierdzenia polityki prywatnosci/cookies i wyboru roli `user` albo `organizer`.
6. Dopiero po zatwierdzeniu tworzy lub uzupelnia profil; rola `admin` nigdy nie moze zostac nadana przez ten przeplyw.
7. Dla nowego organizatora tworzy `organizers` i `organizer_users`, jesli powiazanie jeszcze nie istnieje.

Zamiar rejestracji, rola i nazwa organizatora sa przechowywane przez maksymalnie 10 minut w cookie `HttpOnly`, `SameSite=Lax`, ograniczonym do `/auth/callback`. Niedokonczony onboarding jest autoryzowany osobnym cookie HttpOnly przez 30 minut. Ukonczenie jest oznaczane w `auth.users.user_metadata.eventmap_onboarding_completed`; nie wymaga to migracji tabel `public`. Konto utworzone przez Google przed dodaniem tego oznaczenia zostanie skierowane na onboarding przy kolejnym logowaniu Google.

## Rejestracja

Aplikacja ma formularz `/register`, ktory wywoluje `signUpAction()` z `lib/auth-actions.ts`.

`signUpAction()`:

1. Wymaga zaakceptowania regulaminu przez pole `termsAccepted`.
2. Wymaga potwierdzenia zapoznania sie z polityka prywatnosci / RODO i polityka cookies przez pole `privacyNoticeAccepted`.
3. Tworzy uzytkownika przez `supabase.auth.signUp()`.
4. Zapisuje `display_name`, `role` i opcjonalna nazwe organizatora w metadanych Auth.
5. Gdy Supabase zwroci sesje, zapisuje/aktualizuje rekord w `profiles`.
6. Dla roli `organizer` tworzy rekord w `organizers` i powiazanie w `organizer_users`, jesli nie istnieje.

Jesli logowanie zwroci blad `Email not confirmed`, kod pokazuje komunikat w formularzu. Przy rejestracji bez weryfikacji email trzeba potwierdzic konfiguracje Supabase Auth, bo repozytorium nie zawiera ustawien panelu Supabase.

## Sesja SSR

`lib/supabase-user.ts` tworzy klienta Supabase przez `createServerClient` z `@supabase/ssr`. Klient korzysta z cookies Next.js.

Globalny `middleware.ts` nie jest obecnie uzywany. Sesja jest odczytywana w server components, server actions i route handlers przez `createSupabaseUserClient()`. W przeplywie Google cookie sesyjne sa ustawiane podczas wymiany kodu PKCE w `/auth/callback`.

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
- `NavbarClient` pokazuje `/account` zalogowanym bez roli organizatora, a organizatorom wyłącznie wejście do `/organizer`;
- wylogowanie odbywa sie formularzem `POST /auth/sign-out`.

## Wymagane RLS policies

Faktyczny stan RLS wdrożony w Supabase wymaga każdorazowego potwierdzenia. Kod wymaga przynajmniej:

Proponowany, niewykonywany automatycznie skrypt dla panelu konta znajduje sie w `docs/user-account-rls.sql`.

- uzytkownik moze odczytac swoj rekord `profiles`;
- uzytkownik moze utworzyc lub zaktualizowac swoj rekord `profiles` podczas rejestracji;
- uzytkownik moze odczytywac, dodawac i usuwac tylko swoje rekordy `saved_events` (`user_id = auth.uid()`);
- organizator moze odczytywac swoje `organizer_users`;
- organizator moze tworzyc powiazanie `organizer_users` dla siebie podczas rejestracji albo istnieje trigger/service flow, ktory robi to za aplikacje;
- admin moze odczytywac i zapisywac tabele zarzadcze;
- organizator moze tworzyc i edytowac wydarzenia tylko dla powiazanych `organizer_id`;
- publiczny klient moze czytac opublikowane publiczne wydarzenia i relacje potrzebne na frontendzie;
- publiczny klient moze czytac `cities`;
- admin moze tworzyc, edytowac i usuwac `cities`;
- organizator moze tworzyc nowe `cities` podczas dodawania lokalizacji wydarzenia;
- akcje admina/organizatora moga tworzyc `locations`, `cities` i `event_sources`.

## Elementy wymagajace potwierdzenia

- Czy Supabase Auth ma wylaczone potwierdzanie email dla scenariusza rejestracji bez weryfikacji.
- Czy istnieje trigger tworzacy `profiles` po utworzeniu uzytkownika.
- Czy `profiles.id` ma FK do `auth.users.id`.
- Czy `organizer_users.user_id` ma FK do `auth.users.id`.
- Czy callbacki Google OAuth dla produkcji i localhost sa wpisane na allowliscie Supabase Auth.
