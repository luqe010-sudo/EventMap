# Wzorzec graficzny MapaImprez.pl

Trzy wizualizacje użytkownika są wzorcem wspólnego interfejsu. Ramka telefonu i pasek systemowy nie są elementami strony. Treść pochodzi z istniejącej bazy, więc długość tytułów, zdjęcia, liczba wydarzeń i stan zalogowania zależą od danych.

## Elementy wzorca

- Tło atramentowe `#08121e`, szkło granatowe `#0e1926`, stalowe krawędzie, biały tekst. Akcent `#ff7900`, subtelny żar wokół aktywnych elementów i CTA.
- Lokalny Inter. Mocne nagłówki z umiarkowanie ciasną interlinią, lżejsze metadane. Pomarańczowy punkt po tytule hero.
- Desktop: rama około 84,4% szerokości do 1340 px, menu 58 px, hero około 170 px. Wyszukiwanie w jednym rzędzie, kategorie pod nim. Kolumny wydarzenia/mapa w proporcji około 2:1.
- Polecane desktop: trzy fotografie w kartach około 240 px wysokości. Weekend: cztery zwarte karty. Meta w dolnym gradiencie, kolorowy pill kategorii, szklane serce, cena i jawne „Promowane”.
- Mobile: centralne logo, hamburger i dzwonek otwierający plan z odnośnikami do zapisanych/konta. Hero z fotografią po prawej, sześć skrótów kategorii w przewijanym rzędzie, wyszukiwanie, następnie dwa równe pola miejsca i terminu.
- Polecane mobile: prawie pełna szerokość, fragment kolejnej karty, duży tytuł nad datą i miejscem, cena w pillu, małe wskaźniki karuzeli.
- Dolne menu: cztery pozycje Odkryj / Lista / Mapa / Profil, ikona nad podpisem. Górne rogi 25 px, stalowa linia, aktywne pole z bursztynowym szkłem i pomarańczowym obrysem. Uwzględniony safe area urządzenia.
- Mapa: rzeczywista kartografia, Polska w granacie i turkusie, otoczenie wygaszone. Jasny rdzeń granicy z dwiema poświatami, błyszczące kolorowe piny z białą ikoną. Zoom biały. Podgląd mobile z fotografią 32% szerokości, uchwytem i CTA z pomarańczowym obrysem.
- Podstrony: ten sam nagłówek, typografia, tło, pola, krawędzie paneli i dolna nawigacja. Logowanie, konto, szczegóły, strony redakcyjne oraz formularze paneli zachowują istniejące działania.

## Zakres weryfikacji

Walidacja kodu obejmuje TypeScript, testy, lint i build. Bieżąca kontrola wizualna w przeglądarce została zablokowana przez zapisane uprawnienie narzędzia dla localhost, również po ponownej zgodzie użytkownika. Nie stanowi to potwierdzenia zgodności pikselowej. Wymaga odbioru w rzeczywistej przeglądarce przy szerokości 390 px i 1440–1586 px.

### Odbiór 25.11.2026 (druga iteracja)

Porównanie wykonano na zrzutach z Chrome przy 1586 × 992 (DPR 1) oraz 390 × 844 w skali makiety (DPR ≈ 1,75), zestawionych obok wycinków wizualizacji. Mierzono położenie i wymiary bloków, wysokość wersalików i interlinię tekstu oraz kolory pikseli tła, wypełnień i krawędzi. Wartości referencyjne:

| Element | Wizualizacja | Po zmianach |
|---|---|---|
| Wyszukiwarka desktop | 189–1396 × 250–294 px | 187–1398 × 250–294 px |
| Karty polecane desktop | 418–673 px wysokości ok. 255 | 418–673 px |
| Panel mapy / „Nadchodzące” | 376–675 / 696–942 px | 376–676 / 698–943 px |
| Karty weekendowe | 756–942 px, ok. 180 px szerokości | 759–944 px, 178 px |
| Telefon: wyszukiwarka / pola | 41 / 40 px, promień ok. 12 px | 41 / 40 px, 12 px |
| Telefon: polecana karta | ok. 352 × 215 px | 351 × 216 px |
| Obrys karty na zdjęciu | jasna linia ok. 28% bieli | `rgb(255 255 255 / .27)` nad zdjęciem |
| Tło poza Polską (telefon) | `#001e28`–`#01121c` | `#031a26` |

Sprawdzono też 1440, 1280, 1100, 1024, 768 i 360 px, jasny motyw, widok listy, aktywny filtr kategorii i wybrane wydarzenie na mapie. Zgodność nie obejmuje kroju pisma (Inter zamiast kroju z makiety), treści i zdjęć wydarzeń ani paska systemowego telefonu.
