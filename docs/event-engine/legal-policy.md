# Event Engine — polityka prawna źródeł

Wersja reguł w kodzie: `LEGAL_RULES_VERSION = 2026-11-26.v1` (`engine/src/legal/policy.ts`). To nie jest porada prawna; reguły wymagają zatwierdzenia przez właściciela w panelu (kolejka decyzji → „Reguły prawne”). Do tego czasu **żadne źródło nie jest akceptowane automatycznie**.

## Co pobieramy i publikujemy

Wyłącznie fakty o publicznych wydarzeniach: nazwa, data i godzina, miejsce i adres, cena/wstęp wolny, status (odwołane), link do strony organizatora. Fakty nie są utworami w rozumieniu prawa autorskiego. **Nie** pobieramy i nie publikujemy: opisów, zdjęć, plakatów, logotypów, danych osobowych. Opis w serwisie powstaje z szablonu na podstawie faktów, a obraz to lokalna licencjonowana okładka EventVisual (`main_image_url = null`).

## Kolejność reguł

| Reguła | Wynik | Opis |
|---|---|---|
| L1 decyzja właściciela | akceptacja / blokada | ma pierwszeństwo nad wszystkim |
| L0 lista blokad | blokada | serwisy biletowe (Biletyna, eBilet, Going, Eventim, Ticketmaster, KupBilecik, Bilety24…), agregatory i portale konkurencyjne, sieci społecznościowe za logowaniem. Ochrona przed naruszeniem prawa producenta bazy danych (art. 6 i 8 ustawy o ochronie baz danych) |
| L2 robots.txt | blokada | zakaz dla strony głównej lub kanału; robots niedostępny (5xx/sieć) = zakaz |
| L3 regulamin / TDM | decyzja właściciela | wykryty zakaz kopiowania/pobierania/scrapingu, zastrzeżenie eksploracji tekstu i danych (art. 26³ pr. aut.; `<meta name="tdm-reservation">`, `/.well-known/tdmrep.json`) |
| L4 otwarta licencja | akceptacja* | CC0, CC BY, CC BY-SA, PDDL (bez NC/ND) |
| L6 sektor publiczny | akceptacja* | gminy, powiaty, `gov.pl`, samorządowe instytucje — ponowne wykorzystanie ISP (ustawa z 11.08.2021), o ile strona nie stawia warunków |
| L5 własny kanał organizatora | akceptacja* | organizator/obiekt publikuje własne wydarzenia na własnej domenie (ICS, RSS, schema.org, publiczne API kalendarza WordPress), robots pozwala, brak zakazu/TDM |
| brak podstawy | decyzja właściciela | — |

\* tylko gdy reguła jest zatwierdzona przez właściciela dla bieżącej wersji. Źródła, które spełniłyby niezatwierdzoną regułę, nie zasypują kolejki: czekają pod jedną decyzją „Zatwierdź reguły…”, a po zatwierdzeniu są automatycznie zwalniane (`legal.recheck_due`).

Źródła aktywne są weryfikowane ponownie co 90 dni; zmiana robots.txt jest respektowana przy każdym pobraniu (cache 24 h).

## Pochodzenie i wycofanie

- `candidates` + `provenance` (SQLite): URL, hash treści, reguła prawna i czas każdej obserwacji.
- Supabase: `event_sources.source_type = 'engine'`, `external_id = engine:<sourceId>:<id>`, `source_url` = strona organizatora; `events.review_note` = `EventMap engine v1; source=<id>; key=<klucz>; url=<url>`.
- Wycofanie źródła (panel → „Wycofaj rekordy”): wszystkie wydarzenia źródła → `archived`, źródła wydarzeń → `is_active=false`. Operacja odwracalna przez admina, zapisana w audycie.

## Atrybucje

- Wikidata — CC0 (atrybucja niewymagana; używana tylko do odkrywania adresów stron).
- OpenStreetMap/Nominatim — dane ODbL: współrzędne z geokodowania wymagają atrybucji „© OpenStreetMap contributors” w serwisie (do potwierdzenia, czy mapa już ją wyświetla — patrz decyzje). Zasady użycia publicznego Nominatim: ≤1 req/s, identyfikujący User-Agent, cache — spełnione.

## Otwarte kwestie prawne (dla właściciela)

1. Zatwierdzenie reguł L4/L5/L6 (lub części).
2. Czy portale miejskie (np. kalendarz miasta zbierający wydarzenia wielu podmiotów) traktować jako L6, czy kierować pojedynczo do decyzji.
3. Ewentualna konsultacja prawnika ws. prawa sui generis baz danych przy dużej skali z jednej domeny (silnik już ogranicza się do własnych wydarzeń organizatora).
