# Architecture

## Stack

- Next.js 15 z App Router.
- React 19.
- TypeScript w trybie `strict`.
- Supabase JS v2 oraz `@supabase/ssr`.
- MapLibre GL JS dla map.
- Globalny CSS w `app/globals.css`.

Konfiguracja projektu:

- `package.json` definiuje skrypty `dev`, `build`, `start`, `lint`.
- `next.config.ts` ustawia `reactStrictMode: true`.
- `tsconfig.json` definiuje alias `@/*`.

## Podział warstw

### App Router

Route'y w `app/` są server components tam, gdzie pobierają dane z Supabase:

- `app/page.tsx` pobiera dane przez `getHomeData()` i renderuje `HomePage`.
- `app/wydarzenie/[slug]/page.tsx` renderuje szczegóły wydarzenia.
- `app/wydarzenia/[city]/page.tsx` renderuje stronę miasta; dla starego sluga wydarzenia przekierowuje na `/wydarzenie/[slug]`.
- `app/kategoria/[slug]/page.tsx` pobiera kategorię i wydarzenia z tej kategorii.
- `app/admin/**` oraz `app/organizer/**` renderują panele po stronie serwera i korzystają z server actions.
- `app/login/page.tsx` oraz `app/register/page.tsx` obsługują logowanie i rejestrację użytkowników przez email/haslo i Google OAuth.
- `app/auth/callback/route.ts` wymienia kod Google OAuth na sesje Supabase SSR i inicjalizuje profil uzytkownika.
- `app/auth/onboarding/page.tsx` wymusza zgody prawne i wybor roli, gdy pierwsze logowanie Google utworzylo nowego uzytkownika Auth.
- `app/account/page.tsx` jest panelem konta dla uzytkownikow bez roli organizatora; organizatora przekierowuje do `/organizer`.
- `app/organizer/saved/page.tsx` renderuje zapisane wydarzenia wewnatrz panelu organizatora.
- `app/api/account/saved-events/route.ts` zwraca klientowi stan zapisow aktualnej sesji, potrzebny do ikon serca na listach.
- `app/api/events/[id]/analytics/route.ts` zapisuje publiczne zdarzenia analityczne wydarzenia.
- `app/lokalizacja/page.tsx` renderuje stronę geolokalizacji z `lat`, `lng`, `radius` w query params; ma `noindex, nofollow`.
- `app/[category]/[city]/page.tsx` rozpoznaje `city === "lokalizacja"` jako specjalny przypadek geolokalizacji z kategorią.
- `app/[category]/[city]/page.tsx` renderuje kanoniczna strone kategorii w miescie tylko wtedy, gdy istnieje nadchodzace publiczne wydarzenie tej kategorii w tym miescie; puste pary przekierowuja na `/kategoria/lokalizacja?lat=...&lng=...&radius=30`.
- `app/api/events/[id]/analytics/route.ts` zapisuje publiczne zdarzenia analityczne wydarzenia.
- `app/lokalizacja/page.tsx` renderuje stronę geolokalizacji z `lat`, `lng`, `radius` w query params; ma `noindex, nofollow`.
- `app/[category]/[city]/page.tsx` rozpoznaje `city === "lokalizacja"` jako specjalny przypadek geolokalizacji z kategorią.
- `app/[category]/[city]/page.tsx` renderuje kanoniczna strone kategorii w miescie tylko wtedy, gdy istnieje nadchodzace publiczne wydarzenie tej kategorii w tym miescie; puste pary przekierowuja na `/kategoria/lokalizacja?lat=...&lng=...&radius=30`.
- `app/robots.ts` wystawia prawdziwy `/robots.txt` z linkiem do indeksu sitemap i blokada paneli, API oraz stron logowania/rejestracji.
- Legacy route handlery `/wydarzenie/[slug]` i `/wydarzenia/[slug]` przekierowuja istniejace wydarzenia na kanoniczny adres `/{kategoria}/{miasto}/{wydarzenie}`, a dla brakujacych slugow zwracaja HTTP 404 z `X-Robots-Tag: noindex, nofollow`.

Client components odpowiadają za interakcję UI:

