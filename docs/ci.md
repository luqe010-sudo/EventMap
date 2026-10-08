# Kontrola zmian — D08

Status: **workflow wysłany i odebrany na GitHub, 2026-10-08**. `.github/workflows/checks.yml` uruchomił [Checks #37798463586](https://github.com/luqe010-sudo/EventMap/actions/runs/37798463586) dla `b4969d7`; wynik success obejmuje npm ci, lint, testy, typy i build na Ubuntu/Node 24. Lokalny dziesiąty pakiet ma 507/507 testów w 39 plikach. [Raport](repair-package-10-2026-10-08.md). Nie zmieniano branch protection, ustawień Actions ani deploymentu. Opisy lokalnego pierwszego odbioru niżej są historyczne.

## Polecenia i zakres

| Polecenie | Kontrola |
| --- | --- |
| `npm ci --no-audit --no-fund` | Instalacja dokładnie z `package-lock.json`; niespójność manifestu i locka kończy się błędem. |
| `npm run lint` | ESLint aplikacji, konfiguracji i testów; błędy blokują, ostrzeżenia pozostają widoczne. |
| `npm test` | Vitest w środowisku Node, wyłącznie `tests/**/*.test.ts`; klient Supabase, Auth, upload i geokodowanie są mockowane w wymagających ich testach. |
| `npm run typecheck` | `tsc --noEmit --incremental false`, ścisłe typy bez zapisu lokalnego cache. |
| `npm run build` | Produkcyjny build Next.js, włącznie z jego kontrolami lint/typów i generacją tras. |
| `npm run check` | Kolejno lint, testy, typy i build; zatrzymuje się na pierwszym błędzie. |

Dodano tylko dwa skrypty w `package.json`; zależności i lockfile pozostają bez zmian. `npm ci` ma odrzucać rozjazd locka zamiast aktualizować go podczas CI, zgodnie z [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

## Workflow

Checks uruchomi się po push do `main`, dla pull requestów i na ręczne `workflow_dispatch`, po włączeniu tego pliku do zdalnej gałęzi. Jeden job na `ubuntu-24.04` wykonuje wszystkie cztery kontrole. Limit wynosi 15 minut, nowszy run dla tej samej gałęzi anuluje wcześniejszy. Nie ma `continue-on-error`, ignorowania kodów wyjścia ani arbitralnego `--max-warnings=0`.

Node jest ograniczony do rodziny **24**, zgodnej z aktualnym runtime projektu; action pobiera dostępną wersję tej rodziny. Jest to nadal wspierana linia LTS według [Node.js Releases](https://nodejs.org/en/about/previous-releases). Zmiana wersji głównej wymaga osobnego przeglądu kompatybilności. CI nie instaluje globalnych narzędzi do aplikacji.

Użyto oficjalnych [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) i [setup-node v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0), przypiętych pełnymi SHA commitów odczytanymi z tych repozytoriów 2026-10-06. Wersje w komentarzach służą przeglądowi, a wykonanie wskazuje immutable commit, zgodnie z [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use). Token joba ma wyłącznie `contents: read`, checkout nie utrwala credentials. Nie ma `pull_request_target`, wymaganych secrets, service-role, deploy action, uploadu artefaktów ani cache zależności.

Przed instalacją job odmawia, jeśli Git zawiera lokalne `.env` (z wyjątkiem `.env.example/.env.sample`), konfigurację `.vercel`, stan `supabase/.temp`, `client_secret_*.json`, `scratch/` albo `test_strony/`. To kontrola nazw ścieżek, nie pełny skaner sekretów. ESLint już ignoruje lokalne scratch/test_strony, wygenerowane typy i pliki Next; nie wyłączono reguł dla źródeł, aby ukryć baseline. Dodane `.gitignore` chroni nietracked `/scratch/` i `/test_strony/` przed przypadkowym `git add`.

## Build bez usług i sekretów

CI używa jawnych, **fikcyjnych** publicznych wartości: Supabase `http://127.0.0.1:54321` z nieprawdziwym publishable/anon key oraz site `https://eventmap-ci.invalid`. Nie pobiera konfiguracji Vercel, Supabase ani Cloudinary i nie uruchamia lokalnej bazy. Wartości zapewniają sprawdzalny kształt konfiguracji i importów klienta; nie służą do testu RLS lub logowania.

Po instalacji `NODE_OPTIONS` ładuje `.github/scripts/ci-network-guard.mjs` w Node i procesach potomnych sprawdzających aplikację. Prawdziwy fetch, HTTP(S) lub TCP kończy proces błędem. Fallback UI nie może zamienić nieoczekiwanego odczytu Supabase podczas buildu w zielony CI. Mocks Vitest mogą dostarczać syntetyczne odpowiedzi. Guard jest tylko narzędziem kontroli aplikacji w CI; nie jest ładowany w produkcji i nie blokuje pobrania zależności przez `npm ci`.

Przegląd obecnych route'ów nie znalazł `generateStaticParams` ani zapytań wykonywanych na poziomie importu. Publiczne strony wydarzeń i ich metadata, aliasy, API wyszukiwania, sitemap oraz strony paneli używają dynamicznego renderowania. Recovery/onboarding i strony wymagające sesji również są dynamiczne. Register renderuje komponent klienta, a jego akcje Auth są wykonywane dopiero po działaniu użytkownika. Globalny `Navbar` zwraca stan anonimowy do komponentu klienta. Statyczne manifest/robots/ikony/blokady WordPress i regulamin nie wykonują zapytań domenowych. Build nie uruchamia server actions, rejestracji, wysyłki e-mail ani zapisów DB. Guard ma wykryć przyszłą regresję tego założenia.

Zielony CI potwierdza kod, testy z fixture i produkcyjną kompilację. Odbiór Auth/HTTP, RLS, rzeczywistej moderacji, atomowości A04, CDN, pomiarów i telefonu wymaga osobnych prób staging. Build z dummy config nie jest artefaktem do publikacji: deployment musi budować własną konfigurację docelową.

## Walidacja lokalna

Świeża kopia bez .env/.git/.vercel przeszła npm ci z locka (377 pakietów) i pełne check: 417/417 testów w 32 plikach, typy/build oraz lint 0 błędów/15 zastanych ostrzeżeń. Dummy konfiguracja i guard zablokowały ruch do usług. Log: scratch/mvp-package-9-isolated-ci.log. Kopię usunięto po sprawdzeniu ścieżki. Odbiór wykonano na Windows/Node 24.15, nie na GitHub/Linux. Końcowa poprawka rozpoznania Host ma dodatkowy test; pełny aktualny odbiór opisuje postęp MVP. Na Windows NODE_OPTIONS --import wymaga URL file:///E:/.../ci-network-guard.mjs; workflow Linux używa ścieżki POSIX. NPM_CONFIG_UPDATE_NOTIFIER=false blokuje ruch notyfikatora npm podczas check. `npm run check` w zwykłym checkout może czytać lokalne `.env.local`; do bezsekretowego sprawdzenia użyć czystej kopii bez `.env*`, ustawiając te same dummy wartości i guard co w workflow. Nie uruchamiać równoległego buildu/dev na wspólnym `.next`.
