# Ochrona zapisu organizatora — osobna propozycja

Status: **projekt do przeglądu, bez wykonywalnej migracji i bez zmian w bazie**. Proponowany pakiet zamyka trzy potwierdzone problemy: przenoszenie właściciela wydarzenia przez członka dwóch organizacji, zmianę chronionych pól wydarzenia przez organizatora oraz brak UPDATE własnej organizacji. Nie dodaje tabel ani kolumn i nie zmienia ich nazw.

## Potwierdzona podstawa

Podstawą jest aktualny katalog `scratch/security-audit/production-after-rls-hardening-2026-10-06-readonly.json`, odczytany 6 października 2026 o 21:20:32 CEST, po wdrożeniu małego pakietu lokalizacji/analityki i przed jego testami o 21:21 CEST. SHA-256 pliku: `0272aa876cac1564e709ae137fc954aeb2dd40a00d4af296e6d2176dbc676923`. Katalog zawiera 42 policies; policies `events` i `organizers` pozostały bez zmian. Raport wdrożenia: [supabase-rls-hardening-release-2026-10-06.md](supabase-rls-hardening-release-2026-10-06.md).

Przejrzano rzeczywiste [typy](../database.types.ts), [writer organizatora](../lib/organizer-events.ts), [wspólny payload i zapis źródła](../lib/event-editor-server.ts), [statusy i datę publikacji](../lib/event-editor.ts), [writer admina wydarzeń](../lib/admin-events.ts), [writer admina organizacji](../lib/admin-organizers.ts) oraz [guardy aplikacji](../lib/auth.ts). `events` ma 30 kolumn, `organizers` 14. Nie ma obecnie własnych triggerów na tych dwóch tabelach.

- `events organizer update own` sprawdza członkostwo dla starego i nowego `submitted_by_organizer_id`, ale nie porównuje obu wartości. Członek A i B może więc przenieść wydarzenie A do B. Warunek `status <> 'published'` nie chroni flag admina ani pozostałych kolumn.
- `events organizer insert own` wymaga własnego `created_by`, członkostwa, `pending_review` i `public`, ale nie zabezpiecza pozostałych pól administracyjnych przy INSERT.
- `organizers` ma publiczny SELECT oraz admin ALL; nie ma polityki UPDATE dla członka. Formularz profilu wysyła poprawny UPDATE i otrzymuje zero wierszy.

