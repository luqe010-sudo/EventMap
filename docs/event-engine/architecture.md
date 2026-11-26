# Event Engine — architektura

## Cel i ograniczenia

Autonomiczne, całodobowe pozyskiwanie legalnych, aktualnych wydarzeń z całej Polski do istniejącej bazy MapaImprez.pl, przy minimalnym udziale właściciela i niskich kosztach. Decyzje projektowe:

- **Bez nowych tabel w produkcyjnym Supabase.** Stan silnika (kolejka, rejestr źródeł, pamięć, koszty, decyzje, audyt) jest w osobnej bazie SQLite na VPS. Do Supabase trafiają tylko gotowe wydarzenia przez istniejące tabele.
- **Klasyczny kod zamiast LLM** wszędzie, gdzie się da: parsowanie ICS/schema.org/REST, geokodowanie, deduplikacja, kategorie (reguły), opisy (szablony). Obecnie silnik **nie używa żadnego płatnego API** — koszt zmienny = 0 zł.
- **Zero nowych zależności npm.** Node 24 (natywny TypeScript, `node:sqlite`, `fetch`, `node:http`) + istniejący `@supabase/supabase-js`.

## Komponenty

```
                 ┌──────────── VPS (Docker Compose, restart: unless-stopped) ────────────┐
 internet ◄────► │ worker   — Supervisor + agenci pobierający niezaufane treści           │
 (strony,        │            (brak klucza serwisowego)                                    │
  Wikidata,      │ publisher — zapis do Supabase (klucz serwisowy), nie pobiera stron     │──► Supabase (events,
  Nominatim)     │ control  — API sterujące (token), bez klucza serwisowego               │    locations, event_sources)
                 │ caddy    — TLS, wystawia tylko /api/* i /healthz                         │
                 │ wolumen engine-data: engine.sqlite (WAL)   wolumen engine-backups      │
                 └───────────────────────────────▲─────────────────────────────────────────┘
                                                 │ HTTPS + Bearer token (serwer-serwer)
                              Vercel: /admin/engine (requireAdmin) ── lib/engine-control.ts
```

Wszystkie role to ten sam obraz; `ENGINE_ROLE` wybiera, którzy agenci działają. Trzy kontenery współdzielą plik SQLite (ten sam host ⇒ blokady plików działają poprawnie).

## Agenci (13)

| Agent | Rola | Zadania | Co robi |
|---|---|---|---|
| Supervisor | worker | `supervisor.housekeeping`, `supervisor.daily_report` | dzierżawy, retencja, raport dzienny po 7:00, powiadomienia |
| Source Discovery | worker | `discovery.seed`, `discovery.wikidata(_cycle)`, `discovery.probe(_due)` | rejestr źródeł z Wikidata (CC0: ~3,5 tys. stron gmin/powiatów z kodem TERC + ~1,4 tys. instytucji kultury, festiwale, kluby), seed z historii kuratorskiej; sondowanie stron (ICS, RSS, schema.org, WordPress Tribe API) |
| Legal Compliance | worker | `legal.review`, `legal.recheck_due` | robots.txt, regulaminy (wzorce zakazów), TDM (meta + `tdmrep.json`), licencje; reguły L0–L6; kolejka decyzji |
| Integration | worker | `integration.activate` | wybór kanału (Tribe API > ICS > JSON-LD > RSS), próbna ekstrakcja, aktywacja z harmonogramem |
| Crawler | worker | `crawl.due`, `crawl.source`, `crawl.page` | warunkowe GET (ETag/Last-Modified), adaptacyjny interwał 6 h–7 dni, strony szczegółów (≤30 na przebieg, odświeżanie co 7 dni) |
| Extraction | worker | `extract.raw` | fakty → `candidates` (+ `provenance`), wykrywanie zmian, zachowanie 5 ostatnich surowych odpowiedzi jako fiksturek diagnostycznych |
| Geolocation | worker | `geo.resolve` | dopasowanie do `cities` (bez tworzenia), weryfikacja/geokodowanie (Nominatim ≤1 req/s, cache), odrzucenie pinezek >35 km od miasta; domyślny obiekt dla źródeł jednego miejsca |
| Quality | worker | `quality.check` | walidacja, scoring 0–1, kategorie regułami, deduplikacja między źródłami, odwołania |
| Content | worker | `content.write` | własne opisy z faktów (szablony PL) |
| Publisher | publisher | `publish.sweep`, `publish.candidate`, `publish.cancel`, `publish.retract_source` | deduplikacja z Supabase, zapis `pending_review` → (opcjonalnie) publikacja, aktualizacje z warunkiem `updated_at`, odwołania, wycofanie źródła |
| Maintenance | worker | `maintenance.scan`, `maintenance.backup` | diagnoza awarii, naprawy deterministyczne (ponowne sondowanie, pauza), regresje parserów → zgłoszenie naprawy kodu, kopie `VACUUM INTO` co 6 h (28 sztuk) |
| Growth | worker | `growth.analyze` | pokrycie województw/kategorii (60 dni), luki → priorytety odkrywania, brakujące miasta → decyzja |
| Financial Controller | worker | `finance.rollup` | koszty, koszt/wydarzenie, rentowność źródeł, alert 80% budżetu |

