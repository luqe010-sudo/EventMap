# Current Features

Aktualizacja wyszukiwania: panel wyszukiwania zapisuje w URL filtry `Kiedy?`, `Cena` oraz `radius`. Cena obsluguje tryby `Za darmo`, `Bez limitu` i limit maksymalny ustawiany suwakiem lub polem kwoty, np. `?kiedy=weekend&cena=max&cenaMax=80`. Promien mozna ustawic suwakiem albo recznie w polu km. Zmiany filtrow aktualizuja pasek adresu przez `history.replaceState()` bez przeladowania, a dopiero przycisk `Znajdz` wykonuje nawigacje/przeladowanie pod aktualny URL.

## Publiczne przeglądanie wydarzeń

Strona główna `/`:

- pobiera wydarzenia z Supabase przez `getHomeData()`;
- używa publicznej nazwy i domeny `MapaImprez.pl` w logo, metadanych i publicznych URL-ach;
- pokazuje hero, panel wyszukiwania oraz układ 70/30 z lewą kolumną wydarzeń i prawym sidebarem;
- w lewej kolumnie pokazuje wyróżnione wydarzenia nad listą wydarzeń;
- w prawym sidebarze pokazuje jeden spójny panel z mapą MapLibre, powiadomieniami, nadchodzącymi wydarzeniami i popularnymi kategoriami;
- wydarzenia w sekcji `Nadchodzące wydarzenia` linkują do swoich stron szczegółowych, a odnośnik `Zobacz kalendarz wydarzeń` przewija bieżącą stronę do pełnej listy;
- mapa w sidebarze ładuje się automatycznie dopiero po zbliżeniu panelu mapy do viewportu oraz po krótkim idle/delay, żeby pierwsze ładowanie strony nie pobierało od razu MapLibre, pinesek i kafelków mapowych; przycisk w placeholderze pozwala przyspieszyć ładowanie ręcznie;
- mapa w sidebarze po załadowaniu jest osadzona bezpośrednio w dużym panelu, ma wewnętrzny margines i zaokrąglenie;
- mapa na starcie używa zasięgu `Cała Polska`, obejmuje kadrem całą Polskę i pokazuje wydarzenia bez ograniczenia promieniem;
- mapa grupuje blisko położone wydarzenia w klastry; klastry mają ograniczony promień i rozbijają się na pojedyncze pineski przy średnim przybliżeniu, a kliknięcie klastra przybliża widok.
- pojedyncze pineski i klastry są kompaktowe, używają koloru oraz ikon kategorii wydarzeń i mają wyraźną przezroczystość; zaznaczona pinezka pozostaje mocniejsza, a wydarzenia z tymi samymi współrzędnymi są lekko rozsuwane wizualnie, żeby nie nachodziły idealnie na siebie.
- popup pojedynczej pineski pokazuje zdjęcie wydarzenia, klikalny tytuł prowadzący do szczegółów, adres i krótki opis.
- podstrony zakończonych, nadal opublikowanych wydarzeń pozostają dostępne i indeksowalne; zdjęcie jest wyszarzone, a komunikat kieruje do przyszłych podobnych wydarzeń. Nieaktualny link do biletów jest na takim widoku ukryty.
- opisy wydarzeń zachowują pojedyncze przejścia do nowej linii oraz akapity oddzielone pustym wierszem, bez interpretowania treści jako HTML.
- mapa pokazuje subtelnie kolorowane województwa o zróżnicowanej palecie, granice powiatów widoczne już od niższego poziomu przybliżenia na bazie warstwy `boundary` oraz numery budynków przy dużym przybliżeniu.
- etykiety mapy są preferowane w języku polskim, jeśli styl kafelków udostępnia pole `name:pl`; nazwy dużych, średnich i małych miejscowości pojawiają się wcześniej niż w stylu bazowym i są renderowane pod pinezkami wydarzeń.
- filtruje po presetach daty, niestandardowym zakresie dat, promieniu albo zasięgu `Cała Polska`, kategorii i opcji darmowych wydarzeń;
- pozwala wybrać lokalizację z autouzupełniania albo GPS;
- domyślnie sortuje wydarzenia według daty, z możliwością przełączenia na sortowanie po odległości.
- na widoku mobilnym zachowuje estetyczne marginesy od krawędzi (18px), a kafelki klimatu w sekcji hero układają się w układ trójkolumnowy o zmniejszonych wymiarach;
- panel wyszukiwania posiada przycisk "Znajdź" z ikoną lupy umieszczony inline jako piąta kolumna w rzędzie filtrów na desktopie, na mobilnych zajmuje pełną szerokość; kliknięcie "Znajdź" buduje URL z wybranych filtrów (kategoria, miasto/lokalizacja) i nawiguje do odpowiedniej podstrony (np. `/koncerty/wroclaw` lub `/lokalizacja?lat=...&lng=...&radius=...`);
- panel wyszukiwania (SearchPanel) jest widoczny na wszystkich stronach; ma kompaktowy, jednorzędowy układ bez obramowań wokół sekcji — 5 kolumn na desktopie (Lokalizacja | Promień | Kiedy? | Cena | Znajdź), 2 kolumny na tablecie, 1 kolumna na mobile; na podstronach data filtruje dynamicznie, a zmiana kategorii lub miasta nawiguje dopiero po kliknięciu "Znajdź";
- panel wyszukiwania posiada pasek „Aktywne filtry" u dołu, pokazujący aktywne filtry (lokalizacja, promień, data, cena, kategoria) jako chipy z przyciskami usuwania poszczególnych filtrów oraz przyciskiem „Wyczyść wszystko" resetującym wszystkie filtry naraz; gdy brak aktywnych filtrów, wyświetla „Brak aktywnych filtrów";
- tło strony używa pełnego `background.png` na większych ekranach oraz lekkiego `background-mobile.webp` na mobile, żeby zachować efekt wizualny bez ponownego obciążania pierwszego ładowania.
- stan ładowania strony głównej używa skeletonu o stabilnej wysokości zbliżonej do finalnego układu, żeby ograniczać przesunięcia layoutu podczas streamingu danych.