Admin i organizator korzystają z klienta sesyjnego i tej samej roli SQL `authenticated`. Admina rozpoznaje `public.is_admin()` na podstawie `profiles.role`, nie metadanych deklarowanych przez użytkownika. Obecne granty tabel zawierają pełny UPDATE: odebranie samego UPDATE pojedynczej kolumny nie ograniczy zapisu, dopóki pozostaje grant tabeli. [PostgreSQL 17: GRANT](https://www.postgresql.org/docs/17/sql-grant.html).

## Wybrane rozwiązanie

Zachować istniejące bezpośrednie writery i dodać dwa walidujące triggery wierszowe: `BEFORE INSERT OR UPDATE` na `public.events` oraz `BEFORE UPDATE` na `public.organizers`. Obie funkcje mają być `SECURITY INVOKER`, zwracać `trigger` i odrzucać niedozwoloną zmianę kodem `42501`; nie mogą po cichu pomijać wiersza. Trigger UPDATE ma obejmować każdą aktualizację, bez listy `UPDATE OF` pozwalającej ominąć walidację.

RLS nadal wybiera dostępne wiersze. Trigger porównuje `OLD` i `NEW`, czego sam warunek nowego właściciela w `WITH CHECK` nie zapewnia. PostgreSQL wykonuje `WITH CHECK` po triggerze BEFORE, więc kontroluje również końcową wartość `NEW`. [PostgreSQL 17: CREATE POLICY](https://www.postgresql.org/docs/17/sql-createpolicy.html), [CREATE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html).

Kolejność rozpoznawania autora zapisu:

1. Jawnie zaufana, rzeczywista rola SQL utrzymania `postgres` albo `service_role` zachowuje dotychczasowe możliwości. To wybór roli wykonania w bazie, nie wartość `request.jwt.claim.role` ani samo `auth.uid() = NULL`. Żaden zwykły writer aplikacji nie otrzymuje takiej roli.
2. Dla SQL `authenticated` z niepustym `auth.uid()` i prawdziwym `public.is_admin()` zachować obecne możliwości admina, w tym moderację, flagi weryfikacji, przypisanie organizacji i historię publikacji.
3. Pozostały zapis wymaga SQL `authenticated`, niepustego UID, własnego profilu `role = 'organizer'` oraz członkostwa `organizer_users.user_id = auth.uid()` we właściwej organizacji. To odpowiada guardowi aplikacji i nowej polityce tworzenia lokalizacji. Sama rola profilu, samo członkostwo użytkownika z profilem `user` oraz metadane `role = 'admin'` nie wystarczają.
4. Pozostałe role i brak UID są odrzucane. Nie stosować ogólnego wyjątku dla pustego UID, `pg_trigger_depth()`, wartości z formularza ani dodatkowego własnego GUC.

Wyjątki utrzymania wymagają weryfikacji rzeczywistych ról i istniejących importerów przed przygotowaniem SQL. Nie powstają nowe role. `SECURITY INVOKER` pozwala zachować rolę wykonującą zapis i odczytać własny profil/członkostwo pod ich obecnym RLS; `SECURITY DEFINER` nie jest tu potrzebny. Funkcje powinny mieć ustalony bezpieczny `search_path`, pełne kwalifikowanie `public`/`auth` oraz brak dynamicznego SQL. [PostgreSQL 17: CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html).

## Dokładny kontrakt wydarzenia

Poniższe zasady dotyczą gałęzi organizatora. Admin i jawna rola utrzymania zachowują istniejącą autoryzację.

### INSERT: nowe wydarzenie i duplikacja

| Grupa | Dozwolona wartość / zachowanie |
| --- | --- |
| Identyfikator | `id`: nowy UUID z istniejącego defaultu lub jawny UUID generowany przez obecny writer; obecne PK i unique nadal odrzucają kolizję. |
| Autor i właściciel | `created_by = auth.uid()`; niepusty `submitted_by_organizer_id` wskazuje własne członkostwo. |
| Stan początkowy | Dokładnie `status = 'pending_review'`, `visibility = 'public'`, `is_cancelled = false`. |
| Flagi admina | Dokładnie `is_featured = false`, `is_verified = false`; nie dopuszczać true ani NULL. Pominięcie używa obecnych defaultów false. |
| Ocena i moderacja | `review_note`, `confidence_score`, `source_quality_score` muszą być NULL. |
| Strefa czasu | `timezone = 'Europe/Warsaw'`, zgodnie z aktualnym defaultem i writerami. |
| Historia | Trigger ustawia `published_at = NULL`, a `created_at` i `updated_at` na czas transakcji bazy. Wartości klienta nie stają się historią publikacji ani datą utworzenia. |
| Treść | Pola wymienione w poniższej allowliście, z zachowaniem obecnych FK, NOT NULL i unique. |

Obecny default `published_at` to `now()` również dla nieopublikowanego INSERT. BEFORE INSERT widzi już zastosowane defaulty i nie odróżni pominięcia od jawnie podanej identycznej daty. Dlatego wybrano normalizację `published_at` do NULL dla każdego nowego wydarzenia organizatora, zamiast pozornego testu, czy klient przesłał kolumnę. Nie zmieniać istniejących wierszy ani defaultu admina.

Obecne tworzenie i duplikacja już wysyłają `pending_review`, `public`, własnego autora i `published_at = NULL`. Duplikacja resetuje anulowanie i nie kopiuje flag weryfikacji, oceny ani notatki moderacji. Reguły zachowują te payloady.

### UPDATE: właściciel i pola chronione

Wymagać członkostwa dla **OLD** `submitted_by_organizer_id` oraz niepustego właściciela. Następnie wymagać równości **NEW** i **OLD** właściciela. Ponownie sprawdzić członkostwo dla NEW; członkostwo w obu organizacjach nigdy nie upoważnia do przeniesienia wydarzenia. Przeniesienie pozostaje operacją admina.

| Grupa | Dokładne kolumny |
| --- | --- |
| Treść do edycji | `title`, `slug`, `description`, `short_description`, `start_at`, `end_at`, `is_all_day`, `category_id`, `location_id`, `price_type`, `price_min`, `price_max`, `currency`, `main_image_url`. |
| Relacja prezentowana publicznie | `organizer_id`: przy UPDATE pozostaje OLD albo przechodzi z NULL do OLD `submitted_by_organizer_id`, zgodnie z fallbackiem obecnego edytora. Nie dopuszczać innej zmiany tej relacji przez organizatora. |
| Sterowanie stanem | `status`, `visibility`, `is_cancelled`: wyłącznie według tabeli przejść poniżej. |
| Metadane zarządzane przez bazę | `updated_at`: trigger ustawia czas transakcji, także gdy formularz przesłał własny czas. Nie traktować obecności pola jako naruszenia. |
| Chronione przed zmianą | `id`, `created_at`, `created_by`, `submitted_by_organizer_id`, `is_featured`, `is_verified`, `review_note`, `confidence_score`, `source_quality_score`, `timezone`, `published_at`. |

Porównywać wartości chronione przez `IS DISTINCT FROM` lub równoważne porównanie odporne na NULL. NULL→wartość, wartość→NULL oraz false→NULL są zmianami. Samo ponowne przesłanie niezmienionego `submitted_by_organizer_id` czy `published_at` jest poprawne: robi to wspólny edytor. Istniejące weryfikacje i historia publikacji zachowują się przy edycji organizatora.

Docelowy guard powinien porównać cały wiersz po wyłączeniu dokładnej allowlisty, z osobnymi warunkami relacji i stanu. Nowa kolumna nie może automatycznie zostać dowolnie edytowalna. Przy INSERT oraz każdej późniejszej zmianie schematu trzeba ponownie przejrzeć kontrakt; preflight migracji odrzuca niezgodny katalog.

`organizer_id` nie jest właścicielem autoryzacji. Admin może obecnie przypisać organizację B przy właścicielu A; edytor i duplikacja zachowują tę relację. Aby nie zepsuć istniejącej duplikacji, INSERT może wskazać istniejący `organizer_id` zgodny z FK także wtedy, gdy różni się od właściciela. Nie daje to dostępu do B ani przeniesienia właściciela. Ryzyko mylącej atrybucji nowego wydarzenia pozostaje jawne; narzucenie równości obu pól wymagałoby osobnego kontraktu duplikacji z identyfikatorem źródłowego wydarzenia i zmiany writera.

### UPDATE: dopuszczalne przejścia

| Operacja | Warunek OLD → NEW |
| --- | --- |
| Zwykła edycja nieopublikowanego | Stan pozostaje OLD, anulowanie bez zmian; treść może się zmienić. Historyczny stan NULL może przejść do `pending_review`, zgodnie z edytorem. |
| Edycja opublikowanego | `published` → `pending_review`, anulowanie bez zmian; `published_at` pozostaje OLD. Organizator nie publikuje ponownie. |
| Ponowne zgłoszenie | `rejected` → `pending_review` tylko gdy OLD `is_cancelled IS DISTINCT FROM true`; anulowanie bez zmian. |
| Ukrycie | NEW `visibility = 'private'`; brak zmian treści, relacji `organizer_id` i anulowania; stan pozostaje OLD. Dotyczy także opublikowanego wydarzenia. Ponowne ukrycie jest bezpieczne. |
| Anulowanie | NEW `status = 'archived'`, NEW `is_cancelled = true`; treść, relacja i widoczność bez zmian. Dopuszczalne z każdego poprzedniego stanu, także `published`. Ponowne anulowanie jest bezpieczne. |

W pozostałych edycjach widoczność może pozostać OLD albo przejść do `private`; nie dopuszczać `private`/NULL→`public`. Organizator nie może cofnąć `is_cancelled = true`. Edycja już anulowanego archiwalnego wpisu może zachować `archived` i true, jak obecny writer. Nie dopuszczać innych nowych statusów, publikacji ani zmiany nieznanego historycznego statusu na inny nieznany. Zachowanie historycznego nieopublikowanego statusu bez zmiany nie jest nowym uprawnieniem do jego nadania.

Stan `published` może pozostać po UPDATE organizatora **wyłącznie przy ukryciu**: końcowa widoczność private i żadna zmiana treści, atrybucji, anulowania lub pól chronionych. Samo pozostawienie `published` po zmianie tytułu musi być odrzucone. Nie rozszerzać wyjątku na `published`/public.

Obecna polityka `status <> 'published'` blokuje ukrycie opublikowanego wpisu, chociaż istniejący przycisk przesyła wyłącznie visibility i updated_at. Zastąpić jej organizer `WITH CHECK` warunkiem własnego członkostwa i profilu organizer; `USING` również zachowuje własne członkostwo i wymaga profilu organizer. Powyższy trigger odpowiada za stan i niezmienność właściciela. Ta zmiana i instalacja guardu muszą należeć do **jednej transakcji**. Polityka INSERT zachowuje dotychczasowe warunki i dodatkowo wymaga profilu organizer. Admin ALL i oba SELECT pozostają bez zmian.

## Dokładny kontrakt własnej organizacji

Dodać jedną politykę UPDATE TO `authenticated`, wymagającą profilu organizer oraz członkostwa dla `organizers.id` w USING i WITH CHECK. Obecnie aplikacja pozwala wszystkim członkom, nie tylko `organizer_users.role = 'owner'`; proponowany pakiet zachowuje tę zasadę.

| Grupa | Dokładne kolumny / reguła |
| --- | --- |
| Allowlista formularza | `name`, `slug`, `website`, `facebook_url`, `instagram_url`, `phone`, `email`, `logo_url`, `type`, `description`. |
| Metadane | `updated_at`: czas transakcji ustawiony przez trigger. |
| Chronione | `id`, `created_at`, `is_verified`: NEW identyczne z OLD, z porównaniem odpornym na NULL. |

Trigger sprawdza własne członkostwo dla OLD id oraz niezmienność id; członek dwóch organizacji nie może przenieść rekordu. FK, NOT NULL i unique slug nadal działają. Nie dodawać w tym pakiecie nowego obowiązku wypełniania wszystkich pól opcjonalnych ani nowych formatów URL odrzucających istniejące dane. Admin nadal może zmieniać `is_verified` i edytować dowolną organizację. Publiczny SELECT pozostaje, dzięki czemu obecne `.select('id').maybeSingle()` potwierdzi rzeczywisty zapis.

Nie dodawać członkom INSERT/DELETE na `organizers` ani zapisu `organizer_users`. Trigger na organizacji dotyczy wyłącznie UPDATE, więc tworzenie organizacji przez przejrzany trigger rejestracyjny Auth pozostaje bez zmian. `createOrganizerAccountAction` próbuje osobnego INSERT organizacji i członkostwa bez uprawnienia RLS; proponowana naprawa profilu nie rozwiązuje tej odrębnej ścieżki zakładania organizacji po rejestracji.

## Funkcje, granty i zakres RPC

Dwie nowe funkcje są wyłącznie funkcjami triggerowymi. Nie potrzebują publicznego RPC ani service role w aplikacji. Przy przygotowaniu migracji odebrać ich domyślny PUBLIC EXECUTE i jawny EXECUTE od anon/authenticated; zweryfikować działanie pod rzeczywistymi rolami. Funkcje zwracające trigger nie mogą stać się alternatywnym endpointem zapisującym dane.

Przejrzeć również istniejące granty `TRUNCATE` i `TRIGGER` na obu tabelach: RLS i triggery wierszowe nie stanowią kontroli TRUNCATE. Obecne writery wymagają DML, nie tych uprawnień. Osobno wyliczona część tego pakietu powinna odebrać zbędne TRUNCATE/TRIGGER od anon/authenticated po potwierdzeniu braku zależności; zachować potrzebne granty SELECT/INSERT/UPDATE/DELETE i uprawnienia admina wynikające z RLS. Nie przeprowadzać szerokiego porządkowania grantów innych tabel.

Pełne A04 pozostaje osobne: [propozycja transakcji zapisu](event-write-transaction-proposal.md) obejmuje wydarzenie, źródło, moderację, powiadomienia i wynik operacji. Te dwa triggery niczego nie dopisują do `event_sources`, logów czy powiadomień. Nie robią z kilku żądań jednej transakcji, nie blokują cofnięcia członkostwa względem równoległego zapisu i nie rozwiązują utraty odpowiedzi po zapisie. Autoryzacja korzysta z widoczności danych w bieżącym statement; nie obiecywać serializacji revocation ani ochrony przed nadpisaniem równoległej edycji. Obecne komunikaty o częściowym/nieznanym wyniku nadal są potrzebne.

## Rollout i rollback

1. Przed napisaniem SQL pobrać świeży katalog funkcji, policies, triggerów, typów, defaultów i grantów. Sprawdzić zgodność źródłowych definicji, role utrzymania/importerów i brak dodatkowego writera o innym kontrakcie. Agregatami bez zmieniania rekordów ustalić występowanie NULL/nieznanych statusów oraz mieszanej relacji organizer_id/właściciel. Nie wstawiać do dokumentacji danych użytkowników.
2. Przygotować osobną migrację i rollback z guardami katalogu, kontrolą dokładnych dwóch tabel i ograniczonymi timeoutami. W jednej transakcji zainstalować funkcje/triggery, domknąć ich ACL, zmienić wskazane policies i uzgodnione dwa rodzaje zbędnych grantów. Zmiana RLS wydarzeń nie może zostać zatwierdzona bez czynnego guardu. Nie wykonywać UPDATE historycznych rekordów.
3. Przejrzeć niezależnie SQL i nowe testy, następnie wykonać je w dostępnym odizolowanym środowisku. Lokalny Supabase nadal wymaga działającego runtime i zasobów zgodnie z [preflightem](local-staging-preflight.md); nie deklarować gotowego stagingu. Ewentualne fixture na rzeczywistej bazie wymagają osobno przejrzanego skryptu, zatwierdzonego zakresu i pełnego ROLLBACK, jak wcześniejsze testy.
4. Po wdrożeniu potwierdzić katalog, role i testy, a następnie sprawdzić UI tworzenia, duplikacji, edycji, ukrycia, anulowania, profilu oraz moderacji admina. Reguła dat oznacza świadomą zmianę: updated_at organizatora pochodzi z bazy także przy edycji formularzem. Wygenerować ponownie typy i sprawdzić różnicę; nowych tabel/kolumn nie oczekujemy.

Przed COMMIT błąd wycofuje całą instalację. Po wdrożeniu bezpieczny rollback nie może najpierw usunąć guardu, pozostawiając rozszerzone UPDATE published. W jednej transakcji przywrócić poprzednią politykę wydarzeń, usunąć własną politykę UPDATE organizacji i dopiero usunąć nowe triggery/funkcje oraz odtworzyć dokładne zmienione ACL. Zachować poprawki lokalizacji/analityki. Pełny rollback ponownie otworzy potwierdzone luki; przy awarii pojedynczej ścieżki preferować czasowe wstrzymanie tej ścieżki i zachowanie działającej ochrony pól. Nie usuwać danych użytkowników ani nie odtwarzać dat z domysłów.

## Testy odbiorowe do osobnego skryptu

Wszystkie oczekiwania muszą być twardymi asercjami na syntetycznych fixture. Skrypt ma mieć guard kolizji przed INSERT, jawne role/UID, timeouty, pełny ROLLBACK i liczniki braku fixture. Nie zmieniać wykonanych historycznych suites ani oznaczać obecnych znanych luk jako zaliczonych testów poprawki.

Regresje lokalizacji, analityki i saved RPC przenieść do nowej wersji testów z guardem uwzględniającym dokładną, przejrzaną instalację nowych triggerów. Historycznych suites nie uruchamiać bezpośrednio po tym przyszłym pakiecie: ich guardy oczekują wcześniejszego inventory triggerów, a najstarszy zestaw dodatkowo odtwarza już zamknięte luki.

| Zakres | Wymagany wynik |
| --- | --- |
| Członek A oraz członek A+B | UPDATE submitted owner A→B, A→NULL i cudzy created_by odrzucone 42501; żadna zmiana event/source/ownership. Własna zwykła edycja działa; cudzy wiersz niedostępny dla UPDATE. |
| INSERT chronionych pól | Każda próba true/NULL dla flag, notatki, score, obcego autora, obcego właściciela, published/rejected/private/cancelled lub innej timezone odrzucona. Data published_at zawsze NULL; daty utworzenia/zmiany pochodzą z bazy. |
| UPDATE chronionych pól | Osobno każda z 11 kolumn, także warianty NULL i fałszywe daty, odrzucona. Ponowne przesłanie identycznych wartości przechodzi. Pole updated_at klienta nie zastępuje czasu bazy. |
| Workflow | Tworzenie i duplikacja dają pending/public/nieanulowane; published edycja cofa do pending z zachowaniem daty publikacji. Hide published jest private bez zmiany treści; published title edit bez pending odrzucona. Cancel daje archived/true; odwrócenie anulowania i ujawnienie private odrzucone. Resubmit działa wyłącznie z rejected i nieanulowanego. |
| Historyczne dane | OLD NULL w polach chronionych zostaje NULL. Sprawdzić NULL status i flagę anulowania, nieznany historyczny status bez zmiany, edycję już archived/cancelled oraz powtórne hide/cancel. |
| Atrybucja i duplikacja | Edycja zachowuje różne organizer_id i submitted owner; NULL organizer_id może użyć fallbacku. Duplikacja takiego wydarzenia działa. Próba zmiany atrybucji UPDATE na trzecią organizację odrzucona. |
| Profil organizacji | UPDATE każdego z 10 pól własnej organizacji zwraca jeden id; UPDATE cudzej zero. Zmiana id/created_at/is_verified, w tym NULL→true, odrzucona. Członek A+B nie zmienia tożsamości organizacji. |
| Tożsamość i admin | Profil user z członkostwem, organizer bez członkostwa, UID NULL oraz metadane admin nie uzyskują zapisu. Rzeczywisty admin bez członkostwa nadal moderuje, weryfikuje i przypisuje organizację. Rejestracyjny trigger Auth nadal tworzy tylko własną organizację/członkostwo. |
| Transakcja i ACL | Wielowierszowy UPDATE z jedną niedozwoloną zmianą wycofuje cały statement. Testy uprawnień potwierdzają brak TRUNCATE/TRIGGER dla anon/authenticated i brak klientowego EXECUTE nowych funkcji. |
| Regresja granic | Anon nadal widzi wyłącznie published/public/nieanulowane; odmowy cudzych źródeł i member-forge pozostają. Odebrane testy lokalizacji, analityki i saved RPC nadal przechodzą. Nie powstają dodatkowe source/log/notification ani rekordy po ROLLBACK. |

Próby przez `SET LOCAL ROLE` i ustawiane ręcznie claims weryfikują SQL/RLS/trigger, **nie autentyczność JWT ani Auth API**. Odbiór z prawdziwą sesją PostgREST i test UI należy raportować oddzielnie. W tym dokumencie nie wykonano nowych testów w bazie i nie potwierdzono wdrożenia proponowanej ochrony.
