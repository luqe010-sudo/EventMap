# Dziesiąty pakiet napraw — 2026-10-08

## Zakres

- Przywracanie publicznych filtrów i listy/mapy przez Wstecz/Dalej oraz ochrona szczegółu przed spóźnioną odpowiedzią poprzedniego wyboru.
- Potwierdzanie rzeczywiście zmienionego własnego wiersza przy ukryciu/anulowaniu; stan oczekiwania, bezpieczny błąd i sukces przy przycisku.
- Walidacja, błędy przy polach, stan oczekiwania i zachowanie wpisanych danych w formularzach profilu/ustawień/zakładania organizacji. Zero rows nie oznacza sukcesu. Tworzenie organizacji nadal jest oddzielną sekwencją, a nie transakcją.
- Całe dni Europe/Warsaw w filtrach listy organizatora, z wyłącznym końcem kolejnego dnia i uwzględnieniem DST.
- Sprawdzenie błędów wylogowania oraz ekran ponowienia. Nie obiecuje zakończenia sesji po awarii SDK.
- Kompletne stronicowanie RPC zapisów oraz publicznych wydarzeń pobieranych porcjami identyfikatorów, także poniżej PostgREST max_rows.
- Wysłanie wcześniej niewysłanych dziewięciu pakietów, testów, dokumentacji i workflow GitHub Checks wraz z obecnym pakietem. Diagnostyka i lokalna konfiguracja pozostają poza Git.

## Weryfikacja

Pierwszy odbiór dotychczasowego kodu: 418/418 testów i TypeScript przeszły, lint 0 błędów/15 wcześniejszych ostrzeżeń. Build zatrzymał się na EPERM lokalnego cache `.next/cache/webpack`; końcowy odbiór wymaga świeżego katalogu buildu.

Końcowe `npm run check` w świeżej kopii źródeł bez `.env*` przeszło: **507/507 testów w 39 plikach**, TypeScript i produkcyjny build. Lint: 0 błędów/15 wcześniejszych ostrzeżeń. Kopia używała zainstalowanych zależności przez lokalny junction, fikcyjnej konfiguracji Supabase/site i guardu blokującego sieć podczas wszystkich kontroli. Log: `scratch/package10-check.log`. Nie jest to build do publikacji ani odbiór rzeczywistych sesji.

Statyczny render rzeczywistych formularzy z syntetycznymi stanami błędów potwierdził układ przy 360/390/768/1440 px w obu motywach bez overflow strony. To odbiór CSS/HTML bez hydracji, submitów i dostępu do bazy; zachowanie akcji ma oddzielne testy. Podgląd QA zamknięto. Kontrola kandydatów Git nie wykryła sekretów; `git diff --check` przeszedł. Pełne SHA obu oficjalnych GitHub actions sprawdzono z aktualnymi tagami przed wysłaniem.

Workflow [Checks](https://github.com/luqe010-sudo/EventMap/actions/workflows/checks.yml) uruchamia się po push do main. Statusy wysłania i zdalnego runu należy sprawdzać dla konkretnego SHA; lokalny zielony wynik nie zastępuje GitHub/Linux. Ten pakiet nie wykonuje ręcznej publikacji Vercel ani zmian bazy.

## Otwarte wymagania

Pakiet nie zmienia Supabase ani schematu. Ochrona właściciela/pól admina i UPDATE organizacji czekają na [osobną propozycję](organizer-write-hardening-proposal.md). Pełna transakcja/idempotencja A04 wymaga [osobnego kontraktu](event-write-transaction-proposal.md) i zatwierdzenia SQL zgodnie z AGENTS.md. A08 nadal nie gwarantuje odporności na bezpośredni REST i wiele instancji. Realne sesje Auth/SMTP/Google, staging, jakość katalogu i odbiór na fizycznym telefonie pozostają otwarte.

Automatyczna ocena odrzuciła odczytowy przegląd OpenCode z powodu przesyłania prywatnego kodu do nieokreślonego dostawcy. Tego przeglądu nie uruchomiono; zastosowano niezależne przeglądy agentów Codex.
