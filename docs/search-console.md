# Google Search Console — dostęp do raportów MapaImprez.pl

Stan zweryfikowany w konsolach 10 listopada 2026:

- [Google Search Console API](https://console.cloud.google.com/apis/library/searchconsole.googleapis.com?project=mapaimprezserwis) było już włączone w projekcie `mapaimprezserwis`.
- Utworzono `eventmap-gsc-reader@mapaimprezserwis.iam.gserviceaccount.com` bez przypisywania ról w projekcie Google Cloud. Search Console potwierdziło rolę **Ograniczone** dla tego konta w usłudze `sc-domain:mapaimprez.pl`.
- Po zatwierdzonym tymczasowym wyjątku tylko dla projektu Google Cloud potwierdził wydanie jednego klucza JSON. Przywrócono i zweryfikowano pierwotne egzekwowanie `iam.disableServiceAccountKeyCreation`. Ta reguła blokuje wydawanie kolejnych kluczy; już wydany klucz pozostaje ważny do wygaśnięcia lub wycofania. [Dokumentacja Google](https://docs.cloud.google.com/iam/docs/migrate-from-service-account-keys)
- Google Cloud pokazał komunikat o zapisaniu klucza przez przeglądarkę, ale nie udało się znaleźć pliku na dysku. Po zatwierdzeniu usunięto ten klucz w IAM. Kolejne wydanie powinno zapisać plik bezpośrednio na dysku przez Google Cloud CLI. Odczyt API z konta serwisowego nie jest jeszcze potwierdzony; dane wyjściowe w [planie wzrostu](seo-growth-plan.md) pochodzą z panelu właściciela.

## Odtworzenie konfiguracji w innym projekcie

1. W [Google Cloud Console](https://console.cloud.google.com/) wybierz istniejący projekt należący do właściciela serwisu, w którym ma działać raportowanie. Zanotuj **identyfikator projektu**, nie nazwę wyświetlaną. Włącz w tym projekcie [Google Search Console API](https://console.cloud.google.com/apis/library/searchconsole.googleapis.com) (`searchconsole.googleapis.com`).
2. W [IAM i administracja → Konta usługi](https://console.cloud.google.com/iam-admin/serviceaccounts) utwórz `eventmap-gsc-reader` albo użyj już istniejącego konta przeznaczonego wyłącznie do tego raportu. Pomiń nadawanie temu kontu ról w projekcie Cloud. Skopiuj jego adres `eventmap-gsc-reader@PROJECT_ID.iam.gserviceaccount.com`.
3. Właściciel usługi `mapaimprez.pl` otwiera [Search Console](https://search.google.com/search-console/) → **Ustawienia → Użytkownicy i uprawnienia → Dodaj użytkownika**. Dodaje adres konta serwisowego z rolą **Użytkownik z ograniczonym dostępem**. Dostęp Cloud IAM i dostęp do usługi Search Console są oddzielne. [Uprawnienia Search Console](https://support.google.com/webmasters/answer/7687615?hl=pl)

Kroki 1–2 można też wykonać w Cloud Shell. Przed uruchomieniem zastąp `PROJECT_ID` identyfikatorem sprawdzonego projektu; jeśli konto już istnieje, pomiń drugie polecenie.

```bash
gcloud services enable searchconsole.googleapis.com --project=PROJECT_ID
gcloud iam service-accounts create eventmap-gsc-reader \
  --display-name="EventMap Search Console Reader" --project=PROJECT_ID
```

## Uwierzytelnienie i test

API wymaga tokenu OAuth 2.0; zwykły klucz API nie daje dostępu do danych. Skrypt wymienia podpisane poświadczenie konta serwisowego na token z zakresem `https://www.googleapis.com/auth/webmasters.readonly`. Może też przyjąć krótkotrwały token OAuth z tym samym zakresem przez zmienną procesu `GSC_ACCESS_TOKEN` (ma pierwszeństwo). [Autoryzacja Search Console API](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)

**Raport lokalny z kluczem JSON.** Po wydaniu klucza przenieś plik z Pobranych do katalogu poza `E:\EventMap`, dostępnego tylko dla uprawnionego użytkownika. Wartość zmiennej to ścieżka do pliku. Nie umieszczaj pliku w repozytorium, w ustawieniach frontendu ani w rozmowie. Google nie pozwala ponownie pobrać istniejącego klucza prywatnego z konsoli. [Klucze kont serwisowych](https://docs.cloud.google.com/iam/docs/keys-create-delete) · [Ograniczenia organizacji](https://docs.cloud.google.com/organization-policy/restrict-service-accounts)

```powershell
# Uruchom z katalogu głównego repozytorium. Podaj własną ścieżkę poza repozytorium.
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\prywatne\eventmap-gsc-reader.json'
npm run seo:gsc
Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS
```

Gdy trzeba zastąpić niedostępny klucz, odwołaj go w IAM. Przy zatwierdzonym wyjątku dla projektu i po uwierzytelnieniu operatora w Google Cloud CLI można wskazać prywatną ścieżkę przed wydaniem nowego klucza. CLI sprawdza możliwość zapisu przed utworzeniem klucza. Zastąp `C:\prywatne\eventmap-gsc-reader.json` ścieżką do istniejącego prywatnego katalogu; po próbie przywróć blokadę i zweryfikuj raport. [Polecenie zapisu klucza do pliku](https://docs.cloud.google.com/sdk/gcloud/reference/iam/service-accounts/keys/create)

```powershell
gcloud iam service-accounts keys create 'C:\prywatne\eventmap-gsc-reader.json' `
  --iam-account=eventmap-gsc-reader@mapaimprezserwis.iam.gserviceaccount.com `
  --project=mapaimprezserwis --key-file-type=json
```

**Raport cykliczny.** Preferuj krótkotrwały token zamiast stałego klucza: dedykowany proces raportowy może użyć [Google Cloud Workload Identity Federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) z ograniczeniem do konkretnego repozytorium i środowiska. Token konta `eventmap-gsc-reader` przekaż jako `GSC_ACCESS_TOKEN` tylko do procesu raportującego. Nie jest potrzebny w runtime Next.js. Przy pracy lokalnej administrator może użyć [krótkotrwałego tokenu przez impersonację](https://docs.cloud.google.com/sdk/gcloud/reference/auth/application-default/print-access-token), jeśli ma uprawnienia wyłącznie do tego konta.

Test jest zaliczony, gdy [`sites.list`](https://developers.google.com/webmaster-tools/v1/sites/list) zwraca `sc-domain:mapaimprez.pl` i [`searchAnalytics.query`](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) zwraca poprawny raport. Poprawna odpowiedź bez wierszy oznacza brak danych w tym zakresie. Przy HTTP 403 sprawdź aktywację API w projekcie konta, rolę w **tej usłudze** i zakres tokenu; przy HTTP 401 sprawdź ważność tokenu i poświadczenia. Klucz, którego użycie zakończono, wycofuje się w Cloud IAM; dostęp do usługi usuwa się osobno w Search Console.

## Odczyt i interpretacja

- `npm run seo:gsc` — wyniki typu **Sieć** w Polsce: kliknięcia, wyświetlenia, CTR, średnia pozycja oraz najczęściej klikane strony i zapytania. Raport porównuje dwa kolejne okresy po 28 dni na podstawie sfinalizowanych danych, domyślnie do daty sprzed czterech dni w strefie Pacific Time.
- `npm run --silent seo:gsc -- --json` — raport w JSON na standardowym wyjściu, z dziennymi wynikami. Opcjonalnie użyj `--country all` dla wszystkich krajów i `--limit 100` dla stu najważniejszych stron i zapytań. Zapisuj raporty poza repozytorium lub w ignorowanym `scratch/`. `--end-date RRRR-MM-DD` pozwala powtórzyć raport za ten sam okres. `--site https://mapaimprez.pl/` jest opcją wyłącznie dla oddzielnej usługi z prefiksem URL, jeśli ta usługa istnieje i konto ma do niej dostęp.
- Sumy pochodzą z osobnych zapytań. Tabele stron i zapytań obejmują tylko wybrane najwyższe wiersze; Google może pominąć zapytania ze względu na prywatność. Nie odtwarzaj sum i liczby wszystkich stron z tej tabeli. [Ograniczenia danych skuteczności](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data)
- **Indeksowanie → Strony** i **Mapy witryn** sprawdza właściciel w panelu. Status indeksowania pojedynczej strony można sprawdzić w inspekcji URL. W panelu sprawdź istniejące zgłoszenie `https://mapaimprez.pl/sitemap.xml` i dodaj je tylko wtedy, gdy go brakuje. [Mapy witryn](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

Zobacz [plan wzrostu organicznego](seo-growth-plan.md).
