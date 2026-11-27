# Event Engine — dostępy i decyzje właściciela

Skonsolidowana lista rzeczy, których silnik/agent nie może uzyskać samodzielnie. Kolejność = kolejność odblokowywania etapów.

## A. Decyzje (bez nich nie ruszy etap 4)

| # | Decyzja | Rekomendacja | Gdzie |
|---|---|---|---|
| D1 | Zatwierdzenie reguł automatycznej akceptacji źródeł L4 (otwarte licencje), L5 (własny kanał organizatora), L6 (sektor publiczny) | zatwierdzić wszystkie trzy | panel → Kolejka decyzji; treść w `legal-policy.md` |
| D2 | Budżet: zakup VPS ok. 20–45 zł/mies.; limit roboczy w panelu | tak, limit 0 zł dla API (silnik nie używa płatnych API) | `budget.md` |
| D3 | Tryb startowy produkcji | `pending_review` z limitem 100/dzień przez 14 dni, potem decyzja o `publish` | `env/common.env` |
| D4 | Kryteria jakości dla autopublikacji (etap 5) | próg 0,85, ≥95% poprawnych w próbce 100, <2% duplikatów | ROADMAP |
| D5 | Pojemność Supabase przy dużym wolumenie: Supabase Pro (~105 zł/mies.) albo retencja (np. archiwizacja/usuwanie wydarzeń starszych niż 90 dni) | najpierw retencja; Pro przy >70% limitu | — |
| D6 | Atrybucja OpenStreetMap dla współrzędnych z Nominatim | mapa już wyświetla atrybucję OSM/OpenFreeMap — potwierdzić, że to wystarcza (zalecam dodatkowo wzmiankę w regulaminie) | — |
| D7 | Klasy zmian kodu do automatycznego wdrażania (etap 7) | tylko quirki domen i parsery z nowym testem | `self-repair.md` |
| D8 | Kanał powiadomień | ntfy.sh (prywatny temat) albo webhook Discord | `env/common.env` |

## B. Dostępy (do etapu 1 — uruchomienie 24/7)

| # | Dostęp | Po co | Bezpieczeństwo |
|---|---|---|---|
| A1 | VPS (zakup + dostęp SSH dla operatora wdrożenia) | praca 24/7 niezależnie od komputera | klucz SSH, firewall z `bootstrap-vps.sh` |
| A2 | Rekord DNS `engine.mapaimprez.pl` → IP VPS | TLS dla API sterującego | tylko /api i /healthz wystawione |
| A3 | Klucz deploy (read-only) do repozytorium GitHub na VPS | `update.sh` (git pull) | tylko odczyt |
| A4 | Klucz serwisowy Supabase wpisany przez Ciebie do `secrets/publisher.env` na VPS | zapis wydarzeń | tylko kontener `publisher`, chmod 600 |
| A5 | Zmienne Vercel: `ENGINE_CONTROL_URL`, `ENGINE_CONTROL_TOKEN` + redeploy | panel `/admin/engine` | zmienne serwerowe, nie `NEXT_PUBLIC_*` |
| A6 | (opcjonalnie) konto B2/R2 + rclone | kopie poza serwerem | osobny klucz z dostępem do jednego bucketu |
| A7 | (etap 7) token GitHub z zakresem do tego repo (contents, pull requests) + klucz API modelu z limitem | naprawy kodu w piaskownicy | bez dostępu do produkcji i sekretów |

## C. Co zrobiłem bez dodatkowych uprawnień

Kod silnika, panel, testy, Docker/VPS, dokumentacja; weryfikacja na żywo (odczyt publicznych stron i publicznych danych Supabase, bez zapisu). Nic nie zostało wdrożone, opublikowane ani zakupione.
