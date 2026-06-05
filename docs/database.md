# Database

Źródłem prawdy dla struktury bazy w repozytorium jest wygenerowany plik `database.types.ts`. Typy wskazują na PostgreSQL/Supabase z PostGIS, bo w schemacie są m.in. `locations.geom`, widoki/funkcje geograficzne oraz tabela `spatial_ref_sys`.

## Tabele aplikacyjne

### `events`

Główna tabela wydarzeń.

Pola w typach:

- `id`
- `title`
- `slug`
- `description`
- `short_description`
- `start_at`
- `end_at`
- `is_all_day`
- `main_image_url`
- `price_type`
- `price_min`
- `price_max`
- `currency`
- `status`
- `visibility`
- `is_featured`
- `is_verified`
- `is_cancelled`
- `category_id`
- `location_id`
- `organizer_id`
- `created_by`
- `submitted_by_organizer_id`
- `published_at`
- `review_note`
- `timezone`
- `confidence_score`
- `source_quality_score`
- `created_at`
- `updated_at`

Relacje:

- `events.category_id -> categories.id`
- `events.location_id -> locations.id`
- `events.organizer_id -> organizers.id`
- `events.submitted_by_organizer_id -> organizers.id`

### `categories`

Kategorie wydarzeń.

Pola:

- `id`
- `name`
- `slug`
- `icon`
- `color`
- `parent_id`
- `sort_order`
- `created_at`

Relacja:

- `categories.parent_id -> categories.id`

### `locations`

Miejsca wydarzeń i dane geograficzne.

Pola:

- `id`
- `name`
- `address`
- `city`
- `municipality`
- `county`
- `voivodeship`
- `latitude`
- `longitude`
- `google_maps_url`
- `place_id`
- `postal_code`
- `geom`
- `created_at`
- `updated_at`

Relacja:

- `locations.city_id -> cities.id`

Kod aplikacji filtruje odległość w JavaScripcie na podstawie `latitude` i `longitude`; nie używa obecnie RPC/PostGIS do zapytań promienia.

### `cities`

Kanoniczny slownik miast uzywany przez lokalizacje, strony SEO i slugi URL.

Pola:

- `id`
- `name`
- `slug`
- `county`
- `voivodeship`
- `latitude`
- `longitude`
- `is_active`
- `created_at`
- `updated_at`
### `organizers`

Organizator wydarzenia.

Pola:

- `id`
- `name`
- `slug`
- `type`
- `description`
- `website`
- `facebook_url`
- `instagram_url`
- `phone`
- `email`
- `logo_url`
- `is_verified`
- `created_at`
- `updated_at`

### `event_sources`

Źródła wydarzeń, także dane surowe po scrapingu.

Pola:

- `id`
- `event_id`
- `source_type`
- `source_name`
- `source_url`
- `external_id`
- `raw_title`
- `raw_description`
- `raw_date`
- `raw_location`
- `raw_image_url`
- `confidence_score`
- `scraped_at`
- `last_seen_at`
- `is_active`
- `created_at`

Relacja:

- `event_sources.event_id -> events.id`

### `event_moderation_logs`

Historia decyzji moderacyjnych admina dla wydarzen.

Pola:

- `id`
- `event_id`
- `reviewed_by`
- `old_status`
- `new_status`
- `note`
- `created_at`

Relacja:

- `event_moderation_logs.event_id -> events.id`
- `event_moderation_logs.reviewed_by -> auth.users.id` (potwierdzone w eksporcie SQL; niewidoczne w typach `public`)

### `event_analytics`

Surowe zdarzenia analityczne dla publicznych interakcji z wydarzeniem.

Pola:

- `id`
- `event_id`
- `event_type`
- `user_id`
- `session_id`
- `created_at`

Obslugiwane typy `event_type`:

- `view`
- `phone_click`
- `website_click`
- `ticket_click`
- `map_click`
- `share_click`
- `save_click`

Relacja:

- `event_analytics.event_id -> events.id`
- `event_analytics.user_id -> auth.users.id` (potwierdzone w eksporcie SQL; niewidoczne w typach `public`)

### `tags` i `event_tags`

Tagi wydarzeń.

`tags`:

- `id`
- `name`
- `slug`
- `created_at`

`event_tags`:

- `event_id`
- `tag_id`

Relacje:

- `event_tags.event_id -> events.id`
- `event_tags.tag_id -> tags.id`

### `profiles`

Profil użytkownika połączony logicznie z Supabase Auth.

Pola:

