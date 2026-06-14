# eBilet importer

Maly importer CLI do przenoszenia danych z `scraping/ebilet_muzyka_v3.json` do Supabase.

Domyslnie skrypt dziala w trybie dry-run i pokazuje mapowanie jednego rekordu bez zapisu do bazy:

```powershell
node importers/ebilet/import-ebilet.mjs --limit 1
```

Przed faktycznym zapisem ustaw service role key lokalnie, poza zmiennymi `NEXT_PUBLIC_*`.

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="..."
$env:EVENTMAP_IMPORT_WRITE="1"
node importers/ebilet/import-ebilet.mjs --limit 1 --apply
```

Wymagane zmienne:

- `NEXT_PUBLIC_SUPABASE_URL` - URL projektu Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` albo `EVENTMAP_SUPABASE_SERVICE_ROLE_KEY` - klucz tylko do lokalnego/serverowego importu.
- `EVENTMAP_IMPORT_WRITE=1` - dodatkowa blokada przed przypadkowym zapisem.
- `OPENROUTER_API_KEY` albo `EVENTMAP_OPENROUTER_API_KEY` - preferowany klucz AI do `--rewrite-ai`.
- `GEMINI_API_KEY` albo `EVENTMAP_GEMINI_API_KEY` - klucz Gemini do `--rewrite-ai`.
- `OPENAI_API_KEY` albo `EVENTMAP_OPENAI_API_KEY` - alternatywny klucz OpenAI do `--rewrite-ai`.
- `EVENTMAP_AI_PROVIDER` - opcjonalnie `auto`, `openrouter`, `gemini` albo `openai`; domyslnie `auto`.
- `OPENROUTER_REWRITE_MODEL`, `GEMINI_REWRITE_MODEL` lub `OPENAI_REWRITE_MODEL` - opcjonalny model do przeredagowywania opisow.

Zasady importu:

- kategoria musi juz istniec w tabeli `categories`;
- importer tworzy brakujace `cities` i `locations`;
- domyslny organizator wydarzenia to `51206165-f555-4cc0-9f96-ba26e36f02b4` (`MODERATOR`); importer sprawdza, czy istnieje w `organizers`;
- organizatora mozna nadpisac opcja `--organizer-id <uuid>`;
- wydarzenia dostaja domyslnie status `pending_review`, chyba ze podasz `--status published`;
- `start_at` z eBilet jest traktowane jako lokalny czas `Europe/Warsaw` i zapisywane z offsetem, np. `2026-10-09T21:00:00+02:00`;
- `end_at` z sama data jest pomijane, jesli to ten sam dzien co start; dla wydarzen wielodniowych dostaje koniec dnia lokalnie, np. `2026-07-12T23:59:00+02:00`;
- nowe lokalizacje sa geokodowane przez Nominatim i dostaja `latitude`, `longitude` oraz link Google Maps, jesli geocoder znajdzie wynik;
- przy duplikacie importer nie nadpisuje eventu, ale domyslnie moze uzupelnic wspolrzedne istniejacej lokalizacji, jesli ich brakuje;
- po dodaniu `--rewrite-ai` importer przeredagowuje `short_description` i `description` przez OpenRouter, Gemini albo OpenAI przed zapisem;
- po dodaniu `--rewrite-ai-existing` importer moze zaktualizowac opisy juz istniejacego duplikatu;
- zrodlo trafia do `event_sources` z `external_id`, zeby wykrywac duplikaty;
- oryginalny opis ze zrodla zostaje w `event_sources.raw_description`;
- opis jest czyszczony z prostych encji HTML typu `&nbsp;` przed zapisaniem lub wyslaniem do AI.

Przydatne opcje:

```powershell
node importers/ebilet/import-ebilet.mjs --index 10
node importers/ebilet/import-ebilet.mjs --limit 1 --status published --apply
node importers/ebilet/import-ebilet.mjs --limit 1 --organizer-id 51206165-f555-4cc0-9f96-ba26e36f02b4
node importers/ebilet/import-ebilet.mjs --file scraping/ebilet_muzyka_v3.json --offset 20 --limit 5
node importers/ebilet/import-ebilet.mjs --limit 10 --no-geocode --apply
node importers/ebilet/import-ebilet.mjs --limit 1 --rewrite-ai --ai-provider openrouter --apply
node importers/ebilet/import-ebilet.mjs --limit 5 --resume --rewrite-ai --ai-provider gemini --ai-retries 5 --apply
```