- `components/HomePage.tsx` - stan filtrow oraz uklad 70/30: lewa kolumna z wyroznionymi wydarzeniami i lista, prawa kolumna z sidebarem. Widoczne naglowki, linki kontekstowe i tresci pomocnicze sa wyliczane z aktywnej kategorii i lokalizacji, a nie tylko z poczatkowych parametrow route'a.
- `components/MobileMapView.tsx` - mobilny, pelnoekranowy widok mapy dla aktualnie przefiltrowanych wynikow, z licznikiem i kontrolowana mini karta wybranego wydarzenia. `HomePage` utrzymuje wspolny stan trybu `list/map/event` oraz zaznaczonego wydarzenia.
- `components/EventDetailView.tsx` - jawny Client Component uzywany na dynamicznej podstronie szczegolow oraz jako trzeci ekran mobilnego workspace (z propem `embedded`) z obrazem, metadanymi, akcjami, opisem i organizatorem ostatnio otwartego wydarzenia. Dane podstrony nadal pobiera Server Component route'a; granica klienta jest wymagana przez obsluge zapisu, zamykania i mobilnej podmiany podobnych wydarzen. Tryb osadzony pomija breadcrumbsy, JSON-LD oraz mape i pobiera client-side stan zapisania wydarzenia.
- Mobilny workspace zapisuje aktywny widok, ostatnie wydarzenie i URL listy w History API. Kanoniczny URL wydarzenia pojawia sie bez demontowania listy i mapy, a mapa pozostaje zaparkowana pod szczegolami, zachowujac zoom, pozycje oraz zaznaczona pinezke.
- `components/FeaturedEvents.tsx` - karuzela wyróżnionych wydarzeń; nie renderuje mapy.
- `components/Sidebar.tsx` - prawa kolumna strony głównej z pojedynczą mapą MapLibre, CTA powiadomień, nadchodzącymi wydarzeniami i kategoriami.
- `components/MapLibreMap.tsx` - wspólny komponent mapy dla strony głównej, eksploratora i szczegółów; używa GeoJSON source z `cluster: true`, warstw klastrów, warstw pojedynczych pinesek oraz ikon kategorii. Po załadowaniu stylu dokłada kolorowane województwa i ich granice z lokalnego `public/data/wojewodztwa-min.geojson`, wyraźne granice powiatów z wektorowych kafelków OpenMapTiles (`boundary`, `admin_level=6`) oraz numery budynków (`housenumber`). Gdy mapa nie dostaje lokalizacji, kadruje stałe bounds całej Polski.
- `components/LocationPickerMap.tsx` - interaktywny picker lokalizacji z mini-mapą MapLibre, wyszukiwaniem adresów przez Nominatim i przesuwalną pinezką; renderuje ukryte inputy formularza.
- `components/LocationSection.tsx` - wrapper obsługujący przełączanie między wyborem istniejącej lokalizacji a tworzeniem nowej przez LocationPickerMap.
- `components/EventExplorer.tsx` - filtry, lista i mapa dla widoków kategorii/miasta.
- `components/NavbarClient.tsx` - menu, panel użytkownika i formularz wylogowania.
- `components/CookieConsent.tsx` - banner zgody na cookies/analitykę; zapisuje wybór w `localStorage` i ładuje Google Analytics dopiero po zgodzie.
- `components/GoogleOnboardingForm.tsx` - finalizacja nowego konta Google z wyborem roli i wymaganymi zgodami.
- `components/UserProfileForm.tsx` - zmiana nazwy uzytkownika w `profiles.display_name`.
- `components/SavedEventCard.tsx` i `components/EventCardSaveButton.tsx` - lista zapisanych wydarzen i zapis z publicznych kart.
- Komponenty map są ładowane dynamicznie bez SSR.
- `components/CityAutocomplete.tsx` - publiczne autouzupełnianie miejscowości; priorytetowo używa aktywnych miast z tabeli `cities`, a następnie publicznego Photon/OSM z filtrem `countrycode=PL`, warstwami miejscowości i bounding boxem Polski.

### Warstwa danych

Zapytania Supabase są wydzielone poza UI:

- `lib/events.ts` - publiczne odczyty wydarzeń, kategorii i stron miast.
- `lib/auth.ts` - kontekst użytkownika i guardy ról.
- `lib/auth-actions.ts` - logowanie i rejestracja email/haslo, rozpoczecie Google OAuth (wraz z automatyczną konfiguracją organizatora) i wylogowanie.
- `lib/oauth-profile.ts` - inicjalizacja `profiles` oraz opcjonalnego organizatora po callbacku Google OAuth.
- `lib/oauth-state.ts` - ograniczony stan rejestracji przekazywany do callbacku w cookie HttpOnly.
- `lib/user-account.ts` - dane panelu konta, stan zapisow i publiczne pobieranie zapisanych wydarzen.
- `lib/user-account-actions.ts` - aktualizacja nazwy oraz zapis/usuwanie `saved_events` po zweryfikowaniu sesji.
- `lib/admin-events.ts` - dashboard admina, lista wydarzeń, CRUD i zmiana statusu.
- `lib/organizer-events.ts` - dashboard organizatora, lista i zapis wydarzeń organizatora, powiadomienia oraz agregacja statystyk.
- `lib/admin-organizers.ts` - CRUD organizatorów.
- `lib/event-editor.ts` - wspólne typy, statusy i parsowanie formularza wydarzenia.
- `lib/event-editor-server.ts` - budowanie payloadu wydarzenia, tworzenie lokalizacji, zapis źródła i upload obrazu wydarzenia.
- `lib/cloudinary.ts` - signed upload obrazów wydarzeń do Cloudinary po stronie serwera.
- `lib/geocoding.ts` - geokodowanie adresów i reverse geocoding przez Nominatim (OpenStreetMap); używany client-side w LocationPickerMap.
- `lib/filters.ts` - filtrowanie daty, promienia, kategorii i ceny po stronie klienta.
- `lib/slugs.ts` - budowanie slugów i ścieżek.
- `lib/supabase-config.ts` - wspólna konfiguracja publicznego URL i klucza Supabase; normalizuje `NEXT_PUBLIC_SUPABASE_URL` do samego originu.

## Klienci Supabase

`lib/supabase-config.ts` czyta `NEXT_PUBLIC_SUPABASE_URL` oraz `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` albo fallback `NEXT_PUBLIC_SUPABASE_ANON_KEY`. URL Supabase jest normalizowany do originu, aby wartość z przypadkowym pathem typu `/rest/v1` nie psuła zapytań Supabase JS.

`lib/supabase.ts` tworzy klienta publicznego bez sesji:

