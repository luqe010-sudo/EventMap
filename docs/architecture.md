# Architecture

## Dziesiąty pakiet aplikacji — 2026-10-08

`lib/public-workspace-history.ts` odtwarza stan filtrów z adresu historii przy użyciu wspólnych parserów publicznych tras. HomePage aktualizuje także stan listy/mapy i unieważnia nieaktualne żądania szczegółów. `lib/organizer-event-filters.ts` wyznacza warszawskie granice dni; zapytanie organizatora używa `gte` początku i `lt` początku kolejnego dnia.

Formularze organizatora korzystają z kontrolowanych pól, `useActionState`, walidacji w `lib/organizer-form-validation.ts` i bezpiecznych stanów z `lib/organizer-form-actions.ts`. Właściwe writery nadal wymagają sesji/roli/członkostwa. Profil, ustawienia konta, ukrycie i anulowanie potwierdzają zwrócony identyfikator; formularz lub previous state nie przyznaje uprawnień.

`lib/auth-sign-out.ts` sprawdza wynik SDK zamiast utożsamiać wywołanie z wylogowaniem. `/auth/sign-out-failed` udostępnia ponowienie bez deklarowania usunięcia sesji. Odrzucony callback recovery korzysta z tego samego sprawdzenia. Nie wprowadzono ręcznego protokołu usuwania cookies Supabase.

Kompletność zapisanych wydarzeń jest kontrolowana podczas stronicowania RPC i porcjowanego pobierania publicznych rekordów; filtry published/public/nieanulowane pozostają obowiązkowe. Odczyty REST nie stanowią wspólnej transakcyjnej migawki. Baza, typy i konfiguracja Supabase pozostają bez zmian w tym pakiecie. [Weryfikacja i ograniczenia](repair-package-10-2026-10-08.md).

## Wdrożone RLS lokalizacji/analityki — 2026-10-06

Po zatwierdzeniu użytkownika usunięto broad INSERT lokalizacji; zapis wymaga admina albo profilu organizer wraz z własnym membership. Analityka wymaga publicznej publikacji, nieanulowania i null/własnego UID. Testy SQL na rzeczywistej bazie przeszły z pełnym ROLLBACK; katalog potwierdził tylko trzy zmiany policies, a wygenerowane typy są identyczne. [Raport i punkt wycofania](supabase-rls-hardening-release-2026-10-06.md). Kod/konfiguracja frontendu bez zmian. Pozostałe trzy problemy edycji, A04 i ochrona pomiaru między instancjami nadal otwarte; stwierdzenia niżej o niewykonanym SQL opisują poprzedni etap.

## Potwierdzone RLS — 2026-10-06

Po zgodzie użytkownika odebrano transakcyjne próby SQL na istniejącym EventMap: chronione role, izolacja pojedynczego organizatora i prywatność RPC zapisów działają, ale potwierdzono cztery luki bezpieczeństwa i błąd edycji profilu organizatora. Pełny ROLLBACK usunął fixture; dziewięć katalogów schematu/grantów pozostało identycznych. [Raport](supabase-rls-tests-2026-10-06.md) zawiera osobną propozycję RLS lokalizacji/analityki, rollback i niewykonane testy po poprawce. Policies nie zmieniono. Próby claims/SET ROLE nie zaliczają rzeczywistych JWT/Auth/SMTP ani A04. Lokalny runtime pozostaje opcją dalszych prób, nie warunkiem już wykonanego pakietu.

## Stan produkcji — 2026-10-06

Pakiety ósmy i dziewiąty są na produkcji w Vercel `event-map`, Node 24.x/Next 15.5.18, deployment `dpl_Dh4QrPip3RxwCg843Zk14NCKb5T1`. Publiczne dane są dynamiczne/no-store, analityka wymaga wspólnej zgody, a listy/statystyki obsługują pełne odczyty i jawne błędy. Schemat/RLS/Auth Supabase nie zostały zmienione tym wdrożeniem; ograniczenia poniżej nadal obowiązują. [Odbiór i rollback](production-release-packages-8-9-2026-10-06.md). CI GitHub i staging pozostają nieodebrane.

Plan Supabase Free potwierdził użytkownik; dwa aktywne projekty wykorzystują limit. Przygotowano [odizolowany lokalny staging](local-staging-preflight.md): PG17/Auth/PostgREST/Mailpit i osobny frontend 3001. [Config](local-staging-config.toml) ma wyłączone automatyczne migracje/seed; tylko pliki w `scratch/local-staging`, bez zdalnego linku. CLI wczytuje konfigurację, lecz brak Docker/Podman i ograniczona pamięć nie pozwalają jeszcze zaliczyć startu ani Auth/RLS. Produkcyjny frontend i `.env.local` zachowano.

## Dziewiąty pakiet — pomiar i pełne listy, 2026-10-06

`lib/analytics-consent.ts` wiąże Google Analytics i własne interakcje z jednym wyborem. Brak/odrzucenie zgody blokuje tracker; zmiana w innej karcie dotyczy localStorage, a nieudane utrwalenie odmowy nadal zatrzymuje pomiar w bieżącej karcie. Nowe interakcje nie używają konta/Auth cookies. `lib/event-analytics.ts` waliduje ograniczony strumień JSON i publiczną publikację. `lib/analytics-ingestion-guard.ts` ogranicza jedną warm instancję i rezerwuje powtórzenia przed INSERT. Kontrakt, źródła i pozostające ograniczenia RLS/rozproszenia: [pomiar](event-analytics.md).

`lib/organizer-statistics.ts` oddziela historyczne interakcje od bieżących zapisów. Pełne stabilne odczyty z exact count obsługują odpowiedzi mniejsze od 500; analityka ma cutoff początku odczytu, paczki 100 event ID i jawny limit 200 000. Bieżące zapisy używają exact HEAD per event (concurrency 8) i uzgodnienia sum, bez prywatnych ID użytkowników. Awaria/niepełność daje nullable miary i osobne statusy zbiorów. Dashboard używa miesiąca Warsaw; REST nie zapewnia wspólnej migawki transakcyjnej.

