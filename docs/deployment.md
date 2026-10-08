# Deployment

## Dziesiąty pakiet i wysłanie zaległych zmian — 2026-10-08

Pakiet obejmuje historię wyszukiwania, potwierdzanie akcji organizatora, formularze profilu/ustawień, warszawskie filtry dat, kompletne odczyty zapisów i obsługę błędu wylogowania. Nie wymaga migracji, nowych zmiennych środowiskowych ani zmian Auth/SMTP. Przy publikacji budować z konfiguracją docelowego środowiska; fikcyjne wartości izolowanego CI służą wyłącznie weryfikacji.

Do Git trafiają aplikacja, testy, workflow oraz dokumentacja/propozycje SQL. `.env.local`, `.vercel`, scratch, test_strony i vercel-diagnostics są lokalne i wyłączone. Historyczne propozycje oraz rollbacki w docs nie są migracjami do automatycznego uruchomienia. Uprawnienia edycji organizatora i pełne A04 wymagają osobnego zatwierdzenia i odbioru.

Lokalny cache Next.js zgłosił EPERM podczas pierwszej próby builda; końcowy odbiór odbywa się w świeżej kopii źródeł. [Raport sprawdzeń, GitHub i aktualne ograniczenia](repair-package-10-2026-10-08.md). Push do GitHub i publikacja w Vercel mają oddzielne potwierdzenia.

## Wdrożenie RLS po zatwierdzeniu — 2026-10-06

SQL lokalizacji/analityki wdrożono na EventMap o 21:20 CEST, testy po zmianie przeszły 21:21 CEST i wycofały wszystkie fixture. Dokładnie trzy zmiany policies, pozostałe osiem kolekcji bez zmian; typy wygenerowane ponownie, identyczne z obecnym kontraktem. [Raport, hashe, odbiór i przygotowany rollback](supabase-rls-hardening-release-2026-10-06.md). Rollback pozostaje niewykonany; nie uruchamiać historycznego SQL ponownie ani lokalnego baseline na produkcji. Frontend/Vercel/SMTP bez zmian, publiczne odczyty HTTP 200/no-store. Dalszy pakiet zabezpieczeń edycji i pełny Auth wymagają osobnego odbioru. Poniższy opis niewykonanej propozycji jest historyczny.

## Testy obecnego Supabase i następna poprawka — 2026-10-06

Za zgodą użytkownika wykonano transakcyjne próby RLS na EventMap `jifeontwlybxkghbzcry`, bez Auth API/e-maili. CLI exit 0, wszystkie fixture wycofano; dziewięć katalogów schematu/grantów nie zmieniło się. [Raport](supabase-rls-tests-2026-10-06.md) opisuje cztery potwierdzone luki bezpieczeństwa i jeden błąd funkcjonalny. [Propozycja RLS](supabase-rls-hardening-proposal.sql), [rollback](supabase-rls-hardening-rollback.sql) i [testy po zmianie](supabase-rls-hardening-tests.sql) są przygotowane, ale niewykonane i wymagają osobnego zatwierdzenia SQL według AGENTS.md. Nie wykonywać lokalnego baseline na produkcji ani ponownie uruchamiać historycznych propozycji. Obecny frontend/deployment pozostaje ten sam; rzeczywiste JWT/Auth/SMTP i pełna checklista nie są zaliczone.

## Pakiety ósmy i dziewiąty — produkcja 2026-10-06

A04 feedback/A07 oraz A08/A09/D06 opublikowano jako `dpl_Dh4QrPip3RxwCg843Zk14NCKb5T1`; obie domeny wskazują gotowy deployment. Build i 23 kontrole HTTP przed/po promocji przeszły. [Raport, zakres i rollback](production-release-packages-8-9-2026-10-06.md). Bez SQL, zmian konfiguracji Production, commita i push; D08 nadal czeka na uruchomienie w GitHub. Klient zgody/trackera i endpoint wdrożono razem: stary kontrakt bez analyticsConsent i UUID sesji jest odrzucany; przeładowanie pobiera nowy klient. Nie wymaga nowych zmiennych ani zależności.

Zaufany nagłówek IP jest używany tylko przy wbudowanym VERCEL=1. Poza Vercel wszyscy dzielą koszyk unidentified. Limiter/dedup nie są trwałe ani rozproszone. Bezpośredni INSERT Supabase omija endpoint; check publication i INSERT są odrębne. Pełny A08 wymaga osobnej propozycji uprawnień/RPC i odbioru; [szczegóły](event-analytics.md). Statystyki i filtry admina zwiększają koszt odczytów: odebrać latencję, nullable błędy, niższe max_rows i równoległość na staging.

[CI](ci.md) przeszło lokalne npm ci, 417 testów, lint/typy/build w świeżej kopii bez .env, z dummy config i blokadą usług. GitHub/Linux i branch protection nie zostały odebrane. Dummy build nie jest artefaktem do publikacji.

