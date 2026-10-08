# Wdrożenie RLS lokalizacji i analityki — 2026-10-06

Po odpowiedzi użytkownika „Zatwierdzam wszystkie zmiany” wykonano przedstawiony pakiet na Supabase EventMap `jifeontwlybxkghbzcry`, PostgreSQL 17.6. **Migracja zakończyła się kodem 0 o 21:20:01 CEST; testy po zmianie przeszły o 21:21:28 CEST.** Dwie potwierdzone luki zostały zamknięte w sprawdzonym zakresie SQL. Trzy pozostałe problemy edycji wymagają osobnego pakietu.

## Zmiana produkcyjna

- Usunięto `locations authenticated insert`, która dopuszczała INSERT przez dowolnego authenticated.
- `locations_insert_admin_or_organizer` wymaga admina albo profilu organizer wraz z rzeczywistym własnym członkostwem w `organizer_users`. Sama deklaracja roli lub samo członkostwo nie wystarcza.
- `Anyone can insert event analytics` wymaga published/public/nieanulowanego wydarzenia oraz `user_id = NULL` albo własnego UID. `is_cancelled = NULL` pozostaje dozwolone dla publicznego wydarzenia.

Wykonano zamrożoną kopię [zatwierdzonego SQL](supabase-rls-hardening-proposal.sql): `scratch/security-audit/rls-hardening-approved-deployment-2026-10-06.sql`, SHA-256 `3C70B71F86010034C1BFAD9B6DC1DC8412D6258CF077299A227543BAFFB76458`. CLI wskazywało jawnie `--linked --project-ref jifeontwlybxkghbzcry`. Transakcja sprawdziła aktualne źródłowe policies, RLS, role i admin helper pod blokadami obu tabel; po zmianie przechwyciła fingerprints przed COMMIT. Wynik zapisano w `scratch/security-audit/rls-hardening-deployment-2026-10-06.json`.

Nie dodano tabel, kolumn, funkcji, triggerów ani grantów; nie zmieniono istniejących danych aplikacji. Nie użyto `db push`, nie naprawiano historii migracji, nie uruchomiono lokalnego baseline, nie zmieniono Auth/SMTP ani innych projektów. Frontend i bieżący deployment Vercel pozostały te same.

## Odbiór po zmianie

[Przejrzany zestaw testów](supabase-rls-hardening-tests.sql) uruchomiono z dwoma MD5 zapisanymi przy wdrożeniu, w jednym wywołaniu CLI. Hash źródła: `8592720A757DE9510361886F1E2FFBB5C06F418D20A86D52D2C25BBAD8B27B30`; hash kopii z prefiksem SET: `68362BABEBC093B5F7189DFFC93F9F5FB55944299F13633E22BDFFCD2A8992C9`. Kopia: `scratch/security-audit/rls-hardening-approved-tests-2026-10-06.sql`; wynik: `rls-hardening-tests-2026-10-06.json` w tym samym katalogu.

| Próba zapisu | Wynik |
| --- | --- |
| Lokalizacja: anon, zwykły user, organizer bez członkostwa, członek bez profilu organizer | Cztery odmowy `42501` |
| Lokalizacja: właściwy organizator i admin bez członkostwa | Dwa poprawne INSERT |
| Analityka: draft, private i cancelled, przez anon oraz właściciela-organizatora | Sześć odmów `42501` |
| Analityka z cudzym UID, przez anon oraz authenticated | Dwie odmowy `42501` |
| Analityka publiczna: anon przy false/NULL cancellation oraz authenticated z własnym UID | Trzy poprawne INSERT |

Skrypt utworzył tylko własne niezatwierdzone fixture `ea060626-0000-4000-8001-*`: trzech użytkowników, organizatora/członkostwo przez przejrzany trigger i cztery wydarzenia. Po asercjach pozostały tylko dwa oczekiwane rekordy lokalizacji i trzy analityki, a następnie wykonano pełny ROLLBACK. **Wszystkie dziewięć końcowych liczników fixture wyniosło 0**: Auth users, profile, organizatorzy, członkostwa, wydarzenia, lokalizacje, analityka, źródła i zapisy. Nie używano Auth API, prawdziwych sesji, haseł ani e-maili.

