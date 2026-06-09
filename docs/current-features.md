# Current Features

## Publiczne przeglądanie wydarzeń

Strona główna `/`:

- pobiera wydarzenia z Supabase przez `getHomeData()`;
- używa publicznej nazwy i domeny `MapaImprez.pl` w logo, metadanych i publicznych URL-ach;
- pokazuje hero, panel wyszukiwania oraz układ 70/30 z lewą kolumną wydarzeń i prawym sidebarem;
- w lewej kolumnie pokazuje wyróżnione wydarzenia nad listą wydarzeń;
- w prawym sidebarze pokazuje jeden spójny panel z mapą MapLibre, powiadomieniami, nadchodzącymi wydarzeniami i popularnymi kategoriami;
- mapa w sidebarze jest osadzona bezpośrednio w dużym panelu, ma wewnętrzny margines i zaokrąglenie;
- mapa na starcie używa zasięgu `Cała Polska`, obejmuje kadrem całą Polskę i pokazuje wydarzenia bez ograniczenia promieniem;
- mapa grupuje blisko położone wydarzenia w klastry; kliknięcie klastra przybliża widok.
- pojedyncze pineski używają koloru i ikony kategorii wydarzenia.
- mapa pokazuje lekko kolorowane województwa, wyraźne granice powiatów na bazie warstwy `boundary` oraz numery budynków przy dużym przybliżeniu.
- etykiety mapy są preferowane w języku polskim, jeśli styl kafelków udostępnia pole `name:pl`.
- filtruje po presetach daty, niestandardowym zakresie dat, promieniu albo zasięgu `Cała Polska`, kategorii i opcji darmowych wydarzeń;
- pozwala wybrać lokalizację z autouzupełniania albo GPS;
- sortuje po odległości albo dacie.
- na widoku mobilnym zachowuje estetyczne marginesy od krawędzi (18px), a kafelki klimatu w sekcji hero układają się w układ trójkolumnowy o zmniejszonych wymiarach;
- kafelki kategorii w panelu wyszukiwania zawijają się na wszystkich urządzeniach (zarówno mobilnych, jak i desktopowych) do wielu wierszy, co zapobiega ich ucinaniu;
- panel wyszukiwania posiada przycisk "Znajdź" umieszczony pod przyciskami kategorii, który na urządzeniach mobilnych zajmuje pełną szerokość; kliknięcie "Znajdź" buduje URL z wybranych filtrów (kategoria, miasto/lokalizacja) i nawiguje do odpowiedniej podstrony (np. `/koncerty/wroclaw` lub `/lokalizacja?lat=...&lng=...&radius=...`);
- panel wyszukiwania (SearchPanel) jest widoczny na wszystkich stronach (strona główna, podstrony kategorii, miast i kategorii+miasto); na podstronach data filtruje dynamicznie, a zmiana kategorii lub miasta nawiguje dopiero po kliknięciu "Znajdź";
- tło strony (`background.png`) na komputerach oraz na smartfonach jest dopasowane za pomocą `background-size: cover` oraz wypozycjonowane `center top`, dzięki czemu nie tworzy ostrych krawędzi i płynnie rozmywa się na dolnym odcinku (od wysokości 65% z 35-procentowym obszarem całkowitego zanikania).

- autouzupelnianie lokalizacji wyswietla doprecyzowane etykiety z wojewodztwem, ale po wyborze zachowuje kanoniczny slug miasta (np. `Wroclaw (woj. dolnoslaskie)` nawiguje jak `wroclaw`).

Widok `EventExplorer`:

- jest używany na stronach kategorii i miasta;
- pokazuje listę i mapę MapLibre;
- grupuje markery wydarzeń w klastry i pozwala wybierać pojedyncze wydarzenia z mapy;
- pozwala filtrować po presetach daty albo niestandardowym zakresie dat;
- pozwala wybrać wydarzenie i zobaczyć szczegóły w panelu.

## Szczegóły wydarzenia

URL:

```text
/wydarzenie/[slug]
```

Technicznie obsługiwane przez `app/wydarzenie/[slug]/page.tsx`. Stary format `/wydarzenia/[slug]` przekierowuje na nowy adres, jeśli slug odpowiada wydarzeniu.

Szczegóły pokazują (redesigned premium layout):

