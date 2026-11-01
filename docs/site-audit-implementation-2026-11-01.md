# Wykonanie planu audytu — 2026-11-01

Zmiany wykonano w E:\EventMap. Na późniejsze polecenie właściciela opublikowano je 1 listopada 2026; SQL nie wykonywano. Raport źródłowy skopiowano z worktree claude/mapaimprez-audit-3ae4fd. Zachowano wcześniejsze zmiany zdjęć i kart. Raport produkcji: [site-audit-release-2026-11-01.md](site-audit-release-2026-11-01.md).

| Punkt | Wykonanie |
| --- | --- |
| B1 | Import eBilet i import kuratorowany odrzucają daty ponad 3 lata naprzód. Obecne rekordy: osobna propozycja SQL kierująca do moderacji, bez zgadywania dat. |
| B2 | Osobna propozycja zdjęcia weryfikacji kont technicznych. Nie wykonano. |
| B3 | E-mail usunięty z publicznych selectów i typów organizatora. Lokalna odpowiedź API sprawdzona bez pola email. Nie jest to zmiana uprawnień bezpośredniego API Supabase. |
| B4, B5, W2, W3 | Style ciemnego regulaminu, tytułu podglądu i stopki. Ustawienia cookies w stopce w zwykłym przepływie dokumentu. |
| B6 | Usunięto globalny loading; lokalny Suspense wyłącznie na stronie głównej. Lokalnie potwierdzono 404 i 307 paneli. |
| W1 | Cel #mapa otwiera mobilny widok mapy lub przewija do mapy desktopowej; scroll-margin wyników. |
| W4 | Słowa dzis/weekend/ten-tydzien obsługiwane przed geokodowaniem, przekierowanie do filtra kategorii. |
| W5 | SQL wykrywa kandydatów do scalenia. Ostateczne UUID, wybór rekordu kanonicznego i przeniesienie relacji wymagają przeglądu danych. |
| W6 | Dwie cyfry po przecinku; aktualizacja testów cen. |
| W7 | Mapa szczegółów: zoom 14, bez scrollZoom, polskie etykiety i fallback nazw województw. |
| W8 | Podobne w tym samym mieście i kategorii; karuzela na pełnej szerokości siatki. |
| W9 | Usunięto ręczny drugi description. Metadane społecznościowe list odpowiadają ich tytułom i adresom. Sitemapy bazują na nadchodzących wydarzeniach, pomijają puste skróty czasowe. |
| W10 | Korekta nagłówka kategorii, Aleksandrowa Łódzkiego, rejestracji, 404 i głównych opisów meta. Nie przeprowadzono redakcji wszystkich treści bazy. |
| W11 | Photon: wyłącznie place city/town/village/hamlet, bez dzielnic i POI; deduplikacja miast. |
| W12 | Kafelki hero resetują inne filtry daty/kategorii/ceny i przewijają do wyników. Niedziela od 18:00 wskazuje kolejny weekend. Braków faktycznej podaży wydarzeń nie zastąpiono sztucznymi wynikami. |
| W13 | Polecane przeniesione pod listę. Pierwsza strona 12 zamiast 20 pozycji, mniejszy nagłówek, ograniczona wysokość długich bloków linków i SEO. |
| W14 | Publiczna strona /dla-organizatorow z zasadami zgłaszania, moderacji i linkami do rejestracji/logowania. |

## Technika

Dodano podstawową CSP, X-Frame-Options, X-Content-Type-Options i Referrer-Policy. CSP ogranicza object-src/base-uri/frame-ancestors; nie jest jeszcze pełną polityką skryptów z nonce. HTTP 400 dla błędnych współrzędnych i braku centrum dla promienia/odległości. Przekierowania 308 na małe litery zachowują query string. TypeScript i ESLint pomijają zagnieżdżone worktree .claude.

## Odbiór i zależności

- Testy końcowe: 44 pliki, 539 testów zaliczonych. Typecheck zaliczony; lint bez błędów (pozostały ostrzeżenia m.in. img i zależności hooka mapy). Build produkcyjny zaliczony.
- Lokalny build produkcyjny: kompilacja, lint i typy. Sandbox blokował pliki cache EPERM; build wykonano z dozwolonym zapisem poza ograniczeniem sandboxa.
- Lokalny HTTP: oba nieistniejące adresy z raportu 404; panele admin/account/organizer 307; /KONCERTY 308; /koncerty/dzis 307 do filtra; niepoprawne lat i nearest bez punktu 400; miasto bez centrum i radius 400; lista /koncerty 200 z jednym description.
- Przeglądarka 375 px: brak poziomego przewinięcia; przycisk cookies ma position: static. Ciemny regulamin: jasne nagłówki rgb(243,245,247) na tle rgb(19,26,32).
- Końcowy układ 375 × 812: pierwsza karta około 946 px od góry, wysokość dokumentu około 8527 px, 12 pozycji w pierwszej porcji. Menu Mapa zamyka menu i aktywuje mobileMapViewActive. Przy 1440 px regulamin i nagłówki stopki zachowują poprawne kolory bez poziomego przewinięcia. Odbiór prawdziwego telefonu i pełna macierz wizualna nadal do wykonania.
- SQL pozostaje propozycją. Nie zmieniano schematu ani database.types.ts. Stan RLS wymaga potwierdzenia w Supabase zgodnie z AGENTS.md.
- Region europejski: oczekuje potwierdzenia regionu Supabase i konfiguracji Vercel.
- Etap 5: do wykonania po przygotowaniu kont testowych. Scenariusze opisane w docs/deployment.md. Nie rejestrowano kont ani nie wysyłano formularzy na produkcji.

Podejście do streamingu i nagłówków sprawdzono w dokumentacji Next.js: https://nextjs.org/docs/app/api-reference/file-conventions/loading oraz https://nextjs.org/docs/app/api-reference/config/next-config-js/headers.
