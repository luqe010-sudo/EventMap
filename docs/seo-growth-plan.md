# MapaImprez.pl — plan wzrostu na 90 dni

MapaImprez.pl ma **106 kliknięć z Google w Polsce w ostatnich 28 dniach**, wobec 317 w poprzednim oknie. Najpierw ustal, które strony i zapytania utraciły wyświetlenia. Równolegle przetestuj regularnie aktualizowane strony odpowiadające na lokalne pytania „co robić w weekend”, „gdzie pójść z dziećmi” i „co jest za darmo”. Karty konkretnych wydarzeń pomagają pozyskać ruch przed terminem, a stałe strony miast mogą go pozyskiwać przez cały rok. Cel eksperymentu na 90 dni to **212 kliknięć w oknie 28 dni**, czyli 2× obecny poziom. Następny punkt odniesienia to powrót do **317 kliknięć**. Śledź osobno widoczne zapytania bez marki.

## Punkt wyjścia z Search Console

Odczyt z 10 listopada 2026 r. W raporcie skuteczności ustawiono typ wyszukiwania **Sieć**, kraj **Polska** i gotowe porównanie w panelu „ostatnie 28 dni” z „poprzednimi 28 dniami”.

| Wskaźnik | Ostatnie 28 dni | Poprzednie 28 dni |
| --- | ---: | ---: |
| Kliknięcia | 106 | 317 |
| Wyświetlenia | ok. 8,88 tys. | ok. 22,4 tys. |
| CTR | 1,2% | 1,4% |
| Średnia pozycja | 9,7 | 8,8 |

Kliknięcia spadły o ok. 67%, a wyświetlenia o ok. 60%. Zmiana CTR wyniosła 0,2 punktu procentowego. Najpierw sprawdź utratę widoczności według pary strona–zapytanie i urządzenia. Średnia pozycja całej witryny zależy od tego, które zapytania i strony składają się na wynik.

| Strona | Kliknięcia, ostatnie / poprzednie 28 dni | Wyświetlenia, ostatnie / poprzednie 28 dni |
| --- | ---: | ---: |
| Strona główna | 10 / 73 | — |
| Zakończone wydarzenie ATB we Wrocławiu | 0 / 17 | 148 / 4 627 |
| Wydarzenie ATB w Gdyni | 5 / 0 | 972 / 1 |
| Strona miasta Wrocław | 0 / 0 | 68 / 95 |

Spadek wyświetleń zakończonego wydarzenia ATB we Wrocławiu i wzrost karty ATB w Gdyni wskazują, że terminy mogą przesuwać popyt między kartami. Dla zakończonych wydarzeń sprawdź związek spadków z ich datą. Dla strony głównej i aktualnych stron sprawdź odrębnie zapytania, datę ostatniego odczytu Google, stan indeksowania i adres kanoniczny.

Raport indeksowania z 6 listopada obejmował wszystkie znane Google adresy. Zawierał **438 zindeksowanych i 310 poza indeksem**. Wśród tych 310 było 182 wykrytych i niezindeksowanych, 77 zeskanowanych i niezindeksowanych, 49 z `noindex` oraz 2 przekierowania. Indeks `sitemap.xml` miał status **Sukces**, został ostatnio odczytany 9 listopada i pokazywał **321 wykrytych adresów**. Raporty obejmują różne zbiory. Odsetek zindeksowanych adresów zgłoszonych w mapie sprawdzaj w zakresie tej mapy lub na stałej próbce jej URL-i.

## Dni 1–14: pomiar i sprawdzenie indeksowania

1. Utrwal punkt wyjścia z [raportu Search Console](search-console.md). Ustal, które strony i zapytania straciły najwięcej wyświetleń. Zacznij od strony głównej, stałych stron miast i aktualnych kart. Osobno analizuj wygasające zainteresowanie zakończonymi imprezami. Zbierz dane według typu strony, urządzenia i widocznych zapytań bez marki. Jeśli masz dane, porównaj też analogiczny okres ubiegłego roku. Zachowaj ten sam typ wyszukiwania i kraj.
2. Zacznij sprawdzanie indeksowania od strony głównej. Następnie zbadaj stałą próbkę 30 adresów: 10 kart wydarzeń, 10 stron miast, 5 stron kategorii w mieście i 5 stron terminów. Uwzględnij adresy z widocznością i te wykryte lub zeskanowane bez indeksacji. W pierwszej kolejności wybieraj aktualne, wartościowe URL-e z mapy i kilka kart zakończonych wydarzeń do porównania. Zapisz HTTP, możliwość indeksowania, adres kanoniczny strony i ten wybrany przez Google, stan indeksowania i obecność w mapie. Sprawdź celowość `noindex` i przekierowań. Najpierw usuń wspólne problemy, które blokują wartościowe strony.
3. Zweryfikuj wszystkie mapy: powinny zawierać docelowe adresy zwracające 200, bez przekierowań i stron nieprzeznaczonych do indeksowania. [Indeks XML](../app/sitemap.xml/route.ts) wpisuje bieżący czas przy każdym odczycie; usuń ten `lastmod` lub wyznacz z rzeczywistej zmiany. [Zapytanie do Supabase](../lib/events.ts) używa pojedynczego odczytu z limitem; sprawdź kompletność przy produkcyjnym limicie API i w razie potrzeby zastosuj stronicowanie ze stabilną kolejnością. Uzgodnij, czy zakończone wydarzenia mają pozostać w sitemap: kod je wyklucza, [reguły biznesowe](business-rules.md) opisują ich pozostawienie. Nadal użyteczne karty powinny pokazywać stan zakończenia i linki do przyszłych wydarzeń.

