# Publikacja produkcji — 6 października 2026

To raport wcześniejszej publikacji z 09:53 CEST. Aktualną wersję pakietów 8/9 i bieżący punkt rollbacku opisuje [późniejszy raport](production-release-packages-8-9-2026-10-06.md).

Na wyraźną prośbę użytkownika opublikowano dotychczasowe lokalne zmiany frontendu, publicznego wyszukiwania, kart/talii, konta, walidacji edytora i odzyskiwania hasła.

## Deployment

| Pole | Wartość |
| --- | --- |
| Projekt Vercel | `event-map`, `prj_81CpZTzncBaxsfLON8BL1EmQ54cW` |
| Scope | `luqe010-1961s-projects`, `team_vyoQ4GWSlHKpesAjASF9LuTW` |
| Produkcja | https://mapaimprez.pl oraz https://www.mapaimprez.pl |
| Nowy deployment | `dpl_5iqZnjkeVDe5crmATm1q1gzLJ7wi` |
| URL wersji | https://event-k00v90c3q-luqe010-1961s-projects.vercel.app |
| Utworzenie | 2026-10-06 09:46 CEST |
| Weryfikacja domeny | 2026-10-06 09:53:55 CEST; obie domeny rozwiązuje Vercel do nowego ID |
| Runtime | Node.js 24.x, Next.js 15.5.18 |
| Sposób publikacji | Zdalny build ze źródeł, `--prod --skip-domain`, odczytowe sprawdzenie, następnie `vercel promote` |

Publikacja była bezpośrednia przez CLI. Nie tworzono commita ani nie wypychano zmian do GitHub; bieżące źródła pozostają w lokalnym drzewie. Przed kolejnym automatycznym deploymentem z Git utrwalić ten sam kod w zdalnej gałęzi, aby zachować opublikowane poprawki.

## Konfiguracja

Dodano `NEXT_PUBLIC_SITE_URL=https://mapaimprez.pl` do Vercel Production przed buildem. Istniejące zmienne Supabase i Cloudinary zachowano. `.env.example` dokumentuje produkcyjny origin, a `.vercelignore` wyklucza `.env*`, pliki klienta Google, lokalny build, prywatną konfigurację CLI, importery, dane scrapingu, SQL, testy, dokumentację i diagnostykę. Sprawdzenie paczki wykazało 188 wpisów, ok. 3,97 MB; skan silnych wzorców credentials nie wykazał dopasowań w 187 plikach. Żadne lokalne sekrety nie są częścią paczki aplikacji.

Supabase EventMap (`jifeontwlybxkghbzcry`) miał Site URL `https://mapaimprez.pl` i dwa dodatkowe callbacki. Minimalny config diff wykazał jedną deklarowaną zmianę:

```diff
 additional_redirect_urls = [
   'https://mapaimprez.pl/auth/callback',
   'http://localhost:3000/auth/callback',
+  'https://mapaimprez.pl/auth/recovery\?next=**',
 ]
```

W ramach zleconego wdrożenia zastosowano tylko to pole przez Supabase CLI. Weryfikacja po zapisie: `update=0`, `local_only=0`; 12 pozostałych niedeklarowanych właściwości zachowano. Nie wykonywano SQL, migracji, zmiany RLS, kont, SMTP ani szablonów wiadomości. RPC zapisów z wcześniejszego pakietu pozostają istniejącą zależnością.

## Potwierdzone sprawdzenia

- Poprzednia końcowa weryfikacja kodu: 274/274 testy w 23 plikach, TypeScript i lokalny build. Zdalny build Vercel przeszedł z kontrolą typów/lint: 0 błędów, 15 znanych ostrzeżeń.
- Po publikacji wykonano 12 odczytowych żądań bez sesji konta: strona główna, login, forgot-password, reset-password, callback bez tokenu, admin, navbar API, trzy publiczne API wyszukiwania, robots i sitemap.
- Wrocław + 100 km: lista 18, mapa 18, suma kategorii 18; każdy zwrócony rekord jest published/public/nieanulowany.
- Navbar API zwraca `isLoggedIn=false` i private/no-store. Admin zwraca w renderze strumieniowym przekierowanie Next do `/login?next=%2Fadmin`; HTTP 200 w tym wariancie nie oznacza dostępu do panelu.
- Reset bez kontekstu nie pokazuje pola nowego hasła. Callback bez tokenu zwraca 307 do forgot-password z error=expired i zachowanym next, no-store oraz no-referrer.
- Login zawiera link odzyskiwania. Mobilna przeglądarka potwierdziła powrót z forgot-password do login z `next=/account`.
- Robots wskazuje produkcyjny sitemap; sitemap zwraca XML z indeksem. HTML nie zawiera originu localhost.
- Przeglądarka potwierdziła gotowy publiczny katalog (136 wyników i 134 punkty mapy), karty i talię. Desktop 1280 px i mobile 390 px nie mają poziomego overflow; mobilny formularz recovery także mieści się w widoku. Przywrócono domyślny viewport.

Surowe wyniki techniczne są lokalnie w ignorowanym `scratch/production-smoke.json`; zrzut produkcji zapisano w katalogu wizualizacji zadania.

## Ograniczenia odbioru

Nie wysyłano wiadomości ani nie zmieniano hasła rzeczywistego konta. Custom SMTP i treść szablonu recovery nie zostały potwierdzone przez dostępny odczyt CLI. Domyślny ConfirmationURL wymaga pierwotnej przeglądarki dla PKCE; wariant token_hash między przeglądarkami wymaga opisanego w dokumentacji szablonu. Pełny odbiór sesji Auth/RLS, SMTP, równoległych zapisów i fizycznego telefonu pozostaje otwarty. Publikacja nie zamyka A04 dotyczącego wieloetapowego zapisu edytora. Szczegóły: [checklista](mvp-release-checklist-2026-10-05.md).

## Poprzednia wersja i rollback

Przed wdrożeniem domeny wskazywały gotowy produkcyjny deployment `dpl_5Q7otbmUY3quRujR5aNa9pTRbWPq`, URL `https://event-dyvfp80ax-luqe010-1961s-projects.vercel.app` (30 czerwca 2026). Zachowano go jako punkt rollbacku. Rollback nie został uruchomiony.

```powershell
vercel rollback https://event-dyvfp80ax-luqe010-1961s-projects.vercel.app --scope team_vyoQ4GWSlHKpesAjASF9LuTW --yes
```

Przed ewentualnym wykonaniem potwierdzić dostępność poprzedniej wersji i cel działania. Rollback kodu nie cofa osobno ustawionego publicznego originu Vercel ani dodanego callbacku Supabase; oba są kompatybilne z poprzednią aplikacją.