Końcowy lokalny build również przeszedł z blokadą sieci. Podgląd: 127.0.0.1:3000, PID startowy **13564**, logi scratch/mvp-package-9-production.out.log i .err.log. Ósmy preview 4580, przejściowy 2440 i syntetyczne fixture 19040/7416 zatrzymano po sprawdzeniu polecenia. PID może być ponownie użyty: przed zatrzymaniem sprawdzić command line. Origin localhost ustawiono wyłącznie w procesie, bez zmiany .env.local. Poniższe PID-y/odbiór opisują starsze pakiety.


## Ósmy pakiet — historyczny lokalny odbiór przed publikacją

Pakiet częściowego zapisu i A07 jest zapisany lokalnie, bez nowego deploymentu i bez commita. Wymaga wspólnego wdrożenia actions admina/organizatora, feedback/form/notice i wszystkich publicznych konfiguracji dynamic/no-store. Nie wymaga nowych zmiennych, SQL ani zależności. Build i 328 testów przeszły; regresje i ograniczenia są w [postępie](mvp-progress-2026-10-05.md).

Publiczny SSR, cztery API, aliasy i sitemap nie zatrzymują starej publikacji w ISR/CDN. Zwiększa to odczyty Supabase — po przyszłym wdrożeniu zmierzyć koszt i latencję; cache można przywrócić dopiero wraz ze sprawdzoną invalidacją i ustalonym SLA. Otwarta strona klienta nadal wymaga odświeżenia. Odbiór prawdziwych sesji i kontrolowanego wycofania wydarzenia jest osobny od odczytowego smoke bez konta.

Lokalny produkcyjny Next działa na `127.0.0.1:3000`, PID przy uruchomieniu **4580**, logi `scratch/mvp-package-8-production.out.log` i `.err.log`. Przed zatrzymaniem sprawdzić aktualne command line, bo PID może być użyty ponownie. Poprzedni podgląd **2140** zweryfikowano po poleceniu i HTML EventMap, następnie zatrzymano przed buildem. `NEXT_PUBLIC_SITE_URL=http://localhost:3000` ustawiono wyłącznie w procesie build/start; `.env.local` zachowano. Fixture na 3001 jest tylko tymczasowym odbiorem syntetycznego formularza i zostaje zatrzymany po QA.

[Propozycja transakcji A04](event-write-transaction-proposal.md) jest osobnym projektem, nie migracją do uruchomienia. Nowa prywatna tabela i wersja wydarzenia wymagają zgody według AGENTS.md; bez zatwierdzonego SQL i testów staging nie zastępować bieżących writerów nieistniejącym RPC. W tej sesji wykonano tylko odczyt katalogu Supabase, bez zmiany RLS/konfiguracji Auth/SMTP.

## Produkcja — publikacja 2026-10-06

Na prośbę użytkownika opublikowano dotychczasowe lokalne zmiany w istniejącym projekcie Vercel. `https://mapaimprez.pl` oraz `https://www.mapaimprez.pl` wskazują gotowy deployment `dpl_5iqZnjkeVDe5crmATm1q1gzLJ7wi`. Zdalny build ze źródeł i kontrola po przełączeniu domen przeszły. Dodano produkcyjny `NEXT_PUBLIC_SITE_URL` i pojedynczy wymagany callback recovery w Supabase. Nie wykonano migracji bazy. Szczegóły, wyniki i poprzednia wersja do rollbacku: [raport wdrożenia](production-release-2026-10-06.md).

Starsze sekcje niżej opisują historyczne lokalne odbiory; ich stwierdzenia o braku publikacji nie opisują już obecnej produkcji. Pełny odbiór wiadomości e-mail, SMTP i sesji Auth/RLS pozostaje otwarty.

## Odzyskiwanie hasła i obsługa konta — lokalny pakiet 2026-10-06

