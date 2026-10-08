# Odbiór Auth, RLS i zapisanych wydarzeń przed premierą

Status po dziewiątym pakiecie 2026-10-06: 48 scenariuszy przygotowanych, **niewykonanych w realnych sesjach staging**. Ten dokument uzupełnia [propozycję staging](staging-proposal.md) o konkretne kryteria; nie jest kolejną propozycją SQL ani dowodem odbioru produkcji.

## Co jest zamknięte, a co nadal blokuje odbiór

- Hotfix triggera rejestracji i walidacja roli w aplikacji są wdrożone. Nie wykonywać ponownie historycznego pliku `security-hotfix-registration-proposal.sql` na produkcji.
- RPC `get_my_saved_events` i `set_my_saved_event` są wdrożone, kod ich używa, typy zawierają funkcje. Próby SQL z wycofanymi fixture przeszły; nie zastępują sesji Auth/HTTP ani prób równoległości. [Raport RPC](saved-events-rpc-proposal.md).
- Odbiór nadal wymaga staging, pełnych przepływów e-mail/Google, prób poniżej oraz osobnych propozycji napraw z [audytu bazy](database-security-audit-2026-10-05.md): własny profil organizatora i tworzenie organizacji, permissive INSERT lokalizacji, administracyjne pola wydarzenia i niezmienność zgłaszającego, zakres/tryb publicznego widoku.
- Rejestracja dwóch organizatorów o tej samej nazwie może nadal wpadać w kolizję sluga triggera. Ścieżka nowego organizatora Google próbuje tworzyć organizację zwykłym klientem sesyjnym, bez polityk INSERT wskazanych w audycie. To scenariusze do naprawy i ponownego odbioru, a nie zaliczone przepływy.
- Akcja edycji profilu organizatora potwierdza teraz zwrócony identyfikator zmienionego wiersza. Brak wiersza przerywa sukces i przekierowanie; ta poprawka kodu nie przyznaje brakujących uprawnień RLS.

Polityki, granty i schemat ponownie odczytano 2026-10-06 bez zapisywania danych. Zapis lokalny: `scratch/security-audit/schema-2026-10-06-readonly.json`; `database.types.ts` nie opisuje uprawnień. Ten odczyt nie zalicza prób JWT/Auth/RLS. Przed nowym SQL ponowić aktualny diff katalogu.

## Autoryzowany wyjątek — transakcyjne próby SQL, 2026-10-06

Użytkownik zezwolił na testy istniejącego Supabase EventMap. Dla syntetycznych fixture ograniczonych do własnych identyfikatorów/markerów, z collision guard i pełnym ROLLBACK, można użyć produkcyjnego ref. Nie stosować poniższego zakazu produkcji do tego wąskiego pakietu SQL. Zgoda nie obejmuje nowych tabel/migracji, ingerencji w realne konta ani awarii produkcji. Przejrzano [aktywny katalog triggerów](supabase-test-preflight-readonly.sql); [zakres](staging-proposal.md). Próby SQL ról i claims nie zastępują sesji Auth/HTTP, SMTP/Google ani odbioru całych scenariuszy poniżej.

## Warunki rozpoczęcia pełnego odbioru

1. Utworzony i zatwierdzony staging zgodnie z istniejącą propozycją, osobne callbacki Auth i kontrolowane skrzynki. Każdy test zapisujący musi sprawdzić docelowy ref i odmówić działania dla produkcji `jifeontwlybxkghbzcry`.
2. Syntetyczne konta: user A, user B, organizator A, organizator B, admin; dodatkowo członek **obu** organizacji A/B dla próby przenoszenia zgłaszającego. Admin nadany kontrolowaną ścieżką administracyjną, nigdy przez metadata rejestracji.
3. Syntetyczne wydarzenia: published/public/nieanulowane, draft, pending_review, rejected, archived, private, cancelled; przynajmniej po jednym dla obu organizacji. Nie kopiować kont ani prywatnych danych z produkcji.
4. Sesje testowane przez rzeczywiste Auth i publiczny HTTP z anon key oraz JWT danego konta. Klient administracyjny może przygotować fixture i zweryfikować wynik, ale nie może zastąpić sesji w próbie.
5. Każda próba zapisuje identyfikator scenariusza, rolę, czas, sanitizowany status HTTP/błąd i odczyt końcowy. Nie utrwalać tokenów, haseł, cookies ani surowych nagłówków. Wiersze poniżej pozostają niezaliczone do uzyskania tych dowodów.

