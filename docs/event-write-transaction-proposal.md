# A04 — propozycja transakcyjnego zapisu wydarzeń

Status: **projekt do przeglądu, 2026-10-06; bez wykonania SQL, utworzenia tabel ani zmiany bazy**. Ten dokument nie zamyka A04. Obsługa częściowego lub nieznanego wyniku w aplikacji ogranicza ryzyko ponowienia, ale nie zastępuje poniższej transakcji i trwałego potwierdzenia operacji.

## Podstawa projektu

Przejrzano `database.types.ts`, `lib/admin-events.ts`, `lib/organizer-events.ts`, `lib/event-editor-server.ts`, `lib/event-editor-validation.ts`, `lib/event-editor.ts`, `lib/cities.ts`, `lib/cloudinary.ts` i `lib/auth.ts`. Aktualne polityki, granty, constrainty i triggery potwierdzono odczytem katalogowym **2026-10-06**: `scratch/security-audit/schema-2026-10-06-readonly.json`. Następny odczyt 15:55 CEST połączył ten audyt z [uzupełniającym SELECT](event-write-staging-readonly.sql) o role/owners/schema/default ACL/rozszerzenia; wynik `scratch/security-audit/staging-preflight-2026-10-06-readonly.json`. [Zakres odbioru](staging-proposal.md). Kopia `schema-2026-10-05.json` jest historyczna; nie stanowi dowodu aktualnych uprawnień. Odczyt administracyjny katalogu nie zastępuje prób zwykłych sesji Auth/RLS.

W aktualnym schemacie istnieją `events`, `event_sources`, `event_moderation_logs`, `notifications`, `organizer_users`, `profiles`, `locations` i `cities`. Nie ma tabeli potwierdzeń zapisu, kolumny wersji agregatu ani RPC dla pełnego zapisu edytora. `events.updated_at` jest nullable, ma domyślną wartość `now()` i nie ma triggera aktualizującego ją po każdej edycji. Nie nadaje się obecnie na wiarygodny token współbieżności.

Kod przygotowania najpierw uploaduje obraz, następnie może utworzyć miasto i lokalizację. Wydarzenie, źródło, log decyzji i powiadomienia są zapisywane oddzielnie. Kopiowanie wydarzenia ma osobny zapis źródła. Ukrywanie, anulowanie i usuwanie także piszą bezpośrednio do bazy. Źródło jest pomijane przy obu pustych polach albo aktualizowany jest pierwszy rekord; ósmy pakiet ujednolica jego odczyt i zapis według `created_at, id`.

Aktualne RLS sprawdza członkostwo przy zapisie organizatora, lecz UPDATE nie chroni wszystkich pól administracyjnych ani niezmienności zgłaszającego pomiędzy dwiema organizacjami tej samej osoby. `locations authenticated insert` nadal ma `WITH CHECK true`. Tabele zapisu mają szerokie granty anon/authenticated, a `events` dodatkowo granty INSERT/UPDATE na kolumnach. Sama nowa funkcja, bez zamknięcia alternatywnych ścieżek zapisu, nie uszczelnia tych zasad.

## Zakres osobnego zatwierdzenia

Zgodnie z [AGENTS.md](../AGENTS.md) obowiązuje: „Nie twórz nowych tabel bez pytania użytkownika” oraz „Jeśli potrzebna jest migracja SQL, zaproponuj ją osobno i nie wykonuj automatycznie”. Kontynuacja napraw pozwala przygotować ten projekt; nie jest zgodą na nową tabelę.

Do osobnego zatwierdzenia trzeba przedstawić konkretny pakiet SQL obejmujący:

1. Prywatną tabelę `private.event_write_receipts`, ewentualne utworzenie prywatnego schematu, rolę właściciela funkcji i jej uprawnienia.
2. Dodanie `events.write_version bigint NOT NULL DEFAULT 1` z ograniczeniem dodatniej wartości. Jest to nowa kolumna, bez zmiany nazwy istniejących kolumn. Regeneracja `database.types.ts` następuje dopiero po zatwierdzonej zmianie schematu.
3. RPC zapisu i odczytu potwierdzenia, ograniczenie EXECUTE oraz przegląd polityk/grantów umożliwiających obejście RPC. Brak nieuzgodnionych zmian pozostałych polityk.
4. Oddzielne rozwiązanie administracyjnej edycji miast/lokalizacji i oznaczania powiadomień jako przeczytane, jeśli odebranie szerokich grantów dotknie tych istniejących funkcji.

Nie powstaje tu plik migracji modyfikującej schemat. Nowy plik SQL jest wyłącznie odczytem katalogu; przygotowanie pełnej migracji wymaga kontraktu uploadu, inventory/przełączenia wszystkich writerów i przeglądu uzyskanego baseline. Przed przyszłym wdrożeniem ponowić odczyt katalogu i porównać go z tą podstawą.

## Kontrakt RPC

