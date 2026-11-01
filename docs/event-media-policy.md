# Obrazy wydarzeń: zasady i obsługa

## Stan mediów produkcyjnych — 1.11.2026

Właściciel wyraźnie zatwierdził przesłanie przygotowanego kodu i licencjonowanych zdjęć do istniejącego projektu Vercel `event-map` oraz publikację na `mapaimprez.pl`. Wdrożenie `dpl_5FdEtNHdYRV7e2WtEbc7kHg2wHUm` działa na domenie głównej i www. Potwierdzono okładki EventVisual, osiem lokalnych zdjęć z SHA-256, podpisy ilustracyjne, zachowanie całego plakatu oraz odbiór mobilny i desktopowy.

Przy nowych wydarzeniach korzystaj z tej oprawy bez ponownego uploadu ilustracji i bez generowania AI. `main_image_url` pozostaje przeznaczone na rzeczywiste materiały wydarzenia z potwierdzonym prawem użycia. Ta zgoda obejmowała niniejsze wdrożenie; kolejne zmiany hostingu lub prywatne transfery źródeł oceniaj według nowego zakresu zlecenia. Raport: [event-media-release-2026-11-01.md](event-media-release-2026-11-01.md).

## Cel

Portal ma zachować atrakcyjną, czytelną oprawę także wtedy, gdy organizator nie udostępnia materiałów z potwierdzonym prawem dalszej publikacji. Codzienny import nie powinien wymagać tworzenia osobnego obrazu dla każdego wydarzenia. Generowanie grafik AI zostało zatrzymane na polecenie właściciela; nie jest częścią tej procedury.

## Kolejność wyboru

1. Oficjalny plakat lub fotografia, jeśli konkretna zgoda, licencja albo warunki materiałów prasowych obejmują publikację na EventMap. Samo publiczne umieszczenie pliku, przycisk pobrania lub nazwa sekcji „dla mediów” nie potwierdzają zakresu praw. Zachowaj wymagane podpisy i treść plakatu.
2. Jeśli w ciągu krótkiego przeglądu źródła nie da się potwierdzić warunków, pozostaw `main_image_url` puste. Wspólny komponent automatycznie pokaże tematyczną fotografię z lokalnej biblioteki z nazwą, terminem i miastem. Nie trzeba pobierać ani uploadować zdjęcia ponownie dla kolejnych rekordów.
3. Jeśli temat nie pasuje do żadnej fotografii, komponent pokaże własną oprawę typograficzną z ikoną kategorii i faktami wydarzenia. Nie przypisuj losowej fotografii innego miejsca, artysty lub edycji tylko po to, by zapełnić pole.

Praktycznie: nie blokuj pewnej, wartościowej informacji o wydarzeniu długim poszukiwaniem plakatu. Nie wysyłaj organizatorom wiadomości bez osobnego upoważnienia. Nowych ilustracji AI nie generuj i nie wykorzystuj wcześniejszych, odrzuconych obrazów.

## Potwierdzenie praw do materiału oficjalnego

Przed zapisem oficjalnego pliku zachowaj w lokalnej dokumentacji: stronę i URL assetu, podmiot udzielający praw, podstawę i zakres wykorzystania, URL warunków lub otrzymanej zgody, datę sprawdzenia, wymagane oznaczenie autora oraz powiązane ID wydarzenia. Nie uznawaj opisu „oficjalny” za licencję. Zgoda organizatora musi obejmować uprawnienia, którymi faktycznie dysponuje; fotografia osoby i elementy osób trzecich mogą wymagać osobnej oceny.