## Rejestracja i realna sesja

| ID | Próba | Oczekiwany wynik |
| --- | --- | --- |
| A1 | Rejestracja e-mail user i organizer z potwierdzaniem e-mail włączonym | Komunikat o aktywacji; przed potwierdzeniem brak zalogowanej sesji. Po aktywacji i logowaniu właściwa rola, organizer ma jedną własną organizację i członkostwo. |
| A2 | Formularz/Server Action z rolą `admin`, nieznaną lub pustą; oddzielnie bezpośredni Auth signup z takimi metadata | Akcja odrzuca niepoprawną rolę przed signup. Bezpośredni Auth signup może utworzyć wyłącznie profil `user`, nigdy `admin`; `organizer` pozostaje dozwoloną wartością. |
| A3 | Dwie rejestracje organizer z tą samą nazwą | Obie legalne rejestracje kończą się własną organizacją i członkostwem; brak błędu constraintu i brak dołączenia do pierwszej organizacji. Obecny trigger wymaga osobnej poprawki, aby zaliczyć tę próbę. |
| A4 | Pierwsze zwykłe logowanie Google, wybór user/organizer w onboarding | Onboarding wymaga obu zgód; po zatwierdzeniu właściwa rola i powrót do bezpiecznej lokalnej ścieżki `next`. Organizer ma własną organizację; nie powstają osierocone rekordy po nieudanym zapisie. |
| A5 | Rejestracja Google jako organizer; powtórne logowanie; anulowany callback; wygasły onboarding | Udana rejestracja i logowanie zachowują rolę oraz członkostwo bez duplikatów. Anulowanie/wygaśnięcie pokazuje błąd lub powrót do logowania; nie oznacza rejestracji jako zakończonej. |
| A6 | Wylogowanie, odświeżenie strony chronionej i ponowne logowanie z `next` | Sesja usunięta; serwer chroni admin/organizer/account. Powrót trafia do rozpoczętej lokalnej czynności; zewnętrzny `next` nie wywołuje zewnętrznego przekierowania. |

## Odzyskiwanie hasła — dodane 2026-10-06

Implementacja jest na produkcji; testy mockowane i anonimowy smoke nie zaliczają poniższych prób prawdziwej sesji/e-mail. Przed odbiorem skonfigurować staging `NEXT_PUBLIC_SITE_URL`, dozwolony `/auth/recovery` oraz szablon wiadomości opisany w [deployment](deployment.md).