- używa `NEXT_PUBLIC_SUPABASE_URL`;
- używa `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` albo fallbacku `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- wyłącza `persistSession` i `autoRefreshToken`.

`lib/supabase-user.ts` tworzy klienta SSR z cookies:

- używa `createServerClient` z `@supabase/ssr`;
- czyta i ustawia cookies przez `next/headers`;
- jest używany w ścieżkach wymagających sesji użytkownika.

Globalny middleware nie jest obecnie używany. Ścieżki wymagające sesji korzystają z `createSupabaseUserClient()` bezpośrednio w server components, server actions i route handlers.

## Upload obrazów

Formularze wydarzeń w panelu admina i organizatora przyjmują plik `main_image_file` albo ręczny `main_image_url`. Jeśli użytkownik wybierze plik, `buildEventWritePayload()` wysyła go do Cloudinary przez `uploadEventImageToCloudinary()` i zapisuje zwrócony `secure_url` w `events.main_image_url`.

Upload Cloudinary jest podpisywany po stronie serwera na podstawie `CLOUDINARY_URL` albo zestawu `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` oraz opcjonalnego `CLOUDINARY_EVENT_FOLDER`. Sekret API nie trafia do klienta.

## Wybór lokalizacji

Formularz wydarzenia pozwala wybrać istniejącą lokalizację z dropdown albo utworzyć nową przez interaktywny picker (`LocationPickerMap`).

Picker zawiera pole wyszukiwania adresów z autouzupełnianiem (Nominatim/OSM, ograniczone do Polski), mini-mapę MapLibre z przesuwalną pinezką oraz klikanie na mapę. Po wyborze lokalizacji pola `latitude`, `longitude`, `city`, `address`, `postal_code`, `voivodeship`, `county` i `municipality` są automatycznie wypełniane przez reverse geocoding.

Geokodowanie odbywa się po stronie klienta; API Nominatim nie wymaga klucza, ale respektuje limit 1 req/s (debounce 350ms w kodzie). Użytkownik może ręcznie skorygować wypełnione pola.

## Przepływ danych publicznych

1. `app/page.tsx` wywołuje `getHomeData()`.
2. `getHomeData()` pobiera wydarzenia od początku bieżącego dnia i kategorie.
3. Jeśli publiczne zapytanie Supabase dla strony głównej zwróci błąd, `getHomeData()` loguje błąd i zwraca pusty zestaw wydarzeń oraz fallbackowe kategorie zamiast wywracać Server Component.
4. `HomePage` dostaje dane jako propsy.
5. Filtrowanie po dacie, promieniu, kategorii, darmowe/płatne i sortowanie odbywa się w przeglądarce przez `filterEvents()`.
6. `FeaturedEvents` pokazuje wyróżnione wydarzenia w lewej kolumnie, a `Sidebar` pokazuje mapę dla aktualnie przefiltrowanych wydarzeń.

W widokach `/kategoria/[slug]` i `/wydarzenia/[city]` początkowy zestaw danych też jest pobierany na serwerze, a dalsze filtrowanie robi client component `EventExplorer`.

MapLibre używa stylu wektorowego i po załadowaniu stylu próbuje preferować pola `name:pl`, a potem `name`, `name:latin` i `name:nonlatin` dla warstw etykiet. Dzięki temu etykiety mapy są możliwie polskie bez dodatkowego klucza API.

## Routing i SEO

`app/layout.tsx` definiuje globalne metadane (w tym canonical `/`), Open Graph z domyślnym obrazem `public/og-default.png` oraz metadane Twitter Card. Strony dynamiczne generują specyficzne metadata:

- Szczegóły wydarzenia `/[category]/[city]/[event]` używają dynamicznych tagów Open Graph (m.in. dedykowanego obrazka wydarzenia `imageUrl`) oraz Twitter.
- Adresy URL generowane przez `eventPath()` są w całości konwertowane do małych liter. Strona szczegółów wydarzenia automatycznie przekierowuje za pomocą `redirect` z wariantów URL z wielkimi literami na kanoniczny lowercase.
- `sitemap.xml` (sitemap index) przekazuje znacznik `<lastmod>` z aktualnym czasem dla każdego sub-sitemapa.
- `sitemap-category-cities.xml` korzysta z `listPublicCategoryCityRoutes()` i zawiera tylko realne pary kategoria-miasto z opublikowanych, publicznych i nieanulowanych nadchodzacych wydarzen.
- `sitemap-events.xml`, `sitemap-category-cities.xml` i `sitemap-cities.xml` wystawiaja `lastmod`, gdy aplikacja ma wiarygodna date aktualizacji z bazy.

Strony szczegółów wydarzeń i kolekcji generują JSON-LD:

- `Event` dla szczegółów wydarzenia. Aby spełnić wytyczne Google Search Console, struktura `Event` posiada zdefiniowane fallbacki dla pól `endDate`, `offers.validFrom`, `performer` oraz `organizer.url`.
- `BreadcrumbList` dla podstron wydarzeń, kategorii oraz miast w celu prezentacji poprawnej struktury nawigacji w wynikach wyszukiwania.
- `CollectionPage` dla strony miasta i kategorii.

## Zewnętrzne skrypty

`app/layout.tsx` renderuje `CookieConsent`, a Google Analytics z identyfikatorem `G-60019N4V87` jest ładowane client-side przez `components/CookieConsent.tsx` dopiero po zgodzie użytkownika na analitykę. Odrzucenie zgody zapisuje się w `localStorage` i blokuje ładowanie skryptu GA.

## Stany ładowania i błędu

- `app/loading.tsx` pokazuje globalny stan ładowania wydarzeń.
- `app/error.tsx` pokazuje globalny błąd i przycisk ponowienia.
- `components/Navbar.tsx` łapie błędy Supabase Auth/profilu i renderuje stan niezalogowany; wewnętrzne sygnały Next.js są przepuszczane przez `unstable_rethrow`.
- Dla braku organizatora w panelu organizatora istnieje osobny empty state w `app/organizer/page.tsx`.

## Elementy wymagające potwierdzenia

- Brak testów automatycznych w repozytorium.
- Brak konfiguracji CI/CD.
- Brak konfiguracji Vercel lub innego hostingu w repozytorium.
- Route handlery API obejmuja `/auth/callback`, `/auth/sign-out` oraz `POST /api/events/[id]/analytics`; `/auth/onboarding` jest chroniona sesja strona SSR.
