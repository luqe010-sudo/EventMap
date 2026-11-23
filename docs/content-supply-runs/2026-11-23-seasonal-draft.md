# Jarmarki bożonarodzeniowe — projekt do akceptacji, 23 listopada 2026

**Status: NIEOPUBLIKOWANE.** Przygotowano paczkę z **3 jarmarkami** (Kraków, Łódź, Szczecin) dla strony [/jarmarki-bozonarodzeniowe](https://mapaimprez.pl/jarmarki-bozonarodzeniowe). Wykonano wyłącznie odczytowy dry-run importera. Nic nie zostało zapisane do bazy. Publikacja wymaga akceptacji właściciela.

Kontynuacja przebiegów [10 listopada](2026-11-10-seasonal.md) i [16 listopada](2026-11-16-seasonal.md). Bydgoszcz, Katowice (Rynek), Toruń, Poznań i Wrocław są już opublikowane i nie trafiły do paczki.

## Gotowe do publikacji

| Miasto | Początek lokalny | Koniec lokalny | Wydarzenie | Wstęp | Źródło główne | Dry-run |
|---|---|---|---|---|---|---|
| Kraków | 27.11.2026 10:00 | 01.01.2027 20:00 | Jarmark Bożonarodzeniowy w Krakowie 2026 | niepodany | [krakow.pl](https://krakow.pl/aktualnosci/346609,33,komunikat,krakow_w_swiatecznej_odslonie__jarmark_bozonarodzeniowy_wraca_na_rynek_glowny.html) (opubl. 20.11, akt. 23.11) | `would_insert_and_publish`, `duplicate_id: null` |
| Łódź | 28.11.2026 12:00 | 23.12.2026 20:00 | Jarmark Bożonarodzeniowy na Piotrkowskiej w Łodzi 2026 | niepodany | [Łódzka Organizacja Turystyczna](https://lodz.travel/aktualnosci-lodzkiej-organizacji-turystycznej/artykul-lot/swieta-na-piotrkowskiej-2026-koncerty-silent-disco-mikolajki-i-swiateczna-ciezarowka-coca-cola-id63816/2026/11/23/?cHash=a9b8cb0a9ea5dd09dc433151572247b9) (23.11) | `would_insert_and_publish`, `duplicate_id: null` |
| Szczecin | 27.11.2026 13:00 | 22.12.2026 20:00 | Szczeciński Jarmark Bożonarodzeniowy 2026 | niepodany | [Kolorowa Aleja (ZSTW, organizator)](https://kolorowaaleja.pl/szczecinski-jarmark-bozonarodzeniowy-2/) | `would_insert_and_publish`, `duplicate_id: null` |

Dry-run z 23.11.2026, `checked_at` 16:31:42Z. Wszystkie trzy pozycje mają kategorię `targi`, miasto rozpoznane jednoznacznie i `creates_location: true`. Ręcznie porównano opublikowane wydarzenia od 1.11 z „jarmark”, „świąteczn” lub „szopek” w tytule (24 rekordy). W Krakowie, Łodzi i Szczecinie nie ma innego jarmarku. Konkurs Szopek Krakowskich (`d8a2424b-…`) to osobne wydarzenie, ujęte w programie jarmarku.

### Uzasadnienie i decyzje

**Kraków.** Miejski komunikat potwierdza termin od 27 listopada do 1 stycznia 2027, Rynek Główny, organizatora (Krakowska Kongregacja Kupiecka, realizacja Artim) i otwarcie 28.11 o 12:00. Miejski [program PDF](https://plikimpi.krakow.pl/zalacznik/645028) (utworzony 19.11) zaczyna 27.11 punktami „od 10:00”. Na tej podstawie start to 10:00.
- **Rozbieżność końca:** miasto podaje 1.01.2027, a [PIK Kraków](https://pik.krakow.pl/jarmark-bozonarodzeniowy-w-krakowie/) 6.01.2027. Przyjęto pewne minimum, 1.01.2027, a opis wspomina o rozbieżności.
- **Godzina końca 20:00** pochodzi z godzin sprzedaży PIK (10:00–20:00, wybrana gastronomia dłużej). Miasto nie podaje godzin dziennych, a godziny 1 stycznia mogą być inne. Jeśli właściciel woli ostrożniej, można usunąć `end_at` przed publikacją. Wtedy karta zniknie ze strony sezonowej po 27.11.
- **Wstęp:** PIK podaje wstęp bezpłatny, miasto o tym nie pisze. Zostawiono `unknown`.

**Łódź.** Dwa artykuły Łódzkiej Organizacji Turystycznej (17.11 i 23.11) podają ten sam termin: 28.11–23.12.2026. Godziny stoisk: pon.–pt. 12:00–20:00, sob.–niedz. 12:00–21:00. Miejsce: odcinek Piotrkowskiej od pasażu Rubinsteina do pasażu Schillera. Rozświetlenie choinki 28.11 o 17:30 na placu Wolności. Rozbieżność z 16.11 (otwarcie 28.11 17:30 albo 29.11 19:00) rozstrzyga oficjalny komunikat: 28.11.
- 28.11 to sobota, więc start przyjęto o 12:00, zgodnie z godzinami stoisk. Koniec: środa 23.12, 20:00.
- Strona miasta `lodz.pl/swieta` przekierowuje na `uml.lodz.pl` z testem CAPTCHA. Nie obchodzono go.
- PIK Łódź (evidence) podaje organizatora Jantom Art, 30 wystawców (LOT: 60 domków) i wstęp bezpłatny. Zostawiono `unknown`.
- Pinezka: pasaż Artura Rubinsteina, [OSM way 104487423](https://www.openstreetmap.org/way/104487423). To kraniec odcinka jarmarku i miejsce koncertu otwarcia. Nominatim nie znalazł pasażu Schillera.

**Szczecin.** Organizator, miejska spółka Żegluga Szczecińska Turystyka Wydarzenia, publikuje na kolorowaaleja.pl program z oknem godzinowym na każdy dzień. Piątek 27.11: 13:00–22:00. Wtorek 22.12: 13:00–20:00. Termin i trzy place (Aleja Kwiatowa, plac Adamowicza, plac Lotników) potwierdzają też [zstw.szczecin.pl](https://zstw.szczecin.pl/pl/wydarzenia/2026/szczecinski-jarmark-bozonarodzeniowy/informacje-o-wydarzeniu) i [wiadomosci.szczecin.eu](https://wiadomosci.szczecin.eu/artykul/mieszkancy/szczecinski-jarmark-bozonarodzeniowy-2026-blisko-90-wystawcow-i-mnostwo-swiatecznych-atrakcji) (artykuł o edycji 2026).
- Zastrzeżenie: okna godzinowe to nagłówki dni programu, a nie wprost opisane „godziny stoisk”. Nie użyto artykułu z godzinami z 2025 r.
- Pinezka: plac Lotników (Wikipedia). Rozbłyśnięcie choinki 6.12 o 17:00 przed Urzędem Miasta. Uwaga: artykuł wiadomosci.szczecin.eu podaje inny punkt startu parady (plac Armii Krajowej) niż program organizatora. Opis podaje wersję organizatora.

Grafiki: w żadnym przypadku nie potwierdzono praw, więc `main_image_url` jest puste i okładki wyświetli EventVisual.

## Nadal odłożone

| Miasto | Powód (stan na 23.11.2026) |
|---|---|
| Katowice-Nikiszowiec (Jarmark na Nikiszu) | Termin 11–13.12 i godziny (pt. 12–20, sob. 11–21, niedz. 11–19) podają tylko media lokalne. [PIK Katowice](https://pik.katowice.pl/jarmark-na-nikiszu/) ma pod nagłówkiem 2026 dane edycji 2025 (5–7.12.2025) i pisze, że termin poda, gdy organizator go ogłosi. Nie znaleziono komunikatu Stowarzyszenia Fabryka Inicjatyw Lokalnych ani katowice.eu. Artykuł wkatowicach.eu zwraca 404. |
| Lublin | Brak ogłoszonego terminu na 2026 r. |
| Opole | Brak komunikatu opole.pl na 2026 r. (w wynikach jest tylko edycja 2025: 28.11–23.12.2025). |
| Rzeszów | Brak terminu na 2026 r. Znaleziony artykuł się.pl nie ma roku i nie pasuje do kalendarza 2026. |
| Gdynia | Brak terminu na 2026 r. |
| Białystok | Brak terminu na 2026 r. (wyniki tylko z 2024 r.). |

## Zalecenia dla istniejących kart (niezmienione)

**Poznań — Betlejem Poznańskie** ([karta](https://mapaimprez.pl/targi/poznan/curated-jarmark-bozonarodzeniowy-betlejem-poznanskie-2026-otwarcie-poznan-2026-11-20-94c60fae4e76), `4371d7c5-7588-483b-a393-20d7a3369de3`)
- [betlejempoznanskie.pl](https://betlejempoznanskie.pl/) (Urząd Miasta Poznania) nadal **nie publikuje godzin stoisk**. Podaje tylko program wydarzeń, w tym otwarcie 20.11 o 18:00 (news z 17.11).
- Daty: plac Wolności 20.11.2026–6.01.2027, Stary Rynek 21.11.2026–6.01.2027, MTP 14.11–20.12.2026. Warto sprawdzić, czy opis karty zawiera te trzy lokalizacje i daty końca.
- Karta ma tylko otwarcie, bez końca, więc po 20.11 zniknęła ze strony sezonowej. Bez godzin stoisk nie da się bezpiecznie ustawić `end_at`. Sprawdzić ponownie.

**Wrocław — plac Nowy Targ** ([karta](https://mapaimprez.pl/targi/wroclaw/curated-jarmark-nowy-swiateczny-targ-we-wroclawiu-2026-otwarcie-wroclaw-2026-11-20-e6fb70f70e99), `ef2b988b-13b4-47a5-a84f-f9b7c46987d2`)
- [jarmarkwroclaw.pl](https://jarmarkwroclaw.pl/) podaje tylko „Jarmark Plac Nowy Targ 20.11.-20.12.2026”, bez godzin. [wroclaw.pl](https://www.wroclaw.pl/go/wydarzenia/rozrywka/1417760-jarmark-bozonarodzeniowy-nowy-swiateczny-targ) podaje „Trwa do 20.12.2026” i „Wstęp wolny”. Widżet terminów pokazuje 20.11 15:00, ale kolejne dni są ukryte i nie są opisane jako godziny stoisk. [Artykuł wroclaw.pl z 28.10](https://www.wroclaw.pl/dla-mieszkanca/nowy-jarmark-swiateczny-na-placu-nowy-targ-terminy-atrakcje) zapowiada szczegóły „wkrótce”.
- Data końca 20.12.2026 jest potwierdzona przez organizatora i miasto. `end_at` będzie można ustawić, gdy pojawi się godzina zamknięcia.
- Organizator prowadzi też osobny **Jarmark Kraina Koni** (Partynice, 28.11–20.12.2026). To kandydat do osobnego sprawdzenia w kolejnym przebiegu: nie sprawdzano godzin.

## Polecenie publikacji (do zatwierdzenia przez właściciela)

Z katalogu `E:\EventMap`, po akceptacji. Uwaga: importer odrzuca `checked_at` starsze niż 48 godzin, czyli po 25.11.2026 ok. 17:31 czasu polskiego. Później trzeba ponownie zweryfikować źródła i odświeżyć `checked_at`.

```powershell
node --env-file=.env.local scripts/import-curated-events.mjs --file data/content-supply/2026-11-23-seasonal.json
$env:EVENTMAP_IMPORT_WRITE = "1"
node --env-file=.env.local scripts/import-curated-events.mjs --file data/content-supply/2026-11-23-seasonal.json --apply
Remove-Item Env:EVENTMAP_IMPORT_WRITE
```

Po publikacji: odczytać ID publicznym klientem, sprawdzić HTTP 200 kart i obecność Krakowa, Łodzi i Szczecina na `/jarmarki-bozonarodzeniowe`, a następnie zapisać wynik w `docs/content-supply-runs/2026-11-23-seasonal.json`.

[Paczka](../../data/content-supply/2026-11-23-seasonal.json)