**Hero section** (grid 2-kolumnowy):
- duży obraz wydarzenia zachowujący oryginalne proporcje (bez przycinania);
- badge kategorii na obrazie;
- tytuł, meta-chipy (miasto, data, dzień tygodnia, godzina);
- krótki opis (`short_description`);
- zielony przycisk CTA „Zobacz bilety / strona wydarzenia" (link z `ticketUrl` / pierwszego `event_sources.source_url`);
- przycisk „Udostępnij" (Web Share API / schowek);
- przycisk „Zapisz" z ikoną serca (zapis lokalny w przeglądarce);
- pasek podsumowania: Cena, Kategoria, Organizator.

**Nawigacja sekcji** — linki kotwicowe: Szczegóły, Organizator, Źródła.

**Pasek informacji** — 4 elementy z ikonami w zielonych kółkach:
- KIEDY (data i godzina, obsługa zakresu dat);
- GDZIE (pełny adres z lokalizacji);
- CENA (sformatowana cena + „Bezpłatne" / „Bilety płatne");
- KATEGORIA.

**Sekcja treści** (grid 2-kolumnowy):
- opis wydarzenia z funkcją „Pokaż więcej / Pokaż mniej" (collapsible z gradientem);
- mapa MapLibre z adresem i linkiem „Otwórz w Google Maps" (generowany z `google_maps_url` lub współrzędnych).

**Sekcja dolna** (grid 2-kolumnowy):
- organizator z awatarem (logo lub inicjał), nazwą, statusem weryfikacji i linkiem do profilu;
- źródła wydarzenia z ikonami, nazwami i URL-ami;
- do 6 podobnych wydarzeń z tej samej kategorii w siatce kart z obrazkami, badge kategorii, datą, miastem i ceną.

Analityka szczegolow wydarzenia:

- route `POST /api/events/[id]/analytics` zapisuje zdarzenia w `event_analytics`;
- strona szczegolow zapisuje `view`, klikniecie biletow, telefonu, strony WWW, mapy, udostepnienia i zapisu wydarzenia.

## Strony miast

URL:

```text
/wydarzenia/[citySlug]
```

Strona korzysta z `city_pages`:

- tylko `is_active = true`;
- metadata z `meta_title` i `meta_description`;
- lokalizacja z `latitude` i `longitude`;
- wydarzenia z tego samego miasta albo w promieniu 50 km.

## Kategorie

URL:

```text
/kategoria/[slug]
```

Strona:

- pobiera kategorię z `categories`;
- pobiera wydarzenia przez `category_id`;
- generuje metadata i JSON-LD `CollectionPage`;
- renderuje `EventExplorer`.

## Geolokalizacja

URL:

```text
/lokalizacja?lat=50.589&lng=16.812&radius=30
```

Strona:

- czyta współrzędne i promień z query params;
- pobiera wydarzenia z `listEvents()` na serwerze;
- renderuje `HomePage` z `initialLocation` zbudowaną z parametrów;
- meta `robots: noindex, nofollow` — nieskończona liczba kombinacji;
- tytuł: "Wydarzenia w okolicy | MapaImprez".

URL z kategorią:

```text
/koncerty/lokalizacja?lat=50.589&lng=16.812&radius=30
```

- obsługiwane przez `app/[category]/[city]/page.tsx` gdy `city === "lokalizacja"`;
- filtruje wydarzenia po kategorii;
- również `noindex, nofollow`.

## Fallback dla nieistniejących miast

Gdy użytkownik wywoła adres URL z miastem, które nie istnieje w bazie danych ani jako znane miasto (np. `/koncerty/budzow-woj-dolnoslaskie` lub `/budzow-woj-dolnoslaskie`):
- Serwer automatycznie próbuje zgeokodować slug (podmieniając myślniki na spacje) za pomocą API Nominatim (OpenStreetMap).
- Jeśli API zwróci współrzędne geograficzne, serwer wykonuje przekierowanie tymczasowe (HTTP 307) na stronę geolokalizacji z odpowiednimi parametrami `lat`/`lng` oraz promieniem 30 km (np. `/koncerty/lokalizacja?lat=50.589&lng=16.812&radius=30` lub `/lokalizacja?lat=50.589&lng=16.812&radius=30`).
- Jeśli geokodowanie nie powiedzie się (np. dla losowego ciągu znaków), serwer zwraca standardowy błąd 404 (NotFound).
- Taki mechanizm chroni przed błędami 404 dla mniejszych miejscowości wpisanych w wyszukiwarkę i jednocześnie zapobiega indeksowaniu niepotrzebnych dynamicznych podstron (ponieważ strona docelowa posiada tag `noindex`).

## Login, rejestracja i sesja

