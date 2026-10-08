# Current Features

## Dziesiąty pakiet — historia wyszukiwania i błędy panelu, 2026-10-08

Wstecz/Dalej przywraca filtry, miasto i termin razem z adresem strony oraz widokiem listy/mapy. Powrót z osadzonego szczegółu zachowuje wyszukiwanie; spóźniona odpowiedź poprzedniego szczegółu nie zastępuje nowego wyboru. Zapisane wydarzenia są pobierane stronami, także gdy limit odpowiedzi bazy jest niższy niż żądana strona.

Formularze profilu i ustawień organizatora pokazują błędy przy polach, stan zapisywania i potwierdzenie rzeczywistego zapisu. Wpisane dane pozostają po błędzie. Ukrycie i anulowanie sprawdzają identyfikator zmienionego własnego wydarzenia; brak wiersza lub odmowa nie daje komunikatu sukcesu. Filtry dat obejmują całe dni Europe/Warsaw, także podczas zmiany czasu.

Przy awarii wylogowania osobny ekran wyjaśnia, że sesja może pozostać aktywna, i pozwala ponowić próbę. Profil organizatora i zakładanie organizacji nadal zależą od uprawnień bazy; ten pakiet nie naprawia RLS ani atomowości tworzenia.

Weryfikacja i stan wysłania: [raport pakietu](repair-package-10-2026-10-08.md).

## Zgoda na pomiar i wiarygodne statystyki — opublikowany dziewiąty pakiet, 2026-10-06

„Odrzuć analitykę” zatrzymuje statystyki interakcji wydarzeń i Google Analytics. Pomiar zaczyna się po akceptacji; cofnięcie zgody usuwa identyfikator analityczny bieżącej karty i blokuje kolejne interakcje. Nowe statystyki nie dodają identyfikatora konta. Banner i opis cookies podają zakres; zapisywanie wydarzeń działa niezależnie od zgody.

Organizator widzi oddzielnie historyczne kliknięcia serca i bieżące zapisania. Dashboard pokazuje rzeczywiste udostępnienia/kontakt w miesiącu Europe/Warsaw. Brakujące lub niepełne statystyki pokazują „—” i alert zamiast zera; poprawne dane drugiego zbioru pozostają dostępne. Liczniki nie są opisane jako unikalne osoby.

Listy admina/moderacji mają pełny licznik i nawigację po 50 rekordów z zachowaniem filtrów, także poza pierwszym 1000. Zmiana filtrów wraca na początek. Awaria i pusta lista są odrębne; ponowienie nie gubi filtrów. Tabele przewijają się we własnym obszarze dostępnym klawiaturą, z kontrastowymi nagłówkami obu motywów.

418 testów, lint, TypeScript i build przeszły. Statyczny rzeczywisty UI z syntetycznymi danymi sprawdzono przy 360/390/768/1440 px, w obu motywach, bez poziomego overflow strony. Kod pakietów 8/9 opublikowano na mapaimprez.pl; zdalny build, 23 kontrole HTTP i produkcyjny banner/mobile przeszły. [Raport publikacji](production-release-packages-8-9-2026-10-06.md). Odbiór nie zastępuje prawdziwych sesji/Google/RLS; [pomiar/ograniczenia](event-analytics.md), [lokalne CI](ci.md).


## Częściowy zapis i świeżość wydarzeń — opublikowany ósmy pakiet, 2026-10-06

Formularz admina/organizatora zachowuje dane i plik po niepotwierdzonym lub częściowym zapisie. Pokazuje, czy samo wydarzenie się zapisało, oraz linki do edytora i listy w nowych kartach. Pola pozostają dostępne do skopiowania, ale potwierdzonego częściowego zapisu nie można ponownie wysłać tym formularzem. Przy nieznanym wyniku ponowienie jest dostępne dopiero po świadomym sprawdzeniu braku zapisu. Awaria źródła nie pomija decyzji moderacyjnej; kopiowanie i szybka zmiana statusu mają własne czytelne ostrzeżenia. Edytor i zapis wybierają to samo pierwsze źródło.

Nowe żądania publicznej listy, mapy, szczegółów, aliasów i sitemap odczytują aktualną publikację bez wielominutowego cache ISR/CDN. Actions odświeżają wszystkie publiczne trasy również po częściowym zapisie. Już wczytany widok wymaga odświeżenia; aplikacja nie wysyła aktualizacji na żywo.

328 testów, TypeScript i build przeszły. Statyczny formularz z syntetycznymi danymi potwierdził oba stany/motywy przy 360/390/768/1440 px bez overflow; nie zastępuje realnego odbioru sesji. Nowy pakiet pozostaje lokalny. Pełne transakcje/idempotencja A04 i staging nadal są otwarte; [projekt rozwiązania bazy](event-write-transaction-proposal.md) nie został wykonany.

