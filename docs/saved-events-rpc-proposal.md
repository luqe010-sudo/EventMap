# Własne zapisane wydarzenia — propozycja naprawy

Status: **zatwierdzono i wdrożono 2026-10-05** po poleceniu właściciela „Wdrażaj też swoje SQL”. Historyczna nazwa pliku pozostaje dla istniejących linków. Aplikacja korzysta z RPC; `database.types.ts` wygenerowano ponownie z projektu EventMap.

Wykonano ponowny odczyt schematu/grantów/triggerów. Funkcje utworzono w jednej transakcji z [testami](saved-events-rpc-transaction-tests.sql). Syntetyczne rekordy użytkowników, profili, organizatora i wydarzeń utworzono po savepoincie i wycofano przed COMMIT. Są niewidoczne poza transakcją; nie wykonywano rejestracji przez Auth ani wysyłki e-mail. Przy błędzie asercji cały pakiet, włącznie z funkcjami, nie zostałby zatwierdzony.

Przeszły próby anon, braku JWT, user A/B, organizatora, admina, zapisu/usunięcia/idempotencji, niepublicznych i anulowanych wydarzeń oraz usunięcia po archiwizacji. Zachowany odczyt agregatu organizatora potwierdzono na dwóch zapisach fixture. Sprawdzono brak rekordów fixture po rollbacku. Powtórny odczyt katalogów potwierdził owner postgres, search_path, EXECUTE tylko authenticated oraz identyczne dotychczasowe RLS i granty kolumn. Dowody znajdują się lokalnie w `scratch/security-audit/saved-rpc-*.json`; nie publikować surowych kopii audytu.

Odczyt grantów i RLS 2026-10-05 potwierdził brak SELECT na `saved_events.user_id`, używanym przez obecne filtry odczytu i usuwania. Równocześnie organizator ma SELECT zapisów jego wydarzeń przez inne osoby. Dodanie SELECT na `user_id` ujawniłoby ich identyfikatory; usunięcie filtra mieszałoby cudze i własne zapisy.

## Konkretny zakres SQL

[saved-events-rpc-proposal.sql](saved-events-rpc-proposal.sql) dodaje dwie funkcje, bez nowych tabel i zmian kolumn:

- `get_my_saved_events(p_event_id)` zwraca wyłącznie identyfikatory wydarzeń i daty zapisu bieżącego `auth.uid()`. Parametr jest opcjonalnym filtrem wydarzenia, nie identyfikatorem użytkownika.
- `set_my_saved_event(p_event_id, p_saved)` idempotentnie zapisuje albo usuwa własny zapis. Zapis wymaga publicznego, opublikowanego, nieanulowanego wydarzenia. Usunięcie własnego zapisu działa również po wycofaniu wydarzenia.

Funkcje używają SECURITY DEFINER wyłącznie do obejścia ograniczeń grantów w tej wąskiej operacji. Mają ustalony `search_path`, pełne nazwy tabel, brak dynamicznego SQL i brak możliwości podania innego użytkownika. EXECUTE otrzymuje tylko `authenticated`; `anon` i PUBLIC nie mogą wywoływać funkcji. Organizator nie otrzymuje szerszego odczytu tabeli. Istniejące agregaty panelu nie zmieniają zachowania. `CREATE FUNCTION` celowo zatrzyma transakcję, gdy taka sygnatura już istnieje, zamiast ją nadpisać.

## Pierwotna kolejność wdrożenia

1. Ponownie potwierdzić schemat, granty, funkcje i RLS na właściwym projekcie. Sprawdzić typ `created_at` i klucz `(user_id, event_id)`.
2. Zastosować SQL na staging. Przejść próby poniżej.
3. Wygenerować `database.types.ts` po zmianie funkcji. Zmienić trzy odczyty w `lib/user-account.ts` na pierwsze RPC, a zapis/usuwanie w `lib/user-account-actions.ts` na drugie. Zapewnić komunikat i odświeżenie stanu po błędzie, bez pokazywania użytkownikowi instrukcji RLS.
4. Testować także dwie sesje organizatorów i istniejące liczniki zapisów. Dopiero po odbiorze przedstawić zatwierdzony pakiet produkcyjny.

## Wymagane próby

- Anon: brak EXECUTE obu RPC.
- Użytkownicy A/B: każdy widzi wyłącznie własne zapisy, także gdy obaj zapisali to samo wydarzenie.
- Organizator A: odczyt własnych zapisów nie zawiera zapisów osób zainteresowanych jego wydarzeniami; jego obecny licznik nadal działa.
- Administrator: RPC również zwraca własne zapisy, nie wszystkie.
- Zapis draft/pending/private/cancelled: odrzucony. Zapis publicznego wydarzenia: dozwolony, ponowienie bez duplikatu.
- Usunięcie: usuwa tylko rekord wywołującego, ponowienie bez błędu, brak usuwania cudzych zapisów.
- Równoległe żądania oraz wycofanie wydarzenia: spójny stan, czytelna obsługa błędu.

Próby ról i danych wykonano w wycofywanej transakcji SQL na właściwym projekcie, za zgodą właściciela. Sprawdzono także obie funkcje przez publiczne API bez sesji: HTTP 401 / SQLSTATE 42501, potwierdzając odświeżenie schematu i brak dostępu anon. Pełne sesje Auth przez HTTP, odbiór w zalogowanej przeglądarce i równoległe zapisy z dwóch sesji nadal wymagają testów. Staging nie utworzono. Reguła [AGENTS.md](../AGENTS.md) została spełniona przez wcześniejszą osobną propozycję i późniejszą wyraźną zgodę.
