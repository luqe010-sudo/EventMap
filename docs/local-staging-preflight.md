# Bezpłatny lokalny staging — preflight

Stan: **preflight lokalny, 2026-10-06; przygotowano pliki, nie uruchomiono usług ani migracji**. CLI 2.119.0 wykonał `init` w `E:/EventMap/scratch/local-staging`; skopiowano tam przejrzaną [konfigurację testową](local-staging-config.toml). Nie instalowano runtime ani nie zmieniano systemu lub produkcji. Plan Free z dwoma aktywnymi projektami potwierdził użytkownik. Lokalny stack wykorzystuje zasoby komputera i nie wymaga trzeciego projektu hosted. [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) opisuje lokalny charakter `init`.

**Proponowany wariant dla tego Windows: osobny lokalny workspace i Supabase 17 uruchamiany przez działający silnik kontenerów kompatybilny z Docker.** Opcja dodatkowa to eksperymentalny runtime native w zgodnym Linux wewnątrz WSL2. Na Windows sam CLI nie wystarcza. Brak dostępnego działającego runtime oznacza, że preflight nie jest zakończony. Ten dokument nie jest zgodą na instalowanie narzędzi systemowych.

Użytkownik później zezwolił na testy istniejącej bazy Supabase. Obecny pakiet syntetycznych prób SQL z pełnym ROLLBACK korzysta więc z EventMap bez uruchamiania lokalnego runtime; [bieżący zakres](staging-proposal.md). Ten lokalny wariant jest opcją kolejnych prób, a nie warunkiem autoryzowanych testów transakcyjnych. [Baseline SQL](local-staging-baseline-proposal.sql) jest już przygotowaną i statycznie przejrzaną propozycją; nie wykonano go ani nie zaliczono odtworzenia schematu w runtime.

## Potwierdzone w repozytorium

