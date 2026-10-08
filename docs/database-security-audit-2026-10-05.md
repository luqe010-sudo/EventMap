# EventMap — audyt wdrożonej bazy, 5 października 2026

## Aktualizacja RLS — 6 października 2026

Po zgodzie użytkownika wykonano transakcyjne reprodukcje czterech luk i błędu profilu, a po osobnym zatwierdzeniu wdrożono RLS lokalizacji/analityki o 21:20 CEST. [Bieżący raport wdrożenia](supabase-rls-hardening-release-2026-10-06.md): testy po zmianie przeszły, wszystkie fixture wycofano, dokładnie trzy zaplanowane zmiany policies (43 → 42), pozostałe osiem kolekcji/granty bez zmian. Typy wygenerowano ponownie i są identyczne z obecnym kontraktem. Wciąż otwarte są ochrona pól/właściciela wydarzenia, profil organizacji oraz prawdziwe sesje Auth/HTTP. Stwierdzenia niżej o broad INSERT lokalizacji i niewykonanych próbach opisują stan historyczny.

## Aktualizacja po wykonaniu zatwierdzonego hotfixa

Po wyraźnej zgodzie użytkownika wykonano `docs/security-hotfix-registration-proposal.sql` w projekcie EventMap. Przed wykonaniem porównano bieżącą definicję funkcji z wersją odczytaną podczas audytu: była identyczna. Po wykonaniu potwierdzono dokładną zgodność ciała funkcji z zatwierdzonym SQL, `search_path=pg_catalog, public`, brak bezpośredniego EXECUTE dla anon/authenticated, zachowanego właściciela postgres i aktywny trigger rejestracji. Rola nowego profilu jest ograniczona do user/organizer niezależnie od wartości roli w metadanych.

Nie zmieniono istniejących kont ani danych. Nie tworzono kont testowych na produkcji. Nie przeprowadzono pełnego testu rejestracji Auth; wymaga środowiska testowego. Serwerową walidację roli w kodzie aplikacji później wdrożono, zgodnie z [postępem MVP](mvp-progress-2026-10-05.md). SQL wykonano bezpośrednio przez `db query`; nie uruchamiano `db push` ani nie zmieniano historii migracji. Sygnatura funkcji, tabele i kolumny pozostają takie same, więc ta poprawka nie wymaga regeneracji typów schematu.

Punkt 2 opisuje historyczny rozjazd zapisanych wydarzeń, rozwiązany następnie przez wdrożone RPC i zmianę kodu; [raport RPC](saved-events-rpc-proposal.md) zawiera aktualny status. Po RPC wygenerowano typy ponownie, także z widokiem `city_page_event_counts`. Nadal otwarte są realne sesje Auth/HTTP, próby równoległości oraz pozostałe ustalenia RLS. Konkretne warunki odbioru: [checklista premiery](mvp-release-checklist-2026-10-05.md).

Dowody lokalne: `scratch/security-audit/registration-before-hotfix.json` i `registration-after-hotfix.json`. Dalszy tekst opisuje stan wykryty przed poprawką.

## Zakres i dowody

Zalogowane Supabase CLI 2.119.0 odczytało projekt EventMap (`jifeontwlybxkghbzcry`), PostgreSQL 17.6, przez Management API. Wykonano odczyty katalogów schematu, grantów, RLS, funkcji, triggerów, constraintów, indeksów i widoków oraz raport Security Advisor. Nie wykonano własnych operacji DDL/DML, rejestracji ani prób nadania sobie uprawnień. Połączenie administratora służyło do inspekcji i nie jest dowodem, że zwykłe konta przechodzą testy integracyjne.

Odtwarzalny odczyt katalogu: `docs/security-audit-readonly.sql`. Lokalna kopia odpowiedzi katalogowych i Advisor znajduje się w `scratch/security-audit/`; nie jest przeznaczona do publikacji. Nie pobierano haseł, tokenów, emaili ani rekordów kont. Krytyczna poprawka: `docs/security-hotfix-registration-proposal.sql` — wykonana później po zatwierdzeniu, zgodnie z aktualizacją powyżej.

## 1. Krytyczne: nadanie admina przez rejestrację

W bazie aktywny jest trigger `on_auth_user_created` na `auth.users`, wykonujący `public.handle_new_user()`. Funkcja ma `SECURITY DEFINER` i zapisuje do `profiles.role` wartość `new.raw_user_meta_data->>'role'` bez listy dozwolonych ról. `profiles.role` jest tekstem i nie ma ograniczenia CHECK zawężającego wartości.

