# Event Engine — STATE

**Ostatnia aktualizacja: 2026-11-26** (sesja wdrożeniowa, Claude Code)

## Etap

Etapy 2–3 zrealizowane w kodzie i zweryfikowane lokalnie. Etap 1 (VPS) i etap 4 (test z moderacją) czekają na dostępy i decyzje z `access-and-decisions.md`. **Nic nie jest wdrożone na serwer, nic nie zostało zapisane do produkcyjnego Supabase, nic nie zakupiono.**

## Co jest gotowe

- Silnik `engine/` (Node 24, TypeScript bez builda, SQLite, 0 nowych zależności): Supervisor + 12 agentów wyspecjalizowanych, trwała kolejka z dzierżawami/backoffem/dead-letter, pamięć operacyjna, rejestr źródeł z podstawą prawną, pochodzenie danych, księga kosztów z twardymi limitami, audyt append-only, wyłącznik awaryjny (panel, plik, CLI), API sterujące.
- Integracje: iCalendar, schema.org JSON-LD (lista + strony szczegółów), RSS (jako źródło linków), WordPress „The Events Calendar” REST API; odkrywanie: Wikidata (CC0), seed 183 stron z historii kuratorskiej (142 z potwierdzonym obiektem, 12 z kategorią domyślną).
- Panel `/admin/engine` + akcje serwerowe z `requireAdmin`; publiczna strona `/bot`.
- Wdrożenie: Dockerfile, docker-compose (worker/publisher/control/caddy, izolacja klucza serwisowego), bootstrap VPS, aktualizacja z automatycznym rollbackiem, kopie lokalne i opcjonalne poza serwerem, szablony env dev/staging/prod.
- Migracja SQL: **niepotrzebna** (istniejące tabele i kolumny).

## Weryfikacja (2026-11-26)

- `npm test`: 60 plików, 675 testów — zielone (w tym 35 testów silnika i 2 testy renderu panelu). `npm run typecheck` (aplikacja + silnik) — zielone. `npm run lint` — 0 błędów (10 starszych ostrzeżeń poza silnikiem). `next build` nieuruchomiony lokalnie (zajęty katalog `.next` przez serwer dev innej sesji) — sprawdzi CI.
- Przebieg na żywo (lokalna baza w katalogu tymczasowym, `ENGINE_ROLE=worker`, tryb publikacji `off`, odczyt publicznych danych Supabase, reguły prawne zatwierdzone **tylko w lokalnej bazie testowej**):
  - Wikidata: zapytania zweryfikowane — 3523 jednostki z kodem TERC i stroną, ~1400 instytucji kultury ze stroną.
  - TAURON Arena Kraków: sonda → L5 → kanał JSON-LD na stronach szczegółów → 9 wydarzeń przez geo (domyślny obiekt) → jakość → opisy → `ready`.
  - Sondowanie seedu: patrz sekcja „Wyniki przebiegu” niżej.
- Panel: render sprawdzony testem na prawdziwych odpowiedziach API silnika oraz wizualnie (statyczny podgląd, telefon). Nie sprawdzono na żywo z zalogowanym adminem.

## Wyniki przebiegu (2026-11-26, ok. 25 min, ~120 z 175 źródeł seedu w obróbce)

- Źródła: **13 aktywnych** (5 przez WordPress Tribe API, 8 przez schema.org), 15 zaakceptowanych regułą L5 (tylko lokalnie), 1 zablokowane przez robots.txt, 31 do decyzji (brak kanału strukturalnego rozpoznanego przy sondowaniu), 25 bez kanału z przyszłymi wydarzeniami, 0 zadań w dead-letter (1876 wykonanych).
- Najwydajniejsze: resursa.radom.pl (99), teatr.grudziadz.pl (77), wroclaw.pl (65), filharmoniakoszalinska.pl (46), progresja.com i stodola.pl (po 29), kalendarzimprez.plock.eu (23).
- Kandydaci: **358 gotowych** (`ready`), z czego 230 z wynikiem ≥0,85; 27 bez pewnej pinezki (`needs_geo`), 1 brak miasta, 4 odrzucone przez jakość (3 już rozpoczęte, 1 niepubliczne), 1 duplikat.
- Kategorie gotowych: kultura 118, **inne 105**, koncerty 84, stand-up 13, rodzinne 11, targi 11, imprezy 7.
- Obserwacje z przebiegu (wszystkie poprawione tego samego dnia, patrz niżej): wysoki udział „inne”, wystawy jako osobny wpis na każdy dzień, nietrafna kategoria domyślna (gala w teatrze jako koncert), wydarzenie w Görlitz przypisane do Zgorzelca, godzina 00:00 w opisach tras koncertowych.

