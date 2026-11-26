# Event Engine — ROADMAP

Stan na 2026-11-26. Szczegóły bieżące: STATE.md.

| Etap | Zakres | Status | Kryterium wyjścia |
|---|---|---|---|
| 1. Audyt i infrastruktura | audyt repo/bazy, projekt VPS, Docker Compose, środowiska dev/staging/prod | **kod gotowy**, VPS nie istnieje | VPS uruchomiony, `update.sh` zielony, panel połączony |
| 2. Agenci, kolejka, pamięć, rejestr | 13 agentów, trwała kolejka, pamięć SQLite, budżet, audyt, API, panel | **gotowe, przetestowane lokalnie** | — |
| 3. Pierwsze legalne integracje | ICS, schema.org, RSS (linki), WordPress Tribe API; Wikidata, seed 183 źródeł | **gotowe**; zweryfikowane na żywo na wybranych źródłach | właściciel zatwierdza reguły L4–L6 |
| 4. Test bez autopublikacji | `pending_review` na ograniczonej liczbie źródeł, moderacja w `/admin/review` | czeka na VPS + reguły | ≥14 dni, ≥95% poprawnych dat/miejsc w próbce 100 moderowanych, <2% duplikatów |
| 5. Kontrolowana publikacja | `ENGINE_PUBLISH_MODE=publish`, autopublikacja per źródło, limit 100/dzień | czeka | decyzja właściciela o kryteriach jakości; brak zgłoszeń błędów przez 7 dni |
| 6. Skalowanie w limitach | limit dzienny 100 → 500 → 2000+, odkrywanie wszystkich gmin, własny geokoder przy potrzebie | czeka | koszt/wydarzenie w budżecie, Supabase w limicie pojemności |
| 7. Konserwacja i samodoskonalenie | diagnostyka i naprawy deterministyczne (gotowe); naprawy kodu w piaskownicy (projekt w `self-repair.md`) | częściowo | zatwierdzone klasy zmian niskiego ryzyka + dostęp do repo i LLM |
| 8. Autonomia | 7-dniowy pilotaż bez rutynowej ingerencji | czeka | wszystkie kryteria ukończenia poniżej |

## Kryteria ukończenia (z briefu) — mapowanie

| Kryterium | Mechanizm | Stan |
|---|---|---|
| działa przy wyłączonym komputerze | VPS + Docker | wymaga VPS |
| wznawia po restarcie | restart policy, systemd, dzierżawy, `last_enqueued_at` | gotowe (kod) |
| bez codziennego Codexa/Claude | harmonogramy w silniku | gotowe |
| sam wyszukuje źródła | Wikidata + sondowanie + Growth | gotowe |
| pobiera i publikuje dozwolone | pipeline + Publisher | gotowe; publikacja po decyzji |
| duplikaty, jakość, koszty | Quality, Publisher (Supabase), Financial Controller | gotowe |
| ograniczenia prawne | Legal + fetcher | gotowe; reguły do zatwierdzenia |
| diagnozuje awarie | Maintenance | gotowe (deterministycznie) |
| kopie i rollback | VACUUM INTO, `update.sh`, archiwizacja zamiast kasowania | gotowe; offsite opcjonalnie |
| raportuje | raport dzienny, powiadomienia | gotowe; kanał do wskazania |
| 7-dniowy pilotaż | — | po etapie 5 |

## Realistyczny wolumen

Cel 1000–5000 nowych wydarzeń dziennie zależy od liczby aktywnych źródeł z ustrukturyzowanymi danymi. Szacunek: aktywne źródło (dom kultury, obiekt) dodaje średnio 0,2–1 nowego wydarzenia dziennie. 1000 aktywnych źródeł ≈ 200–1000/dzień; 3000–5000 źródeł ≈ 1000–3000/dzień. Rejestr startowy z Wikidata to ~5 tys. stron; część nie ma kanału strukturalnego (status `no_integration`). Kolejne zwiększenia: katalogi instytucji kultury (np. rejestry instytucji kultury JST), API partnerskie z licencją, organizatorzy sami dodający wydarzenia.