Admin list/review zwracają `AdminEventListPage`, po 50 rekordów. Daty/status/promowane są filtrowane w bazie; daty używają północy Europe/Warsaw i wyłącznej górnej granicy następnego dnia. Zwykłe strony używają exact count/order/range z tie-break ID i offsetem o rzeczywistą długość odpowiedzi. Polskie wyszukiwanie tekstu/sortowanie nazw relacji korzysta z pełnej lekkiej puli po filtrach SQL, do 50 000 rekordów. Nadmiar, powtórzone ID, brak postępu lub zmieniona liczność daje błąd, nie ucięte wyniki. %/_/przecinki są literalne; review zawsze draft/pending_review. Rola sprawdzana przed odczytem, a UI nie połyka Next Auth redirect.

Dodano scripts typecheck/check oraz [CI](ci.md): dokładna instalacja locka, Node 24, SHA-pinned oficjalne actions i dummy config. Guard blokuje rzeczywistą sieć podczas kontroli aplikacji. Workflow nie uruchomiony na GitHub. Pakiet nie zmienia schematu, zależności ani konfiguracji zdalnej.


## Częściowy zapis i publiczny cache — ósmy pakiet, 2026-10-06

`lib/event-save-feedback.ts` odróżnia potwierdzony zapis wydarzenia z niepełnymi followupami od nieznanego wyniku INSERT/UPDATE. Tworzenie wyznacza ID przed żądaniem, więc po timeout można sprawdzić konkretny cel. Stan `saveIssue` jest wyłącznie informacją UI; actions nie używają previous state jako dowodu dostępu ani polecenia pominięcia mutacji. Formularz zachowuje wartości/pliki, umożliwia skopiowanie tekstu, otwiera edytor/listę w nowych kartach i blokuje ślepe ponowienie. Niepotwierdzony wynik może być świadomie ponowiony po sprawdzeniu braku zapisu; nowa próba ponownie sprawdza wszystkie guardy. Potwierdzonego częściowego create nie wolno ponawiać w tym formularzu.

Po potwierdzonym wydarzeniu `completeEventWrite()` próbuje wszystkie niezależne followupy. Źródło nie blokuje moderacji. Błąd końcowy nie udaje rollbacku ani pełnego sukcesu; duplikacja i szybka decyzja mają stałe alerty z `EventSaveNotice`, a query flag nie daje żadnego dostępu. Pierwsze źródło ma tę samą kolejność `created_at, id` przy odczycie i zapisie; writer potwierdza zmieniony wiersz i filtruje event ID.

`lib/public-event-cache.ts` współdzieli no-store headers i rewalidację publicznych tras. Publiczny SSR, API, aliasy i sitemap są `force-dynamic`; nie korzystają z ISR/SWR. Actions odświeżają publiczne template'y i scoped layout tags handlerów, bez invalidacji globalnego layoutu/Auth, także po nieznanym wyniku (COMMIT mógł nastąpić) i przed zawodnymi followupami. Nowe żądanie odczytuje aktualną publikację; dane już załadowane w HomePage wymagają odświeżenia. To poprawia wycofywanie wydarzeń kosztem większego ruchu do Supabase; nie jest pomiarem kosztu/wydajności ani gwarancją propagacji otwartych sesji.

Baza nadal ma wieloetapowy zapis. Pełne A04 i ochrona przed konfliktami wymagają osobnego [projektu RPC](event-write-transaction-proposal.md), jego zatwierdzonego SQL oraz odbioru Auth/RLS. Audyt katalogu z 2026-10-06 był wyłącznie odczytem; schemat, typy i polityki nie zostały zmienione przez ten pakiet.

## Hosting produkcyjny — 2026-10-06

Aplikacja korzysta z istniejącego projektu Vercel `event-map` (Node.js 24.x), obsługującego `https://mapaimprez.pl` oraz `https://www.mapaimprez.pl`. `NEXT_PUBLIC_SITE_URL=https://mapaimprez.pl` jest ustawione w środowisku Production. Publikacja przez CLI przesyła źródła i wykonuje build na Vercel; lokalny `.next`, `.env*`, importery, dane scrapingu, konfiguracja Supabase CLI i diagnostyka są wykluczone przez `.vercelignore`. Gotowy deployment z Production można sprawdzić przed przełączeniem domen przez `--skip-domain`, a następnie promować. Baza i konfiguracja Auth pozostają osobnym systemem; raport wdrożenia znajduje się w [deployment](deployment.md).

## Odzyskiwanie hasła i wiarygodny stan konta — 2026-10-06

`lib/auth-password-actions.ts` zawiera żądanie wiadomości (`resetPasswordForEmail`) i zapis nowego hasła (`updateUser`). `lib/auth-origin.ts` jest wspólnym źródłem originu dla odzyskiwania oraz Google OAuth: produkcja wymaga poprawnego `NEXT_PUBLIC_SITE_URL`, a development może korzystać z nagłówków żądania. `safeNextPath` ogranicza cel powrotu do lokalnej ścieżki. Formularz `/forgot-password` nie ujawnia istnienia konta; sam komunikat sukcesu nie potwierdza dostarczenia wiadomości.

`app/auth/recovery/route.ts` weryfikuje `code` PKCE z `redirectType === "recovery"` albo `token_hash` z `type=recovery` przez `verifyOtp`. Po `getUser()` ustawia dziesięciominutowy marker HttpOnly, związany z ID konta i ważny w `/auth`. `lib/password-recovery.ts` opisuje jego termin ważności, opcje cookie i walidację hasła. Strona `/auth/reset-password` oraz akcja zapisu ponownie wymagają prawidłowej sesji i markera. Po zmianie hasła marker jest usuwany, lokalna sesja odzyskiwania jest zamykana, a login otrzymuje `reset=success` i bezpieczny `next`. Callback nie jest cache'owany i nie przekazuje referrera; ekrany odzyskiwania są dynamiczne i wyłączone z indeksowania. [Auth](auth.md) opisuje obie ścieżki i konfigurację szablonu.