- `id`
- `role`
- `display_name`
- `created_at`

Eksport SQL potwierdza FK `profiles.id -> auth.users.id`. W `database.types.ts` relacja nie jest widoczna, bo typy sa generowane dla schematu `public`.

### `organizer_users`

Powiązanie kont użytkowników z organizatorami.

Pola:

- `id`
- `organizer_id`
- `user_id`
- `role`
- `created_at`

Relacja:

- `organizer_users.organizer_id -> organizers.id`
- `organizer_users.user_id -> auth.users.id` (potwierdzone w eksporcie SQL; niewidoczne w typach `public`)

### `city_pages`

Strony SEO dla miast.

Pola:

- `id`
- `city_id`
- `meta_title`
- `meta_description`
- `intro_text`
- `created_at`
- `updated_at`

Relacja:

- `city_pages.city_id -> cities.id`

### `scraping_sources`

Źródła do scrapingu.

Pola:

- `id`
- `name`
- `url`
- `source_type`
- `city`
- `county`
- `voivodeship`
- `scraping_enabled`
- `scraping_frequency`
- `last_scraped_at`
- `last_success_at`
- `last_error`
- `quality_score`
- `created_at`
- `updated_at`

W kodzie aplikacji nie ma jeszcze implementacji scrapera.

### `raw_scraped_items`

Surowe rekordy ze scrapingu.

Pola:

- `id`
- `scraping_source_id`
- `source_url`
- `raw_html`
- `raw_text`
- `raw_json`
- `content_hash`
- `detected_at`
- `processed_at`
- `processing_status`
- `error_message`

Relacja:

- `raw_scraped_items.scraping_source_id -> scraping_sources.id`

### `saved_events`

Zapisane wydarzenia użytkownika.

Pola:

- `event_id`
- `user_id`
- `created_at`

Relacja:

- `saved_events.event_id -> events.id`

W UI nie ma jeszcze funkcji zapisywania wydarzeń.

### `notification_preferences`

Preferencje powiadomień użytkownika.

Pola:

- `id`
- `user_id`
- `city`
- `latitude`
- `longitude`
- `radius_km`
- `categories`
- `tags`
- `channel`
- `frequency`
- `days_ahead`
- `is_active`
- `created_at`
- `updated_at`

W UI nie ma jeszcze obsługi preferencji powiadomień.

### `notifications`

Powiadomienia panelowe dla uzytkownikow, w tym komunikaty o statusach wydarzen organizatora.

Pola:

- `id`
- `user_id`
- `title`
- `message`
- `type`
- `is_read`
- `related_event_id`
- `created_at`

Relacja:

- `notifications.related_event_id -> events.id`
- `notifications.user_id -> auth.users.id` (potwierdzone w eksporcie SQL; niewidoczne w typach `public`)

## Tabele lub elementy wspomniane w wymaganiach, ale niepotwierdzone w typach

- `ai_extractions` - nie występuje w aktualnym `database.types.ts` i nie jest używane w kodzie. Wymaga potwierdzenia.

## Statusy i role

Kod definiuje statusy wydarzeń w `lib/event-editor.ts`:

- `draft`
- `pending_review`
- `published`
- `rejected`
- `archived`

Role użytkowników są odczytywane z `profiles.role`:

- `admin`
- `organizer`
- `user`

Role w `organizer_users.role` używane przez formularz organizatora:

- `owner`
- inne role, np. `editor`, wymagają potwierdzenia w danych/politykach.

## RLS i polityki

Repozytorium zawiera migracje SQL w `supabase/migrations`, w tym migracje dla `cities`, lokalizacji admina i fundamentu panelu organizatora. Kod nadal zaklada, ze aktualny stan polityk RLS w Supabase jest zgodny z repozytorium albo zostal potwierdzony po stronie projektu.

Kod zakłada, że polityki w Supabase pozwalają na:

- publiczny odczyt opublikowanych wydarzeń i powiązanych danych;
- odczyt `profiles` własnego użytkownika;
- odczyt i zapis panelu admina dla roli `admin`;
- odczyt i zapis wydarzeń organizatora tylko dla powiązanych `organizer_users`;
- zapis `locations` i `event_sources` w akcjach admina/organizatora.
- zapis publicznych zdarzen analitycznych do `event_analytics`;
- odczyt `event_analytics`, `event_moderation_logs` i `notifications` przez admina lub uprawnionego organizatora/uzytkownika.

Faktyczny stan RLS w Supabase wymaga potwierdzenia.
