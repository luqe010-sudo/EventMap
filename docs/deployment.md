# Deployment

## Uruchomienie lokalne

Wymagane zależności:

- Node.js zgodny z Next.js 15.
- npm.
- Dostęp do projektu Supabase.

Instalacja:

```bash
npm install
```

Start developerski:

```bash
npm run dev
```

Build produkcyjny:

```bash
npm run build
```

Start po buildzie:

```bash
npm run start
```

Lint:

```bash
npm run lint
```

Skrypt `lint` korzysta z ESLint CLI oraz konfiguracji `eslint.config.mjs`; nie uruchamia interaktywnego `next lint`.

## Zmienne środowiskowe

Kod wymaga:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=https://mapaimprez.pl
CLOUDINARY_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Alternatywnie dla klucza publicznego kod obsługuje:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

W `.env.local` obecne są publiczne zmienne Supabase. Nie należy dodawać service role key do kodu klienta ani do zmiennych `NEXT_PUBLIC_*`.

`NEXT_PUBLIC_SUPABASE_URL` powinien mieć format samego originu projektu Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
```

Nie ustawiaj tu endpointu REST, np. `https://PROJECT_ID.supabase.co/rest/v1`. Kod normalizuje URL do originu, ale poprawna wartość zmiennej środowiskowej ułatwia diagnozę logów Vercel i Supabase.

`NEXT_PUBLIC_SITE_URL` jest zalecane dla stabilnego callbacku Google OAuth. Bez tej zmiennej aplikacja wyznacza origin z naglowkow zadania.

### Google OAuth

W Google Cloud Console autoryzowany redirect URI klienta webowego powinien wskazywac callback Supabase:

```text
https://PROJECT_ID.supabase.co/auth/v1/callback
```

W Supabase Dashboard, w `Authentication -> URL Configuration`, dodaj do Redirect URLs:

```text
https://mapaimprez.pl/auth/callback
http://localhost:3000/auth/callback
```

Jesli lokalna aplikacja dziala na innym porcie, ten callback tez musi byc dodany. Plik pobrany z Google Cloud w formacie `client_secret_*.json` nie jest potrzebny aplikacji i nie moze trafic do repozytorium ani deploymentu; wzorzec jest ignorowany przez `.gitignore`.

Upload obrazów wydarzeń używa Cloudinary po stronie serwera. Wymagane są:

```bash
CLOUDINARY_URL=
```

Alternatywnie można ustawić konfigurację Cloudinary jako osobne zmienne:

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Opcjonalnie można ustawić folder dla obrazów wydarzeń:

```bash
CLOUDINARY_EVENT_FOLDER=eventmap/events
```

`CLOUDINARY_URL` i `CLOUDINARY_API_SECRET` nie mogą być ustawione jako zmienne `NEXT_PUBLIC_*`, bo zawierają sekret używany do podpisywania uploadu.

Google Analytics jest skonfigurowany bez dodatkowej zmiennej środowiskowej. Identyfikator `G-60019N4V87` jest używany w `components/CookieConsent.tsx`, a skrypt GA ładuje się dopiero po zgodzie użytkownika w bannerze cookies.

## Supabase

Projekt jest połączony z Supabase CLI lokalnie przez katalog `supabase/.temp`, ale repozytorium nie zawiera migracji SQL.

Typy bazy są wygenerowane w:

```bash
database.types.ts
```

Komenda używana dla aktualizacji typów:

```bash
npx supabase gen types typescript --project-id jifeontwlybxkghbzcry > database.types.ts
```

Ta komenda wymaga dostępu sieciowego i zalogowanego Supabase CLI albo tokena Supabase.

## Kroki deploymentu aplikacji

1. Skonfiguruj zmienne środowiskowe w platformie hostingowej.
2. Upewnij się, że RLS policies w Supabase pozwalają na scenariusze opisane w `docs/auth.md` i `docs/database.md`.
3. Upewnij się, że tabela `categories` ma rekordy używane przez formularze.
4. Upewnij się, że konto admina ma rekord `profiles` z `role = 'admin'`.
5. Uruchom `npm run build`.
6. Wdróż aplikację jako standardową aplikację Next.js.

## SEO po wdrozeniu

Po wdrozeniu sprawdz:

- `https://mapaimprez.pl/robots.txt` powinien zwracac `text/plain` i wskazywac `https://mapaimprez.pl/sitemap.xml`;
- `https://mapaimprez.pl/sitemap.xml` powinien zwracac indeks sitemap;
- w Google Search Console ponownie przeslij `sitemap.xml`;
- sprawdz raport indeksowania pod katem `Soft 404`, `Odkryto, obecnie nie zaindeksowano` i `Przeslano i zindeksowano`;
- stare adresy `/wydarzenie/[slug]` i `/wydarzenia/[slug]` powinny zwracac 308 do kanonicznego URL-a wydarzenia albo 404 dla nieistniejacego sluga.

## Hosting

`PROJECT_BRIEF.md` wskazuje docelowo Vercel, a `app/layout.tsx` używa domeny `https://mapaimprez.pl` w metadanych. W repozytorium nie ma jednak plików konfiguracyjnych Vercel, GitHub Actions ani innego pipeline'u.

Docelowa platforma deploymentu wymaga potwierdzenia.

## Seed danych

Repozytorium nie zawiera migracji SQL. Zawiera natomiast pomocniczy seed danych demonstracyjnych:

```bash
supabase/seed-demo-events.sql
```

Seed dodaje przykładowe lokalizacje, wydarzenia publiczne oraz wpisy `event_sources`. Używa slugów `demo-*`, więc może być uruchamiany ponownie bez dublowania tych samych wydarzeń.

Przykładowe uruchomienie przez Supabase CLI:

```bash
npx supabase db query --linked --file supabase/seed-demo-events.sql
```

Komenda wymaga zalogowanego Supabase CLI albo zmiennej `SUPABASE_ACCESS_TOKEN`. Tokenów Supabase nie należy zapisywać w repozytorium.

Dla działania paneli i formularzy potrzebne są przynajmniej:

- rekordy w `categories`;
- rekord admina w `profiles`;
- opcjonalnie rekordy `organizers` i `organizer_users` dla kont organizatorów;
- aktywne `city_pages` dla stron miast.

## Elementy wymagające potwierdzenia

- Docelowy hosting i domena produkcyjna.
- Strategia migracji bazy.
- Strategia seedowania kategorii.
- Konfiguracja Supabase Auth w panelu Supabase.
- CI/CD.
- Monitoring błędów i logów.