Proponowane wejście: `public.write_event_v1(p_operation_id uuid, p_request jsonb)`. Wyjście to jeden obiekt JSON z obowiązkowym `contract_version: 1`. Pole `operation` przyjmuje wyłącznie `create`, `edit`, `resubmit`, `duplicate`, `moderate`, `hide`, `cancel`, `delete`. Każdy wariant ma zamknięty zestaw kluczy; nieznany klucz, zły typ lub niepasujący wariant daje błąd przed mutacją. Nie przyjmować ogólnego obiektu `events.Update` ani dynamicznych nazw tabel/kolumn.

Przykładowe żądanie edycji organizatora (UUID są syntetyczne):

```json
{
  "p_operation_id": "11111111-1111-4111-8111-111111111111",
  "p_request": {
    "contract_version": 1,
    "operation": "edit",
    "event_id": "22222222-2222-4222-8222-222222222222",
    "expected_version": 7,
    "event": {
      "title": "Koncert w parku",
      "slug": "koncert-w-parku",
      "description": "Opis koncertu",
      "short_description": null,
      "start_at": "2026-10-17T16:00:00Z",
      "end_at": "2026-10-17T18:00:00Z",
      "is_all_day": false,
      "category_id": "33333333-3333-4333-8333-333333333333",
      "price_type": "free",
      "price_min": null,
      "price_max": null,
      "currency": "PLN"
    },
    "location": {
      "mode": "existing",
      "location_id": "44444444-4444-4444-8444-444444444444"
    },
    "image": { "mode": "keep" },
    "source": {
      "mode": "upsert_first",
      "source_name": "Organizator",
      "source_url": "https://example.org/koncert"
    }
  }
}
```

Przykładowy wynik po zatwierdzeniu transakcji:

```json
{
  "contract_version": 1,
  "outcome": "committed",
  "operation_id": "11111111-1111-4111-8111-111111111111",
  "event_id": "22222222-2222-4222-8222-222222222222",
  "write_version": 8,
  "status": "pending_review",
  "source_id": "55555555-5555-4555-8555-555555555555",
  "moderation_log_id": null,
  "notification_count": 0,
  "committed_at": "2026-10-06T12:00:00Z",
  "replayed": false,
  "invalidate": {
    "old_slug": "koncert-w-parku",
    "new_slug": "koncert-w-parku",
    "old_city_slug": "warszawa",
    "new_city_slug": "warszawa"
  }
}
```

RPC przechowuje wynik z `replayed: false`; autoryzowane ponowienie zwraca te same identyfikatory, wersję i czas, ustawiając tylko `replayed: true`. To potwierdzenie historycznej operacji, nie snapshot bieżącego wydarzenia: po późniejszej edycji lub moderacji klient ponownie pobiera aktualny rekord. Nie zwraca identyfikatorów odbiorców, tekstu prywatnych powiadomień ani całego formularza. Dane `invalidate` służą kodowi serwera do rewalidacji szczegółów oraz poprzedniego i nowego miasta; nie są adresem przekierowania dostarczonym przez klienta.

`create` wymaga wybranego `organizer_id`, bez `event_id` i `expected_version`. `edit`, `resubmit`, `moderate`, `hide`, `cancel`, `delete` wymagają istniejącego `event_id` oraz dodatniego `expected_version`. `duplicate` wymaga wersji wydarzenia źródłowego; ID, slug kopii i nowy wpis źródła powstają po stronie bazy. Client nie nadaje ID nowego wydarzenia. Dla admina `create/edit` dopuszcza jawne `admin` z zatwierdzoną listą pól; dla organizatora obecność tego obiektu kończy się odmową.

Stałe błędy domenowe: `invalid_request`, `unauthenticated`, `not_found_or_forbidden`, `version_conflict`, `operation_id_reused`, `slug_conflict`. Nie ujawniać różnicy pomiędzy cudzym i nieistniejącym wydarzeniem. Dopiero po autoryzacji `version_conflict` może przekazać aktualną wersję, bez nadpisania danych. Błędy constraintu, deadlocka, timeoutu i infrastruktury nie są sukcesem ani automatycznym nowym zapisem.

## Autoryzacja i reguły pól w bazie

RPC pobiera aktora z `auth.uid()` i aktualną rolę z `public.profiles`; nie z `user_metadata`, parametru `created_by` ani z decyzji UI. Wymaga uwierzytelnionej sesji, roli `admin` lub `organizer`; sesja bez profilu nie pisze. Serwerowe guardy Next.js pozostają dodatkową kontrolą, ale funkcja ma być bezpieczna także przy bezpośrednim HTTP/RPC.

Organizator musi mieć bieżący rekord `organizer_users` dla **aktualnego** `events.submitted_by_organizer_id`. Przy create wybiera wyłącznie organizację, której jest członkiem. `submitted_by_organizer_id` i `created_by` wyznacza baza przy tworzeniu i zachowuje przy edycji, także gdy aktor jest członkiem dwóch organizacji. `organizer_id` organizator zachowuje z istniejącego wydarzenia; admin może zmienić organizatora prezentowanego w UI, zachowując historycznego zgłaszającego. Przeniesienie zgłaszającego, jeśli kiedykolwiek potrzebne, wymaga osobnej administracyjnej operacji z audytem.

