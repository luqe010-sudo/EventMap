# Środowisko testowe MVP — propozycja

Status: wariant Free i autoryzowane testy transakcyjne, aktualizacja 2026-10-06. Testy stanu początkowego wykonano 20:54 CEST. Po osobnym zatwierdzeniu wdrożono RLS lokalizacji/analityki 21:20 CEST, a testy po poprawce przeszły 21:21 CEST; wszystkie fixture wycofano. [Bieżący raport wdrożenia](supabase-rls-hardening-release-2026-10-06.md); trzy problemy edycji nadal otwarte. Lokalnego runtime/baseline nie uruchomiono; nie utworzono projektu w chmurze.

## Bieżąca decyzja użytkownika — testy istniejącej bazy

Późniejsza odpowiedź „Zatwierdzam wszystkie zmiany” zatwierdziła przedstawioną poprawkę dwóch tabel, rollback i testy. SQL został wykonany; oddzielny lokalny baseline i przyszły projekt A04 nie zostały uruchomione przez tę zgodę.

Użytkownik następnie zezwolił: „Możesz testować na naszej bazie Supabase”. Dla obecnego pakietu można więc sprawdzać istniejący EventMap na syntetycznych fixture w transakcji zakończonej ROLLBACK. Wszystkie zapisy/odczyty testowe są ograniczone do własnych identyfikatorów i markerów fixture; kolizja przerywa próbę przed INSERT. Nie tworzyć nowych tabel ani wykonywać migracji na podstawie samej zgody na testy. Nie zmieniać danych rzeczywistych użytkowników, konfiguracji Auth/SMTP ani aktywności innych projektów.

[Preflight triggerów](supabase-test-preflight-readonly.sql) wykonany 16:45 CEST potwierdził na badanych tabelach 111 triggerów, w tym jeden niestanowiący wewnętrznej obsługi constraintów: `auth.users -> handle_new_user`. Przejrzana definicja tworzy profile/organizacje/członkostwa w tej samej transakcji, bez zewnętrznych wywołań. Odczyt nie pobierał wierszy aplikacji/Auth. Próby `SET ROLE`/claims sprawdzają rzeczywiste RLS i RPC w SQL; nie zaliczają prawdziwej sesji Auth, HTTP, Google ani dostarczania e-maila. Lokalny staging pozostaje przygotowaną opcją dalszych prób, a nie warunkiem tego autoryzowanego pakietu.

## Potwierdzony odczyt metadanych — 2026-10-06

Supabase CLI potwierdziło zdrową produkcję `EventMap`, ref `jifeontwlybxkghbzcry`, Frankfurt `eu-central-1`. Dostępna organizacja ma dwa aktywne projekty; nie ma projektu `EventMap-staging`. Użytkownik następnie potwierdził plan **Free**. Pytanie o plan jest zamknięte. Przy obecnym wykorzystaniu limitu nie ma miejsca na trzeci aktywny projekt Free. Nie tworzono zasobów w chmurze i nie wykonywano migracji SQL.

[Dokumentacja rozliczeń Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase) sprawdzona 6.10 podaje limit dwóch aktywnych projektów Free łącznie w organizacjach właściciela/admina. Nowa organizacja nie dodaje dwóch kolejnych miejsc. Plan Free potwierdził użytkownik, nie sam licznik projektów. Nie wstrzymywać istniejących projektów ani nie zmieniać planu w celu zwolnienia limitu bez uzgodnienia.

Repo ma pięć migracji przyrostowych zakładających istniejące tabele. Publiczny snapshot uzupełniono o rozszerzenia, role, default privileges i dokładne typy kolumn. Sam raport katalogowy nie jest wykonywalnym baseline; na jego podstawie przygotowano osobną propozycję poniżej. SQL A04, rollback i cutover writerów nadal wymagają oddzielnego projektu. [Aktualny raport produkcji](production-release-packages-8-9-2026-10-06.md) nie oznacza ukończenia staging.

[Osobna propozycja odtworzenia schematu](local-staging-baseline-proposal.sql) jest już przygotowana: 18 tabel/179 kolumn, jeden widok, 53 constraints, 38 dodatkowych indeksów, pięć funkcji, 43 policies, granty kolumn/tabel/funkcji i trigger rejestracji. Autor i niezależny przegląd porównali definicje/ACL ze snapshotem; nie znaleziono różnic. SQL pozostaje niewykonany. Wymaga pustego lokalnego Supabase17, jawnego markera sesji i przygotowanych rozszerzeń; nie kopiować go do produkcji ani do istniejących czerwcowych migracji. Zachowuje również aktualne słabości polityk/widoku, aby próby reprodukowały realną bazę. Nie jest migracją A04.