Pakiet dodaje `/forgot-password`, callback `/auth/recovery` i `/auth/reset-password`, wspólny formularz oraz moduły `lib/auth-password-actions.ts`, `lib/password-recovery.ts` i `lib/auth-origin.ts`. W produkcyjnym runtime `NEXT_PUBLIC_SITE_URL` jest obowiązkowe dla odzyskiwania hasła i Google OAuth. Musi wskazywać origin tego deploymentu, np. `https://mapaimprez.pl`; brak lub niepoprawna wartość przerywa akcję Auth zamiast budować callback z nagłówka żądania. Lokalny podgląd po `next build`/`next start` również działa w trybie production, więc powinien mieć `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Preview i staging wymagają własnego originu oraz oddzielnej konfiguracji Auth.

Poprawka usuwania zapisów pokazuje pending/błąd i zachowuje kartę po błędzie RPC; wygasła sesja wraca do listy przez logowanie. Navbar zwraca anonimowe menu przy błędzie Auth lub profilu, logując go po stronie serwera. Publiczna etykieta weryfikacji opisuje wyłącznie profil organizatora (`organizers.is_verified`). Zmiany kodu nie wymagają migracji bazy.

Podczas publikacji dodano do allowlisty Supabase produkcyjny callback `/auth/recovery` z `next`, zachowując istniejące callbacki. Szablonu recovery i SMTP nie zmieniano ani nie potwierdzono przez odczyt CLI. Nie wykonano prawdziwej wiadomości i pełnego resetu przez e-mail ani odbioru staging. Nadal odebrać link poprawny, wygasły, ponownie użyty oraz otwarty w innej przeglądarce; testy kodu i ekranów nie potwierdzają dostarczania poczty. Szczegóły przepływu: [Auth](auth.md).

## Ujednolicenie kart listy i talii — 2026-10-06

`EventCardContent` jest wspólną prezentacją zdjęcia i treści dla `EventCard` oraz dekoracyjnych podglądów `EventVenueDeck`. Tylne karty mają pełny układ wydarzenia, a front ma tę samą szerokość listy co pojedyncza karta. Stage rezerwuje przestrzeń podglądów ujemnym marginesem równym bocznemu paddingowi; gutter/spread wynoszą 24/72 px na desktopie i 32/60 px na telefonie. Mobilne obszary wyboru mieszczą się w widocznych 16-pikselowych marginesach. Kategorie zachowują wysokości 36/38 px, a talia nie ma obrotu ani widocznych dolnych kontrolek. Gest, klawiatura, lokalizacja nad kartami i pojedynczy kontroler zapisu pozostają.

**165/165 testów w 16 plikach** oraz końcowy build z typami/lint (0 błędów, 15 ostrzeżeń) przeszły. Odbiór dev obu motywów przy 1440 px potwierdził po 922 × 178 px dla frontu talii i pojedynczej karty. Przy 360/390/768/1100/1440 px szerokości obu kart wynoszą odpowiednio 313/343/689/1021/922 px, z jednakowymi obrazami i bez poziomego overflow strony. Oba mobilne obszary wyboru działały bez poziomego przewijania; szczegóły „Koniec Świata” fokusowały tytuł, a Escape zachował kartę 2, link i URL. Desktop potwierdził wybór boczny i klawiaturę. Odświeżony produkcyjny podgląd potwierdził po 922 × 178 px przy 1440 px, szerokość 343 px przy 390 px, pełną treść tylnych kart, brak dolnych kontrolek i overflow oraz wybór Ethno 3 i ArrowLeft do „Koniec Świata” 2 bez poziomego przewijania. Przywrócono ciemny motyw. Fizycznego gestu palcem nie testowano. Zmiana nie wymaga migracji, zależności ani zmiennych środowiskowych; bez commita i publikacji.

Aktualny produkcyjny Next działa na `http://localhost:3000`, wyłącznie `127.0.0.1:3000`, PID przy uruchomieniu **4020**. Logi: `scratch/ui-unified-cards-production.out.log` i `scratch/ui-unified-cards-production.err.log`. Dev 22192 i jego bieżący child 12664 zatrzymano po sprawdzeniu command line przed buildem; poprzedni produkcyjny 22296 też jest zatrzymany. PID-y mogą być ponownie używane, dlatego przed zatrzymaniem zawsze sprawdzić rzeczywiste command line. Nie uruchamiać dev i buildu jednocześnie na wspólnym `.next`.

## Mniejsze kategorie i prosta talia boczna — poprzedni odbiór 2026-10-06

Obecny wariant zachowuje kolory kategorii, ale zmniejsza ich przyciski do 36 px na desktopie i 38 px na telefonie. Talia pokazuje równoległe, przygaszone karty po bokach bez obrotu, dolnych przycisków z tytułami, strzałek nawigacji i widocznego licznika. Wybór działa przez odsłonięte krawędzie, poziomy gest i klawiaturę; nazwa miejsca pozostaje nad kartami. Boczne podglądy są przycinane w stage, na telefonie przy granicy ekranu. Ukryty licznik i natywne przyciski krawędzi zachowują obsługę czytnika ekranu.

Zmiana obejmuje istniejące komponenty i style; nie wymaga nowych zależności, migracji ani zmiennych środowiskowych. **164/164 testy w 16 plikach**, końcowy build z typami/lint (0 błędów, 16 ostrzeżeń) i `git diff --check` przeszły. Odbiór dev potwierdził oba motywy, wysokości kategorii 36/38 px, brak poziomego overflow przy 360/390/768/1100/1440 px, wybór bocznych kart, klawiaturę i powrót tej samej karty/fokusu po Escape ze szczegółów. Nie ma widocznych dolnych kontrolek; podglądy pozostają równoległe. Fizycznego gestu palcem nie testowano. Dev 2444/16416 i poprzedni produkcyjny 21592 zostały zatrzymane po sprawdzeniu command line. Poniższy poprzedni odbiór opisuje wcześniejszy wariant UI. Nie uruchamiać dev i buildu jednocześnie na wspólnym `.next`.

