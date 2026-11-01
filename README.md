# EventMap

Portal lokalnych wydarzen w Polsce z publicznym przegladaniem wydarzen oraz panelami admina i organizatora.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript strict
- Supabase JS v2 i @supabase/ssr
- MapLibre GL JS

## Uruchomienie lokalne

```bash
npm install
npm run dev
```

Aplikacja wymaga zmiennych srodowiskowych:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
CLOUDINARY_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Mozna skopiowac .env.example do .env.local i uzupelnic wartosci z Supabase.

## Vercel

Po imporcie repozytorium w Vercel ustaw te same zmienne srodowiskowe:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- CLOUDINARY_URL
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Nie dodawaj service role key do zmiennych NEXT_PUBLIC_*.

## Dokumentacja

Dokumentacja techniczna jest w katalogu docs/.

## Google Search Console — widoczność w Google

Stan lokalnego projektu `E:\EventMap` na 2026-10-27: `app/robots.ts` wskazuje `https://mapaimprez.pl/sitemap.xml`, a `app/sitemap.xml/route.ts` wystawia indeks pięciu map. `app/layout.tsx` ustawia tę domenę jako bazową. W sprawdzonym kodzie nie ma znacznika weryfikacji GSC. W `docs/deployment.md` jest historyczna wzmianka o ponownym przesłaniu mapy, ale nie dowodzi ona dostępu do konta GSC. Odpowiedzi produkcyjnych `/robots.txt` i `/sitemap.xml` nie udało się potwierdzić w tej kontroli.

Kod `components/CookieConsent.tsx` zawiera Google Analytics 4 (`G-60019N4V87`) ładowane dopiero po zgodzie odwiedzającego. Osobny pomiar interakcji z wydarzeniami opisuje `docs/event-analytics.md`. Obecność kodu nie potwierdza dostępu do raportów GA4 ani działania pomiaru na produkcji.

**Jeden krok Prezesa teraz:** otwórz [oficjalną Google Search Console](https://search.google.com/search-console/) we własnej przeglądarce, zaloguj się na swoje konto Google i sprawdź w selektorze usług, czy widzisz `mapaimprez.pl` lub `https://mapaimprez.pl/` oraz masz do niej dostęp.

Jeśli usługi nie ma, wybierz **Dodaj usługę**. Prefiks adresu to dokładnie `https://mapaimprez.pl/` (tylko ten protokół i host). Usługa domenowa `mapaimprez.pl` obejmuje też `www`, lecz wymaga weryfikacji DNS. Nowa usługa wymaga **potwierdzenia własności** metodą pokazaną przez Google: prefiks może używać znacznika HTML lub pliku w witrynie (osobna zmiana i wdrożenie), a domena rekordu DNS. Istniejący identyfikator GA4 nie jest dowodem weryfikacji GSC. Jeżeli usługa istnieje, lecz brakuje dostępu, może go nadać obecny właściciel. [Dodawanie usług](https://support.google.com/webmasters/answer/34592?hl=pl) · [weryfikacja własności](https://support.google.com/webmasters/answer/9008080?hl=pl). W tym zadaniu nie zmieniono DNS, kodu weryfikacyjnego ani produkcji.

Po uzyskaniu dostępu **Skuteczność → Wyniki wyszukiwania** pokazuje kliknięcia, wyświetlenia, CTR i średnią pozycję; niżej można wybrać zapytania i strony. **Indeksowanie → Strony** pokazuje strony zindeksowane, niezindeksowane i przyczyny; **Indeksowanie → Mapy witryn** pokazuje stan `https://mapaimprez.pl/sitemap.xml`. [Metryki](https://support.google.com/webmasters/answer/7576553?hl=pl) · [indeksowanie](https://support.google.com/webmasters/answer/7440203?hl=pl).

GSC mierzy widoczność i kliknięcia w usługach wyszukiwarki Google, **nie wszystkie wizyty w serwisie**. GA4 również może pomijać wizyty, bo obecny kod uruchamia się tylko po zgodzie.

Minimalny późniejszy odczyt: po weryfikacji wybierz w raporcie skuteczności typ „Sieć” i ostatnie 28 pełnych dni, następnie **Eksportuj → CSV**; z raportu stron przekaż zagregowane liczby zindeksowanych i niezindeksowanych. Eksport może mieć limit wierszy. [Eksport CSV](https://support.google.com/webmasters/answer/12919797?hl=pl). Później właściciel może zamiast CSV nadać odrębnemu kontu rolę **Użytkownik z ograniczonym dostępem** w **Ustawienia → Użytkownicy i uprawnienia** lub osobno autoryzować API zakresem OAuth `webmasters.readonly`. [Uprawnienia](https://support.google.com/webmasters/answer/7687615?hl=pl) · [API](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing). Nie przekazuj agentom haseł, cookies ani tokenów i nie zapisuj ich w raportach. Bez autoryzacji właściciela agenci nie mają dostępu do statystyk GSC.