## Odebrany uzupełniający katalog — 2026-10-06 15:55 CEST

Przygotowano [uzupełniający SQL odczytowy](event-write-staging-readonly.sql). Po przejrzeniu całej instrukcji połączono ją z `security-audit-readonly.sql` w jeden katalogowy SELECT, aby oba raporty korzystały z tej samej migawki instrukcji. Supabase CLI wskazywało jawnie `--linked --project-ref jifeontwlybxkghbzcry`. Zapytanie przeszło na PostgreSQL 17.6; wynik jest tylko w ignorowanym `scratch/security-audit/staging-preflight-2026-10-06-readonly.json`, z podsumowaniem `staging-preflight-summary.json` i hashami źródeł. Nie odczytywano wierszy aplikacji/Auth, wartości sekwencji, Vault ani haseł/tokenów. Skan wskazanych silnych wzorców credentials nie wykazał dopasowań.

Odczyt potwierdził 19 publicznych tabel, 43 polityki, 5 publicznych funkcji niestanowiących części rozszerzeń, 31 ról, 23 członkostwa ról, 9 schematów, 6 rozszerzeń, 300 wpisów rozwiniętych default ACL i 35 kolumn zarządzanego `auth.users`. `private`, receipts i `events.write_version` nie istnieją. `pgcrypto`/`uuid-ossp` są w `extensions`, PostGIS w `public`; nie zgadywać kwalifikacji funkcji hash. Domyślne granty obiektów tworzonych przez postgres w public są szerokie także dla anon/authenticated, więc nowe RPC wymagają jawnego ograniczenia EXECUTE i dokładnego planu grantów.

CLI wykonywało SELECT przy `transaction_read_only=off`; odczytowość wynika z przejrzanej instrukcji katalogowej, nie z wymuszonego trybu transakcji. Wynik nie zalicza prób JWT/RLS i nie jest odtwarzalnym dumpem. Zarządzane obiekty Auth/rozszerzeń, kolejność zależności, kontrakt uploadu i przełączenie wszystkich writerów nadal wymagają osobnego przeglądu baseline/migracji. Nie przygotowano niekompletnej migracji A04 ani pozornego rollbacku.

## Przygotowany wariant lokalny na dalsze próby

**Lokalny Supabase PostgreSQL 17 z Auth, PostgREST i Mailpit**, w odizolowanym katalogu bez linku do chmury, oraz osobny frontend na `http://127.0.0.1:3001`. Nie wymaga dodatkowego projektu ani abonamentu Supabase. [Preflight i ograniczenia](local-staging-preflight.md), [konfiguracja](local-staging-config.toml).

W `scratch/local-staging` wykonano tylko `supabase init` i zapisano przejrzaną konfigurację: API 54331, baza 54332, Mailpit 54334, PG17, potwierdzanie e-mail włączone, automatyczne migracje/seed wyłączone. `status` poprawnie wczytał konfigurację, po czym zakończył się błędem braku Docker/Podman. Katalog nie ma `.temp/project-ref`; główny `supabase/config.toml` nadal nie istnieje. Nie uruchomiono `start`, `link`, `db push` ani `db reset`.

Po uzupełniającym [odczycie typów](local-staging-columns-readonly.sql) o 16:30 CEST potwierdzono 179 kolumn w 18 tabelach aplikacji, w tym `locations.geom = geography(Point,4326)`. Wynik pozostaje w ignorowanym `scratch/security-audit/local-staging-columns-2026-10-06-readonly.json`; nie odczytywano wierszy aplikacji ani Auth.

Komputer ma Windows 11 Pro, 4 rdzenie, 8 GiB RAM, tylko około 1,1 GiB wolnej pamięci w czasie preflight oraz ponad 200 GiB wolnego miejsca na C: i E:. Wirtualizacja i SLAT są włączone. Port 3000 zajmuje bieżący podgląd; 3001 i 54330–54339 nie miały nasłuchu TCP. Ograniczenie liczby usług pomaga, ale nie potwierdza, że cały przepływ zmieści się w dostępnej pamięci. Runtime wymaga osobnego przygotowania; nie instalowano programów ani funkcji Windows.

