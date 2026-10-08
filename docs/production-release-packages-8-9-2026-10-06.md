# Publikacja pakietów 8 i 9 — 6 października 2026

Na polecenie „Wdrażaj” opublikowano aktualny, sprawdzony kod w istniejącym projekcie Vercel `event-map`. Pakiet zawiera feedback częściowych/nieznanych zapisów A04, dynamiczne publiczne dane A07, zgodę i walidację pomiaru A08, pełne statystyki A09 oraz paginację admina D06. Konfiguracja GitHub CI D08 pozostaje lokalna.

## Wersja produkcyjna

| Pole | Wartość |
| --- | --- |
| Projekt | `event-map`, `prj_81CpZTzncBaxsfLON8BL1EmQ54cW` |
| Scope | `luqe010-1961s-projects`, `team_vyoQ4GWSlHKpesAjASF9LuTW` |
| Deployment | `dpl_Dh4QrPip3RxwCg843Zk14NCKb5T1` |
| URL wersji | https://event-asybaiihb-luqe010-1961s-projects.vercel.app |
| Domeny | https://mapaimprez.pl i https://www.mapaimprez.pl |
| Odbiór domeny | 2026-10-06 15:36:18 CEST |
| Runtime | Node.js 24.x, Next.js 15.5.18 |

Wykonano zdalny build ze źródeł przez `vercel deploy --prod --skip-domain --project event-map --scope luqe010-1961s-projects --yes`. Domena główna nadal wskazywała poprzednią wersję podczas odbioru. Chroniony adres nowej wersji sprawdzono przez zalogowane `vercel curl`, następnie wykonano `vercel promote`. Odczyt metadanych obu domen potwierdził powyższy ID i stan `READY`.

Nie zmieniano zmiennych Production, schematu, RLS, Auth, SMTP, kont ani danych Supabase. Istniejący produkcyjny origin i publiczny klucz zostały zachowane. CLI przy lokalnym powiązaniu automatycznie dodało świeży `VERCEL_OIDC_TOKEN` do ignorowanego `.env.local`; ten wpis usunięto po wdrożeniu. Pozostałe lokalne ustawienia zachowano.

Publikacja odbyła się bez commita i push. Przed następną publikacją z Git trzeba utrwalić sprawdzone źródła w zdalnej gałęzi, aby automatyczny deployment nie przywrócił starszego kodu. Workflow CI nie został uruchomiony w GitHub ani objęty branch protection.

## Potwierdzone kontrole

- Lokalny końcowy `npm run check`: 418/418 testów w 32 plikach, TypeScript, build i lint bez błędów; 15 zastanych ostrzeżeń. Zdalny build Vercel przeszedł kontrolę lint/typów i generację tras.
- Manifest uploadu: 201 wpisów, 200 plików, 4 007 663 bajty. `.vercelignore` wyklucza `.env*`, prywatną konfigurację CLI, credential JSON, dane robocze, SQL, testy i dokumentację. Skan wskazanych wzorców credentials nie wykazał dopasowań. SHA-256 wszystkich 200 plików był niezmieniony przed promocją.
- 23 kontrole HTTP nowej wersji przed promocją i 23 po promocji: publiczny katalog/lista/mapa/kategorie/detail, brakujący UUID 404, alias 308, sitemap/robots, logowanie/recovery, anonimowy navbar oraz panele admina/organizatora.
- Wrocław +100 km: 18 kart, 18 punktów, suma kategorii 18; rekordy mają published/public/nieanulowane. Publiczne API, alias i sitemap mają `Cache-Control: no-store, max-age=0`.
- Anonimowe panele zawierają przekierowania Next do logowania. Strumieniowe HTTP 200 nie oznacza dostępu. Callback recovery bez tokenu daje 307 do forgot-password z error=expired, no-store i no-referrer. Formularz nowego hasła pozostaje niedostępny bez kontekstu recovery.
- Cztery celowo błędne żądania analityki w każdej fazie dały 400/403/413/415: odmowa zgody, obcy origin, nadmierne body i zły Content-Type. Odrzucono je przed INSERT; nie wykonywano prawidłowego żądania zapisu analityki.
- Przeglądarka produkcji potwierdziła gotowy katalog: 136 wydarzeń, pierwsze 20 kart, 134 punkty mapy. Nowy banner wymienia statystyki wydarzeń i Google Analytics. Odmowa zamyka banner i zachowuje dostęp do ustawień cookies. Przy 390 px szerokość dokumentu wynosiła 375 px; przy domyślnych 1280 px — 1265 px. Przywrócono domyślny viewport.