Checkpoint:

Przy zapisie (`--apply`) importer zapisuje lokalny punkt wznowienia w `importers/ebilet/.import-state.json`. Plik zawiera m.in. `next_offset`, czyli indeks nastepnego rekordu do przetworzenia. Ten plik jest ignorowany przez git.

Import pierwszych 10 rekordow:

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="..."
$env:EVENTMAP_IMPORT_WRITE="1"
node importers/ebilet/import-ebilet.mjs --limit 10 --apply
```

Wznowienie od kolejnego rekordu:

```powershell
$env:EVENTMAP_IMPORT_WRITE="1"
node importers/ebilet/import-ebilet.mjs --limit 10 --resume --apply
```

Importer nie nadpisuje juz zapisanych wydarzen. Przed insertem sprawdza `event_sources.external_id`; jesli takie zrodlo juz istnieje, rekord jest pomijany jako duplikat i checkpoint przesuwa sie dalej.

Geokodowanie:

Geokodowanie jest wlaczone domyslnie tylko podczas zapisu (`--apply`). Importer pyta Nominatim maksymalnie raz na ok. 1.1 s, zeby nie robic zbyt agresywnego importu. Jesli chcesz sprobowac uzupelnic wspolrzedne dla juz zaimportowanego rekordu, mozesz ponownie odpalic ten sam indeks. Event zostanie pominiety jako duplikat, ale lokalizacja bez wspolrzednych zostanie uzupelniona, jesli geocoder znajdzie wynik.

```powershell
$env:EVENTMAP_IMPORT_WRITE="1"
node importers/ebilet/import-ebilet.mjs --index 0 --apply
```

Geokodowanie mozna wylaczyc:

```powershell
node importers/ebilet/import-ebilet.mjs --limit 10 --no-geocode --apply
```

AI rewrite:

Przeredagowanie opisow jest domyslnie wylaczone, bo wymaga klucza AI i generuje koszt API. Po wlaczeniu `--rewrite-ai` importer wysyla do modelu fakty wydarzenia oraz oryginalny opis i oczekuje struktury JSON z polami `short_description` oraz `description`.

Provider `auto` wybiera OpenRouter, jesli znajdzie `EVENTMAP_OPENROUTER_API_KEY` albo `OPENROUTER_API_KEY`; potem Gemini, a na koncu OpenAI.
Przy chwilowym przeciazeniu albo limicie Gemini importer ponawia zapytanie z narastajacym opoznieniem i respektuje komunikat `Please retry in ...s`. Domyslnie robi 3 proby; mozna to zwiekszyc przez `--ai-retries`.

Przy limitach free tier bezpieczniej importowac mniejsze paczki albo dac wiekszy odstęp:

```powershell
node importers/ebilet/import-ebilet.mjs --limit 3 --resume --rewrite-ai --ai-provider gemini --ai-delay-ms 6000 --ai-retries 5 --apply
```

```powershell
$env:OPENROUTER_API_KEY="..."
$env:EVENTMAP_IMPORT_WRITE="1"
node importers/ebilet/import-ebilet.mjs --limit 1 --resume --rewrite-ai --ai-provider openrouter --apply
```

Jesli rekord jest juz w bazie i chcesz przeredagowac jego istniejace opisy bez tworzenia drugiego eventu:

```powershell
$env:OPENROUTER_API_KEY="..."
$env:EVENTMAP_IMPORT_WRITE="1"
node importers/ebilet/import-ebilet.mjs --index 0 --rewrite-ai --rewrite-ai-existing --ai-provider openrouter --apply
```

To narzedzie pomaga ograniczyc kopiowanie tresci zrodlowych, ale nie jest formalna gwarancja prawna. Przed masowa publikacja warto przejrzec probke opisow w panelu admina.