| ID | Próba | Oczekiwany wynik |
| --- | --- | --- |
| P1 | Prośba dla istniejącego i nieistniejącego e-maila; lokalny i zewnętrzny `next` | Ten sam neutralny komunikat. Link dla istniejącego konta prowadzi do właściwego staging; kontekst wydarzenia zachowany, zewnętrzny powrót odrzucony. Limit wysyłek i awaria usługi mają czytelny komunikat. |
| P2 | Domyślna wiadomość PKCE w pierwotnej przeglądarce; szablon `token_hash` w innej przeglądarce | Poprawny recovery otwiera formularz. PKCE bez pierwotnego verifiera odmawia i oferuje nowy link. `token_hash` z `type=recovery` działa między przeglądarkami; inne typy odrzucone. |
| P3 | Wygasły, wykorzystany ponownie, niepełny link oraz kod zwykłego OAuth przy istniejącej sesji | Brak uprawnienia UI resetu i brak zmiany hasła. Odrzucony nowy kod OAuth nie pozostawia nowej sesji. Token nie trafia do docelowego URL, referrera ani logów aplikacji. |
| P4 | Za krótkie, różniące się hasła, hasło odrzucone przez Auth; awaria przed zapisem | Walidacja/bezpieczny błąd, brak fałszywego sukcesu. Poprawne hasło można ponowić w ważnym recovery. Awarie sprzątania po skutecznym `updateUser` nie udają błędu zmiany hasła. |
| P5 | Wejście bez linku, zmiana użytkownika, wylogowanie i zwykłe ponowne logowanie, upływ 10 minut | Formularz i Server Action odmawiają bez właściwego kontekstu. Znacznik jest powiązany z użytkownikiem, krótkotrwały i czyszczony przy logowaniu/wylogowaniu. |
| P6 | Skuteczna zmiana hasła, logowanie starym i nowym hasłem, powrót do wydarzenia | Stare hasło odrzucone, nowe działa; komunikat sukcesu i bezpieczny `next`. Zapisu wydarzenia nie wykonuje się automatycznie. Odebrać zachowanie pozostałych sesji zgodnie z konfiguracją Auth. |

## Odczyt i zapis własnych wydarzeń

| ID | Próba | Oczekiwany wynik |
| --- | --- | --- |
| S1 | Oba RPC bez JWT/anon | Brak EXECUTE: odrzucenie HTTP/SQLSTATE `42501`. Publiczne API aplikacji dla anon może poprawnie zwracać 200 z `isLoggedIn: false` i pustą listą. |
| S2 | A i B zapisują to samo publiczne wydarzenie oraz różne dodatkowe wydarzenia | Każdy odczyt RPC i konta zawiera tylko własne zapisy. RPC nie przyjmuje identyfikatora właściciela jako parametru. |
| S3 | Własne zapisy organizatora i admina | RPC nadal zwraca wyłącznie zapisy wywołującego. Licznik organizatora obejmuje zapisy jego wydarzeń, lecz prywatna lista nie zawiera zapisów innych osób. SELECT `saved_events.user_id` nie staje się dostępny organizatorowi. |
| S4 | Zapis draft/pending/rejected/archived/private/cancelled/nieistniejącego ID | Odrzucenie z `42501`, brak nowego zapisu. Aplikacja pokazuje czytelny błąd; nie potwierdza zapisu sercem. Niepoprawne/null argumenty RPC są odrzucane; null ma `22023`. |
| S5 | Powtórne zapisanie i usunięcie; usunięcie po archiwizacji/anulowaniu | Kolejne zapisy nie tworzą duplikatu. Usunięcie własnego zapisu jest idempotentne także po wycofaniu wydarzenia i nie usuwa zapisu B. Publiczna lista konta ukrywa wycofane wydarzenie, nawet jeśli RPC nadal zwraca własny historyczny identyfikator. |
| S6 | Kontrolowana awaria odczytu/zapisu tylko w testowym środowisku | Odczyt API aplikacji zwraca 503 z błędem; UI rozróżnia awarię i pustą listę oraz umożliwia ponowienie. Nieudany zapis/usunięcie nie utrwala pozornego sukcesu. |

## Równoległość RPC

Testy prowadzić z dwóch niezależnych sesji tego samego konta i dodatkowo z kont A/B. Po zakończeniu całej paczki wykonać świeży `get_my_saved_events` w obu sesjach; weryfikować stan bazy, nie kolejność przyjścia odpowiedzi HTTP. Uruchomić kilka powtórzeń każdego przypadku.