Art. 17 ustawy o prawie autorskim ustanawia zasadę wyłączności praw; art. 2 dotyczy korzystania z opracowań. Oznaczenie autora i źródła nie stanowi samoistnej podstawy wykorzystania. Prawo cytatu ma określone cele, więc nie zakładamy automatycznie, że każda ozdobna reprodukcja plakatu w zapowiedzi je spełnia. [Oficjalny tekst ustawy](https://api.sejm.gov.pl/eli/acts/DU/2025/24/text.pdf).

Przegląd aktualnej paczki 29.10.2026 nie potwierdził jawnej licencji na konkretne plakaty 21 wydarzeń. Nie pobierano ich do publikacji i nie zmieniano ich przez AI. Brak potwierdzenia nie oznacza stwierdzenia zakazu; portal korzysta w tych miejscach z odrębnych, udokumentowanych fotografii ilustracyjnych.

## Lokalna biblioteka zdjęć

Manifest [data/media/editorial-photos.json](../data/media/editorial-photos.json) zawiera osiem fotografii, autorów, pierwotne strony, linki do licencji, faktyczny czas sprawdzenia, rozmiary i SHA-256. Pliki w `public/images/editorial/` są dostarczane z aplikacją; renderowanie nie kontaktuje się z Unsplash/Pexels ani losowym generatorem. Łączny rozmiar ośmiu JPEG: około 1 MB.

- [Unsplash License](https://unsplash.com/license) pozwala m.in. na komercyjne użycie i modyfikacje. Nie dopuszcza odsprzedaży niezmienionych kopii ani budowania konkurencyjnego banku zdjęć. Atrybucja jest mile widziana, choć nieobowiązkowa.
- [Pexels License](https://www.pexels.com/license/) pozwala na wykorzystanie i modyfikacje zdjęć na stronie. Należy zachować ograniczenia dotyczące m.in. sugerowania poparcia przez widoczne osoby/marki i dystrybucji jako bank zdjęć.

Fotografie zostały obejrzane po pobraniu. Odrzucono pierwsze zdjęcie włóczek z widocznymi etykietami oraz pierwsze zdjęcie kina z osobami; zastąpiono je martwą naturą i pustą widownią. Używana biblioteka nie przedstawia konkretnych wykonawców, uczestników ani polskich miejsc wydarzeń. Zdjęcia ptaków i terrarium są motywami, nie relacją z danego spaceru lub targów.

W UI widnieje „Zdjęcie ilustracyjne”, a w szczegółach także autor i platforma. Nie zapisuj tych fotografii jako `events.main_image_url`: pole pozostaje przeznaczone na rzeczywisty materiał danego wydarzenia. W przyszłości dodawaj tylko zdjęcia, których licencję, pochodzenie i samą bitmapę zweryfikowano; aktualizuj manifest i test SHA.

## Implementacja i odbiór

`lib/event-cover-media.ts` wybiera wąski motyw na podstawie tytułu. Nie przydziela automatycznie saksofonu lub fortepianu każdemu koncertowi. `components/EventVisual.tsx` obsługuje oficjalne obrazy, zdjęcia ilustracyjne oraz samą typografię, także po błędzie pobierania obrazu. Oprawa obejmuje karty listy, karuzele, szczegóły, zapisane wydarzenia i podglądy mapy. Popup MapLibre używa bezpiecznej wersji DOM z escapowaniem treści.

Oficjalne plakaty używają `object-fit: contain`, dzięki czemu kadr nie obcina napisów. Puste pole obrazu nie powoduje żądania `src=""` ani podstawienia panoramy niezwiązanej z wydarzeniem. JSON-LD pomija brak oryginalnego obrazu; ilustracji nie podaje jako fotografii wydarzenia. Nie zmieniano schematu, RLS ani statusów wydarzeń.

Przed publikacją sprawdzaj: TypeScript, lint, testy, build; następnie jasny i ciemny motyw, szerokości mobilne i desktopowe, długi tytuł, plakat pionowy, błąd źródła, podgląd mapy i brak poziomego overflow. Nie uruchamiaj `next dev` równolegle z buildem w tym samym `.next`. Zdalny deployment Vercel ma budować źródła od nowa; lokalnego buildu z originem localhost nie publikuj przez `--prebuilt`.
