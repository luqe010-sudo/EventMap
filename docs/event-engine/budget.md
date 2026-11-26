# Event Engine — propozycja budżetu (do 300 zł/mies.)

Ceny orientacyjne z listopada 2026, do sprawdzenia przy zakupie. **Żadna płatna usługa nie została uruchomiona** — każda wymaga Twojej akceptacji.

| Pozycja | Propozycja | Koszt/mies. | Uwagi |
|---|---|---|---|
| VPS | 2 vCPU, 4 GB RAM, 40 GB SSD, UE (np. Hetzner CX22, OVH VPS, mikr.us 3.0) | ok. 20–45 zł | wystarczy do kilku tysięcy źródeł; SQLite + 3 kontenery |
| Kopie poza serwerem | Backblaze B2 / Cloudflare R2 (kilka GB) | 0–5 zł | opcjonalne, zalecane |
| Supabase Pro | jeśli baza przekroczy limit Free 500 MB | ok. 105 zł | przy 1000+ wydarzeń/dzień limit Free skończy się w ciągu kilku miesięcy; alternatywa: archiwizacja/usuwanie przeszłych wydarzeń (decyzja) |
| Geokodowanie | publiczny Nominatim (darmowy, ≤1 req/s) + cache | 0 zł | przy dużej skali: własny Photon/Nominatim na VPS (więcej RAM) albo płatne API w budżecie |
| LLM | nie używany | 0 zł | ewentualnie tylko naprawy kodu (etap 7), z limitem |
| Rezerwa | — | reszta | |

**Start: ok. 25–50 zł/mies.** (VPS + kopie), z rezerwą na Supabase Pro w ramach 300 zł.

## Limity w systemie

- Pułapy z konfiguracji serwera (nieprzekraczalne z panelu): `ENGINE_BUDGET_CEILING_MONTHLY_PLN=300`, `ENGINE_BUDGET_CEILING_DAILY_PLN=20`.
- Limity robocze ustawiasz w panelu (domyślnie **0 zł**, czyli brak płatnych operacji). Agent musi uzyskać `authorizeSpend` przed każdą płatną operacją; po przekroczeniu zatrzymują się tylko płatne operacje.
- Koszt infrastruktury (`ENGINE_INFRA_MONTHLY_PLN`) wliczany jest do kosztu jednostkowego: koszt / opublikowane wydarzenie w miesiącu (panel, raport dzienny). Rentowność źródeł: opublikowane vs. znalezione na źródło (Financial Controller).
