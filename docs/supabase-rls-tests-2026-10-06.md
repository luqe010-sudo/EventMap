# Testy RLS na istniejącym Supabase — 2026-10-06

**Aktualizacja 21:21 CEST:** użytkownik zatwierdził przedstawiony SQL. Poprawkę lokalizacji/analityki wdrożono, a testy po zmianie przeszły z pełnym ROLLBACK. [Raport wdrożenia i rollback](supabase-rls-hardening-release-2026-10-06.md). Poniższe wyniki i sekcja „niewykonana” opisują wcześniejszy etap oraz oryginalne pliki w chwili zatwierdzenia; nie są aktualnym statusem tej poprawki. Pozostałe trzy problemy edycji nadal otwarte.

Po zgodzie użytkownika „Możesz testować na naszej bazie Supabase” wykonano próby na EventMap `jifeontwlybxkghbzcry`, PostgreSQL 17.6. CLI zakończyło się kodem 0; wynik zapisano **20:54:47 CEST**. Testy potwierdziły działające zabezpieczenia oraz **cztery luki bezpieczeństwa i jeden błąd funkcjonalny**. Nie wykonano migracji ani trwałych zmian danych testowych.

[Przejrzany skrypt](supabase-rls-transaction-tests.sql) uruchomiono z zamrożonej kopii `scratch/security-audit/production-rls-tests-reviewed-2026-10-06.sql`, z jawnym `--linked --project-ref jifeontwlybxkghbzcry`. SHA-256 obu plików: `3AC5133C1ACB5D1BCC57C86BA435A55021EB6AE1A35FE0C3986B9DE8D812D0C2`. Wynik: `scratch/security-audit/production-rls-tests-2026-10-06.json`; log błędów jest obok. Scratch jest ignorowany przez Git.

## Zakres i wycofanie danych

Przed próbami sprawdzono rzeczywiste typy, RLS, granty, funkcje i [triggery](supabase-test-preflight-readonly.sql). Jedyny dodatkowy trigger badanego zestawu, `auth.users -> handle_new_user`, tworzy profile/organizacje/członkostwa w tej samej transakcji i nie wykonuje zewnętrznych wywołań.

Skrypt używał sześciu syntetycznych użytkowników, dwóch organizatorów, jedenastu wydarzeń oraz własnych źródeł, zapisów, lokalizacji, analityki i logu moderacji. Jawne identyfikatory miały prefiks `ea060626-0000-4000-8000-`; wygenerowane przez trigger organizacje identyfikowano przez dokładne slugi i użytkowników. Guard kolizji poprzedzał INSERT. Dane pozostawały niezatwierdzone; skrypt nie używał DDL, Auth API, haseł ani adresów e-mail.

Wykonano ROLLBACK do savepointu, asercje braku pozostałości, zewnętrzny ROLLBACK oraz końcowy odczyt. Wszystkie dziesięć liczników wyniosło **0**: użytkownicy Auth, profile, organizatorzy, członkostwa, wydarzenia, źródła, zapisy, lokalizacje, analityka i logi moderacji. Nie modyfikowano rekordów rzeczywistych użytkowników.

## Potwierdzone zachowanie

| Próba SQL | Wynik |
| --- | --- |
| Rejestracja z metadanymi `admin` lub nieznaną rolą | Powstaje zwykły użytkownik; brak eskalacji |
| Nadanie sobie admina przez UPDATE profilu | Odmowa `42501` |
| Widoczność anon | Tylko published/public/nieanulowane |
| Organizator z jednym członkostwem | Własne wydarzenia i cudze publiczne; cudze ukryte niedostępne |
| Cudze wydarzenia, źródła i fałszowanie członkostwa | UPDATE 0 wierszy lub odmowa INSERT |
| Własne wydarzenie organizatora | Pending INSERT działa; samodzielna publikacja zablokowana; published → pending_review działa |
| Admin | Dostęp do wszystkich fixture i moderacja działają |
| RPC zapisów | Izolacja A/B, idempotencja, filtrowanie publikacji i usunięcie po archiwizacji działają |
| Prywatność zapisów | Cudze zapisy niewidoczne również dla fixture organizatora/admina; SELECT `user_id` niedozwolony |
| Brak UID | Lista RPC pusta; mutacja niedozwolona |

