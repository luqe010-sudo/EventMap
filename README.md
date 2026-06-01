# EventMap

Portal lokalnych wydarzen w Polsce z publicznym przegladaniem wydarzen oraz panelami admina i organizatora.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript strict
- Supabase JS v2 i @supabase/ssr
- Leaflet, React Leaflet i OpenStreetMap

## Uruchomienie lokalne

```bash
npm install
npm run dev
```

Aplikacja wymaga zmiennych srodowiskowych:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Mozna skopiowac .env.example do .env.local i uzupelnic wartosci z Supabase.

## Vercel

Po imporcie repozytorium w Vercel ustaw te same zmienne srodowiskowe:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Nie dodawaj service role key do zmiennych NEXT_PUBLIC_*.

## Dokumentacja

Dokumentacja techniczna jest w katalogu docs/.