- autouzupelnianie lokalizacji najpierw dopasowuje aktywne miasta z tabeli `cities`, a potem scala je z wynikami Photon/OSM, czyli providera search-as-you-type dla miejsc; dzieki temu czesciowe wpisy typu `Srebrna Go`, `Stoszow` albo `Budzow` moga zwracac trafniejsze miejscowosci.
- autouzupelnianie lokalizacji wyswietla doprecyzowane etykiety z wojewodztwem, ale po wyborze zachowuje kanoniczny slug miasta (np. `Wroclaw (woj. dolnoslaskie)` nawiguje jak `wroclaw`).
- zewnetrzne wyniki miejscowosci bez aktywnej strony miasta przechodza do widoku geolokalizacji po wspolrzednych zamiast zgadywac slug dla niejednoznacznych nazw.
- teksty lokalne uzywaja bezpiecznej odmiany dla nazw konczacych sie na `Gora`, np. `Srebrna Gora` jest prezentowana jako `w Srebrnej Gorze`.
- `/regulamin` pokazuje publiczny regulamin serwisu, polityke prywatnosci / RODO oraz polityke cookies; link do strony jest dostepny w navbarze, stopce i glownym sitemap.
- Przy pierwszej wizycie aplikacja pokazuje banner cookies z wyborem `Akceptuje` albo `Odrzuc analityke`; Google Analytics laduje sie dopiero po zgodzie, a wybor mozna zmienic przyciskiem `Cookies`.

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
- przycisk „Zapisz" z ikoną serca; dla zalogowanego użytkownika zapis trafia do `saved_events`, a niezalogowany jest kierowany do logowania z powrotem na wydarzenie;
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
- Adresy `/kategoria/miasto` są utrzymywane tylko dla par, które mają nadchodzące publiczne, opublikowane i nieanulowane wydarzenie. Jeżeli para kategorii i miasta nie ma takiego wydarzenia, serwer przekierowuje na noindexowy wariant `/kategoria/lokalizacja?lat=...&lng=...&radius=30`.
- `sitemap-category-cities.xml` nie tworzy już iloczynu wszystkich kategorii i aktywnych miast; korzysta z realnych par kategorii i miast wynikających z publicznych wydarzeń.
- `/robots.txt` wskazuje `sitemap.xml` i blokuje indeksowanie paneli, API oraz stron logowania/rejestracji.
- Plik indeksu sitemapy `sitemap.xml` zawiera znacznik `<lastmod>` dla każdego z sub-sitemapów, aby wskazać Google kiedy uległy one zmianie.
- Adresy URL generowane przez `eventPath()` są zawsze sprowadzane do małych liter (`.toLowerCase()`). Dynamiczna strona szczegółów wydarzenia ma wbudowany redirect (HTTP 307) ze ścieżek z wielkimi literami na ich kanoniczny odpowiednik z małymi literami, co eliminuje problem duplikatów URL-i.
- Strona główna posiada kanoniczny link `/` w głównym layoucie, aby zabezpieczyć ją przed powstawaniem duplikatów z parametrami UTM lub parametrami wyszukiwania.
- Zaimplementowano skrypty strukturyzowanych danych `BreadcrumbList` w formacie JSON-LD dla stron wydarzenia, kategorii oraz miast, aby ułatwić wyszukiwarce prezentację ścieżki w wynikach wyszukiwania.
- Uporządkowane dane wydarzenia (`Event` JSON-LD) zostały uzupełnione pod kątem wymogów Google Search Console: dodano automatyczny fallback dla `endDate` (start + 2h), pole `validFrom` dla oferty `Offer` (na bazie daty aktualizacji lub startu - 30 dni), pole `performer` z nazwą organizatora oraz bezwzględny adres URL dla obiektu `organizer` (fallback na domenę główną).
- Panele `/admin/**`, `/organizer/**`, `/account`, `/auth/onboarding`, `/login` i `/register` maja metadane `noindex, nofollow`.
- Favicon jest publikowany jawnie jako wersjonowany `/icon.svg` z logo MapaImprez; legacy `/favicon.ico` przekierowuje trwale (308) do aktualnej ikony, aby wyszukiwarki odswiezyly stary znak.
- Stare adresy `/wydarzenie/[slug]` i `/wydarzenia/[slug]` przekierowuja istniejace wydarzenia na kanoniczne URL-e szczegolow albo zwracaja HTTP 404 dla brakujacych slugow.
- Sitemapy wydarzen, miast oraz par kategoria-miasto zawieraja `lastmod`, gdy data aktualizacji jest dostepna w bazie.