`SavedEventCard` obsługuje usuwanie przez wynik akcji: pending blokuje powtórzenie, błąd zachowuje kartę i pokazuje alert, wygasła sesja wraca przez login do bieżącej listy. Broadcast `eventmap:saved-event` następuje dopiero po potwierdzonym usunięciu. `GET /api/account/navbar` loguje błędy Auth/profilu i zwraca anonimowy stan z prywatnym `no-store`; publiczny layout nie zależy od powodzenia odczytu sesji.

Publiczna etykieta weryfikacji w `EventDetailView` oraz panele organizatora używają `organizers.is_verified`. `events.is_verified` jest odrębnym polem danych i nie decyduje o etykiecie „Zweryfikowany organizator”. Nie zmieniano schematu. W ramach publikacji dodano produkcyjny origin w Vercel i wymagany callback recovery w Supabase; prawdziwy e-mail, SMTP i sesje staging nie zostały odebrane.

## Walidacja edytora i zachowanie metadanych wydarzenia — 2026-10-06

`lib/event-editor-validation.ts` dostarcza wspólny stan formularza i błędy pól. Sprawdza wymagane pola, długości, daty i ich kolejność w `Europe/Warsaw`, ceny, walutę, parę współrzędnych, URL HTTP/HTTPS bez danych logowania oraz typ i limit pliku. `buildEventWritePayload` wykonuje pełną walidację przed uploadem i zapisami lokalizacji. `EventEditorForm` używa `useActionState`, opisów błędów przy polach i pending; jawnie wysyła `FormData` ze wskazaniem submittera, zachowując niekontrolowane inputy, wybrany plik i picker lokalizacji po walidacji lub awarii przygotowania.

Builder ma rozdzielony tryb create/update. Utworzenie przypisuje dozwolonego organizatora i autora oraz początkową publiczną widoczność; update korzysta z istniejącej `visibility`, `submitted_by_organizer_id` i `published_at`. Helper daty publikacji ustawia datę pierwszej publikacji, gdy jej brakuje, i zachowuje już istniejącą również po zmianie statusu. Organizator nie może podmienić w formularzu organizatora, zgłaszającego ani administracyjnego statusu; aktualizacja jest związana z wcześniej odczytanym wydarzeniem i sprawdzonym członkostwem.

Jawne `intent=resubmit` jest dostępne tylko dla własnego `rejected` z `is_cancelled !== true`. Przenosi do `pending_review`; zwykły zapis odrzuconego wydarzenia zachowuje `rejected`. Edycja `published` nadal cofa do `pending_review` bez zerowania pierwszej daty publikacji. Guardy kodu nie zastępują kontroli bezpośrednich uprawnień REST/RLS.

Zapis `events`, źródła, logu moderacji i powiadomienia pozostaje wieloetapowy. Ósmy pakiet pokazuje częściowy wynik, zachowuje formularz, próbuje niezależną moderację i odświeża cache. Nie zapewnia atomowości; pełny A04 nadal wymaga osobnego SQL i odbioru.

## Wspólny model wyszukiwania — szósty pakiet, 2026-10-05

`lib/public-search-params.ts` interpretuje filtry dla `/api/events/search`, `/api/events/markers` i `/api/events/category-counts`. `citySlug` bez `radius` ogranicza wyniki przez `locations.city_id`; z `radius` centrum miasta służy do wyszukiwania okolicy, bez dodatkowej restrykcji miasta. Punkt `lat/lng` domyślnie używa 30 km. Niepoprawny punkt jest odrzucany. Centrum kanonicznego miasta pochodzi z `cities`; brak danych nie jest zastępowany arbitralnym punktem z żądania.

`lib/events.ts` najpierw zbiera lekkie rekordy po filtrach SQL i, dla promienia, prostokątnym prefiltrze współrzędnych. Pobieranie używa dokładnego count, stabilnej kolejności `start_at/id` i paczek do 1000, przesuwając offset o faktyczną liczbę otrzymanych wierszy także przy niższym `max_rows` Supabase. `lib/event-search.ts` liczy dokładną odległość i sortowanie. Pełna pula jest filtrowana i sortowana przed wyborem strony i limitu 300 kart; dopiero identyfikatory wybranej strony pobierają pełną treść. Remisy odległości rozstrzyga data i ID. Brak punktu wydarzenia oznacza nieskończoną odległość, a w trybie miejskim taki rekord nadal może znaleźć się na liście.

Limit puli po filtrach SQL wynosi 50 000 kandydatów; limit mapy 10 000 rekordów z poprawnymi współrzędnymi. Przekroczenie, niepełne pobranie albo wykryta zmiana katalogu powoduje błąd, zamiast cichego przycięcia. Odczyty kolejnych paczek nie tworzą wspólnego snapshotu transakcyjnego; kontrola count/ID i pól wybranej strony wykrywa obserwowane rozbieżności. Wzrost katalogu wymaga dalszej oceny kosztu wielokrotnego zbierania puli i ewentualnego osobno uzgodnionego wyszukiwania w bazie.

Współrzędne w typach publicznych mogą być `null`; `hasLocationCoordinates` sprawdza kompletność, skończoność i zakres. Miasto bez centrum działa przez ID, a `normalizeCitySearchFilters` usuwa niedostępny promień i sortuje według daty. UI wyłącza wtedy okolicę i odległość. Lista, mapowe punkty i liczniki mają wspólny kontekst filtrów; punkty pomijają brak współrzędnych, liczniki kategorii liczą dopasowania z całej puli. `HomePage` ma niezależne ładowanie/błąd/ponowienie kategorii i identyfikatory chroniące przed spóźnionymi odpowiedziami. Licznik „na mapie” opisuje rzeczywiste punkty.

Publiczne route'y używają `searchParams` do pierwszego zapytania SSR i `appendPublicFilters`/`buildSearchUrl` do przekierowań z zachowanymi dozwolonymi filtrami. Brak centrum nie tworzy fikcyjnej geolokalizacji. `redirect` po geokodowaniu znajduje się poza blokiem obsługi błędu usługi; sygnał nawigacji Next.js nie zostaje połknięty.