## Dni 15–45: pilotaż w trzech miastach

Wybierz trzy miasta według wyświetleń w zapytaniach lokalnych, podaży zweryfikowanych wydarzeń i liczby źródeł publikujących regularnie. Widoczność kart wydarzeń we Wrocławiu uzasadnia sprawdzenie miasta w pilotażu. O wyborze zdecyduje też popyt na zapytania weekendowe, rodzinne lub bezpłatne. Miasto powinno móc dostarczać 8–15 potwierdzonych propozycji na najbliższe 2–4 tygodnie. Dobierz trzy podobne miasta porównawcze bez zmian szablonu i oznacz daty wdrożeń oraz kampanii.

- Rozwiń istniejące `/{miasto}` i `/{miasto}/weekend` oraz jedną stronę z potwierdzonym popytem, np. `/rodzinne/{miasto}`. Podaj daty, miejsca, ceny, dostępność zapisów i źródła. Wykorzystaj istniejące pola opisu z `city_pages`, które nie są obecnie używane przez publiczny szablon. Linkuj strony z aktualną ofertą z głównej i powiązanych kart. W publicznej próbce były puste [kultura w Warszawie](https://mapaimprez.pl/kultura/warszawa) i [weekend w Nysie](https://mapaimprez.pl/nysa/weekend); ponownie sprawdź je przed zmianą zasad, bo oferta jest zmienna.
- Zasilaj miasta co tydzień ze stron domów kultury, bibliotek, klubów i organizatorów. Na start wykorzystaj jarmarki, mikołajki i sylwestra z potwierdzonym programem, potem ferie zimowe. Aktualizuj kalendarz przed weekendem, sprawdzaj odwołania i kończące się zapisy. [Proces pozyskiwania wydarzeń](content-supply.md) już istnieje.
- Zastąp szerokie linkowanie pustych kombinacji linkami do stron z ofertą. Dla długich list dodaj zwykłe linki HTML do kolejnych stron, aby kolejne karty można było znaleźć bez przycisku „Pokaż więcej”. Używaj zweryfikowanego organizatora, adresu, odnośnika do biletów i cen także w `Event` JSON-LD. Nie opieraj prognozy na specjalnym widoku wydarzeń: Google nie wymienia Polski w [obsługiwanych regionach](https://developers.google.com/search/docs/appearance/structured-data/event#region-availability). [Paginacja według Google](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)
- Gdy GSC pokaże strony z wysokimi wyświetleniami, pozycją około 4–15 i niskim CTR przy podobnym urządzeniu i pozycji, przetestuj tytuły dopasowane do intencji. Przykład: „Co robić w weekend w [mieście]? Aktualne wydarzenia” z faktyczną listą weekendową. Wprowadzaj zmiany partiami i odnotowuj daty.

## Dni 46–90: dystrybucja i decyzja o rozszerzeniu

Zaproponuj domom kultury i organizatorom regularne dodawanie wydarzeń oraz podlinkowanie aktualnego kalendarza w ich serwisie lub newsletterze. Zbierz ruch z tych poleceń przez oznaczone linki UTM. Rozszerz format na kolejne 3–5 miast, jeśli dwa kolejne odczyty tygodniowe pokazują wzrost kliknięć w oknie 28 dni ponad zmianę w miastach porównawczych, a oferta pozostaje aktualna i rośnie liczba stron z wejściami. Przy małej próbce wydłuż obserwację; pojedynczy pik przy okazji dużej imprezy nie dowodzi skuteczności szablonu.

| Co mierzyć co tydzień | Jak podjąć decyzję |
| --- | --- |
| Kliknięcia Google z Polski i widoczne zapytania bez marki | Porównaj okna 28 dni i śledź wartości bezwzględne względem 106, celu 212 i wcześniejszego wyniku 317. Przy sezonowym skoku porównaj miasta poza pilotażem i analogiczne daty, jeśli są dane. |
| Wyświetlenia, CTR przy podobnej pozycji i strony z kliknięciami | Przy spadku wyświetleń oddziel zakończone wydarzenia od aktualnych i stałych stron. Dla tych drugich sprawdź indeksowanie, linki i aktualność oferty. Przy wysokich wyświetleniach i niskim CTR sprawdź tytuł, opis i dopasowanie oferty do zapytania. |
| Zindeksowane adresy w stałej próbce oraz liczba aktualnych, zweryfikowanych wydarzeń w mieście | Popraw odkrywanie, aktualność i jakość stron przed uruchomieniem kolejnych miast. |
| Sesje organiczne i z poleceń w GA4; kliknięcia w bilety, mapę i zapis wydarzenia | Gdy kliknięcia Google rosną bez interakcji, sprawdź mobilną kartę, informacje o terminie, cenie i widoczność działań. Dane zależą od zgody na analitykę. [Pomiar interakcji](event-analytics.md). |

GSC mierzy kliknięcia w Google. Sesje GA4 i działania na wydarzeniach są osobnymi wskaźnikami i nie należy ich dodawać do kliknięć. Przy liczeniu zapytań bez marki zapisuj użyty filtr oraz ograniczenie wynikające z anonimizacji zapytań. Przy liczeniu stron z kliknięciami nie używaj uciętej listy „top stron” z lokalnego raportu jako pełnego zbioru.