- `/login` obsluguje bledy Supabase Auth w formularzu, bez wywolywania 500 w Server Components.
- `/login` ma formularz email/hasło i link do rejestracji.
- `/register` ma formularz rejestracji użytkowników z wyborem roli: Widz (rola `user`) lub Organizator (rola `organizer`). Dla organizatorów automatycznie tworzy profil organizacyjny (`organizers` i `organizer_users`).
- `signInAction()` oraz `signUpAction()` używają Supabase Auth.
- Wylogowanie idzie przez `POST /auth/sign-out`.
- Navbar pokazuje link do panelu dla roli `admin` albo `organizer`.
- Navbar nie pokazuje statycznego selektora lokalizacji, zeby nie sugerowac aktywnej lokalizacji uzytkownika.

## Panel admina

`/admin`:

- liczniki `pending_review`, `published`, `rejected`;
- ostatnio dodane wydarzenia;
- wspólny pasek nawigacji admina z przejściem do `Wydarzenia`, `Organizatorzy` i `Kategorie`;
- linki do wydarzeń, organizatorów i kategorii.

`/admin/events`:

- tabela wydarzeń;
- akcje: edytuj, opublikuj, odrzuć, archiwizuj, usuń.

`/admin/events/new` i `/admin/events/[id]/edit`:

- formularz wydarzenia;
- status dostępny tylko dla admina;
- wybór kategorii, organizatora i lokalizacji;
- interaktywny picker lokalizacji z mini-mapa MapLibre, wyszukiwaniem adresow przez Nominatim i przesuwalna pinezka; automatycznie wypelnia wspolrzedne, miasto, adres, kod pocztowy, wojewodztwo, powiat i gmine;
- możliwość wgrania obrazu wydarzenia do Cloudinary albo podania zewnętrznego linku;
- zapis źródła wydarzenia.

`/admin/organizers`:

- tabela organizatorów;
- link do edycji.

`/admin/organizers/new` i `/admin/organizers/[id]/edit`:

- formularz organizatora;
- możliwość podania `owner_user_id` i utworzenia powiązania w `organizer_users`.

`/admin/categories`:

- tabela kategorii wydarzeń (kolor, nazwa, slug, ikona, kolejność sortowania);
- przyciski edycji oraz bezpiecznego usuwania (wymaga potwierdzenia użytkownika i nie pozwala na usunięcie, jeśli kategoria posiada powiązane wydarzenia).

`/admin/categories/new` i `/admin/categories/[id]/edit`:

- formularz kategorii z polami: nazwa, slug (opcjonalny, generowany automatycznie z nazwy), kolor (wygodny color picker wraz z polem tekstowym), ikona, kolejność sortowania.

### Rozszerzone sekcje panelu admina

`/admin/review`:

- kolejka wydarzen ze statusem `draft` albo `pending_review`;
- akcje: sprawdz, opublikuj, odrzuc.

`/admin/locations`:

- tabela lokalizacji z nazwa, adresem, miastem, danymi administracyjnymi, liczba wydarzen i sygnalem potencjalnych duplikatow;
- link do edycji;
- usuwanie jest dostepne tylko dla lokalizacji bez przypisanych wydarzen.

`/admin/locations/new` i `/admin/locations/[id]/edit`:

- formularz lokalizacji z mini-mapa MapLibre, wyszukiwaniem adresu i przesuwalna pinezka;
- pola: nazwa miejsca, adres, miasto, kod pocztowy, gmina, powiat, wojewodztwo, Google Maps URL i Place ID.

`/admin/cities`:

- tabela stron lokalnych SEO z miastem, slugiem, statusem aktywnosci, wojewodztwem, wspolrzednymi centrum i liczba wydarzen liczona przez `locations.city_id`.

`/admin/cities/new` i `/admin/cities/[id]/edit`:

- formularz strony miasta z aktywacja/dezaktywacja, `meta_title`, `meta_description`, tekstem wstepnym, slugiem, centrum miasta, powiatem i wojewodztwem.

## Panel organizatora

`/organizer`:

- pokazuje statusy wydarzeń;
- pokazuje wydarzenia powiązane z organizatorami użytkownika;
- pokazuje empty state, jeśli konto ma rolę `organizer`, ale nie ma wpisu w `organizer_users`.

`/organizer/events/new`:

- dodaje wydarzenie ze statusem `pending_review`;
- przypisuje wydarzenie do organizatora użytkownika;
- interaktywny picker lokalizacji z mini-mapa, wyszukiwaniem adresow i automatycznym geokodowaniem;
- pozwala wgrać obraz wydarzenia do Cloudinary albo podać zewnętrzny link.