`components/useMobileWorkspaceAccessibility.ts` zarządza bezpośrednimi panelami `HomePage` przy szerokości do 760 px: ukryte panele mają `inert`/`aria-hidden`, widok docelowy otrzymuje fokus przed ukryciem poprzedniego. Wydarzenie kieruje fokus do `#event-detail-title` i ustawia tytuł dokumentu; zamknięcie i Escape wracają do listy albo mapy zgodnie z zapisanym `originView`, odtwarzając dostępny fokus i URL workspace. Escape z mapy wraca do listy. History API odtwarza origin, wydarzenie i URL filtrów; przełączenie na desktop przywraca listę. Hook zachowuje dostęp do przełącznika i komunikatów, a navbar i footer pozostają poza jego zakresem.

`lib/event-directions.ts` współdzieli link do miejsca: istniejący `google_maps_url`, następnie rzeczywiste współrzędne, następnie sensowny adres i miasto jako tekstowe wyszukiwanie Google Maps. Pomija placeholdery. Brak punktu nie renderuje mapy fikcyjnej lokalizacji; link tekstowy nazywa się „Wyszukaj miejsce w Google Maps”. `organizerUpdateProfileAction` potwierdza zmianę przez `select("id").maybeSingle()`; zero wierszy nie prowadzi do rewalidacji ani przekierowania i nie zastępuje poprawki RLS.

Końcowe 149/149 testów w 14 plikach i build z kontrolą typów/lint przeszły (0 błędów, 15 ostrzeżeń). Vitest ma automatyczny runtime JSX do importów rzeczywistych komponentów TSX i route'ów SSR. Lokalna próba Wrocławia potwierdziła miasto 15, promień 5 km 14 i 100 km 18; po awarii i ponowieniu promień 73 km dał zgodne 16 wyników listy, punktów i liczników. Produkcyjny podgląd potwierdził zachowanie filtrów po odświeżeniu, `inert`, fokus/tytuł, historię i powrót Escape do źródłowego widoku. Oba motywy przy 360/390/768/1100/1440 px nie mają poziomego overflow. Pełne sesje Auth/RLS wymagają nadal nieutworzonego staging. Szczegółowe wyniki i serwer podglądu: [postęp](mvp-progress-2026-10-05.md) oraz [handoff](context-handoff-2026-10-05.md).

## Wspólny styl publicznego discovery — 2026-10-05

`app/layout.tsx` importuje kolejno `app/globals.css`, `app/discovery.css`, `app/search-panel.css` i `app/event-venue-deck.css`. Globalny plik zachowuje tokeny motywów i style pozostałych ekranów; discovery definiuje wspólne powierzchnie kart, typografię i odstępy. Odrębne, scoped klasy nowego panelu oraz talii nie dziedziczą układu dawnych sekcji filtrów. Wszystkie powierzchnie korzystają z tokenów motywu jasnego i ciemnego.

`SearchPanel` pokazuje miejscowość, jeden wybór terminu i główną akcję. Zasięg jest częścią miejscowości; suwak promienia pojawia się dla wyszukiwania okolicy z rzeczywistym centrum. Cena i kategorie rozwijają się pod „Więcej filtrów” na każdej szerokości. Kategorie są kolorowymi przyciskami o szerokości wynikającej z nazwy, zawijanymi przez flex-wrap; mają wysokość 36/38 px (desktop/telefon), ikonę 16 px i pole ikony 22 px. Kolory pochodzą z `categories.color`. Podsumowanie wybranych filtrów pozostaje widoczne po zwinięciu. Wartości i zapytania nadal należą do `HomePage`. Hero zachowuje pięć kafelków, a mobilny `HomePage` ma marginesy po 16 px. Sidebar renderuje osobne karty mapy, nadchodzących wydarzeń i kategorii.

`lib/event-presentation.ts` dostarcza formatowanie daty, ceny, lokalizacji i odległości używane przez `EventCard` oraz `EventCarousel`. `EventDetailView` współdzieli format ceny i respektuje `is_all_day` w metadanych oraz pełnym terminie. Daty korzystają z `formatPolishDate`; wydarzenia całodniowe pokazują „Cały dzień”. Ceny korzystają z pól typu ceny, przedziału i waluty, z fallbackiem do istniejącego opisu. Lokalizacja nie powtarza nazwy miasta, a liczby odległości używają polskiego formatu. `EventCarousel` mierzy overflow przez `ResizeObserver` i zdarzenia scroll; ukrywa strzałki i podpowiedź, kiedy wszystkie karty mieszczą się w pasku.

Siatka `edShell` używa `minmax(0, 1fr)` i zerowego minimum dzieci, aby obraz i długa treść nie poszerzały osadzonego widoku mobilnego. `getEventBySlug` preferuje dokładny publiczny slug, a przy braku dopasowania używa literalnego `ILIKE` z escapowaniem znaków `%`, `_` i backslash. Pobiera najwyżej dwa dopasowania i odrzuca wieloznaczność; obie ścieżki zachowują published/public/nieanulowane. Nie normalizuje danych w bazie.

Wyniki lokalnego buildu i odbioru tego pakietu są zapisane w [postępie MVP](mvp-progress-2026-10-05.md).

## Stany wyników i autocomplete — trzeci pakiet MVP

`HomePage` rozróżnia pobieranie pierwszej paczki i kolejnych. Przy zastąpieniu wyników usuwa poprzednią listę, zachowuje ją przy doładowaniu i zapisuje numer nieudanej paczki do ponowienia. Identyfikatory żądań chronią stan przed spóźnioną odpowiedzią. Markery mają własne ładowanie/błąd przekazywane do `Sidebar` i `MobileMapView`; są czyszczone przed pobraniem nowych filtrów. Szósty pakiet uzupełnił liczniki kategorii o własne ładowanie, komunikat błędu i ponowienie.