Poprzedni produkcyjny Next działał na `http://localhost:3000`, wyłącznie `127.0.0.1:3000`, PID przy uruchomieniu **22296**, zatrzymany przed kolejną zmianą. Logi: `scratch/ui-simple-deck-production.out.log` i `scratch/ui-simple-deck-production.err.log`. Po odświeżeniu przeglądarki potwierdzono kategorię 36/38 px, brak dolnych kontrolek, boczny wybór Ethno przy 390 px bez overflow oraz powrót klawiaturą do poprzedniej karty; obserwowane transformacje były poziome bez obrotu. Zmiany pozostały lokalne, bez publikacji na hostingu i bez commita.

## Kolory kategorii i animowane talie — poprzedni odbiór 2026-10-06

Do wspólnego buildu należą `SearchPanel`, `EventVenueDeck`, `lib/event-venue-deck.ts`, integracja w `HomePage` oraz `app/search-panel.css` i `app/event-venue-deck.css`, importowane w layoucie po discovery. Pakiet nie wymaga migracji ani nowych zmiennych środowiskowych. Polecane i podobne wydarzenia nadal używają `EventCarousel`; talie zastępują wyłącznie grupy miejsc na głównej liście.

Kategorie używają ponownie indywidualnych kolorów. Talia zachowuje warstwy keyed event.id, animuje promocję do frontu, pokazuje podglądy z obu stron i pozwala je wybrać. Nazwa miejsca jest nad kartami; stopka zawiera samą nawigację. Pakiet nie dodaje zależności ani zmian bazy.

**164/164 testy w 16 plikach**, `npm run build` z kontrolą typów/lint (0 błędów, 16 ostrzeżeń) i `git diff --check` przeszły. Przeglądarka potwierdziła oba motywy, brak overflow przy 360/390/768/1100/1440 px, własny termin/cenę/kategorię w URL, ruch warstw, boczne przyciski, szybką klawiaturę, talię dwukartową i zachowanie karty/fokusu przy Escape ze szczegółów. Fizycznego gestu nie testowano; helpery obejmują próg, kierunek i interpolację. Pierwszy build zatrzymały uprawnienia lokalnego cache `.next`; ponowienie z dostępem do cache zakończyło się sukcesem.

Poprzedni produkcyjny podgląd działał na `http://localhost:3000`, tylko `127.0.0.1:3000`, PID przy uruchomieniu **21592**. Logi: `scratch/ui-deck-refinement-production.out.log` i `scratch/ui-deck-refinement-production.err.log`. Odświeżony podgląd potwierdził boczny wybór karty 1→2 / 4 przy 390 px i brak overflow. Historyczny podgląd 17880 i dev 6008/12664 są zatrzymane. Zmiany nie zostały opublikowane na hostingu ani zacommitowane.

## Szósty pakiet MVP — wyszukiwanie i dostępność, 2026-10-05

Pakiet nie wymaga migracji ani nowych zmiennych środowiskowych. W deployment muszą trafić wspólnie `lib/event-search.ts`, `lib/public-search-params.ts`, zmienione publiczne API/route'y SSR, `HomePage`, hook dostępności mobilnego workspace oraz `lib/event-directions.ts`. Wyszukiwanie miasta bez promienia i jego okolicy z promieniem korzysta ze wspólnego modelu listy, punktów mapy i liczników. Sortowanie pełnej puli poprzedza paginację i limit 300 kart.

Pula po filtrach SQL ma limit 50 000 kandydatów; mapa dopuszcza 10 000 poprawnych punktów. Przekroczenia zgłaszają błąd, zamiast udawać pełny wynik. Przy rosnącym katalogu sprawdzić czas, liczbę żądań do Supabase i koszt pobierania całej puli dla każdego endpointu. Błędy listy, mapy i kategorii mają niezależne ponowienie; licznik punktów nie obejmuje wydarzeń bez współrzędnych. Bez centrum miasta dostępny pozostaje tryb „W mieście”, a promień i odległość są wyłączone.

Końcowa weryfikacja: **149/149 testów w 14 plikach**, poprawny `npm run build` obejmujący typy i lint (0 błędów, 15 ostrzeżeń). Pierwsza próba buildu została zatrzymana przez uprawnienia lokalnego cache `.next` w sandboxie; ponowienie z uprawnieniem do tego cache zakończyło pełny build. Nie zmieniano konfiguracji środowiska ani bazy. Wyniki piątego pakietu poniżej są historyczne.

Lokalne API potwierdziło Wrocław: 15 wyników miejskich, 14 w promieniu 5 km i 18 w promieniu 100 km, również w Bielawie, Nysie i Opolu. Produkcyjny podgląd po kontrolowanej lokalnej awarii odtworzył przez przyciski ponowienia 16 kart i count 16 dla 73 km; search/markers/category-counts dały 16/16/16, wszystkie rekordy published/public/nieanulowane. Odświeżenie zachowało 73 km/nearest. Wcześniej potwierdzono też 50 km/nearest po odświeżeniu.