| ID | Próba | Oczekiwany wynik |
| --- | --- | --- |
| C1 | 10 jednoczesnych `set_my_saved_event(id, true)` dla jednego konta | Wszystkie udane odpowiedzi mają `true`; dokładnie jeden własny zapis, bez błędów unikalności. Zapis drugiego użytkownika jest niezależny. |
| C2 | 10 jednoczesnych `set_my_saved_event(id, false)` dla istniejącego lub nieistniejącego zapisu | Udane odpowiedzi `false`; po paczce brak własnego zapisu. Zapis drugiego użytkownika pozostaje. |
| C3 | Równoczesne `true` i `false` w dwóch sesjach tego samego konta | Końcowo zero albo jeden własny rekord, bez naruszenia izolacji. RPC nie obiecuje kolejności według kliknięcia ani zasady „ostatnia odpowiedź wygrywa”. Następnie wysłać pojedyncze, oczekiwane ustawienie i odczytać stan; po odświeżeniu obie sesje muszą go pokazywać. |
| C4 | Zapis równolegle z administracyjnym wycofaniem/anulowaniem wydarzenia | Dopuszczalny zapis zatwierdzony przed wycofaniem albo odrzucenie `42501`, gdy wycofanie wygrało. Po zakończeniu wycofania nowy zapis jest odrzucony; konto nie pokazuje wycofanego wydarzenia. Istniejący zapis pozostaje usuwalny. |
| C5 | Sekwencja zakończonego zapisu, zakończonego usunięcia i odczytu | Po potwierdzonym usunięciu świeży odczyt nie pokazuje zapisu. Analogicznie potwierdzony zapis po zakończonym usunięciu daje jeden rekord. To rozróżnia deterministyczną sekwencję od celowo nieuporządkowanej próby C3. |

## Negatywne próby RLS i pełny przebieg organizatora

Każdą próbę wykonać przez UI i, gdy dotyczy uprawnień, bezpośredni publiczny REST poza formularzem. HTTP 200 z pustą odpowiedzią UPDATE nie potwierdza zmiany: potrzebny jest ponowny odczyt właściwego rekordu.

| ID | Próba | Oczekiwany wynik |
| --- | --- | --- |
| R1 | Zmiana nazwy/opisu/kontaktu własnej organizacji; równolegle próba zmiany `is_verified` i cudzej organizacji | Dozwolone pola zapisują się i są widoczne po odświeżeniu. Weryfikacja i cudzy rekord pozostają bez zmian. UI nie zgłasza sukcesu dla zerowej liczby zmienionych wierszy. |
| R2 | Utworzenie organizacji legalną ścieżką i próba samodzielnego dopisania do cudzej `organizer_users` | Legalny przepływ tworzy jedną własną organizację i członkostwo. Samodzielne dopisanie do cudzej organizacji jest odrzucone i nie zmienia uprawnień. |
| R3 | Nowe wydarzenie, moderacja admina, edycja po publikacji | Organizator tworzy wyłącznie `pending_review`; admin publikuje. Edycja opublikowanego wydarzenia wraca do `pending_review`; organizator nie publikuje przez REST. Źródło i lokalizacja są poprawnie powiązane. |
| R4 | Organizator A edytuje wydarzenie B; członek A i B przenosi `submitted_by_organizer_id` z A do B | Obie próby pozostawiają rekord i zgłaszającego bez zmian. Członkostwo w dwóch organizacjach nie uprawnia do przenoszenia zgłaszającego istniejącego wydarzenia. |
| R5 | Organizator modyfikuje pola administracyjne bezpośrednio przez REST | Chronione pola pozostają bez zmian, także w INSERT. Lista do uzgodnienia w osobnym pakiecie SQL obejmuje m.in. `is_verified`, `is_featured`, `published_at`, `review_note`, `confidence_score`, `source_quality_score` i kontrolę `created_by`. |
| R6 | Anon/user/organizer/admin tworzy lokalizację | Anon i zwykły user odrzuceni; uprawniony organizer/admin może utworzyć potrzebną lokalizację. Sprawdzić łączny efekt wszystkich permissive policies. |
| R7 | Anon odczytuje `city_page_event_counts` przy publicznych i niepublicznych fixture | Widok publiczny liczy wyłącznie published/public/nieanulowane wydarzenia i ma uzgodniony tryb `security_invoker`; albo jest niedostępny publicznie, jeśli uzgodniono przeznaczenie administracyjne. Sprawdzić konsumentów przed zmianą. |
| R8 | Admin edytuje niepubliczne wydarzenie, zmienia organizatora prezentowanego i status; organizator edytuje własne | Widoczność, pierwotny `submitted_by_organizer_id` i pierwsze `published_at` zachowane. Pierwsza publikacja uzupełnia datę tylko gdy jej nie było. Podmienione pola własności/statusu w akcji organizatora nie są przyjmowane. Ochronę REST odebrać oddzielnie w R4/R5. |
| R9 | Odrzucone wydarzenie: zwykły zapis i jawne „Wyślij ponownie”; sfałszowana akcja dla archived/cancelled | Zwykły zapis pozostaje rejected; jawne zgłoszenie tylko odrzuconego, nieanulowanego przechodzi do pending_review. Organizator nigdy nie publikuje. |
| R10 | Niepoprawne daty (w tym luka DST), ceny, współrzędne, URL, zbyt długi tekst i błędny upload | Błędy przy polach przed uploadem/zapisem; formularz zachowuje wartości i plik, pending blokuje wielokrotny submit. Odebrać osobno częściowy zapis źródła/moderacji i retry: A04 pozostaje otwarte. |