`SearchPanel` steruje wyłącznie lokalnym rozwinięciem ceny i kategorii; ich wartości i wyszukiwanie pozostają w `HomePage`. `CityAutocomplete` używa debounced Photon z `AbortController`, lokalnymi podpowiedziami i ochroną przed aktualizacją anulowanego żądania. Zewnętrzny fallback Nominatim został usunięty także z tej odrębnej implementacji.


## Karuzele, powrót po Auth i zakres czasu

`EventCarousel` jest wspólnym klientowym komponentem pasków polecanych i podobnych wydarzeń. Grupy miejsc na głównej liście renderuje `EventVenueDeck`: warstwy keyed `event.id` pozostają w DOM, a `lib/event-venue-deck.ts` wyznacza poziome pozycje po obu stronach. Tylne karty są równoległe do frontu (y=0, obrót=0); CSS animuje przesunięcie, skalę i przygaszenie, a podczas gestu pozycje są interpolowane.

Pełny `EventCard` jest na wierzchu. Czysty komponent prezentacyjny `EventCardContent` renderuje wspólny układ zdjęcia i treści zarówno w `EventCard`, jak i tylnych podglądach; obrazy podglądu mają pusty alt i wyłączone natywne przeciąganie. Dekoracyjne warstwy są inert/aria-hidden, bez linków, kontrolerów zapisu i obsługi wskaźnika. Równy ujemny margines i boczny padding stage zachowują szerokość frontu zgodną z pojedynczą kartą listy. Desktop używa gutter 24 px i spread 72 px; telefon 32 px i 60 px. Tylne karty są przycinane w stage. Na telefonie boczne obszary wyboru mają 16 px i są odsunięte o 16 px od krawędzi stage, dzięki czemu pozostają w widocznych marginesach viewportu i nie wywołują przewijania do ukrytej części talii.

Natywne przyciski z nazwami wydarzeń tworzą przezroczyste obszary wyboru; nie są częścią inert warstw. Nie ma widocznych dolnych przycisków ani stopki. Licznik srOnly ogłasza aktywne wydarzenie; klawiatura i gest pozostają dostępne. Fokus po promocji trafia na trwały stage, a otwarcie szczegółów zachowuje aktywny link do powrotu. Nagłówek miejsca jest nad talią. Rodzic wyklucza `.eventVenueDeck` z gestu lista/mapa; talia odróżnia gest poziomy od przewijania pionowego, blokuje kliknięcie po przesunięciu i anuluje gest przy zmianie składu/kolejności ID. Grupowanie w `lib/event-groups.ts` używa istniejącego `locations.id`; zachowuje kolejność pierwszego wydarzenia grupy i kolejność jej wczytanych rekordów. Licznik dotyczy bieżącej listy, nie całego katalogu miejsca. Zapytanie `/api/events/search?featured=1` zachowuje wszystkie publiczne filtry i limity. Pobranie polecanych ma AbortController; nie miesza ich z licznikiem listy ani paginacją. Schemat bazy nie zmienił się.

`lib/navigation.ts` waliduje lokalny cel `next` także dla callbacku OAuth. `lib/event-dates.ts` definiuje zakres nakładający się na wydarzenie, wspólny dla klienta i filtra SQL: przyszły start lub znany koniec po dolnej granicy. Brak końca nie oznacza domyślnych dwóch godzin.

Naprawa zapisów: [saved-events-rpc-proposal.md](saved-events-rpc-proposal.md), zatwierdzona i wdrożona 2026-10-05. Trzy odczyty w `lib/user-account.ts` używają `get_my_saved_events`, a akcja `toggleSavedEventAction` używa `set_my_saved_event`; funkcje wyznaczają użytkownika przez `auth.uid()`. Istniejące granty/RLS tabeli i odczyty statystyk organizatora pozostały bez zmian. Typy wygenerowano ponownie. API zapisów zwraca 503 przy awarii; karty i szczegóły pokazują błąd oraz pozwalają ponowić sprawdzenie zamiast traktować awarię jako brak sesji.

## Regresje MVP — 2026-10-05

Wspólne zakresy dat: `lib/date-range.ts` (Europe/Warsaw). Serializacja JSON-LD: `lib/json-ld.ts`. Walidacja roli rejestracji: `lib/auth-validation.ts` przed operacjami Supabase. Vitest jest zależnością developerską; `npm test` uruchamia izolowane testy w `tests/`. Pełne testy RLS wymagają staging.

## Stack

- Next.js 15 z App Router.
- React 19.
- TypeScript w trybie `strict`.
- Supabase JS v2 oraz `@supabase/ssr`.
- MapLibre GL JS dla map.
- Globalne tokeny i style w `app/globals.css`; wspólne powierzchnie publicznego discovery w `app/discovery.css`, a nowy panel i talia w `app/search-panel.css` oraz `app/event-venue-deck.css`, importowanych po nim w layoucie.

Konfiguracja projektu:

- `package.json` definiuje skrypty `dev`, `build`, `start`, `lint`.
- Supabase CLI 2.119.0 jest przypięte jako zależność deweloperska; uruchamianie z katalogu projektu: `npx supabase`. CLI służy do administracji i pracy z bazą, nie jest częścią runtime aplikacji.
- `eslint.config.mjs` konfiguruje ESLint CLI dla Next.js; `npm run lint` uruchamia `eslint .` i ignoruje katalogi robocze oraz wygenerowane typy bazy.
- `next.config.ts` ustawia `reactStrictMode: true`.
- `tsconfig.json` definiuje alias `@/*`.

## Podział warstw

### Nadawanie ról podczas rejestracji

W bazie EventMap działa trigger `auth.users -> public.handle_new_user()`, tworzący profil i opcjonalną organizację. Zatwierdzony hotfix z 5 października 2026 ogranicza rolę z metadanych do `user` lub `organizer`, ustala `search_path` i odbiera bezpośrednie EXECUTE funkcji triggerowej dla anon/authenticated. Szczegóły i wynik weryfikacji: `docs/database-security-audit-2026-10-05.md`. Aplikacja także waliduje wejściową rolę przez `parseRegistrationRole` przed utworzeniem klienta Supabase.