Stan produkcji: dotychczasowe zmiany opublikowano 6 października 2026 na [mapaimprez.pl](https://mapaimprez.pl). Build, publiczne API, guardy anonimowej sesji i widoki desktop/mobile przeszły kontrolę po publikacji. Pełny odbiór kont i prawdziwej poczty pozostaje otwarty; [raport wdrożenia](production-release-2026-10-06.md) rozdziela potwierdzone wyniki od ograniczeń.

## Ujednolicony panel filtrów — lokalna aktualizacja 2026-10-06

- Desktop pokazuje jeden zwarty panel: lokalizacja, promień, termin i cena w górnym rzędzie, kolorowe przyciski kategorii pod nimi oraz pasek aktywnych filtrów z akcjami „Wyczyść wszystko” i „Znajdź” na dole. Na średnich ekranach górne pola tworzą dwa rzędy.
- Termin ma przyciski „Wszystkie”, „Dziś”, „Jutro”, „Weekend”, „Ten tydzień” oraz kalendarz z nazwą „Własny termin”; kalendarz rozwija dotychczasowe pola Od/Do. Cena używa jednoznacznych trybów „Za darmo”, „Do kwoty” i „Bez limitu”. Suwaki i pola liczbowe pozostają w tym samym miejscu, a nieaktywne są wyłączone.
- Wybór miasta zachowuje osobne tryby „W mieście” i „W okolicy”. Zmiana promienia przechodzi do wyszukiwania okolicy, a „Cała Polska” wyłącza ograniczenie lokalizacji. Brak centrum nadal blokuje promień. Zachowano autocomplete, walidację dat i liczb oraz model zapytań i URL.
- Na telefonie widoczne są lokalizacja, termin i pasek aktywnych filtrów. Przycisk „Filtry” rozwija promień, cenę i kategorie, pokazuje liczbę aktywnych dodatkowych filtrów i zgłasza `aria-expanded`. Zwinięte kontrolki są ukryte również przed fokusem klawiatury. Kategorie mają 36 px na desktopie i 44 px na telefonie; wybory zgłaszają `aria-pressed` i zachowują kolorowe ikony oraz widoczny fokus.

Przeglądarka potwierdziła wybór Wrocławia klawiaturą, przejście do promienia 73 km, limit 100 zł, zakres 6–20 października 2026, kategorię, darmowe wydarzenia i wyczyszczenie filtrów. Układ przy 360/390/768/1100/1280/1440 px nie poszerza strony ani nie wypycha kontrolek poza ekran. Motywy jasny i ciemny używają wspólnych tokenów. Kontrola typów, lint komponentu, 69 testów publicznego wyszukiwania i końcowy build przeszły (0 błędów, 15 dotychczasowych ostrzeżeń poza panelem). Ta korekta panelu jest na razie lokalna; wcześniejsze wdrożenie produkcyjne opisano w raporcie powyżej.

## Odzyskiwanie hasła i obsługa konta — 2026-10-06

- Link „Nie pamiętasz hasła?” na `/login` prowadzi do `/forgot-password`, zachowując lokalny cel powrotu `next`. Formularz prosi o wiadomość odzyskiwania przez Supabase Auth; komunikat nie ujawnia, czy adres należy do istniejącego konta.
- `/auth/recovery` sprawdza link odzyskiwania przez kod PKCE z typem `recovery` albo `token_hash` z `type=recovery`, następnie kieruje do `/auth/reset-password`. Formularz nowego hasła i jego akcja wymagają zweryfikowanego użytkownika oraz ważnego, krótkotrwałego cookie HttpOnly przypisanego do tego konta. Nieprawidłowy lub wygasły link pozwala poprosić o nowy.
- Nowe hasło jest zapisywane przez `auth.updateUser`; po sukcesie marker jest usuwany, aplikacja zamyka lokalną sesję odzyskiwania i przechodzi do `/login?reset=success` z zachowanym `next`.
- Usuwanie zapisów w `/account` i `/organizer/saved` pokazuje stan oczekiwania oraz błąd przy nieudanej operacji. Karta pozostaje przy błędzie; wygasła sesja prowadzi do logowania z powrotem do listy. Potwierdzone usunięcie aktualizuje pozostałe kontrolki zapisu przez zdarzenie przeglądarki.
- Awaria odczytu Auth lub profilu w API navbara jest logowana po stronie serwera i pokazuje menu osoby niezalogowanej. Publiczny layout pozostaje dostępny.
- Publiczne oznaczenie „Zweryfikowany organizator” pochodzi wyłącznie z `organizers.is_verified`; tooltip wyjaśnia, że dotyczy profilu organizatora. Panele pokazują ten sam stan, a szczegóły nie utożsamiają go z `events.is_verified`.

Implementacja jest opublikowana na produkcji. Dodano produkcyjny origin w Vercel i callback recovery w allowliście Supabase. Nie wykonano próby prawdziwej wiadomości odzyskiwania, dostarczenia przez SMTP ani sesji staging; szablonu wiadomości i SMTP nie zmieniano. Konfigurację opisuje [deployment](deployment.md), a przepływ [Auth](auth.md). Odbiór pełnych sesji pozostaje otwarty.

Lokalny odbiór recovery potwierdził oba motywy i szerokości 360/390/768/1440 px bez poziomego overflow, zachowanie powrotu do konta i blokadę resetu bez kontekstu. Tekst pomocniczy używa kontrastu motywu, a podkreślone linki pomocy mają obszar o wysokości 44 px. Siódmy pakiet przeszedł 274 testy oraz build z kontrolą typów/lint; szczegóły i ograniczenia w [postępie](mvp-progress-2026-10-05.md).

## Formularz wydarzenia i ponowne zgłoszenie — 2026-10-06

- Formularze admina i organizatora walidują całą treść przed uploadem zdjęcia oraz zapisem lokalizacji lub wydarzenia: wymagane pola, limity tekstu, daty w `Europe/Warsaw` i ich kolejność, ceny i walutę, współrzędne, adresy HTTP/HTTPS oraz typ i rozmiar pliku. Błędy pojawiają się przy właściwych polach; podczas zapisu kontrolki pokazują pending i są blokowane.
- Odrzucona walidacja lub awaria przygotowania danych zachowuje wpisane wartości, wybrany plik i stan wyboru lokalizacji, aby użytkownik mógł poprawić formularz albo ponowić próbę.
- Edycja zachowuje dotychczasową `visibility`, `submitted_by_organizer_id` i datę pierwszej publikacji `published_at`. Utworzenie korzysta z osobnych reguł początkowych; zwykły zapis formularza nie zmienia niejawnie właściciela ani prywatności. Pierwsza data publikacji pozostaje także przy zmianach statusu.
- Organizator nadal tworzy `pending_review`, a edycja opublikowanego wydarzenia wraca do tego statusu. Podmienione pola organizatora, statusu i właściciela nie pozwalają zmienić decyzji serwera.
- Odrzucone, nieanulowane wydarzenie można jawnie wysłać ponownie do akceptacji. Akcja „Wyślij ponownie do sprawdzenia” zmienia `rejected` na `pending_review`; zwykłe „Zapisz” pozostawia `rejected`. Inny status lub anulowanie blokuje ponowne zgłoszenie.

Pełny zapis wydarzenia, źródła i działań moderacji nadal nie jest jedną transakcją. Awaria źródła lub moderacji po zapisaniu `events` może pozostawić częściowy wynik; scenariusz A04 pozostaje otwarty. Obsługa walidacji i przygotowania formularza nie zamyka tego problemu ani odbioru RLS na staging.

## Panel wyszukiwania i talie miejsc — aktualizacja 2026-10-06

- Aktualny układ panelu opisuje sekcja „Ujednolicony panel filtrów” powyżej. Zastępuje wcześniejsze rozwijanie ceny i kategorii na desktopie.
- Wydarzenia z tym samym `locations.id` tworzą talię zamiast sekcji małych kart. Front talii zajmuje tę samą szerokość listy co pojedyncze wydarzenie; miejsce dla tylnych kart znajduje się w bocznych marginesach stage, zamiast zwężać aktywną kartę. `EventCardContent` współdzieli zdjęcie, kategorię, datę, tytuł, opis, miejsce, odległość i cenę między zwykłą kartą a dekoracyjnymi podglądami. Tylne karty pokazują pełny układ wydarzenia, bez wypełniania całej powierzchni zdjęciem.
- Stałe warstwy przypisane do ID wydarzeń płynnie zamieniają pozycje; wybrana karta przechodzi na wierzch. Tylne karty są równoległe do frontu, bez obrotu i pionowego przesunięcia. Przy co najmniej trzech wydarzeniach przygaszone podglądy wystają z obu stron; dwie karty mają jeden rzeczywisty podgląd. Większe grupy pokazują do trzech warstw z każdej strony, zachowując wszystkie rekordy w nawigacji.
- Odsłonięte krawędzie wybierają sąsiednią kartę. Talia nie ma dolnych przycisków z tytułami ani widocznych kontrolek „wstecz/dalej”. Działają poziomy gest z interpolacją oraz strzałki klawiatury po ustawieniu fokusu na talii. Boczne obszary wyboru są natywnymi przyciskami z nazwą wydarzenia dla czytnika; licznik jest ogłaszany bez widocznej stopki. Pełne akcje wydarzenia i zapis należą do karty na wierzchu; podglądy nie tworzą dodatkowych kontrolerów zapisu. Talia zachowuje wybrany rekord podczas doładowania listy i respektuje ograniczony ruch.
- Wspólna nazwa lokalizacji i liczba wczytanych wydarzeń znajdują się nad talią. Na telefonie tylne karty mogą sięgać w boczne marginesy i są przycinane przy ekranie, bez dodawania poziomego przewijania strony. Boczne obszary wyboru na telefonie mieszczą się w widocznych 16-pikselowych marginesach, aby fokus lub kliknięcie nie przewijały strony do przyciętych warstw.
- Licznik talii dotyczy wydarzeń wczytanych do tej listy. Różne ID lub brak lokalizacji nadal nie są łączone po nazwie. Polecane i podobne wydarzenia zachowują swoje karuzele. Gest talii jest oddzielony od przełączania listy/mapy, a aktywna karta zachowuje zapis, szczegóły oraz pokazywanie na mapie.
- Nowe kontrolki używają wspólnych tokenów obu motywów i mają widoczny fokus. Aktualny panel zachowuje pole miejscowości o wysokości 44 px oraz mobilne kontrolki o wysokości co najmniej 44 px; desktopowe segmenty i kategorie pozostają kompaktowe. Style panelu i talii są w `app/search-panel.css` i `app/event-venue-deck.css`; wartości filtrów, publiczne zapytania i URL pozostają w dotychczasowym modelu.

Ujednolicenie kart przeszło **165/165 testów w 16 plikach** oraz końcowy build z typami/lint (0 błędów, 15 ostrzeżeń). Odbiór dev obu motywów przy 1440 px potwierdził identyczne 922 × 178 px frontu talii i pojedynczej karty. Przy szerokościach 360/390/768/1100/1440 px front i pojedyncza karta miały odpowiednio 313/343/689/1021/922 px oraz jednakowe obrazy, bez poziomego overflow strony. Oba mobilne obszary wyboru działały bez poziomego przewijania; szczegóły karty 2 „Koniec Świata” fokusowały tytuł, a Escape przywrócił tę samą kartę, link i URL. Desktop potwierdził wybór boczny i strzałki. Po odświeżeniu produkcyjnego podglądu ponownie potwierdzono równe rozmiary przy 1440/390 px, pełną treść tylnych kart, brak dolnych kontrolek i overflow oraz mobilny wybór Ethno 3 i powrót klawiaturą do „Koniec Świata” 2 bez poziomego przewijania. Przywrócono ciemny motyw. Fizycznego gestu palcem nie testowano. Frontend nie został opublikowany na hostingu. Szczegóły: [postęp MVP](mvp-progress-2026-10-05.md).

## Wyszukiwanie i dostępność — szósty pakiet, 2026-10-05

- Znane miasto ma jawne tryby „W mieście” i „W okolicy”. Bez `radius` wyniki obejmują lokalizacje powiązane z miastem; z `citySlug` oraz `radius` obejmują rzeczywisty promień od centrum miasta, również w innych miejscowościach. Wskazany punkt/GPS używa promienia. Lista, mapa i liczniki kategorii interpretują te same filtry URL.
- Sortowanie według daty albo odległości odbywa się na serwerze przed paginacją, dla pełnej pobranej puli kandydatów. Pierwsza paczka ma 20 kart, a limit widoku 300 kart jest stosowany po filtrach i sortowaniu; licznik pokazuje pełną liczbę dopasowań. Pula ma limit 50 000 kandydatów, mapa 10 000 punktów z poprawnymi współrzędnymi. Przekroczenie limitu zgłasza błąd, zamiast przedstawiać przycięty zestaw jako kompletny.
- Brak współrzędnych miasta lub wydarzenia pozostaje `null`. Miasto bez centrum nadal działa w trybie miejskim; kontrolki okolicy i sortowania odległości są wtedy wyłączone. Wydarzenie bez współrzędnych może być na liście miejskiej, ale nie tworzy punktu mapy i nie przechodzi filtra promienia.
- Kategorie mają osobny stan ładowania, błędu i przycisk ponowienia. Spóźnione odpowiedzi nie nadpisują nowych filtrów. Licznik listy rozróżnia wszystkie wyniki, wyświetlone karty i liczbę punktów na mapie.
- Pierwsze wyniki SSR respektują datę, cenę, promień i sortowanie z URL. Przekierowania kanoniczne zachowują dozwolone filtry; wyjątek nawigacji Next.js nie jest przechwytywany jako awaria geokodowania.
- W mobilnym workspace nieaktywne panele mają `inert` i `aria-hidden`. Otwarcie wydarzenia przenosi fokus na jego tytuł i zmienia tytuł karty przeglądarki. Zamknięcie/Escape przywraca źródłowy widok listy albo mapy, URL filtrów i dostępny wcześniej fokus; Escape z mapy wraca do listy. Zmiana na szerokość desktopową przywraca listę.
- Link do miejsca używa istniejącego adresu Google Maps, rzeczywistych współrzędnych lub tekstowego adresu i miasta. Bez punktu szczegóły pokazują „Wyszukaj miejsce w Google Maps”, jeśli istnieje sensowny adres; pomijają placeholdery i nie rysują fikcyjnej mapy.
- Edycja profilu organizatora wymaga potwierdzonego zmienionego wiersza przed przekierowaniem. RLS zwracające zero rekordów nie powoduje pozornego sukcesu; brakujące uprawnienia bazy pozostają osobnym zadaniem.

Lokalne API potwierdziło Wrocław: 15 wyników w mieście, 14 w promieniu 5 km i 18 w promieniu 100 km (Bielawa, Nysa, Opole, Wrocław). Przeglądarka potwierdziła 15 wyników dla Wrocławia i 50 km ze sortowaniem odległości oraz zachowanie filtrów po odświeżeniu. Po kontrolowanej lokalnej awarii przy zmianie na 73 km lista i kategorie pokazały błędy; ponowienie na końcowym produkcyjnym podglądzie przywróciło 16 kart i count 16. API listy, punktów i kategorii dały zgodne 16/16/16, z zachowanymi filtrami published/public/nieanulowane. Odświeżenie zachowało 73 km/nearest.

Odbiór klawiatury potwierdził fokus na tytule i zmianę tytułu dokumentu, historię wstecz/dalej szczegółów, powrót Escape do listy po otwarciu karty oraz do mapy po otwarciu jej podglądu, z odtworzeniem fokusu wywołującego przycisku. Escape z mapy wraca do listy. Oba motywy i szerokości 360/390/768/1100/1440 px nie mają poziomego overflow. Końcowe **149/149 testów w 14 plikach** oraz build z kontrolą typów i lint przeszły (0 błędów, 15 ostrzeżeń). Podgląd produkcyjny działa lokalnie; frontend nie został opublikowany na hostingu. Użytkownik potwierdził brak staging; [postęp MVP](mvp-progress-2026-10-05.md) i [checklista Auth/RLS](mvp-release-checklist-2026-10-05.md) opisują dalszy odbiór.

## Spójność publicznego UI — 2026-10-05

- Strona główna i publiczne widoki korzystające z `HomePage` mają wspólne powierzchnie kart, filtry, typografię i odstępy w obu motywach. Style discovery są zebrane w `app/discovery.css`, importowanym po `app/globals.css`.
- Panel wyszukiwania używa układu opisanego w sekcji „Ujednolicony panel filtrów” powyżej: cztery sekcje na desktopie i rozwijane dodatkowe filtry na telefonie.
- Hero zachowuje pięć kompaktowych kafelków. Margines publicznego widoku na telefonie wynosi 16 px z każdej strony, a Polecane pozostają nad filtrami.
- Zwykłe karty, karuzele Polecanych i karuzele miejsc używają wspólnych formatów daty, ceny, lokalizacji i odległości z `lib/event-presentation.ts`. Szczegóły również korzystają z tego formatu ceny i respektują oznaczenie całodniowe. Lokalizacja nie powtarza nazwy miasta, a odległość używa polskiego separatora dziesiętnego.
- Strzałki oraz podpowiedź przewijania karuzeli pojawiają się tylko wtedy, gdy karty nie mieszczą się w jej szerokości. Na telefonie pozostaje widoczny fragment następnej karty.
- Sidebar składa się z osobnych kart mapy, nadchodzących wydarzeń i popularnych kategorii. Nie zawiera sekcji powiadomień.
- Mobilne szczegóły nie rozszerzają swojej wewnętrznej siatki ponad ekran przez rozmiar obrazu lub długą treść. Tytuły, opisy i adresy mogą się zawijać.
- Kanoniczny link wydarzenia działa również dla importowanych slugów z wielkimi literami. Odczyt preferuje dokładne dopasowanie, a później sprawdza literalny slug bez rozróżniania wielkości liter; wieloznaczne dopasowania są odrzucane.

Pakiet przeszedł lokalny build i odbiór w przeglądarce. Szczegóły zakresu weryfikacji i pozostałych prób: [postęp MVP](mvp-progress-2026-10-05.md).

## Zapisane wydarzenia — wdrożone RPC, 2026-10-05

Własna lista zapisów i przyciski zapisu korzystają z nowych funkcji SQL wdrożonych po zgodzie właściciela. Zapis/usunięcie są idempotentne; funkcja odrzuca zapis wydarzenia niepublicznego lub anulowanego. Usunięcie jest możliwe po wycofaniu wydarzenia. Awaria odczytu zapisów pokazuje komunikat i ponowienie zamiast pozorować wylogowanie; błędy zapisu są widoczne również na kartach. Lista konta nadal wyświetla wyłącznie wydarzenia zwrócone przez publiczne zapytanie.

## Filtry i stany wyszukiwania — 2026-10-05, trzeci pakiet

- Mobilny panel pokazuje od razu miejsce i termin; aktualny przycisk „Filtry” rozwija dodatkowe opcje na telefonie. Desktop pokazuje wszystkie pola, a aktywne filtry pozostają widoczne po mobilnym zwinięciu.
- Kategorie są stale widoczne na desktopie i w rozwijanej sekcji na telefonie; wybory zgłaszają `aria-pressed` i mają widoczny fokus klawiatury. Przyciski mają 36/44 px wysokości, indywidualne kolory ikon kategorii i tło dopasowane do motywu.
- Lista ma szkielet podczas pobierania i zwięzły licznik. Pusty stan proponuje wyczyszczenie daty/kategorii/ceny lub przejście do całej Polski. Błąd pobierania ma osobny komunikat z ponowieniem; nie jest przedstawiany jako brak oferty.
- Po zmianie filtrów lista, markery i liczniki kategorii usuwają stare rekordy na czas pobierania. Każdy odczyt ma własne ładowanie, błąd i ponowienie; mapa pokazuje te stany na telefonie i desktopie.
- Autocomplete głównego panelu anuluje poprzednie zapytanie Photon, zachowuje lokalne podpowiedzi przy błędzie i nie odpytuje Nominatim. Brak dopasowania nie pokazuje niepowiązanych popularnych miast. Combobox ma nazwę, unikalne ID opcji i `aria-activedescendant`; usunięcie filtra miejscowości przełącza zakres na całą Polskę.


## Karuzele i dalsze naprawy MVP — 2026-10-05

- Polecane wydarzenia są nad filtrami wyszukiwania. Kompaktowe karty przewijają się poziomo; telefon pokazuje fragment następnej karty. Działają strzałki, klawiatura, scroll-snap i preferencja ograniczonego ruchu. Nagłówek i skróty kategorii są niższe na telefonie.
- Polecane respektują bieżące filtry. Osobne publiczne zapytanie pobiera do 8 rekordów `is_featured`; mają pierwszeństwo przed najbliższymi wydarzeniami z wyników. Gdy brak wyróżnionych, pasek pokazuje najbliższe pasujące wyniki. To wybór na podstawie wyróżnienia i daty, bez personalizacji ani automatycznego ustawiania flag w bazie.
- Wydarzenia z tym samym `locations.id` w aktualnej paczce wyników tworzą teraz talię miejsca. Kolejność grup wynika z pierwszego wydarzenia, wewnątrz zachowana jest kolejność wyników. Liczba opisuje aktualną listę, nie cały kalendarz miejsca. Różne identyfikatory lub brak lokalizacji nie są łączone po podobnej nazwie. Kolejne paczki mogą uzupełnić grupy.
- Podobne wydarzenia w szczegółach również używają poziomej karuzeli. Przesuwanie karuzeli nie przełącza widoku lista/mapa. Kliknięcia z Ctrl/Cmd zachowują zwykłe zachowanie linków.
- Szczegóły osadzone na telefonie pokazują adres i link Google Maps. Nie rysują mapy fikcyjnej Warszawy przy braku współrzędnych. Przycisk Cookies na mobilnej mapie jest po lewej, poza przyciskiem zamknięcia.
- Lista, markery i liczniki uwzględniają wydarzenia z zakończeniem późniejszym niż dolna granica czasu, również gdy już się rozpoczęły. Bez daty końca nie zgadują długości. Aktywny filtr promienia wyklucza wydarzenia bez współrzędnych. Szósty pakiet uzupełnił model promienia znanego miasta o wyszukiwanie okolicy poza jego granicami.
- Formularze logowania/rejestracji zachowują bezpieczną lokalną ścieżkę `next`, również podczas onboarding Google. Dodawanie wydarzenia wraca do formularza; propozycja konta organizatora odpowiada tej czynności. Rejestracja z sesją przechodzi do celu, bez sesji pokazuje komunikat aktywacji e-mail.
- JSON-LD pomija nieznaną cenę, datę końca, dostępność biletów i nie utożsamia organizatora z wykonawcą. Informacja o minionym terminie bez daty końca nie twierdzi, że znamy czas zakończenia.
- Podpowiedzi miast i adresów korzystają z Photon i lokalnych miast. Awaria nie uruchamia Nominatim autocomplete. Ograniczenie potwierdza [oficjalna polityka](https://operations.osmfoundation.org/policies/nominatim/). Istniejące jawne wyszukiwanie i reverse geocoding wymagają osobnej kontroli limitu ruchu całej aplikacji, cache i możliwości zmiany providera.

## Pakiet MVP — 2026-10-05

Widok Cała Polska pokazuje miasta bez umownych odległości, także w polecanych i bocznej liście. Nagłówki i status lokalizacji wyjaśniają zasięg oferty. Status GPS jest widoczny. Sortowanie odległości wymaga poprawnego centrum lokalizacji; od szóstego pakietu obejmuje pełną pulę dopasowań przed paginacją. Dla dzieci wybiera kategorię Rodzinne. Usunięto nieczynne CTA newslettera, powiadomień i społeczności; dodawanie wydarzenia ma działający link.

Daty klienta i serwera są liczone w Europe/Warsaw. JSON-LD używa bezpiecznej serializacji. Szczegóły i pozostałe zadania: [postęp MVP](mvp-progress-2026-10-05.md).

Panel wyszukiwania zapisuje w URL datę, cenę, aktywny `radius` i `sort=nearest`. Cena obsługuje tryby „Za darmo”, „Bez limitu” i limit maksymalny, np. `?kiedy=weekend&cena=max&cenaMax=80`. Promień można ustawić suwakiem albo polem km w zakresie 5–200 km; tryb miejski usuwa `radius`. Zmiany filtrów aktualizują adres przez `history.replaceState()` i pobierają pierwszą paczkę z `/api/events/search`. Limit 300 kart obowiązuje po przefiltrowaniu i uporządkowaniu całej puli kandydatów.

## Publiczne przeglądanie wydarzeń

Strona główna `/`:

- pobiera wydarzenia z Supabase przez `getHomeData()`;
- używa publicznej nazwy i domeny `MapaImprez.pl` w logo, metadanych i publicznych URL-ach;
- pokazuje hero, Polecane i panel wyszukiwania, a następnie elastyczną kolumnę wydarzeń z prawym sidebarem szerokości 310 px; do 1100 px główny układ przechodzi w jedną kolumnę;
- pokazuje wyróżnione wydarzenia w poziomej karuzeli nad panelem wyszukiwania;
- w sidebarze pokazuje osobne karty z mapą MapLibre, nadchodzącymi wydarzeniami i popularnymi kategoriami;
- wydarzenia w sekcji `Nadchodzące wydarzenia` linkują do swoich stron szczegółowych, a odnośnik `Zobacz kalendarz wydarzeń` przewija bieżącą stronę do pełnej listy;
- ikony serca w sekcji `Nadchodzące wydarzenia` używają tej samej logiki `saved_events`, co przyciski zapisu na głównych kartach wydarzeń;
- mapa w sidebarze ładuje się automatycznie dopiero po zbliżeniu panelu mapy do viewportu oraz po krótkim idle/delay, żeby pierwsze ładowanie strony nie pobierało od razu MapLibre, pinesek i kafelków mapowych; przycisk w placeholderze pozwala przyspieszyć ładowanie ręcznie;
- mapa w sidebarze po załadowaniu jest osadzona w osobnej karcie z nagłówkiem, wewnętrznym marginesem i zaokrągleniem;
- mapa na starcie używa zasięgu `Cała Polska`, obejmuje kadrem całą Polskę i pokazuje wydarzenia bez ograniczenia promieniem;
- mapa grupuje blisko położone wydarzenia w klastry; klastry mają ograniczony promień i rozbijają się na pojedyncze pineski przy średnim przybliżeniu, a kliknięcie klastra przybliża widok.
- mapa pobiera osobny lekki zestaw punktów z poprawnymi współrzędnymi dla aktualnych filtrów, niezależnie od paginowanej listy kart. Powyżej 10 000 punktów zgłasza błąd zamiast przycinać zestaw; licznik „na mapie” może być mniejszy od liczby wyników listy.
- pojedyncze pineski i klastry są kompaktowe, używają koloru oraz ikon kategorii wydarzeń i mają wyraźną przezroczystość; zaznaczona pinezka pozostaje mocniejsza, a wydarzenia z tymi samymi współrzędnymi są lekko rozsuwane wizualnie, żeby nie nachodziły idealnie na siebie.
- popup pojedynczej pineski pokazuje zdjęcie wydarzenia, klikalny tytuł prowadzący do szczegółów, adres i krótki opis.
- podstrony zakończonych, nadal opublikowanych wydarzeń pozostają dostępne i indeksowalne; zdjęcie jest wyszarzone, a komunikat kieruje do przyszłych podobnych wydarzeń. Nieaktualny link do biletów jest na takim widoku ukryty.
- publiczne szczegóły wydarzeń są renderowane jako statyczne ISR z krótką rewalidacją; prywatny stan przycisku zapisu jest dociągany po stronie klienta, aby nie wymuszać dynamicznego HTML dla botów i niezalogowanych użytkowników.
- opisy wydarzeń zachowują pojedyncze przejścia do nowej linii oraz akapity oddzielone pustym wierszem, bez interpretowania treści jako HTML.
- mapa pokazuje subtelnie kolorowane województwa o zróżnicowanej palecie, granice powiatów widoczne już od niższego poziomu przybliżenia na bazie warstwy `boundary` oraz numery budynków przy dużym przybliżeniu.
- etykiety mapy są preferowane w języku polskim, jeśli styl kafelków udostępnia pole `name:pl`; nazwy dużych, średnich i małych miejscowości pojawiają się wcześniej niż w stylu bazowym i są renderowane pod pinezkami wydarzeń.
- filtruje po presetach daty, niestandardowym zakresie dat, promieniu albo zasięgu `Cała Polska`, kategorii i opcji darmowych wydarzeń;
- pozwala wybrać lokalizację z autouzupełniania albo GPS;
- domyślnie sortuje wydarzenia według daty, z możliwością przełączenia na sortowanie po odległości.
- na widoku mobilnym zachowuje marginesy 16 px od krawędzi, a hero pokazuje pięć kompaktowych kafelków;
- panel wyszukiwania posiada główną akcję „Pokaż wydarzenia”; kliknięcie buduje URL z wybranych filtrów (kategoria, miasto/lokalizacja) i nawiguje do odpowiedniej podstrony (np. `/koncerty/wroclaw` lub `/lokalizacja?lat=...&lng=...&radius=...`);
- panel `SearchPanel` jest dostępny w publicznych widokach `HomePage`; miejsce i termin są widoczne od razu, cena i kategorie rozwijają się pod „Więcej filtrów”; na podstronach data filtruje dynamicznie, a zmiana kategorii lub miasta nawiguje po głównej akcji;
- panel pokazuje aktywne filtry jako chipy z przyciskami usuwania oraz pozwala wyczyścić wszystkie wybory; podsumowanie pozostaje widoczne przy zwiniętych dodatkowych filtrach;
- tło strony korzysta z tokenów wybranego motywu i przygaszonej dekoracji: `background.png` na większych ekranach oraz lekkich grafik mobilnych, w tym `background-dark-mobile.webp` w trybie ciemnym.
- stan ładowania strony głównej używa skeletonu o stabilnej wysokości zbliżonej do finalnego układu, żeby ograniczać przesunięcia layoutu podczas streamingu danych.

- autouzupelnianie lokalizacji najpierw dopasowuje aktywne miasta z tabeli `cities`, a potem scala je z wynikami Photon/OSM, czyli providera search-as-you-type dla miejsc; dzieki temu czesciowe wpisy typu `Srebrna Go`, `Stoszow` albo `Budzow` moga zwracac trafniejsze miejscowosci.
- autouzupelnianie lokalizacji wyswietla doprecyzowane etykiety z wojewodztwem, ale po wyborze zachowuje kanoniczny slug miasta (np. `Wroclaw (woj. dolnoslaskie)` nawiguje jak `wroclaw`).
- zewnetrzne wyniki miejscowosci bez aktywnej strony miasta przechodza do widoku geolokalizacji po wspolrzednych zamiast zgadywac slug dla niejednoznacznych nazw.
- teksty lokalne uzywaja bezpiecznej odmiany dla nazw konczacych sie na `Gora`, np. `Srebrna Gora` jest prezentowana jako `w Srebrnej Gorze`.
- `/regulamin` pokazuje publiczny regulamin serwisu, polityke prywatnosci / RODO oraz polityke cookies; link do strony jest dostepny w navbarze, stopce i glownym sitemap.
- Przy pierwszej wizycie aplikacja pokazuje banner cookies z wyborem `Akceptuje` albo `Odrzuc analityke`; Google Analytics laduje sie dopiero po zgodzie, a wybor mozna zmienic przyciskiem `Cookies`.

Starszy komponent `EventExplorer`, zachowany w repozytorium:

- aktualne publiczne trasy kategorii i miasta używają `HomePage`; `EventExplorer` nie jest do nich podłączony;
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
- do 6 podobnych wydarzeń z tej samej kategorii w poziomej karuzeli kart z obrazkami, kategorią, datą, lokalizacją i ceną.

Analityka szczegolow wydarzenia:

- route `POST /api/events/[id]/analytics` zapisuje zdarzenia w `event_analytics`;
- strona szczegolow zapisuje `view`, klikniecie biletow, telefonu, strony WWW, mapy, udostepnienia i zapisu wydarzenia.

## Strony miast

URL:

```text
/{citySlug}
```

Publiczny widok miasta rozwiązuje aktywną miejscowość z `cities`:

- tylko `is_active = true`;
- metadata i kanoniczny adres miejscowości;
- opcjonalne centrum z `latitude` i `longitude`, bez fikcyjnego punktu przy braku danych;
- wydarzenia z tego miasta bez `radius`, albo ze wskazanego promienia od jego centrum z `radius`.

## Kategorie

URL:

```text
/{categorySlug}
```

Strona:

- pobiera kategorię z `categories`;
- pobiera wydarzenia przez `category_id`;
- generuje metadata i JSON-LD `CollectionPage`;
- renderuje `HomePage`, pierwsze filtrowane wyniki SSR i dalszą paginację przez publiczne API.

## Geolokalizacja

URL:

```text
/lokalizacja?lat=50.589&lng=16.812&radius=30
```

Strona:

- czyta współrzędne i promień z query params;
- pobiera pierwszą stronę przez `searchPublicEvents()` na serwerze z filtrami daty, ceny, promienia i sortowania;
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
- Adresy `/{kategoria}/{miasto}` rozpoznają istniejącą kategorię i aktywne miasto oraz pokazują wynik aktualnych filtrów, również pusty stan. Fallback do geolokalizacji dotyczy miejscowości rozpoznanych przez geokodowanie; zachowuje dozwolone filtry i używa uzyskanych współrzędnych.
- `sitemap-category-cities.xml` nie tworzy już iloczynu wszystkich kategorii i aktywnych miast; korzysta z realnych par kategorii i miast wynikających z publicznych wydarzeń.
- `/robots.txt` wskazuje `sitemap.xml` i blokuje indeksowanie paneli, API oraz stron logowania/rejestracji.
- Typowe skany WordPress (`/wp-admin/*`, `/wp-login.php`, `/xmlrpc.php`) dostają szybkie 404 z `X-Robots-Tag: noindex, nofollow`, zamiast wpadać w publiczne trasy wydarzeń.
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
- `/login` ma logowanie Google OAuth, formularz email/hasło, link do rejestracji i odzyskiwania hasła. Po zmianie hasła pokazuje potwierdzenie `reset=success`.
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
- Kliknięcie logo na stronie głównej wymusza powrót do czystego `/`, resetując aktywny stan filtrów, query string i kotwice.
- Menu nawigacji jest dostosowane do urządzeń mobilnych (poniżej 1024px) – chowa się automatycznie i wysuwa za pomocą estetycznego przycisku hamburgera zmieniającego się w znak zamknięcia (X), blokując przewijanie strony pod spodem.
- Navbar pokazuje „Moje konto i zapisane” kontom bez roli organizatora; organizator widzi jeden link do panelu organizatora.
- Navbar nie pokazuje statycznego selektora lokalizacji, zeby nie sugerowac aktywnej lokalizacji uzytkownika.
- Navbar ma przycisk zmiany motywu jasny/ciemny. Wybor zapisuje sie w `localStorage` pod kluczem `eventmap-theme`, jest ustawiany przed hydratacja strony i obejmuje publiczne strony, panele konta oraz panele admina/organizatora przez globalne tokeny CSS i nadpisania `data-theme="dark"`. Bez zapisanego wyboru mobile startuje domyslnie w trybie ciemnym. Mapa MapLibre zachowuje ten sam styl kafelkow i warstw co w trybie jasnym, a mobile dark mode uzywa osobnego tla `background-dark-mobile.webp`.

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
- Upload obrazów do Supabase Storage.

Izolowane testy automatyczne istnieją w `tests/` i są uruchamiane przez Vitest. Pełne testy integracyjne Auth/RLS pozostają do wykonania na staging.

## Ostatnie aktualizacje UI

- Na urzadzeniach mobilnych publiczne listy wydarzen maja staly, pelnoszeroki dolny przelacznik `Lista | Mapa` z ikonami Lucide i animowanym wskaznikiem aktywnego widoku. Widok mapy korzysta z filtrow ustawionych na liscie i interaktywnie podaza za poziomym gestem palca, rysika lub myszy; po puszczeniu domyka albo cofa przejscie. Przycisk `Pokaz na mapie` na karcie centruje wybrane wydarzenie i otwiera jego mini karte.
- Mobilny widok mapy nie duplikuje panelu filtrow. Klikniecie pinezki pokazuje kontrolowana mini karte wydarzenia z krotkim opisem, a powrot do listy zachowuje poprzednia pozycje przewijania.
- Klikniecie `Zobacz wydarzenie` w mini karcie mapy otwiera szczegoly w trzecim mobilnym widoku i rozszerza dolny przelacznik do `Lista | Mapa | Wydarzenie`. Widok pokazuje obraz, najwazniejsze informacje, CTA, opis i organizatora, a zakladka pozostaje dostepna jako ostatnio ogladane wydarzenie podczas powrotu do mapy lub listy. Plynny gest pagera obejmuje wtedy wszystkie trzy ekrany.
- Mobilny widok wydarzenia ustawia w pasku adresu jego kanoniczny URL bez niszczenia stanu listy i mapy. Historia przegladarki odtwarza aktywny widok, filtry, zaznaczona pinezke i ostatnie wydarzenie; bezposrednie wejscie lub odswiezenie kanonicznego URL nadal korzysta z pelnej serwerowej strony szczegolow.
- Mobilna zakladka `Wydarzenie` korzysta ze wspolnego `EventDetailView` w trybie osadzonym, bez dodatkowej mapy i stopki. Otwieraja ja karty listy, polecane wydarzenia oraz mini karta mapy; wybor podobnego wydarzenia podmienia zawartosc, URL i przewija panel szczegolow na poczatek.
- Naglowek strony, opis, breadcrumbsy, sekcje kategorii/miast, linki `Inne wydarzenia` i tekst SEO odzwierciedlaja aktualny stan filtrow klienta. Podstrony kategorii i miast pobieraja wyniki z backendu po aktualnych filtrach, lacznie z count i paginacja.
- Lista publiczna pobiera pierwszą paczkę 20 kart i pełną liczbę dopasowań. Serwer sortuje pełną pulę przed wyborem stron i limitu 300 kart. „Pokaż więcej wydarzeń” pobiera następne strony po 20 dla aktualnych filtrów z `/api/events/search`. Mini karta mapy pobiera pełne dane wydarzenia dopiero po wybraniu punktu lub „Pokaż na mapie”.
- Publiczne formatowanie dat traktuje wartosci wydarzen bez jawnej strefy jako czas lokalny `Europe/Warsaw`, zeby nie pokazywac godziny przesunietej o offset serwera.
- Formularz admina wydarzen pozwala ustawic flage `is_featured` przez checkbox `Promowane`.
- Strona glowna dociaga promowane wydarzenia osobnym zapytaniem i pokazuje je w sekcji `Polecane wydarzenia` bez ograniczenia do najblizszego tygodnia.
- Tabele panelu admina dla wydarzen, kolejki review, organizatorow, lokalizacji, kategorii i miast SEO maja filtry, wyszukiwarke oraz sortowanie po kluczowych polach rekordow.
- Generowanie slugow transliteruje polskie znaki, np. `Łódź` -> `lodz`, `Wrocław` -> `wroclaw`, zamiast zamieniac je na myslniki.