| Potwierdzony problem | Wykonana reprodukcja | Dalszy zakres |
| --- | --- | --- |
| Zwykły użytkownik dodaje lokalizację | INSERT przeszedł przez permissive policy `WITH CHECK (true)` | Przygotowana poprawka RLS poniżej |
| Członek dwóch organizacji przenosi istniejące wydarzenie | Zmiana `submitted_by_organizer_id` przeszła | Osobna ochrona niezmienności właściciela |
| Organizator ustawia chronione pola wydarzenia | Własny UPDATE `is_featured`, `is_verified`, `review_note`, `created_by` przeszedł | Osobny kontrakt edycji/grantów |
| Anon zapisuje analitykę dla draft | INSERT z `user_id = NULL` przeszedł | Przygotowana poprawka RLS poniżej |
| Organizator nie edytuje własnego profilu organizacji | UPDATE zwrócił 0 wierszy | Osobny kontrakt bezpiecznych pól profilu |

Odmowy były asercjami na rzeczywistych operacjach, a luki zostały odtworzone przez zapisy własnych fixture. Kod 0 oznacza poprawne wykonanie tych asercji, nie brak luk.

## Kontrola po testach

Nowy katalogowy SELECT oraz porównanie SHA-256 potwierdziły brak zmian w dziewięciu kolekcjach: tabele (19), kolumny (202, również obiekty rozszerzenia), constraints (55), indeksy (62), policies (43), funkcje (5), triggery (1), granty tabel (288) i kolumn (300). Porównanie zapisano 20:57:38 CEST w `scratch/security-audit/production-rls-tests-schema-comparison.json`; wszystkie wartości `unchanged = true`. Odczyt po testach: `production-after-rls-tests-2026-10-06-readonly.json` w tym samym katalogu.

To porównanie obejmuje wskazane kolekcje audytu, a nie całą konfigurację platformy, właścicieli/widoków czy ważność indeksów. Skrypt testowy nie zawierał DDL. Po testach publiczne `https://mapaimprez.pl/api/events/search` zwróciło HTTP 200, `Cache-Control: no-store, max-age=0` i brak identyfikatorów fixture.

`SET ROLE` i jawne claims sprawdzały SQL RLS/RPC. Nie weryfikowano podpisów JWT, prawdziwej rejestracji/sesji Auth, Google, SMTP, pełnego resetu hasła, współbieżności A04, fault/retry ani widoku liczników miast. Nie zaliczono całej 48-punktowej [checklisty odbiorowej](mvp-release-checklist-2026-10-05.md). Kod aplikacji nie zmienił się od wcześniejszych 418 testów i wdrożenia pakietów 8/9, więc nie powtarzano buildu dla samych dokumentów/SQL.

## Pierwsza przygotowana poprawka — niewykonana

[Propozycja SQL](supabase-rls-hardening-proposal.sql) usuwa szeroki INSERT lokalizacji i wymaga admina albo profilu organizer wraz z własnym członkostwem. Analityka wymaga published/public/nieanulowanego wydarzenia oraz `user_id = NULL` lub własnego UID. Nie dodaje tabel, kolumn ani funkcji i nie zmienia istniejących danych/grantów.

Propozycja sprawdza źródłowe fingerprints i polityki pod blokadami tabel; `lock_timeout = 5s` ogranicza oczekiwanie. Blokady na krótko obejmują odczyty/zapisy tych dwóch tabel podczas transakcji. Fingerprints nowych checków są przechwytywane przed COMMIT, a wynik po COMMIT odczytuje tylko te wartości sesji. [Rollback](supabase-rls-hardening-rollback.sql) wymaga dokładnych fingerprints udanego wdrożenia i oddzielnej decyzji; przywróci wcześniejsze dwie słabości. [Testy po poprawce](supabase-rls-hardening-tests.sql) mają odrębny namespace i pełny ROLLBACK; nie zostały uruchomione.

