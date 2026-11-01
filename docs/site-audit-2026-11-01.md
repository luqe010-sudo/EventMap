# Audyt MapaImprez.pl i plan naprawczy — 2026-11-01

Audyt publicznej części produkcji https://mapaimprez.pl, kod na commicie `d400246`. Sprawdzono przeglądarką przy 375, 768 i 1440 px, w trybie jasnym i ciemnym, oraz przez publiczne API i `curl`. Nic nie zostało wdrożone ani zmienione w kodzie czy bazie.

**Werdykt: strona nie jest jeszcze gotowa do pełnego użytkowania.** Rdzeń działa dobrze: wyszukiwanie, filtry, mapa, klastry i strony wydarzeń nie mają poziomych przewinięć. Problemem są błędne dane widoczne publicznie, tryb ciemny (domyślny na każdym telefonie) i poprawność techniczna adresów oraz SEO. Ocena obecnego stanu: około 6,5/10.

## Zasady dla osoby wdrażającej

Obowiązuje `AGENTS.md`, a w szczególności:

- Nie wykonywać SQL ani migracji automatycznie. Zmiany danych z etapu 0 przygotować jako osobną propozycję do akceptacji właściciela.
- Nie tworzyć tabel i nie zmieniać nazw kolumn bez pytania.
- Zachować publiczne filtry `published`, `public`, nieanulowane.
- Przy zmianach publicznego UI aktualizować `docs/current-features.md`, a przy zmianach konfiguracji `docs/architecture.md` i `docs/deployment.md`.
- Numery linii dotyczą commita `d400246`. Przed zmianą sprawdzić je w aktualnym kodzie.

## Blokery

| ID | Problem | Dowód | Przyczyna |
|---|---|---|---|
| B1 | Wydarzenia z datą 2200 | 10 opublikowanych wydarzeń ma datę 2200-01-01, także w sitemapie i liczniku. „Inside Again” trwa do 20 maja 2200, a opis mówi o płycie z 2020 roku. | Data zastępcza z importu trafiła do publikacji. |
| B2 | Fałszywie „zweryfikowani” organizatorzy | 99 ze 136 wydarzeń ma organizatora „MODERATOR ✓”. Yamato, pierwsza karta Polecanych, ma „Testowy bez admina ✓”. | Konta techniczne mają `is_verified = true`. |
| B3 | Prywatny e-mail w publicznym API | `/api/events/search` zwraca prywatny adres Gmail moderatora przy wydarzeniach z tym organizatorem. | Zapytanie pobiera `email` organizatora: `lib/events.ts:258`, `lib/events.ts:284`. |
| B4 | Regulamin nieczytelny w trybie ciemnym | Nagłówki mają kontrast 1,06:1. Kontrast poniżej 3:1 ma 42 elementy. | Sztywne jasne tło przy tekście zmienianym przez motyw: `app/globals.css:2669`, `app/globals.css:2677`. |
| B5 | Niewidoczny tytuł w popupie mapy na telefonie | Tytuł ma kolor `rgb(37,33,32)` na ciemnym tle. | Brak stylu motywu ciemnego przy `components/MobileMapView.tsx:108`. |
| B6 | Nieistniejące strony zwracają HTTP 200 | `/nie-ma-takiej-strony-xyzqw` i `/koncerty/nie-ma-takiego-miasta-xyzqw` dają 200 zamiast 404. `/admin`, `/account` i `/organizer` przekierowują przez 200 zamiast 307. | Główny `app/loading.tsx` zaczyna strumieniowanie, zanim znany jest status odpowiedzi. |

## Ważne błędy