- `package.json` i zainstalowany pakiet wskazują Supabase CLI **2.119.0**. Oficjalne [wydanie 2.119.0](https://github.com/supabase/cli/releases/tag/v2.119.0) pochodzi z 30.09.2026.
- Główny `E:/EventMap/supabase/config.toml` nadal nie istnieje. Osobny config jest wyłącznie w `scratch/local-staging/supabase/config.toml`; nie ma tam `.temp/project-ref` ani powiązania z hosted projektem. Dostępnych pięć migracji jest przyrostowych i nie odtworzy całej aplikacji w pustej bazie.
- W odczycie PATH znaleziono `wsl.exe` i `tar.exe`; nie znaleziono Docker/Podman. Sprawdzenie wskazanych binariów Docker/Podman/Rancher również było negatywne. `wsl --list --quiet` zakończył się kodem 1 i pomocą zamiast listy dystrybucji. Nie potwierdzono dostępnego działającego runtime; wynik nie ustala definitywnie stanu funkcji Windows/WSL.
- `status` wczytał izolowaną konfigurację, następnie zakończył się kodem **1**: `docker: command not found (podman also not found)`. Wyniki pozostają w ignorowanym `scratch/local-staging/status-preflight.json` (pusty) i `status-preflight.err.log`. Zaakceptowanie configu nie jest udanym startem ani testem Auth/RLS.
- [Audyt katalogowy](event-write-staging-readonly.sql) wraz z wcześniejszym audytem oraz [odczytem dokładnych kolumn](local-staging-columns-readonly.sql) daje podstawę przeglądu schematu. Odczyt kolumn o **16:30 CEST** potwierdził 179 kolumn w 18 tabelach aplikacji, m.in. `locations.geom = geography(Point,4326)`. Nie odczytywano wierszy aplikacji/Auth. To nadal nie jest pełny, odtwarzalny baseline; jego przygotowanie opisuje [propozycja staging](staging-proposal.md).

## Runtime i sprzęt

| Wariant | Wymagania | Ocena dla tego zadania |
| --- | --- | --- |
| Native na Linux (eksperymentalny) | amd64/arm64, Ubuntu 22.04+ albo glibc ≥2.35, `tar`, użytkownik nie-root, dostęp do archiwów usług | Opcja bez silnika kontenerów, jeśli zgodny Linux już istnieje. |
| Native na macOS | Apple Silicon, macOS 14+ | Wspierany; nie dotyczy obecnego Windows. |
| Native bezpośrednio na Windows | Brak oficjalnego wsparcia | Nie stanowi ścieżki uruchomienia. |
| Docker na Windows | Działający silnik kontenerów Linux, zgodny Windows/WSL2 lub Hyper-V, wirtualizacja | Możliwy, lecz nie wykryto go w PATH. |
| Podman na Windows | Działająca Podman machine z Linux/WSL2 i API kompatybilnym z Docker | Możliwy, lecz nadal wymaga środowiska Linux; nie jest samym plikiem CLI. |

Wymagania native oraz pobieranie zweryfikowanych archiwów pochodzą z [Docker and native runtimes](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes). Archiwa trafiają do cache; wymagają sieci przy pierwszym pobraniu. Dozwolone hosty to GitHub z `release-assets.githubusercontent.com` albo fallback `supabase-cli-artifacts.s3.us-east-1.amazonaws.com`. Dane/cache native są domyślnie pod `~/.supabase`; `SUPABASE_HOME` pozwala wybrać osobny katalog. Procesy dzielą zasoby hosta, więc dla testów preferować jeden stack w osobnym środowisku Linux.

[Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) wymaga m.in. 8 GB RAM, procesora 64-bit z SLAT i włączonej wirtualizacji; backend WSL wymaga WSL ≥2.1.5 oraz wspieranej wersji Windows. Darmowość Desktop zależy od warunków licencji: użytek osobisty lub mała firma spełniająca oba limity, poniżej 250 pracowników i 10 mln USD przychodu. [Podman](https://podman.io/docs/installation) na Windows korzysta z maszyny Linux w WSL2. Nie instalowano żadnego z tych wariantów.

[CLI reference](https://supabase.com/docs/reference/cli/supabase-start) zaleca co najmniej **7 GB RAM dla wszystkich usług**. Supabase nie podaje tam zweryfikowanego minimum RAM dla ograniczonego native stacka. [Wymagania pełnego self-hostingu](https://supabase.com/docs/guides/self-hosting/docker) wynoszą 2 rdzenie/4 GB RAM/40 GB SSD, z rekomendacją 4 rdzeni/8 GB+/80 GB+; dotyczą innego profilu i nie zastępują zalecenia CLI. **Budżet roboczy dla Windows + Linux + Next.js: 16 GB RAM hosta, 4 rdzenie, 40 GB wolnego SSD** to propozycja planowania, nie zmierzony próg tego projektu. Przed startem sprawdzić dostępne zasoby i koszt miejsca na obrazy/cache.

Odczyt CIM potwierdził **Windows 11 Pro 10.0.22631, 4 rdzenie, 8 GiB RAM i około 1,1 GiB wolnej pamięci** w chwili kontroli. Wirtualizacja i SLAT są włączone; na C: i E: było ponad 200 GiB wolnego miejsca. CPU/dysk nie są wykrytym ograniczeniem, lecz **dostępna pamięć jest istotnym ograniczeniem**. Wyłączenie dodatkowych usług nie dowodzi, że PG17/Auth/REST/mail oraz Next.js zmieszczą się w tym RAM. Potrzebna będzie ponowna ocena pamięci i pomiar po kontrolowanym uruchomieniu; preflight nie zalicza wydajności.

## Minimalny rzeczywisty zestaw usług

Potrzebne są Supabase PostgreSQL **17**, Auth, PostgREST/REST, gateway i lokalna skrzynka testowa Mailpit. Dla A04 można pominąć Realtime, Storage, Edge Functions, Studio, Analytics i pooler. To propozycja wynikająca z używanego kodu: obrazy trafiają do Cloudinary, sesje do Auth, a odczyty/RPC do REST. Mniejszy stack nadal sprawdza prawdziwe JWT/RLS/transakcje; uruchomienie samego PostgreSQL nie pokrywa tych przepływów. Pełny zestaw usług dostępny jest także w [native runtime](https://supabase.com/features/native-local-runtime).

W [przygotowanym configu](local-staging-config.toml) ustawiono PG17, API 54331, DB 54332, Mailpit 54334 i frontend `http://127.0.0.1:3001`. Automatyczne migracje i seed są wyłączone; potwierdzanie e-mail jest włączone. Pozostają wyłącznie PostgreSQL, Auth (`gotrue`), REST (`postgrest`), gateway (`kong`) i mail (`mailpit`). Nie skonfigurowano zewnętrznego SMTP/OAuth. Baseline wymaga osobnego przeglądu przed wykonaniem SQL.

Standardowy tryb kontenerowy jest przygotowany dla izolowanego katalogu. Polecenie przyszłego startu poniżej **nie zostało wykonane**; wymaga działającego runtime i ponownego sprawdzenia RAM. Lista wykluczeń jest zgodna z [CLI reference](https://supabase.com/docs/reference/cli/supabase-start):

```sh
npx --no-install supabase --workdir E:/EventMap/scratch/local-staging start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

Polecenie korzysta z zainstalowanego pakietu, wywoływanego z `E:/EventMap`. Pomoc CLI 2.119.0 potwierdza, że `--workdir` używa katalogu dokładnie podanego przez wywołującego i nie szuka configu w katalogach nadrzędnych. Domyślnie CLI szuka w górę od bieżącego katalogu. Nie potrzeba dodatkowej flagi wyłączającej to szukanie. Silnik Docker musi już działać; dla Podman standardowy tryb wymaga działającego API kompatybilnego z Docker.

Opcjonalny **eksperymentalny** stack wymaga CLI 2.119.0 oraz `[experimental] stack = true`; w katalogu bez config opt-in to `SUPABASE_EXPERIMENTAL_STACK=1`. Przykład native uruchamiany **w zgodnym Linux**, nie w PowerShell, **nie wykonany**:

```sh
supabase start --runtime native --exclude realtime,storage,functions,studio,analytics,pooler --eager
```

Nazwy wykluczeń eksperymentalnych są z [Running multiple local projects](https://supabase.com/docs/guides/local-development/running-multiple-local-projects). Nie mieszać ich z flagami standardowego trybu. Zachować `auth`, `rest` i `mail`; `--eager` uruchamia usługi przed próbami. Przypiąć 2.119.0 i nie ignorować health checków. Eksperymentalny wariant kontenerowy przyjmuje `--runtime docker` lub `--runtime podman`.

## Porty i oddzielenie od produkcji

| Usługa | Port przygotowanego configu | Stan |
| --- | --- | --- |
| API/gateway | 54331 | Skonfigurowany, nie uruchomiony |
| PostgreSQL | 54332 | Skonfigurowany, nie uruchomiony |
| Skrzynka testowa — WWW | 54334 | Skonfigurowana, nie uruchomiona |
| Studio | 54333 | Wyłączone |
| Shadow DB / pooler | 54330/54339 | Shadow tylko dla odpowiednich narzędzi; pooler wyłączony |
| Analytics | 54337 | Wyłączone |
| Osobny frontend EventMap | 3001 | Adres przygotowany, frontend nie uruchomiony |

`netstat` wykazał bieżący podgląd na **127.0.0.1:3000, PID 13564**. Nie znaleziono nasłuchu TCP na 3001 ani 54330–54339; wynik dotyczy chwili kontroli, więc powtórzyć sprawdzenie przed startem. Eksperymentalny stack bez fixed ports przydziela 20000–32767; ustalone w config mają pierwszeństwo. Przy ewentualnym przejściu do native/WSL wziąć rzeczywiste endpointy z `status`, sprawdzić nasłuch i dostępność z Windows. Named stack wymaga jawnego lokalnego DB URL dla komend bazodanowych. [Opis izolacji stacków](https://supabase.com/docs/guides/local-development/running-multiple-local-projects).

Proponowana izolacja dla EventMap:

1. Przygotowany katalog danych/configu `scratch/local-staging` jest ignorowany przez Git. Frontend również powinien mieć osobny katalog i port; nie nadpisywać `.next` bieżącego podglądu. Nie kopiować `.env*`, `.vercel`, `supabase/.temp`, zdalnego powiązania projektu ani zapisanych credentials CLI. Nie podłączać katalogu do hosted Supabase.
2. Frontend używa wyłącznie lokalnego API/publicznego klucza i osobnego adresu strony. Service-role/secret key tylko dla kontrolowanych lokalnych narzędzi testowych, nigdy `NEXT_PUBLIC_*` ani w logu. Nie eksportować całego `status --env` do współdzielonego pliku.
3. Dostęp wyłącznie z localhost/środowiska testowego; sprawdzić nasłuch IPv4/IPv6 i reguły zapory przed testem. Lokalny stack jest przeznaczony do developmentu i nie powinien przyjmować ruchu zewnętrznego. [Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows) opisuje jego ograniczenia.
4. Bez produkcyjnych kluczy OAuth/SMTP/Cloudinary. Weryfikacja e-mail przez lokalny mail sink, adresy syntetyczne; brak realnej wysyłki. Obrazy/integracje wymagają osobnego testowego kanału, aby test wydarzenia nie uploadował do produkcyjnego Cloudinary. OAuth z zewnętrznym dostawcą pozostaje oddzielną próbą integracyjną.
5. Przed każdą mutacją testową guard sprawdza lokalny API/DB host, port i tożsamość środowiska, odrzuca produkcyjny ref/domeny i nie przyjmuje `--linked`. Sam service-role nie stanowi testu RLS: użyć rzeczywistych sesji zwykłych użytkowników.

## Warunek gotowości

Przed uznaniem lokalnego staging za gotowy należy potwierdzić: działający zgodny runtime, zasoby i wolne porty; rzeczywisty PG17 oraz wersje/położenie potrzebnych rozszerzeń; przejrzany i osobno zatwierdzony schema-only baseline z RLS/grantami/funkcjami/triggerem rejestracji; wyłącznie syntetyczne dane; poprawne Auth→JWT→PostgREST→RLS i odbiór testmail. Dopiero potem uruchamiać zatwierdzone próby A04 i rollback. Nie kopiować zarządzanego `auth.users` ani całych ról platformy z produkcji. Brak runtime lub baseline oznacza niezakończony preflight, a nie zaliczone testy bezpieczeństwa.
