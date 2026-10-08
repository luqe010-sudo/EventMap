# Auth

## Mechanizm logowania

Aplikacja uzywa Supabase Auth. Formularz `/login` renderuje `components/LoginForm.tsx`, ktory wywoluje `signInFormAction()` z `lib/auth-actions.ts` przez `useActionState()`.

`signInFormAction()`:

1. Odczytuje `email` i `password` z `FormData`.
2. Wywoluje `supabase.auth.signInWithPassword()`.
3. Po sukcesie przekierowuje na bezpieczną lokalną ścieżkę `next`, domyślnie `/`.
4. Po bledzie zwraca stan formularza z komunikatem, zeby zwykly blad logowania nie powodowal 500 w Server Components.

`signInAction(formData)` zostaje dostepna jako prosty wariant tej samej logiki.

## Odzyskiwanie hasła — publikacja 2026-10-06

`/forgot-password` renderuje `PasswordRecoveryForm` i wywołuje `requestPasswordResetAction()` z `lib/auth-password-actions.ts`. Akcja waliduje e-mail, wyznacza origin przez `lib/auth-origin.ts` i wywołuje `resetPasswordForEmail()` z callbackiem `/auth/recovery?next=...`. `next` zawsze przechodzi przez `safeNextPath`. Komunikat sukcesu jest taki sam dla istniejącego i nieistniejącego konta; awarie usługi i ograniczenie liczby próśb mają osobne komunikaty. Samo zapisanie nowego hasła realizuje Supabase Auth przez `updateUser()`, zgodnie z [Password-based Auth](https://supabase.com/docs/guides/auth/passwords).

Callback `/auth/recovery` przyjmuje jedną z dwóch ścieżek:

1. `code`: `exchangeCodeForSession()` musi zwrócić sesję i `redirectType === "recovery"`. Zwykły kod OAuth nie uprawnia do tego formularza. Ta ścieżka wymaga verifiera PKCE zachowanego w przeglądarce, w której rozpoczęto odzyskiwanie; ograniczenie opisuje [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
2. `token_hash` oraz `type=recovery`: callback wywołuje `verifyOtp({ token_hash, type: "recovery" })`. Link ze zmienionym typem, oba rodzaje tokenu jednocześnie, błąd dostawcy lub brak tokenu są odrzucane. Ten wariant nie wymaga cookie verifiera PKCE z przeglądarki rozpoczynającej proces.

Po weryfikacji callback pobiera użytkownika przez `getUser()` i ustawia `eventmap-password-recovery`: HttpOnly, SameSite=Lax, Secure dla HTTPS, path `/auth`, ważność 10 minut. Marker zawiera ID zweryfikowanego konta i termin ważności. `/auth/reset-password` oraz `resetPasswordAction()` ponownie sprawdzają `getUser()` i zgodność ważnego markera z kontem. Akcja waliduje zgodność haseł i długość 6–128 znaków; Supabase może nałożyć dodatkowe wymagania. Po udanym `updateUser({ password })` usuwa marker, próbuje zamknąć lokalną sesję odzyskiwania i przekierowuje do `/login?reset=success&next=...`. Błąd zamknięcia sesji nie opisuje już zapisanej zmiany hasła jako porażki.

Callback zwraca `Cache-Control: no-store` i `Referrer-Policy: no-referrer`; ekrany odzyskiwania mają `noindex, nofollow`. Błędy logowane przez ten przepływ nie zawierają hasła ani tokenu linku.

Zalecany link w szablonie Supabase **Reset password**, dostosowany do tego callbacku:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Ustaw nowe hasło</a>
```

Aplikacja zawsze dołącza `?next=...` do `RedirectTo`, dlatego szablon dokleja parametry przez `&`. Wariant z `TokenHash` umożliwia otwarcie wiadomości w innej przeglądarce i weryfikację przez serwer; zmienne i weryfikację linku po stronie serwera opisują [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates). Domyślny `ConfirmationURL` w używanym tutaj przepływie PKCE wymaga przeglądarki i originu z zachowanym verifierem; szczególnie nie należy mieszać `localhost` z `127.0.0.1`.

W produkcji `NEXT_PUBLIC_SITE_URL` jest obowiązkowe dla callbacków Google i odzyskiwania. Lokalny development może wyznaczyć origin z nagłówków. Brak poprawnego originu przerywa akcję przed żądaniem Auth. Szczegóły allowlisty są w [deployment](deployment.md).

Podczas zleconej publikacji dodano do Supabase EventMap wyłącznie `https://mapaimprez.pl/auth/recovery\?next=**`, zachowując dwa wcześniejsze callbacki. Odczyt po zapisie potwierdził zgodność tego pola i zachowanie pozostałych niedeklarowanych ustawień. Nie zmieniono szablonu ani SMTP; ich stan pozostaje niepotwierdzony. Nie wysłano prawdziwej wiadomości, nie wykonano pełnego resetu przez e-mail ani sesji staging. Te próby pozostają warunkiem pełnego odbioru; publikacja kodu i izolowane regresje nie potwierdzają dostarczania poczty. [Raport wdrożenia](production-release-2026-10-06.md).

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

Globalny `middleware.ts` nie jest obecnie uzywany. Sesja jest odczytywana w server components, server actions i route handlers przez `createSupabaseUserClient()`. W przeplywie Google cookie sesyjne sa ustawiane podczas wymiany kodu PKCE w `/auth/callback`; odzyskiwanie hasła ustawia je w `/auth/recovery` po wymianie kodu albo weryfikacji tokenu recovery.

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

`components/Navbar.tsx` renderuje początkowy stan niezalogowany bez odczytu cookies w publicznym layoucie. `NavbarClient` pobiera prywatny stan przez `GET /api/account/navbar`:

- endpoint weryfikuje użytkownika przez Supabase Auth i pobiera `profiles.display_name` oraz `profiles.role`;
- brak użytkownika lub błąd Auth/profilu zwraca `isLoggedIn: false`; awarie są logowane po stronie serwera;
- odpowiedź ma `Cache-Control: private, no-store, max-age=0`, a błąd żądania klienta także przywraca stan niezalogowany;
- `NavbarClient` pokazuje `/account` zalogowanym bez roli organizatora, a organizatorom wyłącznie wejście do `/organizer`;
- wylogowanie odbywa sie formularzem `POST /auth/sign-out`.

## Usuwanie zapisanych wydarzeń

`removeSavedEventAction(eventId)` przekazuje wynik `toggleSavedEventAction(eventId, false)`, korzystającej z wdrożonego `set_my_saved_event`. `SavedEventCard` pokazuje pending oraz błąd, pozostawia kartę przy nieudanym usunięciu i kieruje wygasłą sesję do `/login` z `next` bieżącej listy. Dopiero potwierdzone `saved: false` usuwa kartę i nadaje `eventmap:saved-event`. Nieudana operacja nie rewaliduje listy jako sukces. To obsługa błędu aplikacji; pełny odbiór Auth/HTTP i równoległości RPC pozostaje w [checkliście](mvp-release-checklist-2026-10-05.md).

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
- Czy callback `/auth/recovery`, szablon Reset password i dostarczanie przez SMTP działają dla uzgodnionych originów produkcji oraz środowiska testowego; odebrać token hash w innej przeglądarce i PKCE w przeglądarce rozpoczynającej proces.