| ID | Problem | Szczegóły |
|---|---|---|
| W1 | Link „Mapa” w menu | Z innej podstrony gubi `#events-list` i zostaje u góry. Na stronie głównej prowadzi do listy, nie do mapy, a nagłówek listy chowa się pod paskiem nawigacji. |
| W2 | Przycisk „Cookies” | Kontrast 1,54:1. Na mobilnej mapie zasłania przycisk „+”, a w filtrach ikonę kalendarza (`app/discovery.css:232`, `app/globals.css:6073`). |
| W3 | Nagłówki stopki | W trybie ciemnym kontrast 1,18:1 (`app/globals.css:8440` nadpisuje kolor). |
| W4 | `/koncerty/dzis`, `/koncerty/weekend` | Słowo jest geokodowane jak miejscowość i użytkownik trafia na przypadkowe współrzędne. Fallback jest w `app/[category]/page.tsx`. |
| W5 | Duplikaty | Bracia Figo Fagot (Szczecin 7 XI, Katowice 20 XI, Warszawa 28 XI) i Modestep Live (Wrocław 23 XI) mają po dwa rekordy. |
| W6 | Ceny | Karty pokazują „od 202,9 zł” zamiast „202,90 zł” (`lib/event-presentation.ts:18-20`). |
| W7 | Mapa na stronie wydarzenia | Startuje za szeroko, ma angielskie etykiety (np. „Silesian Voivodeship”), a kółko myszy przybliża ją zamiast przewijać stronę. |
| W8 | Dół strony wydarzenia | Karuzela „Podobne” ma około 400 px szerokości obok pustej przestrzeni. Dla koncertu w Gliwicach pokazuje wydarzenia z Warszawy. |
| W9 | Metadane | Każda strona ma ogólny, drugi `description` (`app/layout.tsx:85`). Listy dziedziczą ogólne `og:title` i `og:url` strony głównej. |
| W10 | Język | „Nadchodzące kultura w Polsce”, „Wydarzenia w Aleksandrów Łódzki”, brak polskich znaków w rejestracji, na stronie 404 i w opisach meta. Dotyczy `components/HomePage.tsx:205` i `lib/slugs.ts`. |
| W11 | Autouzupełnianie miast | Podpowiada „Krakow-Leg Power Plant”, „Krakowska Ulica” i zdublowany „Krakow”. |
| W12 | Puste skróty | Dziś, jutro i w ten weekend jest 0 wydarzeń. Filtry z kafelków kumulują się po cichu (`kiedy=today&cena=free`), a kliknięcie nie przewija do wyników. W niedzielę wieczorem „weekend” obejmuje tylko bieżący dzień (`lib/date-range.ts:22`). |
| W13 | Długość strony mobilnej | Strona ma 11 750 px, a pierwsza karta listy zaczyna się około 1700 px od góry. |
| W14 | Ścieżka dodawania wydarzenia | „Dla organizatorów” od razu przenosi na logowanie, bez wyjaśnienia, co i jak można dodać. |

## Pomniejsze

- **Bezpieczeństwo:** brak nagłówków CSP, `X-Frame-Options`, `X-Content-Type-Options` i `Referrer-Policy`. `next.config.ts` ich nie ustawia.
- **Wydajność:** nagłówek `x-vercel-id` wskazuje region `iad1` (USA). Strona główna zwraca około 249 KB HTML w 1,7 s.
- **Sitemapa:** 51 z 88 miast nie ma żadnego wydarzenia w wynikach API, a każde ma w niej 4 adresy. 8 z 15 kategorii jest pustych.
- **API:** błędne parametry dają 500 zamiast 400, np. `lat=abc`, `sort=nearest` bez lokalizacji, `citySlug=gorzow-wielkopolski&radius=30`.
- **Kontrast:** w trybie jasnym kategorie i metadane mają 2,5–2,8:1, a pomarańczowe przyciski 3,23:1.
- **Adresy:** `/koncerty/wroclaw/Modestep-Live`, `/Wroclaw` i `/KONCERTY` dają 200 bez przekierowania na małe litery.
- **Dane:**
  - 3 koncerty są oznaczone „Cały dzień”.
  - Jedno miasto nazywa się „Gdańsk/Sopot”.
  - Przy 21 miastach brakuje współrzędnych centrum.
  - 36 wydarzeń nie ma zdjęcia, a karty zastępcze powtarzają tytuł.
  - „Sonata Artica” to literówka w tytule wydarzenia w Gliwicach.

