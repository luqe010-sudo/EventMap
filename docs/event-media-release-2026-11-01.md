# Wdrożenie oprawy wydarzeń — 1 listopada 2026

Nowe okładki działają na [mapaimprez.pl](https://mapaimprez.pl/kultura/warszawa) i www. Właściciel wyraźnie zatwierdził przesłanie przygotowanego kodu i licencjonowanych zdjęć do istniejącego projektu Vercel event-map oraz publikację.

Wpis bez własnego zdjęcia otrzymuje okładkę z tytułem, terminem i miastem. Gdy temat pasuje do lokalnej biblioteki, tłem jest udokumentowane zdjęcie ilustracyjne z etykietą i podpisem autora w szczegółach. W pozostałych przypadkach działa własna oprawa typograficzna. Istniejące plakaty zachowują cały kadr. Nowych grafik AI nie generowano.

## Publikacja

- Nowa wersja: dpl_5FdEtNHdYRV7e2WtEbc7kHg2wHUm, https://event-7lfx0fpst-luqe010-1961s-projects.vercel.app.
- Poprzednia wersja do ewentualnego wycofania: dpl_FsA53khAF6WbSJ57JXoyyKoVceFc, https://event-7ca044wer-luqe010-1961s-projects.vercel.app.
- Zdalny build ze źródeł, następnie kontrola wersji przed przełączeniem domen i vercel promote. Nie używano lokalnego prebuilt.
- Chronione wdrożenie sprawdzono przy użyciu istniejącego dostępu automatyzacji projektu, tylko w pamięci. Nie tworzono nowego klucza i nie zmieniano ochrony.
- Przed przełączeniem potwierdzono, że domena nie zmieniła wdrożenia w trakcie pracy.
- Domeny główna i www odpowiadają publicznie HTTP 200; www prowadzi do domeny głównej.
- Publikacja CLI korzysta z lokalnego stanu plików. Nie wysyłano zmian do GitHub. Późniejszy build z Git musi zawierać te same źródła i osiem assetów; README z wcześniejszymi zmianami właściciela pozostawiono bez edycji.

## Weryfikacja

- Pełne npm run check: 531/531 testów w 42 plikach, TypeScript i oba buildy poprawne. ESLint: 0 błędów, 11 ostrzeżeń.
- Paczka: 216 plików, 5077824 B, audyt bez ujawnionych sekretów. Wykluczono .env, konfigurację CLI, dane importu, narzędzia, dokumentację i odrzucone ilustracje.
- Osiem zdjęć z produkcji pobrano odczytowo i porównano SHA-256 z manifestem; 8/8 zgodnych.
- Kontrola kadrów: zdjęcia ilustracyjne dla szydełkowania, kina i muzyki klasycznej, własna typografia dla meczu Polska–Chorwacja, istniejący plakat Eleine.
- Obrazy ilustracyjne nie są podawane jako fotografie wydarzeń w Event JSON-LD. API zwraca pusty imageUrl dla braku oryginalnego materiału.
- Publiczne filtry published/public/nieanulowane zachowane. Brak zmian tabel, kolumn, RLS, treści wydarzeń i ustawień Auth.
- Odbiór przeglądarkowy: ciemny i jasny motyw 1280 px, lista mobilna 390 px, podgląd mapy i szczegóły z podpisem ilustracji; brak pustych src i poziomego przewijania.
- Oryginalny plakat 320 px: loaded=true, object-fit=contain, proporcje 257 × 144,56 przy źródle 656 × 369. Bez obcięcia treści.
- W logu przeglądarki nie odnotowano błędów. Przywrócono motyw i rozmiar przeglądarki.

## Poprawki wykryte w odbiorze

- Zawężono dopasowanie słowa chór, aby Chorwacja nie otrzymywała zdjęcia fortepianu. Dodano regresję dla rzeczywistego tytułu meczu.
- Okładka popupu mapy pokazuje datę bez niepotwierdzonej godziny; uproszczony marker nie przenosi flagi wydarzenia całodniowego.

Źródła i licencje: [manifest](../data/media/editorial-photos.json), [zasady obrazów](event-media-policy.md). Szczegółowe wyniki: [raport JSON](event-media-release-2026-11-01.json).
