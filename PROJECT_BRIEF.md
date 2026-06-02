# EventMap Polska — doprecyzowany prompt MVP

## Cel

Zbuduj aplikację webową MVP do odkrywania lokalnych wydarzeń w Polsce. Użytkownik może wybrać zakres daty, lokalizację, promień oraz kategorię, a następnie zobaczyć dopasowane wydarzenia jako listę i markery na mapie.

## Zakres pierwszej wersji

Pierwsza wersja ma udowodnić wartość produktu, dlatego nie zawiera jeszcze crawlerów, kont użytkowników, płatności ani panelu moderatora. Zamiast tego korzysta z lokalnych danych demonstracyjnych, ale struktura kodu i model danych mają być przygotowane pod późniejsze podłączenie Supabase/PostGIS.

## Funkcje MVP

- Widok główny z listą wydarzeń i interaktywną mapą.
- Filtry daty: dziś, jutro, weekend, ten tydzień oraz konkretna data.
- Filtr promienia: 10 km, 25 km, 50 km, 100 km.
- Filtr kategorii: koncert, festyn, dożynki, sport, rodzina, targi, motoryzacja, kultura, inne.
- Lokalizacja przez wpisanie miasta/kodu pocztowego lub użycie lokalizacji GPS przeglądarki.
- Szczegóły wydarzenia: tytuł, opis, data, godzina, adres, organizator, cena, kategoria, tagi, link do organizatora i biletów.
- Kliknięcie wydarzenia na liście podświetla marker na mapie.

## Założenia produktowe

- Największym ryzykiem projektu jest pozyskiwanie aktualnych danych, nie sam interfejs.
- Najlepszy model docelowy to hybryda: agregacja automatyczna + dodawanie przez użytkowników + panel organizatorów.
- Crawler i AI-ekstrakcja powinny trafiać do kolejki moderacji, a nie bezpośrednio na produkcję.

## Stack docelowy

- Frontend: Next.js 15, React 19, TypeScript.
- UI: CSS/Tailwind-ready, docelowo shadcn/ui.
- Mapa: MapLibre GL JS.
- Backend: Supabase.
- Baza: PostgreSQL + PostGIS.
- Auth: Supabase Auth.
- Storage: Supabase Storage.
- Hosting: Vercel.

## Następne etapy po MVP

1. Podłączenie Supabase i tabel `events`, `organizers`, `event_images`, `favorites`, `reports`.
2. Formularz dodawania wydarzeń.
3. Panel moderacji wydarzeń.
4. Importer wydarzeń z pierwszych ręcznie wybranych źródeł.
5. Profile organizatorów i promowanie wydarzeń.