## Poprawki jakości (2026-11-26, po przebiegu)

- **Kategorie:** nowe reguły (m.in. tenor/przeboje/kolędy/orchestra → koncerty, impro/komedia/przedstawienie/prelekcja/spacer/gra miejska → kultura, parkrun → sport, targ → targi, „1–3 lata”/maluch → rodzinne, andrzejki). Kategoria domyślna źródła tylko z ≥5 wydarzeń historii (≥70% udziału), nigdy dla gal/konferencji/szkoleń; w razie braku — podpowiedź z nazwy źródła (filharmonia/orkiestra/opera → koncerty, teatr/muzeum/galeria/biblioteka → kultura); kategoria z fallbacku obniża wynik o 0,1.
- **Serie dzienne:** ≥3 dni tego samego tytułu i miejsca z medianą odstępu ≤2 dni → jedno wydarzenie z datą końca (≤120 dni); serie z kilku stron API łączone sumą zakresu. Cotygodniowe powtórzenia zostają osobno. Opis: „Potrwa do …”.
- **Strażnicy:** `foreign_venue` (np. „(DE)”, Niemcy, Czechy), `not_event` (ogłoszenia typu „Specjalne ceny…”, „Nabór”), szersze `not_public` („spektakl zamknięty”, „uroczystość zamknięta”). Tag „Wynajem” (Teatr Grudziądz) oznacza zewnętrznego organizatora publicznego wydarzenia — świadomie **nie** blokuje.
- **Opisy:** bez „godz. 00:00”; koniec tego samego dnia jako „Zakończenie: godz. …”; bez podwójnych cudzysłowów.
- **Naprawiony błąd wykrywania zmian:** porównanie opierało się na `facts`, które geolokalizacja wzbogaca o współrzędne, więc każde pobranie uznawano za zmianę. Teraz `candidates.source_hash` (migracja v2 lokalnej bazy silnika — nie Supabase).
- **Efekt na tych samych danych** (powtórka zapisanych odpowiedzi, mniejszy zbiór niż przebieg na żywo): udział „inne” spadł z 29% (105/358) do 7% (16/222), koncerty 115, kultura 39; 176 z 222 gotowych z wynikiem ≥0,85; zablokowane poprawnie: 5× zamknięte, 3× ogłoszenie, 1× Görlitz, 2× już rozpoczęte.
- Testy: 60 plików, 675 testów, typecheck i lint czyste.

## Otwarte / następne kroki

1. Właściciel: decyzje D1–D3, D8 i dostępy A1–A5 (`access-and-decisions.md`).
2. Po VPS: `update.sh`, połączenie panelu, zatwierdzenie reguł w panelu, `pending_review` z limitem 100/dzień.
3. Obserwacja 14 dni (etap 4): jakość próbki, duplikaty, `needs_city`/`needs_geo`, regresje.
4. Rozszerzenia: kolejne adaptery (np. inne popularne wtyczki kalendarzy), katalogi instytucji kultury JST, własny geokoder przy skali, naprawy kodu w piaskownicy (etap 7).

## Znane ograniczenia

- Strony bez danych strukturalnych (sam HTML) nie są obsługiwane — to świadoma decyzja (pewność dat/miejsc ponad wolumen); trafiają do `no_integration`.
- Deduplikacja z Supabase porównuje tytuł/dzień/miasto i podobieństwo tytułu; zupełnie inne nazwy tego samego wydarzenia mogą przejść (jak w importerze kuratorskim) — moderacja w etapie 4 to wyłapie.
- Kategoria „inne” obniża wynik jakości (nie przejdzie autopublikacji przy progu 0,85). Pozostałe „inne” to głównie nazwy samych wykonawców spoza klubów muzycznych i nietypowe formaty (burleska, urodziny obiektu).
- Lokalnie przechowywane jest tylko 5 ostatnich surowych odpowiedzi na źródło (fiksturki diagnostyczne), więc powtórka pipeline'u z zapisanych danych nie odtwarza pełnego przebiegu.
- Kanał pinezek dla wydarzeń bez lokalizacji w schema.org: tylko dla źródeł z potwierdzonym obiektem (seed); pozostałe → `needs_geo`.