## Częściowy zapis i wycofanie publikacji — próby ósmego pakietu

Poniższe próby wykonać na zatwierdzonym staging, bez awarii/zmian danych w produkcji. Mocks i statyczny fixture przeszły lokalnie; wyniki realnych sesji są nadal otwarte.

| ID | Próba | Oczekiwany wynik |
| --- | --- | --- |
| K1 | Source read/write/RLS failure po potwierdzonym create admina i organizatora | Jeden event dostępny przez wskazany edytor; alert częściowego zapisu, zachowane dane/plik, brak kolejnego submitu create. Źródło nie ma fałszywego sukcesu zero-row. |
| K2 | Utrata odpowiedzi INSERT tuż przed i po COMMIT | Link wskazuje próbny UUID; UI nie obiecuje rollbacku i nie ponawia automatycznie. Świadome potwierdzenie braku zapisu dopiero odblokowuje ręczną próbę. Pełna idempotencja wymaga przyszłego RPC. |
| K3 | Source failure równolegle ze zmianą statusu admina; oddzielnie awaria logu i notification INSERT | Moderacja próbowana niezależnie od źródła. Brak deklaracji pełnego sukcesu; poprawny zakres częściowego stanu, publiczny cache odświeżony mimo followup failure. Utracony old_status nie jest niejawnie rekonstruowany. |
| K4 | Duplicate: źródło zawodzi; status quick action: moderacja/transport zawodzi | Potwierdzona kopia otwiera edytor z ostrzeżeniem; nieznany wynik prowadzi do listy z instrukcją sprawdzenia. Decyzja pokazuje częściowy/nieznany wynik, nie pusty ekran sukcesu. |
| K5 | Wiele źródeł, remis created_at; zapis źródła po zmianie RLS | Getter, formularz, duplicate i writer wskazują ten sam rekord według created_at/id; zero-row update jest błędem. Pozostałe źródła i cudze wydarzenia niezmienione. |
| K6 | Przeniesienie sluga/kategorii/miasta, publish→pending_review/archive/private/cancelled, delete | Nowe żądania SSR, detail API, search/map/counts, alias i sitemap mają aktualny stan i no-store; stary adres nie pokazuje wycofanego event. Otwartą wcześniej listę świadomie odświeżyć — brak live push. Odebrać także mutację z błędem końcowym. |
| K7 | Zachowane pola po awarii: mobile 360/390/430, klawiatura, nowa karta i ręczne potwierdzenie nieznanego wyniku | Linki/checkbox dostępne i bez overflow, brak automatycznego retry; formularz pozostaje czytelny i pozwala skopiować dane. Każda kolejna próba ponownie sprawdza rolę/własność. |

