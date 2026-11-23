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

Usługa domenowa: `sc-domain:mapaimprez.pl`. API jest włączone w projekcie `mapaimprezserwis`, a dedykowane konto ma ograniczony dostęp do usługi. Po [skonfigurowaniu uwierzytelniania](docs/search-console.md) uruchom `npm run seo:gsc`, aby porównać ostatnie 28 dni z poprzednimi 28 dniami w wynikach Google w Polsce. Poświadczenia pozostają poza repozytorium i aplikacją.

[Plan wzrostu na 90 dni](docs/seo-growth-plan.md) opisuje pilotaż lokalnych kalendarzy, pomiar ruchu i kryteria rozszerzenia. Search Console mierzy kliknięcia z Google; [GA4 i pomiar interakcji](docs/event-analytics.md) są osobnymi źródłami danych zależnymi od zgody.
