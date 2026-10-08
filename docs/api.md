# API

Stan lokalny 2026-10-06. Route handlers aplikacji i Server Actions korzystają z biblioteki lib; nie są kontraktem API dla integracji zewnętrznych. RLS/uprawnienia Supabase wymagają osobnego odbioru.

## Route handlers

| Ścieżka | Działanie |
| --- | --- |
| GET /api/events/search | Publiczne wydarzenia i totalCount; wspólny model miasta/promienia/dat/ceny/kategorii/sortowania. |
| GET /api/events/markers | Markery tej samej pełnej puli; brak współrzędnych nie usuwa karty z listy. |
| GET /api/events/category-counts | Liczniki kategorii dla wyszukiwania. |
| GET /api/events/{id} | Szczegóły opublikowanego, publicznego, nieanulowanego wydarzenia albo 404. |
| POST /api/events/{id}/analytics | Interakcja po deklaracji zgody, same-origin/UUID/dokładny JSON do 1024 B/public-only/limiter. [Kontrakt i ograniczenia](event-analytics.md). |
| GET /api/account/navbar | Menu bieżącej sesji; anonimowy fallback po awarii Auth/profilu. |
| GET /api/account/saved-events | Własne zapisy bieżącej sesji, bez przyjmowania user_id; błąd usługi odrębny od pustej listy. |
| GET /auth/callback | PKCE Google OAuth, dozwolony powrót i ewentualny onboarding. |
| GET /auth/recovery | Recovery PKCE/token_hash, krótki kontekst HttpOnly powiązany z kontem i przekierowanie do resetu. |
| POST /auth/sign-out | Wylogowanie bieżącej sesji i usunięcie kontekstu recovery. |

Parametry wyszukiwania normalizuje lib/public-search-params.ts; zapytania wydarzeń są w lib/events.ts. Publiczne dane mają zawsze status published, visibility public i is_cancelled różne od true. Discovery/detail API, aliasy /wydarzenie i /wydarzenia oraz sitemap nie przechowują odpowiedzi: Cache-Control no-store, max-age=0. Listingi publiczne są dynamiczne; więcej w [architekturze](architecture.md).

## Server Actions i guardy

Auth/rejestrację obsługuje lib/auth-actions.ts, odzyskiwanie lib/auth-password-actions.ts; [przepływy Auth](auth.md). Account actions ustalają użytkownika z sesji. Własne zapisy używają wdrożonych get_my_saved_events i set_my_saved_event z auth.uid(), a nie parametru właściciela.

lib/admin-events.ts sprawdza admina na serwerze. listAdminEvents/listAdminReviewEvents zwracają teraz { events, totalCount, page, pageSize, pageCount }, po 50 rekordów na stronę. SQL obsługuje daty/status/promowane i zwykłe strony; pełna projekcja do 50 000 rekordów obsługuje polski tekst/nazwy relacji przed paginacją. Review jest zawsze draft/pending_review. Awaria/limit to błąd, nie ucięta lista.

lib/organizer-events.ts sprawdza rolę i członkostwo organizer_users, ogranicza events do submitted_by_organizer_id i nie przyjmuje podmiany właściciela. Create zawsze pending_review; edycja published wraca do moderacji; rejected ma oddzielny resubmit. getOrganizerStats zwraca rows oraz niezależne analyticsStatus/savesStatus, a miary mogą być null. Bieżące zapisania i historyczne kliknięcia nie są sumowane. [Statystyki](event-analytics.md).

Edytory używają useActionState i walidacji w lib/event-editor-validation.ts. Po częściowym/niepotwierdzonym events/source/moderation zachowują formularz i pokazują sposób sprawdzenia wyniku. Akcje nie są jeszcze transakcyjne ani trwale idempotentne: [propozycja A04](event-write-transaction-proposal.md). Nowe writer RPC/tabela/kolumna nie zostały wdrożone.

Panele locations/categories/organizers/city-pages korzystają z właściwych lib/admin-*. Nie ma potwierdzonego API webhooków, zewnętrznych integracji, scrapingu/AI ani powiadomień użytkownika. Tabele same nie oznaczają gotowej funkcji.