## Fallback dla nieistniejących miast

Gdy użytkownik wywoła adres URL z miastem, które nie istnieje w bazie danych ani jako znane miasto (np. `/koncerty/budzow-woj-dolnoslaskie` lub `/budzow-woj-dolnoslaskie`):
- Serwer automatycznie próbuje zgeokodować slug (podmieniając myślniki na spacje) za pomocą API Nominatim (OpenStreetMap).
- Jeśli API zwróci współrzędne geograficzne, serwer wykonuje przekierowanie tymczasowe (HTTP 307) na stronę geolokalizacji z odpowiednimi parametrami `lat`/`lng` oraz promieniem 30 km (np. `/koncerty/lokalizacja?lat=50.589&lng=16.812&radius=30` lub `/lokalizacja?lat=50.589&lng=16.812&radius=30`).
- Jeśli geokodowanie nie powiedzie się (np. dla losowego ciągu znaków), serwer zwraca standardowy błąd 404 (NotFound).
- Taki mechanizm chroni przed błędami 404 dla mniejszych miejscowości wpisanych w wyszukiwarkę i jednocześnie zapobiega indeksowaniu niepotrzebnych dynamicznych podstron (ponieważ strona docelowa posiada tag `noindex`).

## Login, rejestracja i sesja

- `/login` obsluguje bledy Supabase Auth w formularzu, bez wywolywania 500 w Server Components.
- `/login` ma logowanie Google OAuth, formularz email/hasło i link do rejestracji.
- `/register` obsluguje rejestracje przez Google OAuth oraz email/haslo, z wyborem roli: Widz (rola `user`) lub Organizator (rola `organizer`), wymaganym checkboxem akceptacji regulaminu oraz osobnym potwierdzeniem zapoznania sie z polityka prywatnosci / RODO i polityka cookies. Dla organizatorów automatycznie tworzy profil organizacyjny (`organizers` i `organizer_users`).
- Callback `/auth/callback` wymienia kod Google na sesje SSR i wykrywa, gdy pierwsze "logowanie" Google w rzeczywistosci utworzylo konto Auth.
- Nowe konto rozpoczęte z `/login` trafia obowiązkowo na `/auth/onboarding`, gdzie użytkownik akceptuje dokumenty i wybiera rolę przed utworzeniem/uzupełnieniem profilu aplikacyjnego.
- Przepływ Google nie pozwala nadać roli `admin`; dla roli organizatora tworzy wymagane `organizers` i `organizer_users`.
- `signInAction()`, `signInWithGoogleAction()` oraz `signUpAction()` używają Supabase Auth.
- `/account` jest panelem konta Widza: pozwala ustawić `profiles.display_name` oraz wyświetlać i usuwać zapisane wydarzenia; organizatora przekierowuje do `/organizer`.
- Organizator edytuje nazwę użytkownika w `/organizer/settings`, a zapisane wydarzenia przegląda w osobnej zakładce `/organizer/saved` swojego panelu.
- Ikony serca na kartach wydarzeń i przycisk na szczegółach zapisują stan w `saved_events`; lista konta pokazuje tylko wydarzenia nadal opublikowane, publiczne i nieanulowane.
- Wylogowanie idzie przez `POST /auth/sign-out`.
- Navbar posiada nowoczesny wygląd zintegrowany z portalem (efekt glassmorphism/rozmycia tła) i dynamicznym menu profilu dla zalogowanego użytkownika (wygodny dropdown z inicjałem, nazwą, adresem email, rolą, linkiem do panelu zarządzania oraz wylogowaniem).
- Menu nawigacji jest dostosowane do urządzeń mobilnych (poniżej 1024px) – chowa się automatycznie i wysuwa za pomocą estetycznego przycisku hamburgera zmieniającego się w znak zamknięcia (X), blokując przewijanie strony pod spodem.
- Navbar pokazuje „Moje konto i zapisane” kontom bez roli organizatora; organizator widzi jeden link do panelu organizatora.
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
- interaktywny picker lokalizacji z mini-mapa MapLibre, wyszukiwarka zapisanych miejsc, autocomplete miasta ograniczonym do Polski oraz autocomplete pola `Ulica i numer` ograniczonym do wybranego miasta; mini-mapa uzywa tych samych warstw administracyjnych i numerow budynkow co mapa publiczna; wybor podpowiedzi albo przesuniecie pinezki wypelnia wspolrzedne i dane administracyjne;
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