Świeże katalogi przed/po zmianie: `production-before-rls-hardening-2026-10-06-readonly.json` oraz `production-after-rls-hardening-2026-10-06-readonly.json` w ignorowanym `scratch/security-audit`. Niezależny weryfikator potwierdził **dokładnie trzy zaplanowane zmiany policies**, liczbę 43 → 42 oraz zgodność obu MD5 z wynikiem wdrożenia. Pozostałe osiem kolekcji jest identycznych: tabele, kolumny, constraints, indeksy, funkcje, triggery i granty tabel/kolumn. Raport: `rls-hardening-catalog-verification-2026-10-06.json`; `unexpected = []`, status pass.

Wygenerowano ponownie typy z projektu do `scratch/security-audit/database.types-after-rls-hardening-2026-10-06.ts`. Po normalizacji CRLF/LF są identyczne z `database.types.ts`, SHA-256 `12ecdc4e712c9dd977cd089c7ba98955b1ba08826aa2dc36475590e1441f3ca2`; kontrakt aplikacji nie wymagał zmiany. Porównanie: `rls-hardening-types-verification-2026-10-06.json`. Nie powtarzano buildu/testów aplikacji, ponieważ jej kod i typy nie zmieniły się od odebranych 418 testów i produkcji pakietów 8/9.

Po testach `https://mapaimprez.pl/api/events/search` i `https://www.mapaimprez.pl/` zwróciły HTTP 200, no-store i brak obu prefiksów fixture. Kontrola katalogu obejmuje wskazane kolekcje audytu, nie całą konfigurację platformy ani wszystkich właścicieli/widoków.

## Punkt wycofania

[Przejrzany rollback](supabase-rls-hardening-rollback.sql) pozostaje niewykonany. Gotowa kopia z dokładnymi fingerprints tego wdrożenia: `scratch/security-audit/rls-hardening-prepared-rollback-2026-10-06.sql`, SHA-256 `A7867830D87EFE9DC42094D1F6153DACB2A4B0DCDACCBC5C2D0A5E56053E8134`. Guardy odrzucą brak fingerprintu albo późniejszą zmianę docelowych policies.

| Policy | Zapisany applied MD5 |
| --- | --- |
| `locations_insert_admin_or_organizer` | `1202023c9dba1de2e86717b71308d779` |
| `Anyone can insert event analytics` | `596ae3defb45b1a1eebee3fdb0928853` |

Nie wykonuj rollbacku jako rutynowego testu na produkcji: przywróci poprzednie dwie luki. Jeśli będzie potrzebny, potwierdź aktualny katalog i dokładny cel, wykonaj przygotowany plik z jawnym ref w jednym wywołaniu z przerwaniem na pierwszym błędzie, następnie odczytaj katalog i odbierz działanie aplikacji. Nie odczytuj zastępczych hashy z dowolnego późniejszego stanu.

## Pozostały zakres

Nadal otwarte: przeniesienie `submitted_by_organizer_id` przez członka dwóch organizacji, zapis chronionych pól wydarzenia przez organizatora i brak edycji własnego profilu organizacji. [Wcześniejszy raport](supabase-rls-tests-2026-10-06.md) zachowuje wykonane reprodukcje. [Osobny projekt ochrony zapisu organizatora](organizer-write-hardening-proposal.md) jest przygotowany i przejrzany: dokładne allowlisty wszystkich 30/14 kolumn, OLD/NEW, admin/maintenance, zgodność writerów, rollout/rollback i scenariusze testowe. To dokument kontraktu, bez wykonywalnej migracji i bez wdrożenia tych trzech napraw.

Pełne A04, prawdziwe JWT/Auth/SMTP, Google, fizyczny telefon i kompletna checklista odbiorowa pozostają otwarte. RLS analityki sprawdza publikację w bieżącym statement, bez blokady wiersza wydarzenia względem równoległego unpublish. Bezpośredni REST nadal omija zgodę, limiter i dedup endpointu; ta poprawka nie zapewnia rozproszonej ochrony A08.