`/organizer/events/[id]/edit`:

- edytuje tylko własne wydarzenie;
- po edycji opublikowanego wydarzenia ustawia `pending_review`.
- pozwala zmienić obraz wydarzenia przez upload do Cloudinary albo zewnętrzny link.

### Aktualny MVP panelu organizatora

`/organizer`:

- pelni role dashboardu organizatora;
- pokazuje liczniki aktywnych wydarzen, wydarzen do zatwierdzenia, miesiecznych wyswietlen i klikniec kontaktu;
- pokazuje najblizsze wydarzenia, powiadomienia panelowe / komunikaty wynikajace z odrzuconych wydarzen, miejsca uzywane w wydarzeniach oraz podstawowe statystyki;
- zwykly zalogowany uzytkownik moze z tego miejsca rozszerzyc konto o konto organizatora, co tworzy `organizers`, `organizer_users` i zmienia role profilu na `organizer`;
- pokazuje empty state, jesli konto ma role `organizer`, ale nie ma wpisu w `organizer_users`.

`/organizer/events`:

- lista wydarzen organizatora;
- filtrowanie po statusie oraz zakresie dat;
- statusy prezentowane jako: szkic, oczekuje, opublikowane, odrzucone, archiwalne;
- szybkie akcje: edytuj, ukryj, anuluj, duplikuj;
- podglad publiczny dostepny tylko dla wydarzen opublikowanych, publicznych i nieanulowanych;
- przy odrzuconych wydarzeniach pokazuje ostatnia uwage admina z `events.review_note`;
- mini-checklista jakosci wydarzenia.

`/organizer/events/new`:

- dodaje wydarzenie ze statusem `pending_review`;
- przypisuje wydarzenie do organizatora uzytkownika;
- interaktywny picker lokalizacji z mini-mapa, wyszukiwaniem adresow i automatycznym geokodowaniem;
- pozwala wybrac znane miejsce z listy lokalizacji przed wpisywaniem nowej lokalizacji;
- pozwala wgrac obraz wydarzenia do Cloudinary albo podac zewnetrzny link.

`/organizer/events/[id]/edit`:

- edytuje tylko wlasne wydarzenie;
- po edycji opublikowanego wydarzenia ustawia `pending_review`;
- pozwala zmienic obraz wydarzenia przez upload do Cloudinary albo zewnetrzny link;
- pokazuje checkliste jakosci: tytul, data, lokalizacja, opis minimum 300 znakow, zdjecie glowne, kategoria, link do biletow / strony i cena.
- pokazuje historie moderacji z `event_moderation_logs`.

`/organizer/profile`:

- pozwala organizatorowi edytowac istniejace pola profilu: nazwa, slug, typ, opis, telefon, email, WWW, Facebook, Instagram i logo URL;
- informuje, ze zdjecie w tle, TikTok i stale miasto dzialania wymagaja migracji bazy.

`/organizer/stats`:

- pokazuje statystyki wydarzen;
- liczy wyswietlenia i klikniecia z `event_analytics`;
- zapisania liczy z `event_analytics` oraz dodatkowo z `saved_events`.

`/organizer/settings`:

- pozwala zaktualizowac nazwe kontaktowa profilu;
- pokazuje powiazanych organizatorow;
- dla zwyklego konta udostepnia rozszerzenie do konta organizatora.

## Stany techniczne

- Globalne `loading.tsx` i `error.tsx`.
- Strona główna ma fallback dla błędów publicznego pobierania wydarzeń/kategorii z Supabase: renderuje pusty stan i fallbackowe kategorie oraz loguje błąd po stronie serwera.
- Navbar ma fallback dla błędów Supabase Auth/profilu i pokazuje stan niezalogowany zamiast wywracać cały layout.
- Dynamiczne ładowanie map bez SSR.
- JSON-LD dla wydarzenia, strony miasta i kategorii.
- Przykładowe wydarzenia demo można dodać przez `supabase/seed-demo-events.sql`; seed używa slugów `demo-*` i jest idempotentny.

## Niezaimplementowane mimo tabel w bazie

- UI zapisanych wydarzeń z `saved_events`.
- UI preferencji powiadomień z `notification_preferences`.
- Scraper i panel źródeł scrapingu.
- AI extraction pipeline.
- Rejestracja użytkowników.
- Reset hasła.
- Upload obrazów do Supabase Storage.
- Testy automatyczne.