### App Router

Route'y w `app/` są server components tam, gdzie pobierają dane z Supabase:

- `app/page.tsx` pobiera dane przez `getHomeData()` i renderuje `HomePage`.
- `app/wydarzenie/[slug]/page.tsx` renderuje szczegóły wydarzenia.
- `app/[category]/page.tsx` rozpoznaje kategorię albo aktywne miasto i renderuje filtrowane wyniki SSR przez `HomePage`.
- `app/admin/**` oraz `app/organizer/**` renderują panele po stronie serwera i korzystają z server actions.
- `app/login/page.tsx` oraz `app/register/page.tsx` obsługują logowanie i rejestrację użytkowników przez email/haslo i Google OAuth.
- `app/forgot-password/page.tsx` i `app/auth/reset-password/page.tsx` renderują żądanie wiadomości odzyskiwania oraz formularz nowego hasła po weryfikacji sesji i markera.
- `app/auth/recovery/route.ts` weryfikuje link recovery przez PKCE albo token hash i ustawia krótkotrwały marker resetu.
- `app/auth/callback/route.ts` wymienia kod Google OAuth na sesje Supabase SSR i inicjalizuje profil uzytkownika.
- `app/auth/onboarding/page.tsx` wymusza zgody prawne i wybor roli, gdy pierwsze logowanie Google utworzylo nowego uzytkownika Auth.
- `app/account/page.tsx` jest panelem konta dla uzytkownikow bez roli organizatora; organizatora przekierowuje do `/organizer`.
- `app/organizer/saved/page.tsx` renderuje zapisane wydarzenia wewnatrz panelu organizatora.
- `app/api/account/saved-events/route.ts` zwraca klientowi stan zapisow aktualnej sesji, potrzebny do ikon serca na listach.
- `app/api/events/[id]/analytics/route.ts` zapisuje publiczne zdarzenia analityczne wydarzenia.
- `app/lokalizacja/page.tsx` renderuje stronę geolokalizacji z `lat`, `lng`, `radius` w query params; ma `noindex, nofollow`.
- `app/[category]/[city]/page.tsx` rozpoznaje `city === "lokalizacja"` jako specjalny przypadek geolokalizacji z kategorią.
- `app/[category]/[city]/page.tsx` renderuje kategorię w istniejącym mieście, także z pustym wynikiem filtrów; kanoniczne przekierowania zachowują dozwolone filtry. Obsługuje też miasto z terminem `dzis`, `weekend` lub `ten-tydzien`.
- `app/robots.ts` wystawia prawdziwy `/robots.txt` z linkiem do indeksu sitemap i blokada paneli, API oraz stron logowania/rejestracji.
- Legacy route handlery `/wydarzenie/[slug]` i `/wydarzenia/[slug]` przekierowuja istniejace wydarzenia na kanoniczny adres `/{kategoria}/{miasto}/{wydarzenie}`, a dla brakujacych slugow zwracaja HTTP 404 z `X-Robots-Tag: noindex, nofollow`.

Client components odpowiadają za interakcję UI:

- `components/HomePage.tsx` - stan filtrów, hero, karuzela Polecanych nad panelem wyszukiwania i lista z sidebarem szerokości 310 px; do 1100 px główny układ przechodzi w jedną kolumnę. Widoczne nagłówki, linki kontekstowe i treści pomocnicze są wyliczane z aktywnej kategorii i lokalizacji, a nie tylko z początkowych parametrów route'a.
- `components/MobileMapView.tsx` - mobilny, pelnoekranowy widok mapy dla aktualnie przefiltrowanych wynikow, z licznikiem i kontrolowana mini karta wybranego wydarzenia. `HomePage` utrzymuje wspolny stan trybu `list/map/event` oraz zaznaczonego wydarzenia.
- `components/EventDetailView.tsx` - jawny Client Component uzywany na dynamicznej podstronie szczegolow oraz jako trzeci ekran mobilnego workspace (z propem `embedded`) z obrazem, metadanymi, akcjami, opisem i organizatorem ostatnio otwartego wydarzenia. Dane podstrony nadal pobiera Server Component route'a; granica klienta jest wymagana przez obsluge zapisu, zamykania i mobilnej podmiany podobnych wydarzen. Tryb osadzony pomija breadcrumbsy, JSON-LD oraz mape i pobiera client-side stan zapisania wydarzenia.
- Mobilny workspace zapisuje aktywny widok, ostatnie wydarzenie i URL listy w History API. Kanoniczny URL wydarzenia pojawia sie bez demontowania listy i mapy, a mapa pozostaje zaparkowana pod szczegolami, zachowujac zoom, pozycje oraz zaznaczona pinezke.
- `components/FeaturedEvents.tsx` - karuzela wyróżnionych wydarzeń; nie renderuje mapy.
- `components/Sidebar.tsx` - osobne karty mapy MapLibre, nadchodzących wydarzeń i popularnych kategorii; publiczny sidebar nie zawiera CTA powiadomień.
- `components/MapLibreMap.tsx` - wspólny komponent mapy dla strony głównej, eksploratora i szczegółów; używa GeoJSON source z `cluster: true`, warstw klastrów, warstw pojedynczych pinesek oraz ikon kategorii. Po załadowaniu stylu dokłada kolorowane województwa i ich granice z lokalnego `public/data/wojewodztwa-min.geojson`, wyraźne granice powiatów z wektorowych kafelków OpenMapTiles (`boundary`, `admin_level=6`) oraz numery budynków (`housenumber`). Gdy mapa nie dostaje lokalizacji, kadruje stałe bounds całej Polski.
- `components/LocationPickerMap.tsx` - interaktywny picker lokalizacji z mini-mapą MapLibre, wyszukiwaniem adresów przez Nominatim i przesuwalną pinezką; renderuje ukryte inputy formularza.
- `components/LocationSection.tsx` - wrapper obsługujący przełączanie między wyborem istniejącej lokalizacji a tworzeniem nowej przez LocationPickerMap.
- `components/EventExplorer.tsx` - starszy komponent filtrów/listy/mapy zachowany w repozytorium; aktualne publiczne trasy kategorii i miasta korzystają z `HomePage`.
- `components/NavbarClient.tsx` - menu, panel użytkownika i formularz wylogowania.
- `components/CookieConsent.tsx` - banner zgody na cookies/analitykę; zapisuje wybór w `localStorage` i ładuje Google Analytics dopiero po zgodzie.
- `components/GoogleOnboardingForm.tsx` - finalizacja nowego konta Google z wyborem roli i wymaganymi zgodami.
- `components/PasswordRecoveryForm.tsx` - żądanie wiadomości i zapis nowego hasła z pending oraz stanami błędu/sukcesu.
- `components/UserProfileForm.tsx` - zmiana nazwy uzytkownika w `profiles.display_name`.
- `components/SavedEventCard.tsx` i `components/EventCardSaveButton.tsx` - lista zapisanych wydarzen i zapis z publicznych kart.
- Komponenty map są ładowane dynamicznie bez SSR.
- `components/CityAutocomplete.tsx` - publiczne autouzupełnianie miejscowości; priorytetowo używa aktywnych miast z tabeli `cities`, a następnie publicznego Photon/OSM z filtrem `countrycode=PL`, warstwami miejscowości i bounding boxem Polski.

