# Jedenasty pakiet napraw — 2026-10-08

## Kod aplikacji

`LocationPickerMap` nie stosuje odpowiedzi geokodowania po rozpoczęciu nowszego wyboru miasta/adresu/znanego miejsca/punktu mapy ani po unmount. Zmiana kontekstu kasuje debounce i sugestie; ręczne poprawki administracyjne są zachowane. Nowy punkt natychmiast usuwa stare `location_id`, miasto, adres i dane administracyjne, zachowując nazwę miejsca. Loading i niepowodzenie mają status w istniejącym opisie mapy. Po awarii reverse trzeba ponownie wyszukać miasto/adres albo wybrać znane miejsce.

Pełne `npm run check` w świeżej kopii bez `.env*`, z fikcyjną konfiguracją i guardem blokującym sieć: **522/522 testów w 40 plikach, TypeScript i produkcyjny build przeszły, lint 0 błędów/15 wcześniejszych ostrzeżeń**. 15 nowych testów używa kontrolowanych odpowiedzi i mocka MapLibre; weryfikuje rzeczywiste handlery komponentu, ale nie zastępuje przeglądarki, fizycznego telefonu i rzeczywistych providerów. Pierwszy build zatrzymał błąd Next.js rozwiązywania junctiona zależności między E: a C:; powtórzenie z fizyczną kopią tych samych zależności przeszło. Log pozostaje w katalogu roboczym bieżącego czatu.

## Przygotowane SQL — niewykonane

- [Migracja](organizer-write-hardening-proposal.sql): dwa triggery SECURITY INVOKER, niezmienny właściciel i pola administracyjne, przejścia stanu, published-hide oraz UPDATE własnej organizacji; ograniczone policies/ACL w jednej transakcji.
- [Rollback](organizer-write-hardening-rollback.sql): wymaga manifestu udanej instalacji i dokładnie zgodnego katalogu; najpierw przywraca restrykcyjną politykę wydarzeń, potem usuwa ochronę i odtwarza wskazane granty. Zachowuje wcześniejsze poprawki lokalizacji/analityki. Ponownie otwiera dawne luki, dlatego nie jest rutynową czynnością.
- [Testy](organizer-write-hardening-tests.sql): osobne od historycznych suites; syntetyczne fixture, twarde asercje, role/claims, chronione pola, NULL, workflow, admin/service_role, wielowierszowa atomowość, regresje lokalizacji/analityki/zapisów i pełne wycofanie fixture.
- [Próba transakcyjna](organizer-write-hardening-dry-run.sql): przygotowane DDL oraz testy w jednej transakcji, bez COMMIT, końcowy ROLLBACK wycofuje także triggery/policies/granty. Wymaga oddzielnej zgody na tymczasowe DDL i dane testowe w obecnym EventMap. Nie instaluje ochrony na stałe.

Podstawa to świeży odczyt publicznego i dodatkowego katalogu 2026-10-08, SHA-256 `6860e45f7d171bcb9681d2c36f51a4bc8413f1bc2d052decd27ca747fd7022a5`. Wszystkie dziewięć kolekcji publicznych jest identyczne z odebranym stanem 6 października. Osobno wykonano wyłącznie SELECT guardu migracji: **11/11 kolekcji odpowiada dokładnie baseline**, bez blokad i bez DO/DDL/DML. Anonimowe agregaty: 455 wydarzeń, brak NULL/nieznanych statusów, brakujących właścicieli/organizatorów, NULL anulowania i mieszanej atrybucji. Stare nietypowe przypadki mimo to uwzględniono w kontrakcie.

Parser pglast 7.20 dla PostgreSQL 17 potwierdził składnię wszystkich czterech plików SQL i ich bloków PL/pgSQL bez wykonania; AST próby transakcyjnej nie zawiera COMMIT. [Dokumentacja parsera](https://pglast.readthedocs.io/en/v7/api.html). Zgodność składni nie potwierdza wiązania typów, uprawnień ani działania triggerów. Niezależny przegląd obejmuje OLD/NEW, NULL, rolę wykonania i dokładny manifest/rollback; brak sprawdzania manifestu w roboczym zestawie testów naprawiono przed zamrożeniem. Nie wykonano nowych testów SQL ani migracji. Zapisany stan nie oznacza zamknięcia luk RLS.

Wąska reguła `.gitattributes` zachowuje LF tylko w czterech nowych plikach `docs/organizer-write-hardening-*.sql`. To utrzymuje dokładne SHA i fingerprinty źródeł funkcji mimo Windows/core.autocrlf; nie przepisuje historycznych SQL.

## Następny krok i ograniczenia

`AGENTS.md`, instrukcja 4: „Jeśli potrzebna jest migracja SQL, zaproponuj ją osobno i nie wykonuj automatycznie.” Wcześniejsza zgoda na inne migracje/próby nie obejmuje tego nowego DDL. Przygotowany skrypt próby jest konkretnym zakresem do osobnego zatwierdzenia. Wykonanie wymaga jednej dedykowanej sesji, zatrzymania przy pierwszym błędzie, timeoutów i wycofania/zamknięcia po błędzie. Tymczasowe blokady dotyczą dwóch zmienianych tabel; próba nie wysyła poczty ani nie zmienia rzeczywistych kont.

Po zatwierdzonej próbie sprawdzić pełny sukces, zero fixture i niezmieniony katalog. Dopiero wtedy osobno rozważyć trwałą migrację. Pliki są celowo przypięte do tożsamości i schematu obecnego EventMap; lokalny klon wymaga osobno przygotowanych guardów. Nie omijać ich. Staging, pełne A04, rozproszona ochrona analityki A08, rzeczywiste Auth/SMTP/Google, jakość katalogu, koszt wyszukiwania i fizyczny telefon pozostają otwarte. W tej sesji nie publikowano nowej wersji Vercel.