## Pomiar, statystyki i pełne listy — dziewiąty pakiet

Próby P1–P8 przygotowane, niewykonane na staging. Używać syntetycznych wydarzeń i zgody testowych kont, bez ruchu do produkcyjnej analityki.

| ID | Próba | Oczekiwany wynik |
| --- | --- | --- |
| P1 | Nowa przeglądarka: brak decyzji/odrzucenie, wejście w szczegóły/kliki/serce | Brak requestów event analytics/GA i brak nowego session UUID; właściwy zapis serca nadal działa. |
| P2 | Akceptacja na otwartych szczegółach, odrzucenie w tej/innej karcie, storage read/write failure | Pomiar po zgodzie, następnie zatrzymany; UUID usunięty, GA disable aktywne. Nieudany zapis odmowy nie wznawia pomiaru; sessionStorage clear nie zmienia zgody. |
| P3 | Kontrakt: brak/false zgody, dodatkowy user_id, zły UUID/typ/UTF-8/JSON, body>1024 B bez/fałszywego Content-Length, obcy Origin/Host | 400/403/413/415 przed INSERT; strumień anulowany przy nadmiarze, no-store. Lokalny alias hosta oraz docelowe domeny przechodzą poprawną kontrolę originu. |
| P4 | Równoległe powtórzenia i wolny INSERT>30 s, limity klienta/global/mapy, wiele instancji/restart | Jedna rezerwacja warm instancji przez całe żądanie i 30 s po zakończeniu; 429 z Retry-After. Udokumentować brak trwałej ochrony między instancjami/restartami zamiast uznać A08 za zamknięte. |
| P5 | Niepubliczne/anulowane wydarzenie oraz wycofanie między SELECT i INSERT; osobno bezpośredni Supabase REST | Endpoint nie zapisuje znanego niepublicznego rekordu. Direct REST i race są otwartą luką; pełne odrzucenie wymaga zatwierdzonego SQL/RPC/uprawnień i nowego odbioru. Nie uznać obecnego kodu za ochronę bazy. |
| P6 | Ponad 1000 interakcji, niższe max_rows, miesiąc Warsaw/DST, usunięcie zapisu, brak pomiaru serca | Pełne miary; historyczne kliknięcia oddzielone od aktualnych saved_events. Nie deklaruje unikalnych osób, miesiąc nie przesuwa się według UTC. |
| P7 | Awaria/limit/zmiana liczności/powtórzenia na kolejnych stronach analityki/zapisów | Niepełny zbiór daje null/„—” i alert; niezależny poprawny zbiór pozostaje widoczny. Zmierzyć koszt HEAD i jawny limit 200 000; osobno zmiany zachowujące liczność. |
| P8 | Admin: dopasowanie po rekordzie 1000, remisy/datyWarsaw/%,_,przecinki, relacje, page beyond end, fail, anonim/organizer | Pełny licznik, 50 rekordów na stronę i stabilny ID; wszystkie filtry przed paginacją. Złożona pula ponad 50 000 daje błąd. Review zawsze draft/pending_review; pusta lista odrębna od awarii, Auth redirect zachowany. Oba motywy/360–1440/table keyboard. |

## Decyzja o publikacji

Każdy otwarty scenariusz bezpieczeństwa i głównego przepływu ma mieć wynik i dowód. Błędy naprawić w staging, przejść ponowny odbiór, osobno przedstawić SQL i plan cofnięcia. Dopiero po zatwierdzeniu zmian bazy oraz odbiorze frontendu rozważyć publikację. Kontrola fizycznego telefonu, wyszukiwania i jakości katalogu pozostaje w [handoff](context-handoff-2026-10-05.md); ta checklista jej nie zastępuje.
