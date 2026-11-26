# Event Engine — RUNBOOK

## 1. Uruchomienie lokalne (development, bez Dockera)

```powershell
Copy-Item engine/deploy/env/development.env.example engine/deploy/env/development.env
# uzupełnij NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY (publiczne) i ENGINE_CONTROL_TOKEN (32+ znaki)
node --env-file=engine/deploy/env/development.env engine/src/main.ts run
```

- Stan: `node engine/src/main.ts status`; jedno zadanie: `node engine/src/main.ts once discovery.probe '{"sourceId":3}'`.
- Panel lokalnie: w `.env.local` dodaj `ENGINE_CONTROL_URL=http://127.0.0.1:8787` i ten sam `ENGINE_CONTROL_TOKEN`, potem `npm run dev` i `/admin/engine`.
- W development `ENGINE_PUBLISH_MODE=publish` jest zablokowane w kodzie. Nie podawaj klucza serwisowego lokalnie, jeśli nie testujesz zapisu.

## 2. Pierwsze wdrożenie na VPS

Wymagania: VPS z Ubuntu 24.04, 2 vCPU, 4 GB RAM, 40 GB dysku (propozycje w `budget.md`), domena `engine.mapaimprez.pl` (rekord A).

1. Jako root: `bash engine/deploy/bootstrap-vps.sh <URL repozytorium>` — Docker, firewall (22/80/443), automatyczne aktualizacje, użytkownik `engine`, klon, szablony env, losowy `ENGINE_CONTROL_TOKEN`, jednostka systemd.
2. Uzupełnij `/opt/mapaimprez/engine/deploy/env/common.env` (publiczne dane Supabase, kanał powiadomień), `secrets/publisher.env` (klucz serwisowy — tylko tu), `compose.env` (`ENGINE_PUBLIC_HOST`).
3. `sudo -u engine bash /opt/mapaimprez/engine/deploy/update.sh` — build, test dymny, start, healthcheck.
4. Vercel (Production, zmienne serwerowe, **nie** `NEXT_PUBLIC_*`): `ENGINE_CONTROL_URL=https://engine.mapaimprez.pl`, `ENGINE_CONTROL_TOKEN=<z secrets/control.env>`; redeploy.
5. W panelu `/admin/engine`: zatwierdź reguły prawne, ustaw budżet (domyślnie 0 zł = brak płatnych operacji).

Staging: ten sam obraz z `env/staging.env.example` (tryb `dry_run`, bez klucza serwisowego) — np. drugi katalog i `docker compose -p engine-staging`.

## 3. Codzienna obsługa (docelowo: żadna)

- Raport dzienny po 7:00 (panel + powiadomienie, jeśli skonfigurowano kanał).
- Kolejka decyzji: źródła z niejasnym regulaminem, brakujące miasta, zgłoszenia naprawy kodu.
- `pending_review`: wydarzenia silnika trafiają do istniejącego `/admin/review` (marker `EventMap engine v1` w notatce).

## 4. Awaryjne zatrzymanie

| Sposób | Jak | Działa bez |
|---|---|---|
| Panel | `/admin/engine` → „Wyłącznik awaryjny” | SSH |
| SSH (plik) | `docker compose ... exec worker sh -c 'touch /data/KILL'` (usunięcie pliku wznawia) | panelu, DB |
| SSH (CLI) | `docker compose ... exec worker node engine/src/main.ts kill on "powód"` / `kill off` | panelu |
| Twarde | `docker compose -f engine/deploy/docker-compose.yml --env-file engine/deploy/compose.env stop` | — |

Wyłącznik zatrzymuje pobieranie nowych zadań; zadania w toku kończą się (krótkie). Pojedynczego agenta wstrzymasz w tabeli „Agenci”.

## 5. Wycofanie danych źródła

Panel → Rejestr źródeł → „Wycofaj rekordy”. Wszystkie wydarzenia źródła przechodzą w `archived` (nie są kasowane), źródło dostaje status `retracted`. Przywrócenie pojedynczych wydarzeń: zwykła edycja w `/admin/events`.

## 6. Kopie zapasowe i odtworzenie

- Automatycznie co 6 h (`/backups/engine-*.sqlite`, 28 ostatnich) i przed każdą aktualizacją. Ręcznie: `... exec worker node engine/src/main.ts backup`.
- Poza serwer (opcjonalnie): skonfiguruj `rclone` i cron z `engine/deploy/offsite-backup.sh`.
- Odtworzenie: `stop` → skopiuj wybraną kopię na `/data/engine.sqlite` (usuń `engine.sqlite-wal`/`-shm`) → `up -d`. Supabase ma własne kopie (plan Supabase).

## 7. Aktualizacja i rollback

`bash /opt/mapaimprez/engine/deploy/update.sh [ref]` — kopia, build z tagiem commita, test dymny, restart, oczekiwanie na healthy; porażka ⇒ automatyczny powrót do poprzedniego tagu i commita. Ręczny rollback: ustaw `ENGINE_IMAGE_TAG` w `compose.env` na poprzedni tag i `up -d`.

## 8. Typowe incydenty

| Objaw | Diagnoza | Działanie |
|---|---|---|
| Agent „brak sygnału” | kontener nie działa | `docker compose ps`, `logs worker --tail 200`; restart jest automatyczny |
| Wiele zadań „martwe” | błąd kodu lub zmiana źródła | Historia działań → treść błędu; Maintenance otwiera incydent |
| `source_failing` | sieć / 404 / 403 / robots | Maintenance sam sonduje ponownie albo wstrzymuje; 403/CAPTCHA nie obchodzimy |
| `parser_regression` | zmiana struktury strony | automatyczne ponowne wykrycie kanału; po 4 razach decyzja „Naprawa kodu” |
| Publisher odkłada zadania | brak klucza / dzienny limit | sprawdź `secrets/publisher.env`, `ENGINE_PUBLISH_DAILY_CAP` |
| `needs_city` rośnie | brak miast w `cities` | decyzja „Brakujące miasta” → dodaj w `/admin/cities` |

## 9. Zmiana trybu publikacji (etapy 4→5→6)

W `env/common.env`: `ENGINE_PUBLISH_MODE` (`off` → `dry_run` → `pending_review` → `publish`), `ENGINE_PUBLISH_DAILY_CAP`, `ENGINE_AUTOPUBLISH_MIN_SCORE`; potem `update.sh` lub `up -d`. Autopublikację włączasz per źródło w panelu. Każda zmiana trybu na `publish` wymaga decyzji właściciela (ROADMAP, etap 5).