Przeglądarka potwierdziła oba motywy i brak poziomego overflow przy 360/390/768/1100/1440 px, fokus/tytuł szczegółów i historię wstecz/dalej. Escape z karty wraca do listy, z podglądu mapy do mapy i jej przycisku wywołującego, a z mapy do listy. Produkcyjny Next działa na `http://localhost:3000`, tylko `127.0.0.1:3000`, PID przy uruchomieniu **1828**; przed zatrzymaniem potwierdzić command line. Logi: `scratch/localhost-preview.out.log` i `scratch/localhost-preview.err.log`. Zrzuty zapisano w katalogu wynikowym wskazanym w [handoff](context-handoff-2026-10-05.md).

Ponowienie błędu kategorii i listy oraz mobilny powrót klawiaturą przeszły na lokalnym podglądzie. Testy TSX/SSR używają automatycznego runtime JSX w Vitest. Guard zapisu profilu organizatora wykrywa UPDATE bez zmienionego wiersza, ale nie naprawia RLS. Fizyczny telefon/GPS, pełna sesja Auth i pozostałe RLS nadal wymagają odbioru przed publikacją.

Użytkownik potwierdził, że osobne środowisko testowe nadal nie istnieje. Następny etap to uzgodnione przygotowanie [staging](staging-proposal.md) i wykonanie [checklisty Auth/RLS](mvp-release-checklist-2026-10-05.md), w tym realnych sesji i równoległych RPC. Nie utworzono kont testowych ani nie wykonano nowego SQL. Frontend nie został opublikowany na hostingu.

## Pakiet spójności UI — 2026-10-05

Pakiet nie wymaga migracji ani nowych zmiennych środowiskowych. `app/layout.tsx` importuje `app/discovery.css` po `app/globals.css`; oba pliki muszą znaleźć się w buildzie. Discovery jest wspólną definicją publicznych kart, filtrów, typografii i odstępów dla obu motywów. `lib/event-presentation.ts` współdzieli formaty daty, ceny, lokalizacji i odległości między `EventCard` oraz `EventCarousel`.

W piątym pakiecie lokalny build z kontrolą typów i 65 testów przeszły. W przeglądarce sprawdzono oba motywy, brak poziomego overflow strony w szerokościach 360, 390, 768, 1100 i 1440 px, przewijanie karuzel oraz rozwijanie filtrów. Potwierdzono działanie bezpośredniego linku do wydarzenia z importowanym slugiem zawierającym wielkie litery oraz poprawną szerokość szczegółów na telefonie. Odbiór ma cztery sekcje filtrów na desktopie, dwie kolumny do 1100 px i jedną do 760 px, mobilny przycisk „Filtry” z nazwą dostępną „Cena i promień”, pięć kafelków hero i marginesy mobilne po 16 px. Sidebar ma osobne karty mapy, nadchodzących wydarzeń i kategorii. Szósty pakiet uzupełnia fokus/Escape mobilnego workspace; przed publikacją pozostają realne sesje Auth/zapisów, dalszy odbiór klawiatury i próby na fizycznym telefonie. Szczegóły: [postęp MVP](mvp-progress-2026-10-05.md).

Pakiet mobilnych filtrów i stanów wyników nie wymaga migracji ani nowych zmiennych środowiskowych. Przed publikacją sprawdzić zwijanie filtrów na telefonie, puste wyniki, doładowanie i ponowienie po błędzie sieci, osobno dla listy i mapy. Kontrolowana awaria i ponowienie listy/mapy przeszły na lokalnym podglądzie; próby zrywania połączenia, gestów i GPS na fizycznym telefonie pozostają do odbioru.


## Staging i odbiór MVP

Pakiet karuzel nie wymaga migracji. Pełne przejście rejestracji z potwierdzeniem e-mail i onboarding Google trzeba odebrać na staging. [RPC zapisów](saved-events-rpc-proposal.md) wdrożono do EventMap po zgodzie właściciela 2026-10-05. Aktualny frontend wymaga tych funkcji; testy SQL przeszły w transakcji z wycofaniem fixture. Nie wykonywano `db push` ani nie zmieniano historii migracji. W nowym środowisku najpierw przygotować właściwy schemat i funkcje. Historyczny SQL używa CREATE FUNCTION, dlatego ponowne wykonanie zatrzyma się zamiast nadpisywać istniejące definicje.

Propozycja osobnego środowiska: [staging-proposal.md](staging-proposal.md). Brak projektu testowego został ponownie potwierdzony przez użytkownika. Scenariusze i oczekiwane wyniki zapisano w [checkliście premiery](mvp-release-checklist-2026-10-05.md), lecz nie wykonano ich w sesjach staging. Przed publikacją uruchom `npm test`, kontrolę TypeScript, lint i build; po konfiguracji staging wykonaj próby Auth/RLS oraz przepływy telefonu. Testy jednostkowe nie używają kont produkcyjnych.

## Uruchomienie lokalne