### Warstwa danych

Zapytania Supabase są wydzielone poza UI:

- `lib/events.ts` - publiczne odczyty wydarzeń, kategorii i stron miast.
- `lib/auth.ts` - kontekst użytkownika i guardy ról.
- `lib/auth-actions.ts` - logowanie i rejestracja email/haslo, rozpoczecie Google OAuth (wraz z automatyczną konfiguracją organizatora) i wylogowanie.
- `lib/auth-password-actions.ts` - żądanie wiadomości odzyskiwania oraz zmiana hasła przez Supabase Auth.
- `lib/auth-origin.ts` - walidacja originu callbacków z obowiązkowym `NEXT_PUBLIC_SITE_URL` w produkcji.
- `lib/password-recovery.ts` - krótki marker recovery przypisany do konta, opcje cookie i walidacja nowego hasła.
- `lib/oauth-profile.ts` - inicjalizacja `profiles` oraz opcjonalnego organizatora po callbacku Google OAuth.
- `lib/oauth-state.ts` - ograniczony stan rejestracji przekazywany do callbacku w cookie HttpOnly.
- `lib/user-account.ts` - dane panelu konta, stan zapisow i publiczne pobieranie zapisanych wydarzen.
- `lib/user-account-actions.ts` - aktualizacja nazwy oraz zapis/usuwanie `saved_events` po zweryfikowaniu sesji.
- `lib/admin-events.ts` - dashboard admina, lista wydarzeń, CRUD i zmiana statusu.
- `lib/organizer-events.ts` - dashboard organizatora, lista i zapis wydarzeń organizatora, powiadomienia oraz agregacja statystyk.
- `lib/admin-organizers.ts` - CRUD organizatorów.
- `lib/event-editor.ts` - wspólne typy, statusy i parsowanie formularza wydarzenia.
- `lib/event-editor-validation.ts` - pełna walidacja wejścia edytora oraz typ stanu i błędów pól formularza.
- `lib/event-editor-server.ts` - budowanie payloadu wydarzenia, tworzenie lokalizacji, zapis źródła i upload obrazu wydarzenia.
- `lib/cloudinary.ts` - signed upload obrazów wydarzeń do Cloudinary po stronie serwera.
- `lib/geocoding.ts` - geokodowanie adresów i reverse geocoding przez Nominatim (OpenStreetMap); używany client-side w LocationPickerMap.
- `lib/filters.ts` - parsowanie filtrów URL i pomocnicze filtrowanie klienta; główne wyniki listy, mapy i liczników korzystają ze wspólnego wyszukiwania w `lib/events.ts`.
- `lib/event-search.ts` i `lib/public-search-params.ts` - poprawność współrzędnych, odległość, sortowanie i wspólna interpretacja parametrów publicznych wyszukiwań.
- `lib/event-directions.ts` - wspólny wybór rzeczywistego punktu lub tekstowego adresu dla linków Google Maps.
- `lib/event-presentation.ts` - wspólne formatowanie daty, ceny, lokalizacji i odległości dla zwykłych kart wydarzeń oraz karuzel.
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

Globalny navbar nie czyta sesji w server component root layoutu. Publiczny HTML renderuje stan niezalogowany, a prywatny stan profilu jest pobierany po stronie klienta przez `GET /api/account/navbar` z nagłówkiem `private, no-store`. Dzięki temu publiczne strony nie stają się dynamiczne tylko przez cookies użytkownika.

## Upload obrazów

Formularze wydarzeń w panelu admina i organizatora przyjmują plik `main_image_file` albo ręczny `main_image_url`. Jeśli użytkownik wybierze plik, `buildEventWritePayload()` wysyła go do Cloudinary przez `uploadEventImageToCloudinary()` i zapisuje zwrócony `secure_url` w `events.main_image_url`.

Upload Cloudinary jest podpisywany po stronie serwera na podstawie `CLOUDINARY_URL` albo zestawu `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` oraz opcjonalnego `CLOUDINARY_EVENT_FOLDER`. Sekret API nie trafia do klienta.

## Wybór lokalizacji

Formularz wydarzenia pozwala wybrać istniejącą lokalizację z dropdown albo utworzyć nową przez interaktywny picker (`LocationPickerMap`).

Picker zawiera pole wyszukiwania adresów z autouzupełnianiem (Nominatim/OSM, ograniczone do Polski), mini-mapę MapLibre z przesuwalną pinezką oraz klikanie na mapę. Po wyborze lokalizacji pola `latitude`, `longitude`, `city`, `address`, `postal_code`, `voivodeship`, `county` i `municipality` są automatycznie wypełniane przez reverse geocoding.

