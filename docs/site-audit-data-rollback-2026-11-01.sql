-- Cofnięcie zmian danych audytu z 2026-11-01. Wykonać tylko po decyzji właściciela.
-- Stan sprzed zmian: site-audit-data-backup-2026-11-01.json.
BEGIN;
UPDATE public.events SET status='published', review_note=NULLIF(replace(review_note,'Audyt B1: data zastępcza, wymaga weryfikacji źródła.',''),'')
WHERE status='pending_review' AND review_note LIKE '%Audyt B1:%';
UPDATE public.organizers SET is_verified=true WHERE id IN ('51206165-f555-4cc0-9f96-ba26e36f02b4','64b296f0-6b06-4ec0-b5a8-b68f3075436e');
UPDATE public.events SET status='published', review_note=NULLIF(replace(review_note,'Audyt W5: duplikat.',''),'')
WHERE id IN ('a8035224-7aab-4f67-a381-3dcab8828386','5e0288ec-268f-483e-b930-cd20e82fd495','f75264e1-42a9-497a-a980-05538ff19295','229d1bb5-6913-4588-afaa-9533245a88d9');
COMMIT;