Przed wykonaniem należy uzyskać osobne zatwierdzenie tej propozycji, zgodnie z punktem 4 [AGENTS.md](../AGENTS.md): „Jeśli potrzebna jest migracja SQL, zaproponuj ją osobno i nie wykonuj automatycznie”. Zgoda na testy nie wdrożyła zmian policies. Po zatwierdzeniu: wykonać przejrzany SQL z jawnym ref projektu w jednym świeżym połączeniu, przerwać przy pierwszym błędzie i zamknąć/wycofać transakcję przy błędzie. Same zwrócone hashe nie dowodzą sukcesu: wymagane jest poprawne wykonanie całego pliku, zachowanie wyniku/fingerprints oraz potwierdzenie bieżącego katalogu. Następnie odebrać nową suite i publiczne API. Typy należy wygenerować do porównania po zmianie bazy; RLS nie powinno zmienić kontraktu tabel.

Ta poprawka nie zamyka trzech pozostałych problemów edycji, atomowego A04 ani pełnego A08. Check analityki korzysta z widoczności bieżącego statement, bez blokady wiersza wydarzenia przy równoległym unpublish. Bezpośredni REST nadal omija zgodę, limiter i dedup endpointu; rozproszona ochrona pozostaje osobnym zadaniem. Nie utworzono trzeciego projektu Free ani nie instalowano lokalnego runtime.

Pozostałe trzy problemy wymagają wspólnego przeglądu kontraktu zapisu organizatora: ochrony właściciela przez porównanie OLD/NEW, ochrony pól administracyjnych przy INSERT i UPDATE oraz dopuszczenia wyłącznie bezpiecznych pól własnego profilu organizacji. Admin i organizator mają wspólną rolę SQL `authenticated`, więc samo REVOKE kolumn albo dodanie membership policy mogłoby uszkodzić panel admina lub umożliwić zmianę weryfikacji organizatora. Ten zakres należy przedstawić osobno wraz z guardami/RPC i zgodnością istniejących writerów.

Semantykę blokad i przechwytywania wartości sesji sprawdzono w źródłach PostgreSQL 17: [LOCK](https://www.postgresql.org/docs/17/sql-lock.html), [set_config](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADMIN-SET) i [SET](https://www.postgresql.org/docs/17/sql-set.html). Dwie niezależne ścieżki przeglądu potwierdziły źródłowe hashes i zgodność nowych predicates z obecnymi writerami; nie wykonano propozycji ani rollbacku.

Cały nowy zestaw testów po poprawce został także przejrzany niezależnie. Wymaga obu MD5 przechwyconych podczas zatwierdzonego wdrożenia, sprawdza analitykę również z uprawnieniami właściciela wydarzenia oraz dla `is_cancelled = NULL`. Sprawdza obie niedozwolone kombinacje dla lokalizacji: profil organizer bez członkostwa i członkostwo bez profilu organizer. Oczekuje tylko dwóch poprawnych lokalizacji i trzech wpisów analityki przed pełnym ROLLBACK. To przygotowane asercje, bez deklaracji zaliczenia przed uruchomieniem po poprawce.

SHA-256 plików w chwili przedstawienia do zatwierdzenia (oryginalna kopia migracji zachowana w scratch; jej obecny nagłówek oznacza już historyczne wdrożenie):

| Plik | SHA-256 |
| --- | --- |
| `supabase-rls-hardening-proposal.sql` | `3C70B71F86010034C1BFAD9B6DC1DC8412D6258CF077299A227543BAFFB76458` |
| `supabase-rls-hardening-rollback.sql` | `FE207280929A9D2D0DB3D068F63C64AB04AA5F0DE7D20F32A58F3E91E0E338BF` |
| `supabase-rls-hardening-tests.sql` | `8592720A757DE9510361886F1E2FFBB5C06F418D20A86D52D2C25BBAD8B27B30` |