Wymagane zależności:

- Node.js zgodny z Next.js 15.
- npm.
- Dostęp do projektu Supabase.

Instalacja:

```bash
npm install
```

Start developerski:

```bash
npm run dev
```

Build produkcyjny:

```bash
npm run build
```

Start po buildzie:

```bash
npm run start
```

Lint:

```bash
npm run lint
```

Skrypt `lint` korzysta z ESLint CLI oraz konfiguracji `eslint.config.mjs`; nie uruchamia interaktywnego `next lint`.

## Lokalny staging w planie Free — 2026-10-06

Użytkownik potwierdził Free; dwa aktywne projekty wykorzystują limit. [Propozycja staging](staging-proposal.md) wskazuje teraz lokalny wariant z PG17/Auth/PostgREST/Mailpit bez nowego abonamentu. [Config](local-staging-config.toml) jest zapisany w odizolowanym `scratch/local-staging/supabase/config.toml`, bez linku do hosted projektu. API 54331, DB 54332, Mailpit 54334, osobny frontend 3001; potwierdzanie e-mail włączone, automatyczne migracje/seed wyłączone.

`supabase init --workdir E:\EventMap\scratch\local-staging` stworzył wyłącznie pliki. `status` poprawnie wczytał config, po czym zgłosił brak Docker/Podman. Nie uruchomiono usług, migracji ani testów kont. [Preflight](local-staging-preflight.md) opisuje brak runtime i ograniczenie 8 GiB RAM/~1,1 GiB wolnej pamięci. SQL baseline musi zostać przedstawiony i zatwierdzony osobno według AGENTS.md; nie kopiować przyrostowych migracji ani produkcyjnego `.env.local` do automatycznego startu. Vercel Preview nie ma dostępu do localhost tego komputera. SMTP/Google w chmurze nadal wymagają osobnego odbioru.

## Supabase CLI

CLI jest zainstalowane lokalnie jako zależność deweloperska projektu w wersji 2.119.0, zapisanej w `package.json` i `package-lock.json`. Po `npm install` można je uruchomić z katalogu projektu:

```bash
npx --no-install supabase --version
npx supabase login
```

Logowanie należy wykonać interaktywnie; tokenów nie zapisujemy w repozytorium. Samo zainstalowanie CLI nie oznacza uwierzytelnienia do projektu ani uprawnień do bazy. Docker jest potrzebny do uruchamiania lokalnego stosu Supabase, nie do samego sprawdzenia wersji CLI. CLI może zapisywać konfigurację w katalogu użytkownika `.supabase`, więc uruchomienie w ograniczonym sandboxie może wymagać dodatkowych uprawnień do tego katalogu.

Instalacja lokalna jest wspierana w [oficjalnej dokumentacji Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started).

## Zmienne środowiskowe

Kod wymaga:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=https://mapaimprez.pl
CLOUDINARY_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Alternatywnie dla klucza publicznego kod obsługuje:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

W `.env.local` obecne są publiczne zmienne Supabase. Nie należy dodawać service role key do kodu klienta ani do zmiennych `NEXT_PUBLIC_*`.

`NEXT_PUBLIC_SUPABASE_URL` powinien mieć format samego originu projektu Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
```

Nie ustawiaj tu endpointu REST, np. `https://PROJECT_ID.supabase.co/rest/v1`. Kod normalizuje URL do originu, ale poprawna wartość zmiennej środowiskowej ułatwia diagnozę logów Vercel i Supabase.

`NEXT_PUBLIC_SITE_URL` jest wymagane w produkcji dla stabilnych callbacków Google OAuth i odzyskiwania hasła. Ustaw poprawny origin HTTP/HTTPS bez danych uwierzytelniających; na publicznej produkcji użyj HTTPS. Fallback z nagłówków działa wyłącznie w development. Dla lokalnego `next start` ustaw origin podglądu jawnie. Nie mieszaj `localhost` i `127.0.0.1` w jednym przepływie PKCE, ponieważ mają oddzielne cookies.

Dla lokalnego produkcyjnego podglądu w PowerShell ustaw wartość w środowisku procesu przed buildem i startem:

```powershell
$env:NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
npm run build
npm run start -- --hostname 127.0.0.1
```

Podgląd otwieraj jako `http://localhost:3000`, zgodnie ze skonfigurowanym originem. W tym pakiecie nie zmieniano `.env.local`; ustawienie procesu nie nadpisuje wartości produkcyjnej w tym pliku.

### Google OAuth

W Google Cloud Console autoryzowany redirect URI klienta webowego powinien wskazywac callback Supabase:

```text
https://PROJECT_ID.supabase.co/auth/v1/callback
```

W Supabase Dashboard, w `Authentication -> URL Configuration`, dodaj do Redirect URLs:

```text
https://mapaimprez.pl/auth/callback
http://localhost:3000/auth/callback
```

