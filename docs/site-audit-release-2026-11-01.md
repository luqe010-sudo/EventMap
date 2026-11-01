# Publikacja poprawek audytu — 1 listopada 2026

Poprawki są opublikowane na https://mapaimprez.pl. Wdrożenie na wyraźne polecenie właściciela „Wdrażaj”. Końcowy odbiór HTTP: 21:43:57 CET, 19/19 kontroli zaliczonych.

## Wersja i wycofanie

- Projekt: Vercel event-map, prj_81CpZTzncBaxsfLON8BL1EmQ54cW; scope team_vyoQ4GWSlHKpesAjASF9LuTW.
- Końcowy deployment: dpl_97HoVYrcU87oe5hHGupWmJvDhfVs, https://event-p6kdbmn5u-luqe010-1961s-projects.vercel.app. Domenę potwierdzono przez vercel inspect po promocji.
- Punkt wycofania sprzed tej publikacji: dpl_5FdEtNHdYRV7e2WtEbc7kHg2wHUm, https://event-7lfx0fpst-luqe010-1961s-projects.vercel.app.
- Publikacja ze źródeł: vercel deploy --prod --skip-domain, kontrola gotowej wersji, vercel promote. Bez lokalnego prebuilt.
- Pierwszy deployment pakietu: dpl_C8s1zQ6uxeBzMj2VzoHzjAnfc9yr. Odbiór mobilny ujawnił brak spacji między zdaniami po ukryciu br; końcowa wersja dodaje wyłącznie tę spację w HeroSection i ponownie przechodzi build oraz odbiór HTTP.
- Nie tworzono commita ani nie wysyłano zmian do GitHub. Kolejny automatyczny deployment z Git musi zawierać te same źródła, aby nie cofnąć poprawek.

## Kontrola

- Paczka: 220 plików, około 5,09 MB. Dodano .claude do .vercelignore. Wykluczone środowisko, konfiguracja CLI, worktree, dokumentacja/SQL, importery, skrypty, testy i dane importu. Kontrola ścieżek i silnych sygnatur sekretów bez dopasowań.
- Ostatnie testy przed publikacją: 539/539, TypeScript i lokalny build poprawne. Zdalne buildy kończą się poprawnie, lint bez błędów, 11 znanych ostrzeżeń.
- Przed promocją: strona organizatorów 200, nieistniejąca strona 404, błędne współrzędne 400, panel admina bez sesji 307, publiczne API bez pola email i z filtrami published/public/nieanulowane.
- Po końcowej promocji: 19/19 kontroli HTTP. Obydwa nieistniejące adresy z audytu 404; panele 307; wielkie litery 308; skrót terminu 307; trzy błędne konteksty wyszukiwania 400.
- Strona główna, koncerty, regulamin i strona organizatorów: 200, pojedynczy description, obecne nagłówki CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy. Koncerty mają własny og:url. Sitemapy i robots 200.
- Publiczne API: 12 pozycji, zachowane filtry widoczności i brak email organizatora. www przekierowuje do domeny głównej.
- Przeglądarka produkcji 375 × 812: 12 kart, brak poziomego overflow, pierwsza karta około 948 px od góry, przycisk cookies position: static, link organizatorów prowadzi do /dla-organizatorow. Poprawiony odstęp potwierdzono w HTML końcowej wersji.
- Surowe wyniki bez danych kontaktowych: [site-audit-release-2026-11-01.json](site-audit-release-2026-11-01.json).

## Zakres poza publikacją

Nie wykonywano SQL, migracji ani zmian danych, RLS, kont, Auth, zmiennych środowiskowych i regionu. B1/B2 dotyczące istniejących rekordów, W5 oraz brakujące centra miast pozostają objęte osobną propozycją SQL. Nie przeprowadzono odbioru formularzy na kontach testowych ani na fizycznym telefonie. Runtime pozostał w iad1; decyzja o regionie europejskim wymaga potwierdzenia regionu Supabase.