Allowlista treści organizatora: `title`, `slug`, `description`, `short_description`, `start_at`, `end_at`, `is_all_day`, `category_id`, ceny/waluta oraz kontrolowane warianty `location`, `image`, `source`. W tym kontrakcie strefa jest `Europe/Warsaw`; wejściowe momenty czasu są jawnie UTC. Baza sprawdza wymagane wartości, długości zgodne z walidacją formularza, poprawny URL http(s) bez danych logowania, skończone ceny/współrzędne, zakresy oraz relację początku i końca. `category_id` musi wskazywać istniejącą kategorię. Puste opcjonalne wartości i ich normalizacja mają jednoznaczną semantykę. Istniejąca wartość `price_type='unknown'` jest prawidłowym stanem odczytu, a nie powodem przypadkowego odrzucania importowanych wydarzeń przy operacji samego statusu.

Organizator nie dostarcza `status`, `visibility`, `is_cancelled`, `is_featured`, `is_verified`, `published_at`, `review_note`, `confidence_score`, `source_quality_score`, pól autora, zgłaszającego, wersji zapisywanej ani znaczników czasu. Podanie ich w edycji jest błędem; nie ignorować cicho prób ustawienia administracyjnych pól. Admin ma osobny, jawny zestaw `status`, `review_note`, `is_featured`, `is_verified`, `visibility`, `is_cancelled`, `organizer_id`; historyczne ID/autorstwo i pierwsza data publikacji pozostają sterowane przez bazę.

Reguły organizatora odtwarzają aktualny przepływ:

| Operacja | Wynik wyznaczany w bazie |
| --- | --- |
| Create / duplicate | `pending_review`, `public`, `is_cancelled=false`, `published_at=null`, własny zgłaszający i bieżący autor. Kopia nie dziedziczy wyróżnienia/weryfikacji ani decyzji admina. |
| Edit published | `pending_review`; zachowane visibility, zgłaszający i pierwsze `published_at`. |
| Edit pozostałych statusów | Zachowany aktualny status; rejected pozostaje rejected bez jawnego resubmit, archived pozostaje archived. Nieznany/null historyczny status wymaga bezpiecznego, jawnego rozstrzygnięcia przez admina przed edycją. |
| Resubmit | Wyłącznie aktualne `rejected` i `is_cancelled IS NOT TRUE`; wynik `pending_review`. Podanie intent dla archived/cancelled nie wystarczy. |
| Hide | Wyłącznie `visibility='private'`; bez przywrócenia publikacji lub zmiany zgłaszającego. |
| Cancel | `is_cancelled=true`, `status='archived'`; nie usuwa pierwszej daty publikacji. |
| Moderate / delete | Niedostępne organizatorowi. |

Admin wybiera tylko `draft`, `pending_review`, `published`, `rejected`, `archived`. Pierwsze ustawienie `published` zapisuje datę z bazy; kolejne edycje, archiwizacja i ponowna publikacja jej nie zerują. Funkcja jawnie przekazuje null podczas tworzenia nieopublikowanego wydarzenia: aktualny default `events.published_at=now()` nie może niejawnie nadać daty publikacji zgłoszeniu. Nie zmieniać istniejących dat historycznych przy wdrożeniu.

## Jedna transakcja i współbieżność

