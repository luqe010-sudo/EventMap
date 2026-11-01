-- PROPOZYCJA DO AKCEPTACJI. NIE WYKONANO. Bez zmian schematu.
-- Właściciel potwierdza kandydatów, polityki RLS i backup.
-- Całość kończy ROLLBACK; COMMIT dopiero w zatwierdzonym wykonaniu.
BEGIN;
-- B1: nie zgadujemy poprawnych dat. Rekordy do ponownej moderacji.
SELECT id, title, start_at, end_at, status FROM public.events
WHERE status = 'published' AND (start_at >= '2100-01-01' OR end_at >= '2100-01-01');
UPDATE public.events SET status = 'pending_review',
  review_note = concat_ws(E'\n', review_note, 'Audyt B1: data zastępcza, wymaga weryfikacji źródła.')
WHERE status = 'published' AND (start_at >= '2100-01-01' OR end_at >= '2100-01-01')
RETURNING id, title;
-- B2: wyłącznie konta wskazane w audycie.
SELECT id, name, is_verified FROM public.organizers
WHERE lower(trim(name)) IN ('moderator', 'testowy bez admina');
UPDATE public.organizers SET is_verified = false
WHERE lower(trim(name)) IN ('moderator', 'testowy bez admina') AND is_verified = true
RETURNING id, name;
-- W5: kandydaci. Ten sam tytuł/data/miejsce nie dowodzą tożsamości.
SELECT lower(trim(e.title)) AS title, e.start_at, e.location_id,
  array_agg(e.id ORDER BY e.created_at, e.id) AS event_ids
FROM public.events e
WHERE e.status = 'published' AND e.visibility = 'public' AND e.is_cancelled IS DISTINCT FROM true
GROUP BY lower(trim(e.title)), e.start_at, e.location_id HAVING count(*) > 1;
-- Po porównaniu źródeł i zatwierdzeniu UUID: zachować rekord kanoniczny,
-- przenieść event_sources/event_tags/saved_events z obsługą konfliktów,
-- sprawdzić relacje spoza database.types.ts, zarchiwizować duplikat.
-- UPDATE public.events SET status = 'archived' WHERE id IN (<zatwierdzone UUID>);
SELECT id, name, slug, latitude, longitude FROM public.cities
WHERE is_active = true AND (latitude IS NULL OR longitude IS NULL);
-- Centra wymagają potwierdzonych współrzędnych i UUID przed aktualizacją.
ROLLBACK;