Geokodowanie odbywa się po stronie klienta; API Nominatim nie wymaga klucza, ale respektuje limit 1 req/s (debounce 350ms w kodzie). Użytkownik może ręcznie skorygować wypełnione pola.

## Przepływ danych publicznych

1. `app/page.tsx` parsuje `searchParams` i wywołuje `getHomeData()` z aktywnymi filtrami daty i ceny.
2. `getHomeData()` pobiera pierwszą stronę uporządkowanych wyników, pełny count, polecane i kategorie; domyślny zakres obejmuje przyszłe oraz trwające wydarzenia ze znanym końcem.
3. Jeśli publiczne zapytanie Supabase dla strony głównej zwróci błąd, `getHomeData()` loguje błąd i zwraca pusty zestaw wydarzeń oraz fallbackowe kategorie zamiast wywracać Server Component.
4. `HomePage` dostaje dane jako propsy.
5. Zmiany filtrów i sortowania pobierają wyniki przez publiczne API, które filtruje i sortuje pełną pulę przed paginacją. Pomocnicze `filterEvents()` nie wyznacza kolejności paginowanej listy.
6. `FeaturedEvents` pokazuje karuzelę Polecanych nad panelem wyszukiwania, a `Sidebar` pokazuje osobną kartę mapy dla aktualnie przefiltrowanych wydarzeń oraz karty nadchodzących wydarzeń i kategorii.

W widokach `/{category}`, `/{city}`, `/{category}/{city}` i geolokalizacji początkowy zestaw także uwzględnia filtry URL na serwerze; dalsze interakcje i paginację obsługuje `HomePage` z tym samym modelem wyszukiwania.

Publiczne strony wydarzeń/listingów, geolokalizacja i sitemapy mają `dynamic = "force-dynamic"`. Publiczne API, sitemap i aliasy zwracają `Cache-Control: no-store, max-age=0`, również dla obsłużonych błędów/404. Widoki wyszukiwania odczytują `searchParams` dla filtrowanych wyników SSR; stan zapisu wydarzenia nadal korzysta z prywatnego API. Po mutacjach publiczne trasy odświeża wspólny `revalidatePublicEventCache()`; już załadowana lista nie jest automatycznie aktualizowana.

MapLibre używa stylu wektorowego i po załadowaniu stylu próbuje preferować pola `name:pl`, a potem `name`, `name:latin` i `name:nonlatin` dla warstw etykiet. Dzięki temu etykiety mapy są możliwie polskie bez dodatkowego klucza API.

## Routing i SEO

`app/layout.tsx` definiuje globalne metadane (w tym canonical `/`), Open Graph z domyślnym obrazem `public/og-default.png` oraz metadane Twitter Card. Strony dynamiczne generują specyficzne metadata:

- Szczegóły wydarzenia `/[category]/[city]/[event]` używają dynamicznych tagów Open Graph (m.in. dedykowanego obrazka wydarzenia `imageUrl`) oraz Twitter.
- Adresy URL generowane przez `eventPath()` są w całości konwertowane do małych liter. Strona szczegółów wydarzenia automatycznie przekierowuje za pomocą `redirect` z wariantów URL z wielkimi literami na kanoniczny lowercase.
- `sitemap.xml` (sitemap index) przekazuje znacznik `<lastmod>` z aktualnym czasem dla każdego sub-sitemapa.
- `sitemap-category-cities.xml` korzysta z `listPublicCategoryCityRoutes()` i zawiera tylko realne pary kategoria-miasto z opublikowanych, publicznych i nieanulowanych nadchodzacych wydarzen.
- `sitemap-events.xml`, `sitemap-category-cities.xml` i `sitemap-cities.xml` wystawiaja `lastmod`, gdy aplikacja ma wiarygodna date aktualizacji z bazy.

Strony szczegółów wydarzeń i kolekcji generują JSON-LD:

- `Event` dla szczegółów wydarzenia, z bezpieczną serializacją i pomijaniem nieznanej ceny, daty końca i informacji o dostępności biletów. Organizator nie jest domyślnie wykonawcą.
- `BreadcrumbList` dla podstron wydarzeń, kategorii oraz miast w celu prezentacji poprawnej struktury nawigacji w wynikach wyszukiwania.
- `CollectionPage` dla strony miasta i kategorii.

## Zewnętrzne skrypty

`app/layout.tsx` renderuje `CookieConsent`, a Google Analytics z identyfikatorem `G-60019N4V87` jest ładowane client-side przez `components/CookieConsent.tsx` dopiero po zgodzie użytkownika na analitykę. Odrzucenie zgody zapisuje się w `localStorage` i blokuje ładowanie skryptu GA.

## Stany ładowania i błędu

- `app/loading.tsx` pokazuje globalny stan ładowania wydarzeń.
- `app/error.tsx` pokazuje globalny błąd i przycisk ponowienia.
- `components/Navbar.tsx` renderuje początkowy anonimowy stan; `GET /api/account/navbar` loguje błędy Supabase Auth/profilu i zwraca stan niezalogowany, a `NavbarClient` także obsługuje nieudane pobranie prywatnego stanu.
- Dla braku organizatora w panelu organizatora istnieje osobny empty state w `app/organizer/page.tsx`.

## Elementy wymagające potwierdzenia

- Pełne integracyjne próby Auth/RLS na staging; izolowane testy regresji istnieją w `tests/` i używają Vitest.
- Brak konfiguracji CI/CD.
- Hosting Vercel potwierdzony; lokalne powiązanie projektu jest ignorowane w Git. Opublikowane źródła nadal wymagają utrwalenia w zdalnej gałęzi przed kolejnym deploymentem z Git.
- Route handlery API obejmuja `/auth/callback`, `/auth/recovery`, `/auth/sign-out` oraz `POST /api/events/[id]/analytics`; `/auth/onboarding` jest chroniona sesja strona SSR, a `/auth/reset-password` wymaga także ważnego markera recovery.