Jesli lokalna aplikacja dziala na innym porcie, ten callback tez musi byc dodany. Plik pobrany z Google Cloud w formacie `client_secret_*.json` nie jest potrzebny aplikacji i nie moze trafic do repozytorium ani deploymentu; wzorzec jest ignorowany przez `.gitignore`.

### Odzyskiwanie hasła: callback i wiadomość

W Supabase `Authentication -> URL Configuration` dodaj do Redirect URLs callback recovery dla używanych originów, wraz z parametrem `next` wysyłanym przez aplikację:

```text
https://mapaimprez.pl/auth/recovery\?next=**
http://localhost:3000/auth/recovery\?next=**
```

Staging i inne lokalne porty wymagają własnych wpisów; nie kieruj testowego deploymentu do produkcyjnego originu. Aplikacja zawsze przekazuje `redirectTo` w postaci `/auth/recovery?next=...`. Wymaganie allowlisty i użycie `resetPasswordForEmail`/`updateUser` opisuje [Password-based Auth](https://supabase.com/docs/guides/auth/passwords).

Wpisy zachowują dokładny origin i ścieżkę callbacku, a dopasowanie zmiennej wartości `next` dotyczy tylko query string. `\?` oznacza literalny znak zapytania w składni glob Supabase, zaś `**` obsługuje również znaki separatorów w zakodowanym celu powrotu. Nie zastępuj tego szerokim wildcardem całej domeny lub ścieżki. Składnię opisują [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls); przed odbiorem sprawdź rzeczywiste dopasowanie do URL wysłanego przez aplikację.

W szablonie **Reset password** zalecany jest link kierujący bezpośrednio do callbacku aplikacji:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Ustaw nowe hasło</a>
```

`RedirectTo` ma już `?next=...`, dlatego nowe parametry zaczynają się od `&`. Callback sprawdza `type=recovery` i weryfikuje token po stronie serwera; ta ścieżka umożliwia otwarcie wiadomości w innej przeglądarce bez pierwotnego cookie PKCE. Definicje zmiennych i model weryfikacji opisują [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates). Domyślny `ConfirmationURL` także jest obsługiwany w wariancie PKCE, ale wymaga originu i przeglądarki z verifierem; ograniczenie opisuje [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

Stan SMTP, limity i rzeczywiste dostarczenie do kontrolowanej skrzynki trzeba potwierdzić w uzgodnionym środowisku. W ramach zleconej publikacji 6 października dodano wyłącznie produkcyjny wpis `https://mapaimprez.pl/auth/recovery\?next=**`. Lokalny wpis recovery i powyższy szablon nadal są instrukcją, nie zapisem wykonanej konfiguracji. Dalszych zmian SMTP, szablonów lub innych ustawień Auth nie wykonywać bez uzgodnionego zakresu.

Upload obrazów wydarzeń używa Cloudinary po stronie serwera. Wymagane są:

```bash
CLOUDINARY_URL=
```

Alternatywnie można ustawić konfigurację Cloudinary jako osobne zmienne:

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Opcjonalnie można ustawić folder dla obrazów wydarzeń:

```bash
CLOUDINARY_EVENT_FOLDER=eventmap/events
```

`CLOUDINARY_URL` i `CLOUDINARY_API_SECRET` nie mogą być ustawione jako zmienne `NEXT_PUBLIC_*`, bo zawierają sekret używany do podpisywania uploadu.

Google Analytics jest skonfigurowany bez dodatkowej zmiennej środowiskowej. Identyfikator `G-60019N4V87` jest używany w `components/CookieConsent.tsx`, a skrypt GA ładuje się dopiero po zgodzie użytkownika w bannerze cookies.

## Supabase

5 października 2026, po zgodzie użytkownika, wykonano na połączonej bazie EventMap wąski hotfix rejestracji z `docs/security-hotfix-registration-proposal.sql`. Weryfikacja potwierdziła ograniczenie nowych ról do user/organizer, aktywny trigger, ustalony search_path i brak bezpośredniego EXECUTE dla anon/authenticated. Nie zmieniano istniejących kont, tabel ani kolumn. Poprawkę zastosowano przez `db query`, bez `db push` i bez oznaczania historii migracji. Pełny test rejestracji na staging pozostaje do wykonania. Raport: `docs/database-security-audit-2026-10-05.md`.

Projekt jest połączony z Supabase CLI lokalnie przez katalog `supabase/.temp`. Repozytorium zawiera przyrostowe migracje w `supabase/migrations`, ale nie pełny baseline pustej bazy; staging wymaga uzgodnionego odtworzenia rzeczywistego schematu, grantów, funkcji i triggerów.

Typy bazy są wygenerowane w:

```bash
database.types.ts
```

Komenda używana dla aktualizacji typów:

```bash
npx supabase gen types typescript --project-id jifeontwlybxkghbzcry > database.types.ts
```

Ta komenda wymaga dostępu sieciowego i zalogowanego Supabase CLI albo tokena Supabase.

## Kroki deploymentu aplikacji

1. Skonfiguruj zmienne środowiskowe w platformie hostingowej.
2. Upewnij się, że RLS policies w Supabase pozwalają na scenariusze opisane w `docs/auth.md` i `docs/database.md`.
3. Upewnij się, że tabela `categories` ma rekordy używane przez formularze.
4. Upewnij się, że konto admina ma rekord `profiles` z `role = 'admin'`.
5. Uruchom `npm run build`.
6. Wdróż aplikację jako standardową aplikację Next.js.

## Cache i limity Vercel

Publiczne szczegóły, listingi i sitemapy XML są dynamiczne. Wyszukiwanie `/`, `/{category}` lub `/{city}`, `/{category}/{city}` i geolokalizacja odczytują query params do pierwszych wyników SSR. Panele zalogowanych użytkowników pozostają dynamiczne.

Publiczne endpointy `/api/events/search`, `/api/events/markers`, `/api/events/category-counts` i `/api/events/[id]`, sitemapy i aliasy mają `Cache-Control: no-store, max-age=0`. Endpointy prywatne `/api/account/*`, akcje auth i panele także nie powinny być cache'owane.

Actions admina/organizatora używają `revalidatePublicEventCache()` po mutacjach, także przed source/moderation followupami i gdy wynik mógł się zatwierdzić przed utratą odpowiedzi. Nie obiecywać aktualizacji już otwartego widoku bez odświeżenia.

## SEO po wdrozeniu

Po wdrozeniu sprawdz:

- `https://mapaimprez.pl/robots.txt` powinien zwracac `text/plain` i wskazywac `https://mapaimprez.pl/sitemap.xml`;
- `https://mapaimprez.pl/sitemap.xml` powinien zwracac indeks sitemap;
- w Google Search Console ponownie przeslij `sitemap.xml`;
- sprawdz raport indeksowania pod katem `Soft 404`, `Odkryto, obecnie nie zaindeksowano` i `Przeslano i zindeksowano`;
- stare adresy `/wydarzenie/[slug]` i `/wydarzenia/[slug]` powinny zwracac 308 do kanonicznego URL-a wydarzenia albo 404 dla nieistniejacego sluga.

## Hosting

Potwierdzony 6 października 2026 hosting to istniejący projekt Vercel `event-map`, ID `prj_81CpZTzncBaxsfLON8BL1EmQ54cW`, scope `team_vyoQ4GWSlHKpesAjASF9LuTW` (`luqe010-1961s-projects`), Node.js 24.x. Domeny produkcyjne to `https://mapaimprez.pl` i `https://www.mapaimprez.pl`. Powiązanie lokalnego repozytorium zapisano w ignorowanym `.vercel/repo.json`.

`NEXT_PUBLIC_SITE_URL=https://mapaimprez.pl` dodano do Vercel Production przed zdalnym buildem. Pozostałe zmienne Supabase i Cloudinary są zarządzane w Vercel; ich wartości nie trafiają do repozytorium. `.vercelignore` wyklucza lokalny build, `.env*`, pliki klienta Google, konfigurację CLI, importery, dane scrapingu, SQL, dokumentację, testy i diagnostykę. Paczka aplikacji zawiera źródła oraz publiczne assety. Weryfikacja `vercel deploy --dry --format=json` wykazała 188 wpisów (ok. 3,97 MB), bez tych wykluczonych plików.

Wdrożenie wykonuje zdalny build ze źródeł przez `vercel deploy --prod --skip-domain`; po weryfikacji gotowej wersji `vercel promote` przełącza domeny. Nie należy używać lokalnego `--prebuilt` z buildem dla localhost. Publikacja przez CLI nie tworzy commita ani nie wypycha zmian do GitHub, dlatego późniejszy automatyczny build z Git musi zawierać te same źródła.

## Seed danych

Repozytorium zawiera przyrostowe migracje SQL oraz pomocniczy seed demonstracyjny:

```bash
supabase/seed-demo-events.sql
```

Seed dodaje przykładowe lokalizacje, wydarzenia publiczne oraz wpisy `event_sources`. Używa slugów `demo-*`, więc może być uruchamiany ponownie bez dublowania tych samych wydarzeń.

Przykładowe uruchomienie przez Supabase CLI:

```bash
npx supabase db query --linked --file supabase/seed-demo-events.sql
```

Komenda wymaga zalogowanego Supabase CLI albo zmiennej `SUPABASE_ACCESS_TOKEN`. Tokenów Supabase nie należy zapisywać w repozytorium.

Dla działania paneli i formularzy potrzebne są przynajmniej:

- rekordy w `categories`;
- rekord admina w `profiles`;
- opcjonalnie rekordy `organizers` i `organizer_users` dla kont organizatorów;
- aktywne `city_pages` dla stron miast.

## Elementy wymagające potwierdzenia

- Strategia migracji bazy.
- Strategia seedowania kategorii.
- Konfiguracja Supabase Auth w panelu Supabase.
- CI/CD.
- Monitoring błędów i logów.