Polityki `profiles insert own safe` i `profiles update own safe` istnieją i ograniczają zwykłe zapisy użytkownika, ale nie chronią tej ścieżki: trigger działa z uprawnieniami właściciela funkcji. `public.is_admin()` następnie ufa wartości profilu. Kod rejestracji emailowej także przyjmuje dowolny string roli z formularza.

To **potwierdzona niebezpieczna ścieżka nadawania uprawnień w definicji bazy**, nie tylko podejrzenie z kodu. Nie wykonano próby wykorzystania na produkcji. Ewentualne dodatkowe ograniczenia usługi Auth wymagają osobnego sprawdzenia, lecz nie zastępują poprawnego triggera. Poprawka aplikacji sama nie wystarczy, bo rejestracja Auth jest oddzielną powierzchnią API.

Przygotowany hotfix ogranicza wynik roli do `organizer` lub `user`, ustala `search_path` i odbiera niepotrzebne bezpośrednie EXECUTE funkcji triggerowej dla PUBLIC/anon/authenticated. Nie zmienia istniejących kont, schematu tabel ani polityk. Nie rozwiązuje istniejących kolizji slugów organizatorów — to kolejny, oddzielny krok.

Po hotfixie: osobno przegląd legalności aktualnych kont admina przez właściciela projektu oraz testy rejestracji na staging. Wszelkie cofnięcie uprawnień, blokowanie kont czy sesji wymaga decyzji na podstawie rzeczywistych danych; audyt nie stwierdza, że doszło do nadużycia.

## 2. Zapisane wydarzenia: rozjazd kodu i grantów

Rola `authenticated` ma SELECT wyłącznie na `saved_events.event_id` i `created_at`, INSERT na `user_id/event_id`, DELETE na tabeli. Nie ma SELECT na `user_id`.

`lib/user-account.ts` filtruje odczyty przez `.eq("user_id", ...)`, a `lib/user-account-actions.ts` filtruje tak usuwanie. Filtr kolumny wymaga prawa jej odczytu, więc obecny model grantów jest niespójny z kodem. Co więcej, RLS pozwala organizatorowi odczytać zapisania jego wydarzeń przez inne osoby — nie wystarczy po prostu usunąć filtr i polegać na „own” policy, ponieważ polityki SELECT są sumowane.

Naprawa wymaga rozdzielenia prywatnego odczytu własnych zapisów i agregatów dla organizatora. Przygotować dedykowane bezpieczne RPC lub inną uzgodnioną strukturę uprawnień. Nie przyznawać w ciemno SELECT na `user_id`, bo otworzyłoby to organizatorom identyfikatory zapisujących użytkowników. Błąd wykonania na konkretnej sesji wymaga testu integracyjnego; sprzeczność uprawnień i zapytania jest potwierdzona.

## 3. Profil organizatora: zapis blokowany przez RLS

`organizers` ma tylko politykę publicznego SELECT i admin ALL. Nie ma UPDATE dla członka organizacji ani INSERT dla samodzielnego tworzenia organizacji przez zwykłą sesję.

Trigger rejestracji tworzy organizację, ale `organizerUpdateProfileAction` i `createOrganizerAccountAction` wykonują późniejsze zapisy zwykłym klientem sesyjnym. Pierwsza ścieżka jest blokowana dla organizatora przez aktualne RLS; druga także nie ma polityk INSERT do `organizers`/`organizer_users`.

Naprawa musi umożliwiać edycję wybranych pól własnej organizacji, bez samodzielnego ustawiania `is_verified` i bez dopisywania się do cudzej organizacji. Samo dopisanie szerokiego UPDATE albo `user_id=auth.uid()` do INSERT członkostwa byłoby zbyt słabe.

## 4. Publiczny widok obejmuje także niepubliczne wydarzenia

`public.city_page_event_counts` jest dostępny dla anon i authenticated, działa jako widok właściciela (`reloptions` nie zawiera security_invoker) i zlicza wszystkie połączone wydarzenia bez filtra publikacji, widoczności lub anulowania. Security Advisor zgłasza ERROR.

To ekspozycja liczników, a nie udowodniony wyciek pełnych rekordów wydarzeń. Jeśli widok ma służyć publicznemu UI, powinien zliczać wyłącznie publicznie dostępne wydarzenia i działać z uprawnieniami wywołującego. Jeśli jest administracyjny, należy ograniczyć dostęp. Sprawdzić wszystkich zewnętrznych konsumentów przed zmianą.

## 5. Inne potwierdzone ustalenia

