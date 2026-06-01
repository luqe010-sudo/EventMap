# Business Rules

## Publiczna widoczność wydarzeń

Publiczne listy i szczegóły wydarzeń używają `lib/events.ts`.

Wydarzenie jest widoczne publicznie tylko, gdy:

- `events.status = "published"`;
- `events.visibility = "public"`;
- `events.is_cancelled` jest `null` albo `false`.

Lista publiczna jest sortowana po `events.start_at ASC`.

## Daty

`lib/filters.ts` definiuje filtry:

- `today` - od początku bieżącego dnia do następnego dnia;
- `tomorrow` - następny dzień;
- `weekend` - najbliższa sobota/niedziela, a w sobotę sobota+niedziela, w niedzielę tylko niedziela;
- `week` - kolejne 7 dni;
- `custom` - konkretna data.

`getHomeData()` pobiera z Supabase wydarzenia od początku bieżącego dnia, a dokładniejsze filtry działają już w przeglądarce.

## Lokalizacja i promień

Odległość jest liczona funkcją Haversine w `distanceInKm()`.

Jeśli wydarzenie nie ma `latitude` lub `longitude`, funkcja zwraca `Infinity`. Aktualnie `filterEvents()` traktuje brak dystansu jako dopasowanie do promienia, ale sortuje takie wydarzenia na końcu.

Strony miast:

- korzystają z `city_pages`;
- biorą wydarzenia od początku dnia;
- pokazują wydarzenia z tym samym slugiem miasta albo w promieniu 50 km od współrzędnych miasta.

## Kategorie

Kategorie są pobierane z tabeli `categories` przez `listCategories()`.

Jeśli tabela kategorii jest pusta na stronie głównej, `getHomeData()` zwraca fallback z listy w `lib/events.ts`:

- Koncert
- Festyn
- Dozynki
- Sport
- Rodzina
- Targi
- Motoryzacja
- Kultura
- Inne

Fallback pomaga wyświetlić UI, ale formularze admina/organizatora potrzebują realnych rekordów `categories`, aby zapisywać `category_id`.

## Ceny

`isFreeEvent()` traktuje wydarzenie jako darmowe, gdy:

- `price_type` po obniżeniu liter to `free`;
- `price_type` to `bezplatne`;
- sformatowana cena zawiera tekst `bezplat`.

`formatPrice()` w `lib/events.ts` obsługuje:

- `free` albo `bezplatne`;
- `unknown`;
- zakres `price_min-price_max currency`;
- minimum;
- maksimum;
- fallback do `price_type` albo `Cena nieznana`.

## Admin

Admin:

- ma dostęp do `/admin`;
- widzi dashboard z licznikami `pending_review`, `published`, `rejected`;
- widzi ostatnio dodane wydarzenia;
- widzi listę do 250 wydarzeń w `/admin/events`;
- może tworzyć wydarzenie;
- może edytować dowolne wydarzenie;
- może ustawić status `draft`, `pending_review`, `published`, `rejected`, `archived`;
- może publikować, odrzucać, archiwizować i usuwać z listy;
- może przypisać wydarzenie do organizatora;
- może tworzyć i edytować organizatorów;
- może przypisać ownera organizatora przez `owner_user_id`.

Przy tworzeniu/edycji admina:

- status pochodzi z formularza, domyślnie `published`;
- `visibility` jest ustawiane na `public`;
- `submitted_by_organizer_id` jest ustawiane na wybranego organizatora;
- `published_at` jest ustawiane przy statusie `published`, w innym przypadku `null`;
- jeśli nie wybrano istniejącej lokalizacji, formularz może utworzyć nowy rekord `locations`;
- źródło wydarzenia jest tworzone lub aktualizowany jest pierwszy rekord `event_sources`.

## Organizator

Organizator:

- ma dostęp do `/organizer` tylko po zalogowaniu i przy roli `organizer`;
- musi mieć powiązanie w `organizer_users`;
- widzi wydarzenia, których `submitted_by_organizer_id` należy do jego organizatorów;
- może dodać wydarzenie;
- może edytować własne wydarzenie;
- nie może samodzielnie opublikować wydarzenia;
- nie może zmienić wydarzenia na cudzego organizatora.

Przy tworzeniu wydarzenia organizatora:

- `status = "pending_review"`;
- `visibility = "public"`;
- `created_by = auth user id`;
- `organizer_id` i `submitted_by_organizer_id` są wymuszone na dozwolonym organizatorze;
- `source_type` domyślnie to `organizer`.

Przy edycji:

- jeśli wydarzenie było `published`, status wraca na `pending_review`;
- jeśli wydarzenie miało inny status, pozostaje przy dotychczasowym statusie albo `pending_review`.

## Usuwanie wydarzeń

Admin deletion w `adminDeleteEventAction()` usuwa kolejno:

1. `event_sources` dla wydarzenia.
2. `event_tags` dla wydarzenia.
3. `saved_events` dla wydarzenia.
4. Rekord `events`.

Kod nie używa cascade delete w aplikacji, tylko usuwa powiązania jawnie.

## Elementy wymagające potwierdzenia

- Dokładne słowniki wartości `price_type`, `visibility`, `organizers.type`, `organizer_users.role` w bazie.
- Czy brak współrzędnych powinien nadal omijać filtr promienia.
- Czy `events.slug` jest globalnie unikalny na poziomie bazy.
- Czy organizatorzy z rolą `editor` mają mieć inne uprawnienia niż `owner`.