- formularz lokalizacji z mini-mapa MapLibre, warstwami wojewodztw/powiatow, numerami budynkow, autocomplete miasta, autocomplete pola `Ulica i numer` zaleznym od miasta i przesuwalna pinezka;
- pola: nazwa miejsca, ulica i numer, miasto, kod pocztowy, gmina, powiat, wojewodztwo, Google Maps URL i Place ID.

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
- interaktywny picker lokalizacji z mini-mapa, warstwami wojewodztw/powiatow, numerami budynkow, wyszukiwarka zapisanych miejsc, autocomplete miasta oraz autocomplete pola `Ulica i numer` zaleznym od wybranego miasta;
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

`/organizer/saved`:

- pokazuje zapisane wydarzenia organizatora wewnątrz jego panelu;
- używa tej samej bezpiecznej warstwy `saved_events`, ale nie dubluje panelu `/account`.

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

- UI preferencji powiadomień z `notification_preferences`.
- Scraper i panel źródeł scrapingu.
- AI extraction pipeline.
- Reset hasła.
- Upload obrazów do Supabase Storage.
- Testy automatyczne.

## Ostatnie aktualizacje UI

- Na urzadzeniach mobilnych publiczne listy wydarzen maja staly, pelnoszeroki dolny przelacznik `Lista | Mapa` z ikonami Lucide i animowanym wskaznikiem aktywnego widoku. Widok mapy korzysta z filtrow ustawionych na liscie, obsluguje gesty poziome palcem, rysikiem i mysza, a przycisk `Pokaz na mapie` na karcie centruje wybrane wydarzenie i otwiera jego mini karte.
- Mobilny widok mapy nie duplikuje panelu filtrow. Klikniecie pinezki pokazuje kontrolowana mini karte wydarzenia z krotkim opisem, a powrot do listy zachowuje poprzednia pozycje przewijania.
- Lista publiczna wydarzen pokazuje poczatkowo 20 kart, a przycisk `Pokaz wiecej wydarzen` doladowuje kolejne porcje po 20 wynikow i znika po wyswietleniu calej przefiltrowanej listy.
- Publiczne formatowanie dat traktuje wartosci wydarzen bez jawnej strefy jako czas lokalny `Europe/Warsaw`, zeby nie pokazywac godziny przesunietej o offset serwera.
- Formularz admina wydarzen pozwala ustawic flage `is_featured` przez checkbox `Promowane`.
- Strona glowna dociaga promowane wydarzenia osobnym zapytaniem i pokazuje je w sekcji `Polecane wydarzenia` bez ograniczenia do najblizszego tygodnia.
- Tabele panelu admina dla wydarzen, kolejki review, organizatorow, lokalizacji, kategorii i miast SEO maja filtry, wyszukiwarke oraz sortowanie po kluczowych polach rekordow.
- Generowanie slugow transliteruje polskie znaki, np. `Łódź` -> `lodz`, `Wrocław` -> `wroclaw`, zamiast zamieniac je na myslniki.