- RLS jest włączone na wszystkich 18 tabelach domenowych. `spatial_ref_sys` pochodzi z PostGIS i nie ma RLS; Advisor zgłasza to jako ERROR. To nie oznacza automatycznie wycieku danych użytkowników ani uzasadnienia dla zmian tabel rozszerzenia bez analizy.
- Stara polityka `locations authenticated insert` ma `WITH CHECK true` i sumuje się z nowszą `locations_insert_admin_or_organizer`. W efekcie restrykcja nowej polityki nie ogranicza tworzenia lokalizacji do admina/organizatora.
- `events organizer update own` blokuje status published i sprawdza członkostwo dla starego/nowego zgłaszającego, ale nie wymusza niezmienności `submitted_by_organizer_id` między dwiema organizacjami tej samej osoby. Nie chroni też wszystkich pól administracyjnych przed bezpośrednią aktualizacją. Kod aplikacji jest węższy od uprawnień bazy.
- `organizers public read` udostępnia publiczny SELECT wszystkich pól. Trigger wypełnia `email` mailem rejestrującego. Trzeba ustalić, czy to celowo publiczny kontakt organizacji; nie pobierano rzeczywistych adresów.
- `handle_new_user` i `city_slugify` nie mają ustalonego search_path. Funkcja triggerowa nie zapewnia unikalności sluga: rejestracja drugiej organizacji o tym samym slugu może zakończyć się błędem constraintu i całej transakcji Auth.
- Wiele tabel ma szerokie granty dla anon/authenticated. RLS nadal ogranicza zwykłe operacje na wierszach; grant nie jest sam w sobie dowodem, że anonim może pisać do API. Niemniej TRUNCATE/REFERENCES/TRIGGER są niepotrzebne dla runtime i nie należy polegać na RLS przy operacjach, których nie obejmuje. Przygotować minimalizację grantów oddzielnie.
- Nie ma CHECK dla statusów wydarzeń, cen i relacji dat. Walidację aplikacji warto wesprzeć uzgodnionymi constraintami po kontroli istniejących danych.
- Istnieją przydatne indeksy częściowe publicznych wydarzeń oraz indeksy dat, kategorii i zgłaszającego. Są też duplikaty indeksów/kluczy obcych. Nie usuwać ich bez sprawdzenia zależności; nie ma podstaw do przebudowy całej bazy.
- Aktualny schemat zawiera migracje w repo oraz dodatkowy widok nieobecny w `database.types.ts`. Pierwotny raport wymaga sprostowania w punktach o braku migracji.

## 6. Security Advisor

Odczytano 16 zgłoszeń: 2 ERROR i 14 WARN. Grupy:

| Grupa | Liczba | Interpretacja |
| --- | --- | --- |
| security_definer_view | 1 | Widok city_page_event_counts — wymaga naprawy zakresu/trybu dostępu. |
| rls_disabled_in_public | 1 | spatial_ref_sys z PostGIS — osobna analiza ekspozycji rozszerzenia. |
| function_search_path_mutable | 2 | handle_new_user i city_slugify. |
| extension_in_public | 1 | PostGIS w public — ocenić konfigurację i zależności. |
| anon_security_definer_function_executable | 5 | Funkcje definer dostępne anon; ocenić każdą, nie odbierać mechanicznie wszystkich praw. |
| authenticated_security_definer_function_executable | 5 | Analogicznie dla zalogowanych. is_admin jest celowym helperem RLS i wymaga zachowania działania polityk. |
| auth_leaked_password_protection | 1 | Wyłączona ochrona przed hasłami z wycieków; sprawdzić dostępność funkcji w planie i ustawienia Auth. |

Nie korzystano z arbitralnego wyniku Advisor jako dowodu wykorzystania podatności. Najpoważniejszy problem nadawania roli wynika z odczytanej funkcji i zależności, nie z automatycznego raportu.

## 7. Kolejność następnych prac

1. Zatwierdzić i zastosować wąski hotfix triggera rejestracji; zweryfikować definicję i granty po wykonaniu. Osobno poprawić listę ról w kodzie aplikacji.
2. Uruchomić staging i konta testowe. Przejść macierz: anon, user, organizator A/B, admin; rejestracja user/organizer/admin/nieznana rola.
3. Przygotować osobny pakiet dla zapisanych wydarzeń, edycji profilu organizatora, uprawnień pól wydarzenia i publicznego widoku. Dołączone testy negatywne są warunkiem odbioru.
4. Dopiero potem szeroki lifting mobile i dalsze naprawy wyszukiwania; drobne, niezależne poprawki UI mogą powstawać równolegle.

Hotfix rejestracji zatwierdzono i wykonano, zgodnie z aktualizacją na początku raportu. Pozostałe propozycje zmian produkcyjnej bazy nadal wymagają osobnego przedstawienia i zatwierdzenia, zgodnie z instrukcją AGENTS.md: „Jeśli potrzebna jest migracja SQL, zaproponuj ją osobno i nie wykonuj automatycznie”.