## Plan naprawczy

### Etap 0: dane (osobny SQL, wymaga zgody właściciela)

- Poprawić lub ukryć 10 wydarzeń z datą 2200 (B1).
- Scalić duplikaty (W5).
- Zdjąć weryfikację z kont MODERATOR i „Testowy bez admina” (B2).
- Uzupełnić współrzędne miast.

### Etap 1: blokery w kodzie

1. Usunąć e-mail z publicznych zapytań (B3).
2. Zastąpić główny `loading.tsx` lokalnym `Suspense`, tak aby 404 i przekierowania miały poprawne statusy (B6).
3. Dodać do importu walidację dat, która nie przepuści wartości w rodzaju 2200 (B1).
4. Naprawić style trybu ciemnego: regulamin, popup, stopka, „Cookies” (B4, B5, W2, W3).
5. Przenieść „Cookies”, tak aby nic nie zasłaniał (W2).

### Etap 2: nawigacja i przepływy

1. Dać linkowi „Mapa” właściwy cel i dodać `scroll-margin` (W1).
2. Obsłużyć `/kategoria/dzis`, `/weekend` i `/ten-tydzien` przed geokodowaniem (W4).
3. Uporządkować kafelki: jeden wybór i przewinięcie do wyników (W12).
4. Dodać krótką stronę dla organizatorów przed logowaniem (W14).

### Etap 3: dopracowanie

- Mapa i układ strony wydarzenia (W7, W8).
- Polskie znaki i odmiana nazw (W10).
- Format cen i kontrast (W6).
- Filtrowanie podpowiedzi miast (W11).
- Skrócenie strony mobilnej (W13).

### Etap 4: technika i SEO

- Nagłówki bezpieczeństwa i kody 400 w API.
- Region europejski, po sprawdzeniu regionu Supabase.
- Metadane list i usunięcie pustych adresów z sitemapy (W9).
- Przekierowania adresów z wielkimi literami.

### Etap 5: odbiór na koncie testowym

Przejść ścieżki z sekcji poniżej, po wcześniejszym przygotowaniu kont testowych.

## Ponowna kontrola produkcji — 2026-11-01

Potwierdzono na produkcji: B3, B5, B6, W1, W2, W3, W4, W6, W8, W9, W10 (sprawdzone miejsca), W12, W13, W14, nagłówki bezpieczeństwa i kody 400 w API.

Pozostało wtedy otwarte: B1, B2 i W5 (dane, SQL niewykonany), B4 (spis treści regulaminu), W7 (polskie nazwy tylko 6 z 16 województw), W11 oraz region Vercel. Sitemapa wydarzeń spadła z 492 do 136 adresów, a `docs/current-features.md` mówi, że minione wydarzenia mają pozostać indeksowalne. Tę rozbieżność trzeba rozstrzygnąć.

## Audyt panelu admina — 2026-11-01

Sprawdzono na koncie admina właściciela, w trybie oglądania, bez zapisów. Listy, filtry, paginacja i formularze działają, a ochrona tras bez logowania jest poprawna.

| ID | Waga | Problem | Stan |
|---|---|---|---|
| A1 | Krytyczny | „Usuń” kasował wydarzenie bez potwierdzenia | Naprawione w kodzie: `components/DeleteEventButton.tsx` |
| A2 | Wysoki | „Miasta SEO” czytały tylko pustą `city_pages`, więc lista miała 0 pozycji | Naprawione w kodzie: lista z `cities`, `city_pages` opcjonalne, `id` w trasie to id miasta |
| A3 | Wysoki | „Moje konto”: dane i tytuły zapisów miały kontrast 1,02:1 w trybie ciemnym | Naprawione w kodzie: `app/audit-fixes.css` |
| A4 | Wysoki | Nowe wydarzenie miało domyślnie status `published` i organizatora „Admin” | Naprawione w kodzie: `draft` i świadomy wybór organizatora |
| A5 | Średni | Brak górnego limitu daty w formularzu | Naprawione w kodzie: najwyżej 3 lata naprzód |
| A6 | Niski | „Opublikuj” przy opublikowanych, surowe statusy, błysk „Zaloguj”, brak polskich znaków, utrata adresu po logowaniu, 500 dla `/api/events/abc` | Naprawione w kodzie |