## Przepływ wydarzenia

`source(discovered) → probe → legal_review → approved → integration.activate → active → crawl.source → raw_items → extract.raw → candidate(extracted) → geo.resolve(geo_ok | needs_city | needs_geo) → quality.check(quality_ok | quality_failed | duplicate) → content.write(ready) → publish.candidate(pending_review | published | duplicate)`

Tryby publikacji (`ENGINE_PUBLISH_MODE`): `off` (domyślny), `dry_run`, `pending_review` (wydarzenia trafiają do istniejącej moderacji `/admin/review`), `publish` (autopublikacja tylko dla źródeł z flagą `autopublish` i wynikiem ≥ `ENGINE_AUTOPUBLISH_MIN_SCORE`; reszta do moderacji). Dzienny limit zapisów: `ENGINE_PUBLISH_DAILY_CAP`.

## Trwałość i odporność

- Kolejka z dzierżawami: zadanie przerwane restartem wraca po wygaśnięciu dzierżawy; klucze deduplikacji czynią harmonogramy idempotentnymi; wykładniczy backoff, dead-letter po 5 próbach; `DeferError` odkłada bez liczenia próby (brak dostępu, limit, budżet).
- Harmonogramy pamiętają `last_enqueued_at` ⇒ restart nie gubi ani nie dubluje cykli.
- Healthcheck każdej roli (`/healthz` na loopback), `restart: unless-stopped` + jednostka systemd.
- Kopie: `VACUUM INTO` co 6 h + przed każdą aktualizacją; opcjonalnie rclone poza serwer.
- Aktualizacja: `update.sh` buduje obraz z tagiem commita, test dymny, restart, czeka na healthy, w razie porażki wraca do poprzedniego tagu.

## Bezpieczeństwo

- Treści z internetu są danymi: parsery wyciągają tylko pola strukturalne; żaden tekst źródła nie trafia do LLM ani powłoki.
- Fetcher: tylko http(s) na portach 80/443, blokada adresów prywatnych (również po DNS i przekierowaniach), limit rozmiaru i czasu, brak cookies, generyczny User-Agent ze stroną `/bot`, robots.txt (niedostępny ⇒ zakaz), 429 ⇒ wstrzymanie hosta, 401/403/CAPTCHA ⇒ odmowa bez obchodzenia.
- Izolacja ról: klucz serwisowy tylko w `publisher`; kontenery `read_only`, `cap_drop: ALL`, `no-new-privileges`.
- API sterujące: token ≥32 znaki, porównanie w stałym czasie, Caddy z TLS, audyt append-only z identyfikatorem admina (UUID, nie e-mail).

## Skalowanie

SQLite w WAL obsłuży dziesiątki tysięcy zadań dziennie w jednym procesie. Wąskie gardła w kolejności: (1) grzeczne odstępy na hosta (5 s) — skaluje się liczbą źródeł, nie wątków; (2) publiczny Nominatim (≤1 req/s, cache) — przy dużej skali własna instancja Nominatim/Photon; (3) pojemność Supabase Free (500 MB) — patrz decyzje. Przejście na Postgres dla kolejki jest możliwe bez zmiany agentów (repozytoria w `store.ts`/`queue.ts`).