Cały zapis bazy odbywa się wewnątrz jednego wywołania funkcji, bez COMMIT pomiędzy etapami i bez RPC do zewnętrznych usług. Funkcja modyfikująca ma charakter `VOLATILE` i `PARALLEL UNSAFE`. Błąd dowolnego etapu cofa wydarzenie, źródło, utworzone miasto/lokalizację, log, wszystkie powiadomienia i receipt. Nie przechwytywać błędu zapisu, aby zwrócić sukces; ewentualny handler musi wycofać cały blok mutacji. Model jednej transakcji RPC opisuje [PostgREST 14 Transactions](https://docs.postgrest.org/en/v14/references/transactions.html).

Proponowana kolejność, wspólna dla wszystkich wariantów:

1. Sprawdzić strukturę i limity żądania; wyprowadzić znormalizowany obiekt i jego hash w bazie. Uwierzytelnić aktora.
2. Uzyskać **transakcyjną** blokadę advisory klucza `(actor_id, operation_id)`. Hash blokady służy wyłącznie serializacji; kolizja hashy najwyżej opóźnia obcą operację. Ostateczne rozróżnienie zapewnia pełny klucz unikalny receipts.
3. Odczytać istniejący receipt. Przy tym samym hashu ponownie sprawdzić bieżący dostęp przed replay; przy innym odrzucić `operation_id_reused`. Replay jest przed porównaniem `expected_version`, gdyż oryginalny zapis już zwiększył wersję.
4. Dla nowej operacji zablokować docelowe wydarzenie `FOR UPDATE` (źródłowe przy duplicate), odczytać jego najnowszą wersję i metadata. Zablokować rekord profilu aktora i używane członkostwo w trybie blokującym zmianę roli/usunięcie członkostwa do końca transakcji. Ponownie sprawdzić rolę, właściciela i intent na zablokowanych danych.
5. Porównać `expected_version` z `write_version`. Różnica przerywa operację bez skutków ubocznych. Dwie edycje tej samej wersji: dokładnie jedna przechodzi; druga po zwolnieniu blokady otrzymuje konflikt. Blokowanie wiersza i oczekiwanie na konkurencyjnego autora opiera się na [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html).
6. Rozwiązać miasto/lokalizację; zapisać wydarzenie oraz kontrolowane źródło. Przy edit/status/hide/cancel zwiększyć wersję agregatu dokładnie raz. Create/duplicate rozpoczynają od 1. Nie używać wersji przesłanej przez klienta jako wartości do zapisania.
7. Gdy wymagana jest decyzja admina, zapisać log i powiadomienia, następnie immutable receipt z wynikiem. Wygenerowane identyfikatory, czas i snapshot poprzedniego/nowego sluga pochodzą z bazy. Dopiero zatwierdzona transakcja uprawnia serwer do sukcesu, redirectu i invalidacji cache.

Przy rolach/członkostwie utrzymywanych poza tym RPC należy uzgodnić kolejność blokad. Dla wielu wydarzeń/organizacji stosować stałą kolejność UUID. Test deadlocka ma potwierdzić pełny rollback; ograniczony retry techniczny zachowuje **ten sam** operation ID i treść. Blokada profilu/członkostwa ustala punkt autoryzacji: cofnięcie uprawnień zakończone wcześniej daje odmowę; cofnięcie czekające na zapis działa po jego commit. Samo porównanie roli z odczytu przed RPC nie daje tej gwarancji.

`write_version` obejmuje wydarzenie i źródło edytora. Warunkiem wiarygodności jest przeniesienie **wszystkich runtime writerów** tego agregatu na kontrakt, łącznie z szybkim statusem, ukryciem, anulowaniem, kopiowaniem i usunięciem. Import/maintenance musi używać tego samego protokołu blokady i zwiększenia wersji albo osobnego przeglądniętego RPC; uprzywilejowany bezpośredni UPDATE bez zwiększenia wersji narusza założenia. Edycja wspólnej lokalizacji przez admina jest osobną operacją i nie może zostać niejawnie wykonana przez formularz wydarzenia. Jej wersjonowanie i invalidacja wszystkich odwołujących się wydarzeń wymagają oddzielnego kontraktu; wersja wydarzenia nie obiecuje wykrywania zmian całego katalogu miast.

## Trwałe potwierdzenie i retry

Proponowana **nowa, prywatna** tabela `private.event_write_receipts`:

| Pole | Proponowany typ i ograniczenie | Znaczenie |
| --- | --- | --- |
| `actor_id` | uuid, NOT NULL | Wyłącznie `auth.uid()` zweryfikowanego aktora. |
| `operation_id` | uuid, NOT NULL | Klucz utrzymany przez klienta dla jednego zamrożonego żądania. |
| `contract_version` | smallint, NOT NULL, początkowo 1 | Wersja sposobu normalizacji i interpretacji żądania. |
| `operation_kind` | text, NOT NULL, zamknięty CHECK wariantów | Operacja autoryzowana w chwili zapisu. |
| `request_hash` | bytea, NOT NULL, długość 32 | SHA-256 kanonicznego, typowanego requestu wyliczonego w DB; nie hash dostarczony przez klienta. |
| `event_id` | uuid, NOT NULL | Docelowe ID; przy delete pozostaje historyczne ID. |
| `authorization_kind` | text, NOT NULL, `admin` / `organizer` | Reguła wymaganej ponownej autoryzacji. |
| `authorization_organizer_id` | uuid, nullable | Organizacja dla kontroli organizer replay, wyznaczona przez DB. |
| `result` | jsonb, NOT NULL, kontrola obiektu/wersji | Minimalny ustalony wynik operacji i identyfikatory invalidacji. |
| `committed_at` | timestamptz, NOT NULL | Czas utworzenia potwierdzenia w transakcji DB; aplikacja nie ustawia daty. Nie jest to dokładny zegar momentu COMMIT. |

Klucz główny: `(actor_id, operation_id)`. Dodatkowy indeks operacyjny na `committed_at`. Receipt powstaje tylko dla pomyślnie kończącej się mutacji; nie ma zatwierdzanego stanu `pending`. Hash obejmuje wariant, event ID, expected version i wszystkie znaczące pola, także referencję obrazu i jawne keep/upsert. Normalizacja typed JSON w DB zapewnia identyczność niezależną od kolejności kluczy, z jednoznacznym rozróżnieniem missing/null. Nie obejmuje czasu wygenerowanego przez serwer ani nowo nadanego ID.

Celowo brak kaskadowego FK do wydarzenia/organizatora: usunięcie celu nie może usunąć dowodu i pozwolić powtórzyć create/delete. Zachowanie identyfikatora aktora po usunięciu konta wymaga zatwierdzonej retencji; usunięty użytkownik nie może odczytać receipts, a nowo utworzone konto nie dziedziczy ich. Domyślnie zachowywać minimalny receipt i hash bez terminowego automatycznego wygaszenia klucza. Jeśli później zatwierdzony zostanie pruning danych wyniku, pozostawić tombstone klucza/hashu, który odmawia nowej mutacji. Nie obiecywać idempotencji po skasowaniu całego receipt.

Receipt jest niezmienny, niewystawiony jako tabela API i bez SELECT/INSERT/UPDATE/DELETE/TRUNCATE dla anon/authenticated. Nie zapisuje payloadu formularza, treści opisu, pliku, tokenów ani sekretów. Operator maintenance ma ograniczony, audytowany dostęp; frontend widzi tylko bezpieczny wynik RPC.

Proponowany odczyt odzyskiwania: `public.get_event_write_receipt_v1(p_operation_id uuid)`. Zawsze ogranicza klucz do bieżącego `auth.uid()`. Odczyt i replay wymagają ponownie aktualnej roli; admin receipt wymaga nadal admina. Organizer receipt wymaga nadal roli organizer, członkostwa w zapisanej organizacji i zgodności bieżącego zgłaszającego wydarzenia. Po delete można zwrócić minimalne potwierdzenie wyłącznie przy nadal istniejącej autoryzacji zapisanej w receipt. Cofnięcie członkostwa lub democja admina blokuje odczyt/replay nawet wtedy, gdy aktor pamięta klucz operacji. Inny admin lub członek organizacji nie odczyta receipt aktora poprzez sam operation ID.

RPC odzyskiwania może czekać na tę samą blokadę operation ID z ograniczonym timeoutem. Brak receipt oznacza `not_observed`, **nie** dowód, że wcześniejsze żądanie nigdy się nie wykona. Timeout/network error pozostawia wynik niepotwierdzony. Bezpieczne ponowienie używa tego samego ID i identycznego requestu. Gdy pierwsza transakcja commitowała, następuje replay; gdy rollbackowała, druga może wykonać cały zapis; gdy jeszcze trwa, druga czeka. Nowy operation ID dla nieznanego poprzedniego wyniku jest zabroniony przez UX.

Klient tworzy UUID raz przed wysłaniem, przechowuje wersję i dokładny znormalizowany request wraz z referencją obrazu przez nieznany wynik oraz nie resetuje go po timeout. Po świadomej zmianie formularza tworzy nową operację dopiero po rozstrzygnięciu poprzedniej. `version_conflict` prowadzi do zachowania formularza i porównania z nową wersją, bez automatycznego last-write-wins. Klucz jest scoped do aktora: ten sam UUID innego konta nie daje dostępu do cudzego wyniku. To nie jest globalna deduplikacja podobnych wydarzeń.

## Źródło, moderacja, powiadomienia i usuwanie

`source.mode='keep'` zachowuje źródła. Oba puste pola formularza mapują się na keep, zgodnie z obecnym zachowaniem. `upsert_first` wymaga przynajmniej nazwy lub URL i wybiera pierwszy rekord po `created_at ASC NULLS LAST, id ASC` w ramach blokady wydarzenia. Istniejący rekord musi należeć do tego wydarzenia; klient nie przekazuje cudzych `source_id/event_id`. Aktualizowane są tylko `source_name`, `source_url`, kontrolowany `source_type`, `last_seen_at` i `is_active`. Typ ustala baza: organizer dla organizatora, manual dla admina, chyba że przyszły admin wariant dopuści osobną listę typów. Nie zmieniać niejawnie raw/confidence/external pól źródeł z importu. Brak źródła daje INSERT; równoległe operacje nie tworzą dwóch pierwszych rekordów dzięki blokadzie rodzica. Nie dodawać UNIQUE(event_id), bo model dopuszcza wiele źródeł.

Pierwszy wariant zachowuje zakres moderacji aplikacji: admin edit zapisuje jedną decyzję, gdy zmienił status lub dostarczył note; `moderate` zapisuje jedną jawną decyzję. `reviewed_by` wyznacza baza z aktora, `old_status` z zablokowanego wiersza, `new_status` z wyniku. Organizator nie może podać moderatora, notatki decyzji ani statusu; jego receipt dokumentuje zapis bez podszywania się pod decyzję admina. Nie dodawać nieuzgodnionej wysyłki na samo create/edit organizatora.

Lista odbiorców wynika z aktualnego `submitted_by_organizer_id` i `organizer_users`; znormalizowana jako DISTINCT nie-null user ID w jednej operacji DB. Klient nie podaje recipients, title/message/type ani notification ID. Tytuł wiadomości wynika z końcowego tytułu wydarzenia, statusu i zwalidowanej notatki. Zmiana statusu admina tworzy log oraz wszystkie wymagane in-app `notifications` w tej samej transakcji. Zero członków oznacza zero powiadomień; błąd odczytu odbiorców lub INSERT jednego odbiorcy cofa całą operację. Replay nie dopisuje logu ani wiadomości, także jeżeli członkostwo zmieniło się po commit. SMTP, push i webhook nie są częścią tej gwarancji; przyszła wysyłka zewnętrzna wymaga osobnej propozycji outbox, bez nowej tabeli w ciemno.

Dla admin delete obecne FK potwierdzają CASCADE z events do sources, tags, saves, analytics i moderation logs oraz SET NULL w notifications.related_event_id. Usunięcie jednego parent row wewnątrz transakcji daje spójny wynik; receipt zachowuje ID i poprzedni slug/miasto. Nie usuwać obrazów lub współdzielonych locations automatycznie. Ewentualna zmiana retencji historii moderacji przy delete to osobna decyzja produktu; projekt nie zmienia obecnego CASCADE.

## Cloudinary i lokalizacja

PostgreSQL nie cofa uploadu Cloudinary. Atomowość A04 obejmuje dane DB, a obraz wymaga jawnej strategii odzyskiwania. Obecny uploader zwraca tylko `secure_url` i ma losowy rezultat kolejnego uploadu; przed włączeniem retry musi zwracać trwałe `public_id`, wersję i hash pliku oraz używać stabilnej referencji zależnej od aktora, operation ID i hashu. Ustawić jawne `overwrite=false` i zweryfikować zgodność hashu dla istniejącego zasobu; zmiana pliku pod tym samym kluczem jest konfliktem. Parametry public ID i overwrite są opisane w [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference#upload). Szczegóły istniejącego zasobu i mechanizm podpisu sprawdzić w osobnym przeglądzie integracji przed implementacją.

Warianty image: keep (DB zachowuje istniejący URL), external (walidowany URL http(s)), uploaded (stabilny public ID/URL/hash już przygotowanego zasobu). Serwer uwierzytelnia i waliduje całą operację przed uploadem, upload wykonuje przed RPC, a następnie zamraża dokładny request. RPC nie przyjmuje Cloudinary API secret ani nie pobiera pliku. Sam URL nie dowodzi własności zasobu; gwarancja uploaded wymaga weryfikowalnego serwerowego poświadczenia powiązanego z aktorem i operation ID, sprawdzanego przez DB, albo osobnego ograniczonego serwerowego kanału przy zachowaniu DB auth. Bez takiego poświadczenia uploaded ma co najwyżej uprawnienia zwykłego zewnętrznego URL i nie może uprawniać do usuwania zasobu.

Timeout uploadu rozstrzyga się przez kontrolowany odczyt tego samego public ID; nie tworzyć kolejnego losowego obrazu. Po nieznanym wyniku RPC **nie usuwać** uploadu, który mogła właśnie powiązać zatwierdzona transakcja. Po potwierdzonym rollback można oznaczyć osierocony zasób do późniejszej kontroli, a usunięcie przeprowadzić dopiero po weryfikacji receipts i braku odwołań z wydarzeń. Nie usuwać dotychczasowego obrazu po edycji bez kontroli, bo kopia wydarzenia może współdzielić jego URL. Cleanup wymaga osobnego zatwierdzonego procesu; sam prototyp UI go nie wykonuje.

Lokalizacja jest wariantem `none`, `existing` albo `new`; nie dopuszczać jednoczesnego location ID i pól nowej lokalizacji. Existing wskazuje istniejące miejsce i nie edytuje wspólnego rekordu. New niesie zwalidowane pola odpowiadające rzeczywistym kolumnom `locations`: name/address, city, latitude/longitude, postal_code, voivodeship, county, municipality. Utworzenie brakującego miasta i lokalizacji następuje **wewnątrz tej samej transakcji**. RPC nie ufa przesłanemu `geom` ani dowolnym polom katalogu.

Miasto jest rozwiązywane po istniejącym ID albo ustalonym slugu; istniejący `cities_slug_unique_idx` rozstrzyga wyścig tworzenia. Konflikt tego samego sluga przy różnej miejscowości/województwie nie może cicho przypiąć niewłaściwego miasta: zwrócić wymaganie jawnego wyboru. Nie aktualizować istniejącego katalogowego miasta współrzędnymi miejsca wydarzenia. Deduplikacja lokalizacji oparta wyłącznie na współrzędnych jest za słaba (wiele miejsc w jednym budynku); zaproponowany klucz porównania to znormalizowane city ID + name + address + współrzędne. Przy nowym miejscu użyć transakcyjnej blokady tego klucza, ponownie sprawdzić dopasowanie i utworzyć najwyżej jeden rekord przez RPC. Brak obecnego UNIQUE takiego klucza oznacza, że inne bezpośrednie writery też muszą przyjąć ten protokół; projekt nie obiecuje globalnej deduplikacji istniejących locations. Rollback zapisu event/source/notifications cofa utworzone miasto i miejsce.

## SECURITY INVOKER / DEFINER i granice grantów

`SECURITY INVOKER` ogranicza funkcję istniejącymi grantami/RLS aktora. Jest prostszy przy poprawnym modelu tabel, ale tutaj zwykły organizator nie może pisać logów/powiadomień, prywatna tabela receipts nie powinna być bezpośrednio dostępna, a szerokie event grants pozostawiłyby obejście allowlisty. Invoker wymagałby większej przebudowy bezpośrednich uprawnień i dedykowanych chronionych helperów.

Proponowany wariant: wąski `SECURITY DEFINER`, właściciel w dedykowanej roli NOLOGIN, bez SUPERUSER/BYPASSRLS i bez członkostwa anon/authenticated w tej roli. Dla publicznych tabel rola otrzymuje tylko potrzebne granty i jawnie przeglądnięte polityki RLS dla swoich operacji, bez osłabienia publicznych polityk odczytu. Dzięki temu nie polega się na przypadkowym bypass właściciela postgres. Funkcja sama sprawdza cały kontrakt i auth; RLS/column grants są dodatkową barierą. Prywatny schema nie jest wystawiony przez PostgREST. Właściciel receipts i ustawienie RLS tej tabeli muszą być jawne w przyszłym SQL; brak policy ani domyślny grant nie może tworzyć API do receipts.

Ustalić `search_path` tylko do `pg_catalog, pg_temp`, z pg_temp na końcu, i w pełni kwalifikować wszystkie obiekty `public`, `private`, `auth` i funkcję hash w rzeczywistym schemacie rozszerzenia. Nie używać dynamicznego SQL, nazw z requestu ani funkcji z niezaufanego schematu. Funkcje utworzyć wraz z odebraniem domyślnego EXECUTE dla PUBLIC/anon w jednej transakcji; EXECUTE wyłącznie dla authenticated na dokładnych sygnaturach. Service role nie jest runtime kanałem edytora i nie otrzymuje domyślnego bypass kontraktu. Powody tych zabezpieczeń opisuje [PostgreSQL CREATE FUNCTION — security definer](https://www.postgresql.org/docs/17/sql-createfunction.html).

Po migracji wszystkich runtime writerów odebrać anon/authenticated bezpośrednie INSERT/UPDATE/DELETE agregatu events/sources/logs, a także niepotrzebne TRUNCATE/TRIGGER/REFERENCES. Uwzględnić granty tabelowe **i kolumnowe**; samo REVOKE na tabeli nie jest pełnym przeglądem. Zachować SELECT przez aktualne RLS i filtry publiczne: published + public + nieanulowane. Dostęp admina też biegnie przez JWT i RPC, bo admin i organizer używają tej samej roli DB authenticated.

Nie odbierać w ciemno notifications UPDATE: obecne UI używa `is_read=true`; zawęzić do tego pola i własnego wiersza, a wszystkie pozostałe modyfikacje kierować do chronionego kontraktu. Dla cities/locations usunąć permissive INSERT dopiero w przeglądniętym pakiecie ze zgodnym kanałem administracyjnym. Nie obejmować przypadkowym REVOKE osobnych RPC saved_events ani analityki. Przed grant cutover sporządzić inventory importerów i zewnętrznych konsumentów, nie tylko formularzy Next.js.

## Wdrożenie i cofnięcie

1. Powtórny odczyt katalogu, spis wszystkich writerów i baseline grantów/RLS. Przedstawić osobno SQL, testy, rollback oraz wymaganą zgodę na receipts/kolumnę. Nie używać automatycznego db push ani zmiany produkcji na podstawie tego dokumentu.
2. Na staging zastosować zatwierdzony pakiet addytywny: receipts, write_version, wąskie role/polityki, RPC bez publicznego EXECUTE i pełną walidację. Użyć syntetycznych kont/fixture; bez kopiowania sekretów i kont produkcyjnych. Potwierdzić rzeczywiste zwykłe JWT, nie tylko sesję administratora bazy.
3. Wygenerować typy, przygotować klienta i wszystkie action warianty, trwały operation ID, reconciliation, upload oraz invalidację A07 po commit/replay. Zamknięcie A04 wymaga też testów utraty odpowiedzi i współbieżności; green unit tests nie są odbiorem SQL.
4. Uruchomić app cutover i zamknięcie direct grants w kontrolowanym oknie zapisu. Starsze otwarte formularze mają otrzymać jawne odświeżenie/odmowę, nie wrócić do starego częściowego zapisu. Nie utrzymywać długiego okresu mieszanego, w którym stara ścieżka omija wersję i receipts.
5. Po wdrożeniu ponownie odczytać definicje, role, search_path, ACL, polityki, granty kolumn i publiczny filtr. Odebrać DB oraz formularze, publiczny URL/listę/mapę i nieznany wynik sieciowy. Dopiero wynik macierzy pozwala oznaczyć A04 jako zakończone; A07 jest osobnym odbiorem widoczności cache.

Rollback przed commit DDL cofa cały pakiet; po zapisach przez nowe RPC zatrzymać nowe operacje, zachować receipts i wersje, wycofać wadliwy kod do zgodnego klienta lub zablokować zapis. Nie usuwać receipts/kolumny, nie odtwarzać szerokich grantów i nie kierować formularzy na wieloetapowy zapis jako automatycznego fallbacku. Przy utraconej odpowiedzi starego requestu retained receipt nadal rozstrzyga wynik. Ewentualny powrót do poprzednich grantów jest oddzielną, świadomą decyzją z pełnym baseline i konsekwencjami bezpieczeństwa. Zapisów użytkowników nie usuwać, aby „cofnąć deploy”; poprawiać przez autoryzowaną nową operację z nową wersją.

## Macierz odbioru — do wykonania

| Próba | Wymagany dowód |
| --- | --- |
| Anon/brak JWT/user/admin w user_metadata | Odmowa, zero event/location/source/log/notifications/receipt. Rola wyłącznie z aktualnego profilu. |
| Organizator A → event B; fałszywy source/event/location ID | Odmowa bez ujawnienia cudzych danych; brak mutacji. |
| Aktor członek A+B próbuje zmienić submitted_by A→B | Odmowa także przez bezpośredni RPC/API, autor i zgłaszający niezmienieni. |
| Organizator podaje status published, featured/verified, review_note, author, timestamps lub recipients | Odrzucenie payloadu; żadna administracyjna wartość nie trafia do DB. |
| Edit published; resubmit rejected; fałszywy resubmit archived/cancelled | Dokładne przejścia z tabeli; pierwsza publikacja i visibility zachowane. |
| Dwie różne operacje z tym samym expected_version | Jedna zatwierdzona, druga version_conflict; brak utraconych pól, drugiego źródła/logu. |
| Ten sam actor/op/payload równolegle i po utracie odpowiedzi | Jeden event, jedno właściwe źródło/log i jeden zestaw notifications, identyczny receipt; drugi wynik replay. |
| Ten sam actor/op, zmieniony tytuł/plik/status/expected_version | operation_id_reused; oryginalny wynik niezmieniony. |
| Inny aktor zna operation ID; democja admina; usunięte członkostwo po commit | Brak odczytu/replay cudzego lub już nieautoryzowanego receipt. Sprawdzić także aktualny parent owner i usunięty event. |
| Cofnięcie roli/członkostwa konkurencyjne z zapisem | Udokumentowany punkt blokady: revocation przed nim odmawia, późniejsza czeka; zero zapisu z odwołanego wcześniejszego uprawnienia. |
| Fault po city/location, event, source, log i w środku INSERT notifications | W każdym punkcie pełny rollback DB i brak receipt; brak osieroconego nowego miasta/miejsca. Fault injection wyłącznie staging, bez produkcyjnego hooka w funkcji. |
| Zabicie połączenia tuż przed i tuż po COMMIT | Retry tego samego ID odpowiednio wykonuje albo replayuje całość. „Brak odpowiedzi” nie tworzy nowego operation ID. |
| Równoległe create tego samego miasta/miejsca; kilka źródeł i remis created_at | Poprawny city slug konflikt, najwyżej jedna lokalizacja przez protokół; deterministyczna aktualizacja wyłącznie pierwszego źródła. |
| Duplicate i retry, hide/cancel/delete wraz z zależnościami | Kopia tylko raz; preserve/reset pól zgodnie z kontraktem; CASCADE/SET NULL i zachowany receipt delete. |
| Błąd/timeout Cloudinary przed RPC, upload przy późniejszym rollback/unknown commit | Brak nowego event bez potwierdzenia obrazu; stabilna referencja; brak automatycznego skasowania obrazu mogącego należeć do zatwierdzonego event. |
| Wymuszenie constraint/slug conflict, deadlock, timeout | Pełny rollback, zero receipt sukcesu; techniczny retry nigdy nie zmienia klucza/requestu. |
| Bezpośrednie REST INSERT/UPDATE/DELETE/TRUNCATE oraz próba EXECUTE helperów | Brak obejścia; sprawdzone również odziedziczone i kolumnowe granty. Notification is_read oraz saved-events RPC dalej działają. |
| Status/replay po zmianie sluga/miasta lub unpublish/cancel | Serwer invaliduje old/new detail/city + listing/map/cache; replay nie wykonuje danych ponownie, ale może ponowić invalidację. |
| Publiczne odczyty dla draft/private/cancelled po każdym wariancie | Nie ujawniają event ani źródeł; zachowane filtry published/public/nieanulowane i RLS. |

Dowód dla fault/concurrency testów obejmuje liczniki i snapshot wartości przed/po, dwa niezależne połączenia/JWT, receipt i odpowiedzi HTTP, bez sekretów w repo. Testy transakcyjne używają rollbackowanych fixture; test rzeczywistego COMMIT/utraty odpowiedzi wymaga izolowanego staging i kontrolowanego sprzątania. **Powyższych testów nie wykonano w ramach przygotowania tej propozycji.**