Wyniki: ignorowane `scratch/mvp-package-9-candidate-smoke.json`, `scratch/mvp-package-9-production-smoke.json`, `scratch/mvp-package-9-release-source-audit.json`, `scratch/mvp-package-9-vercel-build.log`, `scratch/mvp-package-9-promotion.log` i metadane domen. Zrzuty `package9-production-desktop.png` oraz `package9-production-mobile.png` są w katalogu wizualizacji czatu `01a11061-eedd-7653-b5de-084264bfd451`.

## Punkt powrotu

Bezpośrednio przed publikacją domena wskazywała gotową wersję `dpl_5iqZnjkeVDe5crmATm1q1gzLJ7wi`, opisaną w [poprzednim raporcie](production-release-2026-10-06.md). Zachowano jej URL; rollback nie był potrzebny i nie został uruchomiony.

```powershell
vercel rollback https://event-k00v90c3q-luqe010-1961s-projects.vercel.app --scope luqe010-1961s-projects --yes
```

Przed rollbackiem potwierdzić cel i dostępność wersji. Polecenie przywraca kod; nie wykonuje migracji bazy.

## Pozostały odbiór

Po późniejszym zatwierdzeniu wykonano także osobny SQL RLS lokalizacji/analityki o 21:20 CEST; testy po zmianie przeszły i wycofały wszystkie fixture. [Aktualny raport Supabase i rollback](supabase-rls-hardening-release-2026-10-06.md). Frontend/Vercel pozostały bez zmian. Poniższy opis przygotowanej propozycji RLS jest historyczny.

Po zgodzie użytkownika wykonano 6.10 o 20:54 CEST transakcyjne testy SQL na istniejącym Supabase, niezależnie od powyższej publikacji frontendu. [Raport RLS](supabase-rls-tests-2026-10-06.md): działające zabezpieczenia i cztery luki bezpieczeństwa/jeden błąd funkcjonalny, wszystkie fixture wycofane, dziewięć katalogów niezmienionych. Nowa propozycja naprawy lokalizacji/analityki pozostaje niewykonana. Te próby nie zaliczają realnych sesji/e-maili, A04 ani pełnej checklisty.

A04 transakcja/idempotencja i A08 ochrona bezpośredniego INSERT/między instancjami pozostają otwarte. Statystyki REST nie mają wspólnej migawki. Pełny odbiór prawdziwych sesji, zapisów, e-maili i fizycznego telefonu wymaga staging oraz [48 przygotowanych prób](mvp-release-checklist-2026-10-05.md). Publikacja nie zastępuje tych prób.

Odczyt metadanych Supabase potwierdził brak `EventMap-staging` w dostępnych projektach oraz zdrową produkcję `jifeontwlybxkghbzcry` w `eu-central-1`. Repo zawiera migracje przyrostowe bez pełnego baseline. Po publikacji wykonano [uzupełniający odczyt katalogu](event-write-staging-readonly.sql), połączony z dotychczasowym audytem w jeden SELECT, oraz [dokładne typy 179 kolumn](local-staging-columns-readonly.sql); [zakres i wyniki](staging-proposal.md). Użytkownik potwierdził Free; oba miejsca zajęte. [Wariant lokalny](local-staging-preflight.md), odizolowany config i osobny baseline są przygotowane bez usług/migracji; brak Docker/Podman i mała dostępna pamięć nadal blokują jego start. Nie utworzono płatnych zasobów. Osobny SQL RLS lokalizacji/analityki z rollbackiem jest już gotowy do zatwierdzenia; A04 oraz pozostałe zabezpieczenia edycji wymagają dalszego projektu. Zgodnie z AGENTS.md wykonanie migracji trzeba uzgodnić osobno.
