# Current Features

## Publiczne przeglądanie wydarzeń

Strona główna `/`:

- pobiera wydarzenia z Supabase przez `getHomeData()`;
- pokazuje hero, panel wyszukiwania, sticky filter bar oraz układ 70/30 z lewą kolumną wydarzeń i prawym sidebarem;
- w lewej kolumnie pokazuje wyróżnione wydarzenia nad listą wydarzeń;
- w prawym sidebarze pokazuje jeden spójny panel z mapą MapLibre, powiadomieniami, nadchodzącymi wydarzeniami i popularnymi kategoriami;
- mapa w sidebarze jest osadzona bezpośrednio w dużym panelu, ma wewnętrzny margines, zaokrąglenie i przycisk `Pokaż listę` na mapie;
- mapa grupuje blisko położone wydarzenia w klastry; kliknięcie klastra przybliża widok.
- pojedyncze pineski używają koloru i ikony kategorii wydarzenia.
- etykiety mapy są preferowane w języku polskim, jeśli styl kafelków udostępnia pole `name:pl`.
- filtruje po presetach daty, niestandardowym zakresie dat, promieniu, kategorii i opcji darmowych wydarzeń;
- pozwala wybrać lokalizację z autouzupełniania albo GPS;
- sortuje po odległości albo dacie.
- na widoku mobilnym układa hero i blok informacyjny w pojedynczej, czytelnej kolumnie.
- na małych ekranach ogranicza szerokość sekcji strony głównej do viewportu, aby nagłówki, listy, panele i mapa nie były ucinane poziomo; polecane wydarzenia zachowują kompaktową siatkę dwóch kolumn.

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

Szczegóły pokazują:

- duzy pojedynczy obraz wydarzenia bez galerii;
- kategorię;
- tytuł;
- organizatora;
- opis;
- datę;
- lokalizację;
- cenę;
- mapę;
- link Google Maps, jeśli `locations.google_maps_url` istnieje;
- sekcję źródeł, jeśli wydarzenie ma `event_sources`.

- przyciski `Udostepnij` i `Zapisz`; zapis dziala lokalnie w przegladarce;
- mapa jest wyswietlana jako blok obok opisu wydarzenia;
- podobne wydarzenia z tej samej kategorii, jesli publiczne zapytanie je zwroci.

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
- wspolny pasek nawigacji admina z przejsciem do `Wydarzenia` i `Organizatorzy`;
- linki do wydarzeń i organizatorów.

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