## Zmiany w kodzie po audycie panelu

Zmiany są w `E:\EventMap`, bez commita i bez wdrożenia. Testy 539/539 i `tsc` przeszły, a build produkcyjny zakończył się poprawnie. **Nie sprawdzono ich w przeglądarce.**

- Naprawione: A1–A6, B4 (spis treści), W7 (16 województw), W11 (tylko miejscowości, bez duplikatów pisowni).
- Dodatkowo: `poweredByHeader: false`, `/dla-organizatorow` w sitemapie, `vercel.json` z regionem `fra1` (Supabase EventMap jest w `eu-central-1`).
- Ikona pinezki: dodano ponowne przeliczenie danych mapy po załadowaniu ikon. Przyczyny nie potwierdzono, więc wymaga obserwacji.
- Nowe zachowanie: edycja wydarzenia z datą ponad 3 lata naprzód albo bez organizatora wymaga poprawienia tych pól.

Do zrobienia:

1. Skopiować `tests/panel-audit-regressions.test.ts` i ten raport z worktree do `E:\EventMap`.
2. Zaktualizować `docs/current-features.md` (sekcja `/admin/cities`, statusy, limit daty) oraz `docs/deployment.md` i `docs/architecture.md` (region `fra1`).
3. Zrobić commit, bo inaczej deployment z GitHuba cofnie poprawki.
4. Wykonać przejrzany SQL dla B1 i B2 oraz scalić W5, po akceptacji właściciela.
5. Sprawdzić zapis miasta na produkcji: polityki RLS tabel `cities` i `city_pages` nie zostały potwierdzone.

## Publikacja poprawek i danych — 2026-11-01

Na polecenie właściciela opublikowano deployment `dpl_GHsw4hp87Kbn8t9XTS1fZSytpaoK` (`event-l9umb3n59`). Punkt wycofania kodu: `event-p6kdbmn5u`. Region to `fra1`, potwierdzony nagłówkiem `x-vercel-id`. Bez commita, więc deployment z Git cofnie zmiany, dopóki nie trafią do repozytorium.

Zmiany danych, wykonane jedną transakcją: 10 wydarzeń z 2200 przeniesiono do `pending_review`, 2 kontom technicznym zdjęto weryfikację, 4 duplikaty zarchiwizowano (trzy Bracia Figo Fagot i stary Modestep Live bez źródła). Stan przed zmianą: `site-audit-data-backup-2026-11-01.json`. Cofnięcie: `site-audit-data-rollback-2026-11-01.sql`.

Po publikacji: 122 publiczne wydarzenia, 0 dat 2200 w sitemapie, 88 miast w panelu (61 bez centrum), usuwanie typu button, nowe wydarzenie jako szkic, kontrast konta i regulaminu poprawny. Zapisów w panelu nie testowano.

## Czego nie sprawdzono

- **Konta i formularze:** faktyczne zapisy w panelu admina, panel organizatora, rejestracja, reset hasła, Google i zapisywanie wydarzeń zwykłym kontem.
- **RLS:** odczyt produkcyjnej bazy został zablokowany, a lokalny Supabase wymaga Dockera i większej ilości RAM.
- **Sprzęt i usługi zewnętrzne:** prawdziwy telefon, gesty dotykowe, GPS i linki do biletów. Widok mobilny był tylko emulacją.
- **Błąd React #418:** pojawił się raz, przy pierwszym wejściu, i nie powtórzył się w kolejnych ładowaniach. Nie jest potwierdzony.
- **Błąd HTTP 400 w konsoli:** pojawił się raz, a jego źródła nie zidentyfikowano.
