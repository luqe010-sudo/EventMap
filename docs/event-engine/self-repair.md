# Event Engine — samodoskonalenie i naprawy (etap 7)

## Co działa już teraz (bez LLM, bez zgody)

1. **Wykrycie**: `maintenance.scan` co godzinę — źródła z ≥3 błędami z rzędu, regresje (wcześniej ≥3 wydarzenia, teraz 0 dwa razy), zadania w dead-letter, zaległości kolejki, brak heartbeat.
2. **Diagnoza** (`diagnose()`): robots, 404/410 (kanał przeniesiony), 401/403/CAPTCHA, 429, błąd sieci/serwera, nieznane.
3. **Naprawy deterministyczne niskiego ryzyka** (nie zmieniają kodu): ponowne sondowanie i wybór innego kanału, wydłużenie interwału, wstrzymanie źródła, ponowna weryfikacja prawna.
4. **Eskalacja**: po 4 regresjach — decyzja „Naprawa kodu” z ID fiksturki (ostatnia surowa odpowiedź) w kolejce właściciela.

## Projekt napraw kodu (wymaga zatwierdzenia i dostępów)

Przepływ dla zgłoszenia `code_repair`:

1. Eksport fiksturki (surowa odpowiedź, bez sekretów) do katalogu zadania.
2. Uruchomienie agenta kodującego (`codex exec` / Claude Code w trybie nieinteraktywnym) w **jednorazowym kontenerze**: bez sieci poza registry pakietów, bez wolumenu `engine-data`, bez żadnych sekretów, z kopią repozytorium. Zadanie: dodać/poprawić parser i test z fiksturką.
3. Weryfikacja automatyczna: `npm run typecheck`, `npm test`, lint, oraz **strażnik zakresu zmian** — diff może dotykać wyłącznie `engine/src/extract/**`, `engine/data/domain-quirks.json` i `engine/test/**`. Inne pliki ⇒ odrzucenie.
4. Strażnik bezpieczeństwa/legalności: diff nie może zawierać nowych hostów sieciowych, `child_process`, `eval`, zmian w `legal/`, `budget.ts`, `control.ts`, `net/`, `config.ts`, `deploy/`.
5. Wynik: gałąź `engine-repair/<źródło>` i PR na GitHubie. **Automatyczne scalenie tylko dla zatwierdzonych klas** (propozycja: nowy wpis w `domain-quirks.json`; poprawka parsera z nowym testem i bez zmiany istniejących testów). Wdrożenie przez `update.sh` z automatycznym rollbackiem.
6. Wszystko inne (uprawnienia, bezpieczeństwo, schemat bazy, główne funkcje aplikacji) — tylko PR do ręcznej akceptacji.

Potrzebne do uruchomienia: decyzja o klasach auto-merge, token GitHub o minimalnym zakresie (tylko to repozytorium, contents+pull requests), klucz API modelu z limitem kosztów wliczonym w budżet (Financial Controller: `authorizeSpend` przed każdym przebiegiem).
