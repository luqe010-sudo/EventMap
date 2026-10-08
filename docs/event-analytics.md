# Pomiar wydarzeń — A08/A09

Stan: 2026-10-06. Kod pakietów 8/9 jest na produkcji. Po późniejszym zatwierdzeniu wdrożono także RLS publicznej analityki; [raport SQL i odbiór](supabase-rls-hardening-release-2026-10-06.md). Nie zmieniano historycznych rekordów pomiaru.

## Zakres pomiaru

Wspólny wybór `eventmap.cookieConsent` obejmuje Google Analytics oraz własne interakcje wydarzeń. Przed wyborem, po odrzuceniu lub przy niedostępnym storage klient nie wysyła interakcji i nie tworzy identyfikatora. Po akceptacji `sessionStorage` przechowuje losowy UUID `eventmap.analyticsSessionId`. Zmiana wyboru w tej lub innej karcie zatrzymuje kolejne pomiary i usuwa identyfikator w aktywnych kartach. Nieudane utrwalenie odrzucenia nadal blokuje pomiar w bieżącej karcie. Nie cofa już wysłanych żądań ani nie usuwa historycznych rekordów.

Google Analytics ładuje się po akceptacji; odrzucenie ustawia również `ga-disable-G-60019N4V87` dla wcześniej załadowanego skryptu, zgodnie z [dokumentacją Google](https://developers.google.com/tag-platform/security/guides/privacy). Nie zmieniano konfiguracji usługi Google. Pełny odbiór żądań tej usługi i ocena prywatności pozostają osobne.

Nowe interakcje używają publicznego klienta Supabase bez sesji; `user_id` jest `null`. Fetch ma `credentials: "omit"`, `keepalive: true` i nie ponawia nieznanego wyniku przez beacon. Zapis serca nadal jest niezależną funkcją konta i działa bez zgody analitycznej. Nie wszystkie umiejscowienia serca mają pomiar kliknięcia; kliknięcia nie są pełną liczbą zapisów.

## Kontrakt HTTP

`POST /api/events/{UUID}/analytics` wymaga `Origin` zgodnego z rzeczywistym Host i protokołem żądania (URL jako fallback; bez zaufania do forwarded-host), JSON i najwyżej 1024 bajtów. Sprawdzany jest deklarowany rozmiar oraz faktycznie odczytany strumień; nadmiar anuluje odczyt. Niepoprawne UTF-8/JSON, dodatkowe pola i obce typy są odrzucane.

```json
{
  "eventType": "view",
  "sessionId": "22222222-2222-4222-8222-222222222222",
  "analyticsConsent": true
}
```

Dozwolone typy: `view`, `phone_click`, `website_click`, `ticket_click`, `map_click`, `share_click`, `save_click`. Parametr zgody jest deklaracją klienta, nie dowodem zgody ani uwierzytelnieniem. UUID sesji jest pseudonimowym, niezweryfikowanym identyfikatorem karty; nie dowodzi liczby osób.

Przed INSERT biblioteka `lib/event-analytics.ts` odczytuje wydarzenie z filtrami `published`, `public` i `is_cancelled IS NULL OR false`. Brak publicznego rekordu daje 404. Awaria sprawdzenia lub zapisu daje 503; UI nie blokuje nawigacji. Odpowiedzi mają `Cache-Control: no-store, max-age=0`.

| Status | Znaczenie |
| --- | --- |
| 200 | Zapis potwierdzony albo powtórzenie zignorowane (`ignored: true`). |
| 400 | Niepoprawny UUID, kontrakt, JSON lub brak deklaracji zgody. |
| 403 | Brak poprawnego same-origin albo `sec-fetch-site: cross-site`. |
| 404 | Wydarzenie niedostępne publicznie. |
| 413 / 415 | Za duże żądanie / niewłaściwy Content-Type. |
| 429 | Limit instancji; `Retry-After: 60`. |
| 503 | Wynik nie został potwierdzony. |

## Ograniczenia ochrony

`lib/analytics-ingestion-guard.ts` ogranicza warm instancję do 600 żądań/min i 60 na identyfikator klienta/min. W środowisku `VERCEL=1` korzysta wyłącznie z poprawnego IP w `x-vercel-forwarded-for`, którego zachowanie opisuje [Vercel](https://vercel.com/docs/headers/request-headers). Inne forwarded headers są ignorowane. Pamięć przechowuje HMAC z losową solą procesu zamiast surowego IP; logowanie/retencja platformy hostingowej są osobnym zagadnieniem. Bez zaufanego IP wszyscy klienci należą do jednego koszyka `unidentified`.

Ten sam event/session/type ma wspólną rezerwację przed oczekiwaniem na bazę. Rezerwacja nie wygasa podczas aktywnego żądania; po sukcesie albo nieznanym wyniku blokuje powtórzenie przez 30 sekund. Znany brak publicznego wydarzenia zwalnia ją. Mapa koszyków i mapa rezerwacji są ograniczone do 10 000 wpisów; pełna mapa odrzuca nowy klucz zamiast usuwać aktywne wpisy. Nie ma trwałej gwarancji dokładnie jednego zapisu, ochrony pomiędzy instancjami ani po restarcie.

**A08 pozostaje częściowo otwarte.** Odczyt publiczności w aplikacji i INSERT są osobnymi żądaniami. RLS wdrożone 6.10 o 21:20 CEST dodatkowo sprawdza published/public/nieanulowane w bieżącym statement INSERT oraz null/własny UID. Przeszły SQL próby odmowy dla draft/private/cancelled, także z rolą właściciela wydarzenia, i poprawnego zapisu publicznego przy false/NULL cancellation; fixture wycofano. Nie ma blokady wiersza wydarzenia względem równoległego unpublish. Klient nadal może ominąć endpoint i wykonać INSERT bezpośrednio dla publicznego wydarzenia, bez zgody/limitera/dedup aplikacji. Nie zmieniono grantów. Pełna ochrona wymaga osobnego RPC/uprawnień oraz rozproszonego limitera i prób współbieżności. Nie traktować metryk jako odpornego na nadużycia pomiaru reklamowego.

## Statystyki organizatora

`lib/organizer-statistics.ts` pobiera stabilnie wszystkie strony wydarzeń i analityki, przesuwając offset o rzeczywistą liczbę zwróconych rekordów. Limit odpowiedzi niższy od żądanych 500 nie oznacza końca. Exact count, powtórzone ID, brak postępu i kontrola końcowej liczności wykrywają niepełny odczyt. Limit pełnej puli wynosi 200 000 rekordów; analityka jest dzielona na paczki 100 event ID i ograniczana do czasu rozpoczęcia odczytu.

Bieżące zapisania liczone są osobnym exact HEAD dla każdego własnego wydarzenia, po osiem równolegle, a następnie uzgadniane z sumą paczek 100 wydarzeń. RLS/granty pozwalają na odczyt `event_id`, ale nie prywatnego `user_id`, dlatego nie zgadujemy unikalnego porządku zapisów i nie pobieramy ich jako uciętej listy.

Kliknięcia serca i udostępnienia są historycznymi interakcjami. Bieżące zapisania to aktualna liczba rekordów, także gdy kliknięcia nie zostały zarejestrowane. Dashboard miesiąca używa północy `Europe/Warsaw`; szczegółowa tabela pokazuje cały zarejestrowany okres. Awaria lub niepełny zbiór daje `null`, znak „—” i alert, nie pozorne zero. Niezależny poprawnie odczytany zbiór pozostaje widoczny.

Niezależne odczyty REST nie zapewniają wspólnej transakcyjnej migawki; zmiana zachowująca liczność może pozostać niewykryta. Koszt dokładnych zapisów rośnie z liczbą wydarzeń. Przyszły agregat RPC i retencja wymagają osobnej propozycji; nie zostały wdrożone.

## Weryfikacja i odbiór

Pakiety 8/9 opublikowano 2026-10-06; [raport](production-release-packages-8-9-2026-10-06.md) potwierdza 23 kontrole HTTP przed i po promocji. Żądania analityki w smoke były wyłącznie celowo błędne (400/403/413/415), bez INSERT. Banner/odmowę sprawdzono w przeglądarce produkcji. Te wyniki nie zaliczają prawidłowego pomiaru, trwałej deduplikacji, Google ani prób kont/RLS.

Mocks sprawdzają body, publikację, odrzucenie dodatkowego user ID, awarie/nieznany INSERT, granice limitów, pending lease, odmowę/cofnięcie zgody i błędy storage, dane ponad 1000, niższe `max_rows`, błędy częściowe oraz Warsaw month. Nie wykonują prawdziwych zapisów i nie mierzą Google Analytics. Statyczny fixture paneli używa syntetycznych danych i CSP bez sieci/form submit. Próby HTTP/Auth/RLS, rozproszonych instancji, Google i prywatności pozostają w [checkliście](mvp-release-checklist-2026-10-05.md).

Przegląd przed publikacją wskazał dwa dalsze punkty utwardzenia kodu: deadline dla strumienia body, który nigdy nie kończy odczytu (obecnie egzekucję ogranicza timeout platformy), oraz obsługę wyjątku samego gettera `window.localStorage` w listenerze `storage`. Nie włączano dodatkowych zmian do już odebranej paczki. Zachowanie przy odmowie dostępu do storage trzeba objąć osobną poprawką i regresją.
