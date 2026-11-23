# Płatne polecanie wydarzeń

Stan na 2026-11-23. Wersja bez bramki płatności; koniec polecenia zapisywany w `events.featured_until`.

## Oferta

- 39 zł brutto za jedno wydarzenie. Sprzedawca: DevilEnergy Łukasz Szypuła, ul. Zimowa 6/4, 57-215 Srebrna Góra, NIP 8871744618, zwolniony z VAT (zwolnienie podmiotowe) — wystawia rachunek / fakturę bez VAT.
- Wyróżnienie trwa do dnia zakończenia wydarzenia, maks. 30 dni od włączenia.
- Efekt: wydarzenie trafia do karuzeli „Polecane wydarzenia” (osobne zapytanie `featuredOnly` w `lib/events.ts`, sortowanie `isFeatured` w `components/HomePage.tsx`) z etykietą „Promowane”.
- Stałe oferty (cena, dane sprzedawcy, teksty) są w `lib/promotion.ts`; zmiana ceny wymaga też aktualizacji punktu 10 regulaminu (`app/regulamin/page.tsx`, `lastUpdated`).

## Proces (ręczny)

1. Organizator w `/organizer/events` klika „Zamów polecenie” → klient poczty otwiera e-mail do `kontakt@mapaimprez.pl` z tytułem, ID, terminem, linkiem i polami na dane do rachunku.
2. Operator potwierdza zamówienie, wysyła rachunek z numerem konta.
3. Po zaksięgowaniu wpłaty: `/admin/events` → edycja wydarzenia → zaznacz „Promowane” i zapisz. Pole „Promowane do” puste = koniec dnia wydarzenia (czas polski), maks. 30 dni od zapisu; można wpisać inną datę (np. przy przedłużeniu).
4. Po `featured_until` wydarzenie samo znika z Polecanych i traci etykietę. Lista admina pokazuje „do DD.MM.RRRR” albo „wygasło …”; odznaczenie „Promowane” czyści datę.

## Model danych

- `events.is_featured` + `events.featured_until` (migracja `20261123210000_events_featured_until.sql`). Aktywne polecenie: `is_featured = true AND featured_until > now()` — publiczne zapytanie `featuredOnly` w `lib/events.ts`, mapowanie `isFeatured` przez `isPromotionActive` z `lib/promotion.ts`.
- Organizator nie może ustawić ani zmienić `featured_until` (wyzwalacz `guard_organizer_event_write`). Duplikat wydarzenia nie kopiuje polecenia.
- Edycja opublikowanego wydarzenia przez organizatora cofa je do `pending_review`, więc polecenie jest niewidoczne do ponownej akceptacji; czas biegnie dalej.
- Strony publiczne są cache'owane, więc wygaśnięcie jest widoczne po najbliższym odświeżeniu cache.

## Znane ograniczenia i kolejne kroki

- Brak tabeli zamówień i płatności online. Przy integracji bramki (Przelewy24 / tpay / Stripe) potrzebna będzie osobna tabela zamówień ze statusem płatności, webhook po stronie serwera (klucze tylko w zmiennych serwerowych, nigdy `NEXT_PUBLIC_*`) i automatyczne ustawianie `is_featured`/`featured_until`. Wymaga osobnej propozycji SQL.
- Zamówienie przez `mailto:` zależy od klienta poczty organizatora; strona oferty podaje też adres do ręcznego kontaktu.