Osobny projekt hosted i Vercel Preview pozostają późniejszą opcją po uzgodnieniu wolnego miejsca albo budżetu, zgodnie z [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments). Chmurowy Preview nie połączy się z API na localhost komputera. Lokalny odbiór potwierdzi logikę Auth/JWT/RLS, ale nie dostarczanie produkcyjnego SMTP, Google OAuth ani konfigurację chmurowego callbacku.

## Kolejność przygotowania

1. Przygotować działający lokalny runtime po uzgodnieniu instalacji i zasobów. Zachować odizolowany katalog i wyłączone automatyczne migracje/seed.
2. Przedstawić osobno schema-only baseline na podstawie przejrzanych katalogów i dokładnych typów kolumn. Odtworzyć tylko obiekty aplikacji, RLS/granty/funkcje i trigger rejestracji; zarządzane Auth/role/rozszerzenia dostarcza runtime. Nie uruchamiać `db pull` ani napraw historii na produkcji.
3. Po osobnym zatwierdzeniu wykonać baseline wyłącznie w pustym lokalnym Supabase17. Nie kopiować wierszy `auth.users`, profili, e-maili, zapisów, analityki ani preferencji z produkcji. Istniejący seed zależy od organizatora; przygotować syntetyczny zestaw osobno.
4. Porównać schemat/RLS/granty i wygenerować typy do porównania z `database.types.ts`. Dopiero po zmianie bazy aktualizować typy używane przez aplikację.
5. Uruchomić odizolowaną kopię frontendu na 3001 z lokalnym API/publicznym kluczem i `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001`. Nie kopiować `.env.local` ani produkcyjnych OAuth/SMTP/Cloudinary. Lokalny service-role tylko w narzędziach testowych, nigdy `NEXT_PUBLIC_*`.
6. Utworzyć wyłącznie syntetyczne konta przez Auth i odebrać aktywację/reset w lokalnym Mailpit. JWT zwykłych użytkowników muszą przejść rzeczywisty PostgREST/RLS; same próby service-role tego nie zastępują.
7. Osobno przygotować i przedstawić SQL A04, rollback, syntetyczne scenariusze oraz cutover writerów. Przed każdym zapisem testowym wymagać lokalnego endpointu i tożsamości środowiska; odmówić dla produkcyjnego ref/hosta. Chmurowy OAuth/SMTP i przyszły Preview mają osobny odbiór.

## Zestaw danych i próby odbiorowe

- Konta: użytkownik, organizator A, organizator B i administrator utworzony administracyjnie. Żadna rejestracja nie nadaje `admin`.
- Wydarzenia: publiczne opublikowane, draft, pending_review, rejected, archived, prywatne, anulowane; przeszłe, przyszłe i trwające; darmowe, płatne i bez znanej ceny; bez współrzędnych i ze wspólnymi współrzędnymi.
- Lokalizacje: kilka odległych miast Polski i małe miejscowości w promieniu wyszukiwania. Przynajmniej jedna miejscowość bez oferty, aby przetestować pusty stan.
- Bezpieczeństwo: niepoprawne role przez aplikację i bezpośrednio przez Auth API; użytkownik nie czyta cudzych zapisów; organizator A nie edytuje B, nie publikuje i nie przenosi właściciela; niezalogowany nie widzi niepublicznych wydarzeń. Próby prowadzić również bezpośrednio przez API, poza formularzami.
- Przepływy: rejestracja i aktywacja e-mail, logowanie, Google, wylogowanie, zapis/usunięcie zapisu, dodanie i moderacja wydarzenia, powrót po logowaniu do rozpoczętej czynności.
- Wyszukiwanie: jednakowe wyniki listy/mapy/liczników dla miejsca, daty, ceny i promienia; polska strefa czasowa, zmiana czasu, ładowanie kolejnych stron i szybkie zmiany filtrów.
- Telefon: 360/390/430 px, brak przewijania poziomego, odmowa GPS, mapa i zamknięcie szczegółów, link do dojazdu, słabsza sieć.

## Warunek przejścia na produkcję

Przejście wymaga zaliczenia prób Auth/RLS i głównych przepływów, przeglądu SQL oraz planu cofnięcia zmian. Udana kompilacja i testy jednostkowe nie potwierdzają poprawności RLS. Zakres pilotażu: cała Polska, komunikacja o rzeczywistej lokalnej ofercie; brak obietnicy pełnego pokrycia każdego miasta.
