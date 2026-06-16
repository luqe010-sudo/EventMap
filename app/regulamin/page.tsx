import type { Metadata } from "next";
import Link from "next/link";

const lastUpdated = "16 czerwca 2026 r.";
const operatorName = "DevilEnergy Łukasz Szypuła";
const operatorOwner = "Łukasz Szypuła";
const contactEmail = "kontakt@mapaimprez.pl";

export const metadata: Metadata = {
  title: "Regulamin, polityka prywatności i cookies | MapaImprez.pl",
  description:
    "Regulamin serwisu MapaImprez.pl, polityka prywatności RODO oraz informacje o plikach cookies i analityce.",
  alternates: {
    canonical: "/regulamin",
  },
};

type Section = {
  id: string;
  title: string;
  body: string[];
};

const termsSections: Section[] = [
  {
    id: "postanowienia-ogolne",
    title: "1. Postanowienia ogólne",
    body: [
      "Niniejszy regulamin określa zasady korzystania z serwisu internetowego MapaImprez.pl, dostępnego pod adresem mapaimprez.pl.",
      "Serwis jest portalem informacyjnym poświęconym lokalnym wydarzeniom w Polsce. Umożliwia przeglądanie wydarzeń według daty, lokalizacji, kategorii, promienia i ceny, a także korzystanie z kont organizatorów oraz panelu administracyjnego.",
      `Operatorem serwisu jest ${operatorName}, prowadzona przez ${operatorOwner}. Kontakt z operatorem jest możliwy pod adresem e-mail ${contactEmail}.`,
      "Korzystając z serwisu, użytkownik akceptuje regulamin w zakresie, w jakim dotyczy sposobu korzystania z publicznych funkcji oraz, w przypadku posiadania konta, funkcji dostępnych po zalogowaniu.",
    ],
  },
  {
    id: "definicje",
    title: "2. Definicje",
    body: [
      "Serwis oznacza portal MapaImprez.pl wraz z publicznymi stronami wydarzeń, mapą, wyszukiwarką, kontami użytkowników, panelem organizatora i panelem administracyjnym.",
      "Użytkownik oznacza każdą osobę korzystającą z serwisu, niezależnie od tego, czy posiada konto.",
      "Organizator oznacza użytkownika lub podmiot, który dodaje, edytuje albo zgłasza wydarzenia do publikacji w serwisie.",
      "Wydarzenie oznacza informację o wydarzeniu lokalnym, w szczególności jego nazwę, opis, datę, lokalizację, kategorię, cenę, źródła, zdjęcia i dane organizatora.",
      "Treści oznaczają wszelkie materiały dodawane do serwisu, w tym opisy wydarzeń, zdjęcia, linki, dane miejsc, dane organizatorów i informacje kontaktowe.",
    ],
  },
  {
    id: "zakres-uslug",
    title: "3. Zakres usług serwisu",
    body: [
      "Serwis umożliwia publiczne przeglądanie opublikowanych, publicznych i nieanulowanych wydarzeń.",
      "Serwis może prezentować wydarzenia na liście, mapie, stronach kategorii, stronach miast oraz stronach szczegółów wydarzenia.",
      "Serwis może udostępniać użytkownikom funkcje zapisywania wydarzeń, udostępniania linków, przechodzenia do stron biletów lub stron organizatorów oraz korzystania z geolokalizacji po zgodzie udzielonej w przeglądarce.",
      "Organizatorzy mogą korzystać z panelu organizatora, w tym dodawać i edytować wydarzenia, uzupełniać profil oraz przeglądać podstawowe statystyki swoich wydarzeń.",
      "Administratorzy serwisu mogą moderować wydarzenia, organizatorów, kategorie, lokalizacje i strony lokalne.",
    ],
  },
  {
    id: "konto",
    title: "4. Konto użytkownika i organizatora",
    body: [
      "Część funkcji serwisu jest dostępna bez rejestracji. Funkcje organizatora i panelu administracyjnego wymagają zalogowania.",
      "Użytkownik powinien podawać dane zgodne z prawdą i aktualizować je, jeżeli są nieaktualne.",
      "Użytkownik odpowiada za zachowanie poufności danych logowania oraz za działania wykonane z użyciem jego konta, o ile wynikają one z jego zawinionego działania lub zaniechania.",
      "Konto organizatora może zostać powiązane z jednym lub większą liczbą profili organizatorów. Organizator nie może podszywać się pod cudzy podmiot ani zgłaszać wydarzeń w imieniu podmiotu, do którego nie ma uprawnienia.",
      "Operator może ograniczyć dostęp do konta, panelu lub wybranych funkcji, jeżeli jest to konieczne dla bezpieczeństwa serwisu, ochrony użytkowników albo wyjaśnienia naruszenia regulaminu.",
    ],
  },
  {
    id: "wydarzenia",
    title: "5. Dodawanie i moderacja wydarzeń",
    body: [
      "Wydarzenia dodane przez organizatora trafiają do moderacji i nie muszą zostać opublikowane automatycznie.",
      "Administrator może opublikować, odrzucić, zarchiwizować, anulować, ukryć albo poprawić wydarzenie, jeżeli wymaga tego jakość danych, bezpieczeństwo użytkowników, zgodność z prawem lub zgodność z regulaminem.",
      "Organizator powinien zadbać, aby opis wydarzenia był rzetelny, aktualny i kompletny, a wskazane ceny, daty, miejsce, linki oraz dane kontaktowe odpowiadały rzeczywistości.",
      "Zabronione jest dodawanie treści bezprawnych, wprowadzających w błąd, naruszających prawa osób trzecich, nawołujących do nienawiści, zawierających złośliwe oprogramowanie albo promujących działania sprzeczne z prawem.",
      "Edycja opublikowanego wydarzenia przez organizatora może spowodować ponowne skierowanie wydarzenia do moderacji przed dalszą publikacją.",
    ],
  },
  {
    id: "zrodla",
    title: "6. Źródła danych i odpowiedzialność za informacje",
    body: [
      "Dane wydarzeń mogą pochodzić od organizatorów, administratorów, publicznie dostępnych źródeł lub z linków wskazanych przy wydarzeniu.",
      "Serwis dokłada starań, aby prezentowane informacje były użyteczne i aktualne, ale nie gwarantuje, że każde wydarzenie odbędzie się dokładnie w opisanym terminie, miejscu lub formule.",
      "Przed zakupem biletu, wyjazdem lub udziałem w wydarzeniu użytkownik powinien sprawdzić aktualne informacje u organizatora albo w oficjalnym źródle wydarzenia.",
      "Operator nie jest stroną umów zawieranych między użytkownikiem a organizatorem, sprzedawcą biletów, miejscem wydarzenia lub innym podmiotem zewnętrznym.",
    ],
  },
  {
    id: "zasady-korzystania",
    title: "7. Zasady korzystania z serwisu",
    body: [
      "Użytkownik powinien korzystać z serwisu zgodnie z prawem, regulaminem, dobrymi obyczajami oraz przeznaczeniem serwisu.",
      "Zabronione jest podejmowanie działań zakłócających działanie serwisu, obchodzenie zabezpieczeń, nieuprawnione pobieranie danych, automatyczne przeciążanie infrastruktury oraz wykorzystywanie serwisu do wysyłania spamu.",
      "Użytkownik nie może kopiować, rozpowszechniać ani wykorzystywać treści z serwisu w sposób naruszający prawa operatora, organizatorów lub osób trzecich.",
      "Mapy, kafelki mapowe, geokodowanie, system logowania, hosting obrazów, analityka lub inne elementy techniczne mogą być dostarczane przez zewnętrznych usługodawców na zasadach określonych przez tych usługodawców.",
    ],
  },
  {
    id: "wlasnosc-intelektualna",
    title: "8. Prawa do treści",
    body: [
      "Prawa do znaków towarowych, układu graficznego, kodu, baz danych i elementów serwisu przysługują operatorowi lub uprawnionym podmiotom trzecim.",
      "Organizator, dodając treści do serwisu, oświadcza, że posiada prawa lub zgody potrzebne do ich publikacji, w tym prawa do zdjęć, opisów, logotypów i linkowanych materiałów.",
      "Organizator udziela operatorowi niewyłącznej licencji na wykorzystywanie dodanych treści w zakresie potrzebnym do działania, promocji i archiwizacji serwisu oraz prezentowania wydarzeń użytkownikom.",
      "Jeżeli użytkownik uważa, że treść w serwisie narusza jego prawa, powinien zgłosić to operatorowi, wskazując adres strony, opis naruszenia oraz dane pozwalające na kontakt zwrotny.",
    ],
  },
  {
    id: "platnosci",
    title: "9. Ceny, bilety i usługi zewnętrzne",
    body: [
      "Serwis może informować o cenach wydarzeń lub oznaczać wydarzenia jako bezpłatne, jeżeli taka informacja została podana w danych wydarzenia.",
      "Zakup biletów, rezerwacja miejsc, płatności i obsługa zwrotów odbywają się poza serwisem, jeżeli użytkownik przechodzi do zewnętrznej strony organizatora lub sprzedawcy biletów.",
      "Operator nie odpowiada za dostępność, ceny, regulaminy, płatności ani realizację usług oferowanych na stronach zewnętrznych.",
    ],
  },
  {
    id: "dane",
    title: "10. Dane osobowe i prywatność",
    body: [
      `Administratorem danych osobowych przetwarzanych w ramach serwisu jest ${operatorName}. W sprawach dotyczących danych osobowych można skontaktować się pod adresem ${contactEmail}.`,
      "Serwis przetwarza dane osobowe w zakresie potrzebnym do działania kont, paneli, moderacji, bezpieczeństwa, statystyk, obsługi zgłoszeń oraz prezentowania wydarzeń.",
      "W przypadku kont użytkowników serwis może przetwarzać między innymi adres e-mail, nazwę profilu, rolę, powiązanie z organizatorem oraz historię działań niezbędną do obsługi konta i moderacji.",
      "W przypadku organizatorów serwis może prezentować publicznie dane podane w profilu organizatora lub wydarzeniu, takie jak nazwa, opis, strona WWW, telefon, e-mail, logo i linki społecznościowe.",
      "Szczegółowe informacje o plikach cookies i podobnych technologiach znajdują się w polityce cookies poniżej.",
    ],
  },
  {
    id: "reklamacje",
    title: "11. Zgłoszenia i reklamacje",
    body: [
      `Użytkownik może zgłosić błąd, nieaktualne wydarzenie, naruszenie praw, problem z kontem albo zastrzeżenie dotyczące działania serwisu pod adresem ${contactEmail}.`,
      "Zgłoszenie powinno zawierać opis sprawy, adres URL, którego dotyczy, oraz dane kontaktowe umożliwiające odpowiedź.",
      "Operator rozpatruje zgłoszenia w rozsądnym terminie, z uwzględnieniem charakteru sprawy, konieczności weryfikacji danych i dostępności informacji od organizatora.",
    ],
  },
  {
    id: "zmiany",
    title: "12. Zmiany regulaminu",
    body: [
      "Operator może zmienić regulamin w szczególności w przypadku rozwoju funkcji serwisu, zmian technicznych, zmian prawnych, potrzeby doprecyzowania zasad lub poprawy bezpieczeństwa.",
      "Aktualna wersja regulaminu jest publikowana na tej stronie. Przy istotnych zmianach dotyczących kont użytkowników operator może poinformować użytkowników w sposób przyjęty w serwisie.",
      "Dalsze korzystanie z serwisu po wejściu w życie zmian oznacza korzystanie z serwisu na zasadach określonych w aktualnej wersji regulaminu.",
    ],
  },
];

const privacySections: Section[] = [
  {
    id: "rodo-administrator",
    title: "1. Administrator danych",
    body: [
      `Administratorem danych osobowych użytkowników serwisu MapaImprez.pl jest ${operatorName}, prowadzona przez ${operatorOwner}.`,
      `W sprawach dotyczących prywatności, danych osobowych i realizacji praw wynikających z RODO można skontaktować się pod adresem e-mail ${contactEmail}.`,
      "Serwis nie wyznaczył inspektora ochrony danych. Kontakt w sprawach danych osobowych odbywa się przez wskazany adres e-mail.",
    ],
  },
  {
    id: "rodo-zakres",
    title: "2. Jakie dane przetwarzamy",
    body: [
      "W przypadku zwykłych użytkowników serwis może przetwarzać adres e-mail, nazwę profilu, rolę konta, identyfikator użytkownika, informacje o sesji logowania oraz dane techniczne potrzebne do bezpieczeństwa i działania konta.",
      "W przypadku organizatorów serwis może przetwarzać również nazwę organizacji, dane kontaktowe, opis, logo, linki internetowe, wydarzenia, lokalizacje, historię moderacji i statystyki interakcji z wydarzeniami.",
      "W przypadku osób kontaktujących się z operatorem serwis może przetwarzać dane podane w korespondencji, w tym adres e-mail, imię i nazwisko, treść zgłoszenia oraz informacje potrzebne do obsługi sprawy.",
      "Podczas korzystania z serwisu mogą być przetwarzane dane techniczne, takie jak adres IP, informacje o urządzeniu, przeglądarce, data i godzina żądania, logi bezpieczeństwa, identyfikatory cookies oraz dane analityczne, jeżeli użytkownik wyraził zgodę na analitykę.",
    ],
  },
  {
    id: "rodo-cele",
    title: "3. Cele i podstawy prawne przetwarzania",
    body: [
      "Dane konta są przetwarzane w celu założenia i obsługi konta, logowania, udostępnienia panelu organizatora oraz realizacji usług serwisu. Podstawą jest niezbędność przetwarzania do wykonania umowy lub podjęcia działań przed jej zawarciem.",
      "Dane organizatorów i wydarzeń są przetwarzane w celu publikacji, moderacji i prezentowania wydarzeń użytkownikom. Podstawą jest wykonanie usługi oraz prawnie uzasadniony interes administratora polegający na prowadzeniu portalu wydarzeń i zapewnieniu jakości danych.",
      "Dane kontaktowe i zgłoszenia są przetwarzane w celu obsługi korespondencji, reklamacji, zgłoszeń naruszeń i pytań użytkowników. Podstawą jest prawnie uzasadniony interes administratora albo, zależnie od sprawy, wykonanie umowy.",
      "Dane techniczne i logi są przetwarzane w celu zapewnienia bezpieczeństwa, zapobiegania nadużyciom, diagnozowania błędów i utrzymania serwisu. Podstawą jest prawnie uzasadniony interes administratora.",
      "Dane analityczne Google Analytics są przetwarzane wyłącznie po udzieleniu zgody w bannerze cookies. Zgodę można w każdej chwili zmienić lub wycofać przez przycisk Cookies.",
      "Jeżeli przepisy prawa wymagają przechowywania określonych danych, podstawą przetwarzania jest obowiązek prawny ciążący na administratorze.",
    ],
  },
  {
    id: "rodo-odbiorcy",
    title: "4. Odbiorcy danych i dostawcy usług",
    body: [
      "Dane mogą być przekazywane dostawcom usług technicznych, którzy pomagają utrzymywać serwis, w szczególności dostawcom hostingu, bazy danych, uwierzytelniania, analityki, map, przechowywania obrazów, poczty elektronicznej i narzędzi administracyjnych.",
      "W aktualnej architekturze serwis korzysta lub może korzystać między innymi z Supabase do obsługi bazy danych i uwierzytelniania, Google Analytics do statystyk po zgodzie użytkownika, Cloudinary do obrazów oraz dostawców map i geokodowania.",
      "Publiczne dane organizatora lub wydarzenia, takie jak nazwa organizatora, opis, linki, telefon, e-mail, zdjęcia i lokalizacja wydarzenia, mogą być widoczne publicznie, jeżeli organizator poda je w profilu lub wydarzeniu.",
      "Dane mogą zostać udostępnione uprawnionym organom publicznym, jeżeli wynika to z obowiązujących przepisów prawa.",
    ],
  },
  {
    id: "rodo-transfer",
    title: "5. Przekazywanie danych poza EOG",
    body: [
      "Niektórzy dostawcy usług technicznych mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym, w szczególności jeżeli korzystają z infrastruktury globalnej.",
      "W takim przypadku administrator korzysta z dostawców deklarujących stosowanie mechanizmów wymaganych przez RODO, takich jak standardowe klauzule umowne, decyzje stwierdzające odpowiedni stopień ochrony albo inne dopuszczalne zabezpieczenia.",
    ],
  },
  {
    id: "rodo-okres",
    title: "6. Jak długo przechowujemy dane",
    body: [
      "Dane konta są przechowywane przez okres posiadania konta, a po jego usunięciu przez czas potrzebny do rozliczenia zgłoszeń, zabezpieczenia roszczeń, zapewnienia bezpieczeństwa i spełnienia obowiązków prawnych.",
      "Dane wydarzeń i organizatorów są przechowywane przez okres publikacji, moderacji i archiwizacji wydarzeń, a także przez czas potrzebny do zachowania historii zmian, przeciwdziałania nadużyciom i obsługi zgłoszeń.",
      "Dane korespondencji są przechowywane przez czas potrzebny do obsługi sprawy, a następnie przez okres niezbędny do ochrony przed roszczeniami lub wykazania sposobu rozpatrzenia zgłoszenia.",
      "Dane analityczne i cookies są przechowywane zgodnie z ustawieniami narzędzi analitycznych, ustawieniami przeglądarki oraz wyborem użytkownika w bannerze cookies.",
    ],
  },
  {
    id: "rodo-prawa",
    title: "7. Prawa użytkownika",
    body: [
      "Użytkownik ma prawo żądać dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia danych oraz wniesienia sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie administratora.",
      "Jeżeli przetwarzanie odbywa się na podstawie zgody, użytkownik ma prawo wycofać zgodę w dowolnym momencie. Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania dokonanego przed jej wycofaniem.",
      `Aby skorzystać z praw, należy skontaktować się z administratorem pod adresem ${contactEmail}. Administrator może poprosić o informacje potrzebne do potwierdzenia tożsamości osoby składającej żądanie.`,
      "Użytkownik ma prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych, jeżeli uważa, że przetwarzanie danych narusza przepisy RODO.",
    ],
  },
  {
    id: "rodo-dobrowolnosc",
    title: "8. Dobrowolność podania danych",
    body: [
      "Podanie danych potrzebnych do założenia konta jest dobrowolne, ale konieczne do korzystania z funkcji konta, panelu organizatora i funkcji dostępnych po zalogowaniu.",
      "Podanie danych organizatora i wydarzenia jest dobrowolne, ale część danych może być konieczna do publikacji wydarzenia, jego moderacji i prawidłowej prezentacji użytkownikom.",
      "Podanie danych w zgłoszeniu lub wiadomości jest dobrowolne, ale brak danych kontaktowych albo brak opisu sprawy może uniemożliwić udzielenie odpowiedzi lub rozpatrzenie zgłoszenia.",
    ],
  },
  {
    id: "rodo-decyzje",
    title: "9. Profilowanie i zautomatyzowane decyzje",
    body: [
      "Serwis nie podejmuje wobec użytkowników decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, które wywoływałyby wobec nich skutki prawne lub w podobny sposób istotnie na nich wpływały.",
      "Serwis może korzystać ze statystyk i analityki w celu mierzenia popularności wydarzeń, poprawy działania serwisu i prezentowania danych organizatorom, ale nie służy to automatycznemu podejmowaniu decyzji prawnych wobec użytkownika.",
    ],
  },
  {
    id: "rodo-bezpieczenstwo",
    title: "10. Bezpieczeństwo danych",
    body: [
      "Administrator stosuje środki organizacyjne i techniczne adekwatne do charakteru serwisu, w tym kontrolę dostępu, uwierzytelnianie, role użytkowników oraz oddzielenie funkcji publicznych od paneli administracyjnych.",
      "Użytkownik powinien chronić dane logowania, używać bezpiecznego hasła i nie udostępniać konta osobom nieuprawnionym.",
    ],
  },
];

const cookieSections: Section[] = [
  {
    id: "cookies-czym-sa",
    title: "1. Czym są cookies",
    body: [
      "Cookies to niewielkie pliki zapisywane w przeglądarce użytkownika. Podobne funkcje mogą pełnić także localStorage, sessionStorage, identyfikatory sesji i inne technologie przechowywania informacji w urządzeniu użytkownika.",
      "Serwis używa cookies i podobnych technologii w celu zapewnienia działania strony, utrzymania sesji logowania, zapamiętywania wybranych ustawień, pomiaru korzystania z serwisu oraz poprawy jakości prezentowanych funkcji.",
    ],
  },
  {
    id: "cookies-rodzaje",
    title: "2. Rodzaje wykorzystywanych technologii",
    body: [
      "Niezbędne cookies i identyfikatory sesji służą do działania strony, bezpieczeństwa, logowania i utrzymania sesji Supabase Auth. Bez nich część funkcji, w szczególności konto użytkownika i panel organizatora, może nie działać prawidłowo.",
      "Preferencje i dane lokalne mogą służyć do zapamiętania ustawień interfejsu, zapisanych wydarzeń w przeglądarce, identyfikatora sesji analitycznej wydarzeń albo ostatnio wybranych opcji wyszukiwania.",
      "Analityka wydarzeń może zapisywać informacje o publicznych interakcjach z wydarzeniem, takich jak wyświetlenie, kliknięcie linku, kliknięcie mapy, zapisanie lub udostępnienie wydarzenia. Dane te pomagają organizatorom i administratorom mierzyć skuteczność publikacji.",
      "Google Analytics, jeżeli jest aktywne, może wykorzystywać pliki cookies i podobne identyfikatory do tworzenia zbiorczych statystyk odwiedzin, źródeł ruchu i sposobu korzystania z serwisu.",
    ],
  },
  {
    id: "cookies-tabela",
    title: "3. Przykładowe cookies i identyfikatory",
    body: [
      "Cookies Supabase Auth: utrzymują sesję zalogowanego użytkownika i obsługują bezpieczeństwo logowania. Są używane tylko wtedy, gdy użytkownik korzysta z funkcji konta.",
      "eventmap.analyticsSessionId: identyfikator sesji w przeglądarce używany do podstawowej analityki interakcji z wydarzeniami.",
      "_ga oraz _ga_*: przykładowe pliki Google Analytics, jeżeli usługa jest aktywna w serwisie. Służą do rozróżniania wizyt i tworzenia statystyk.",
      "Preferencje przeglądarki i localStorage: mogą przechowywać lokalne ustawienia interfejsu lub zapisane przez użytkownika elementy, o ile dana funkcja jest dostępna w serwisie.",
    ],
  },
  {
    id: "cookies-zgoda",
    title: "4. Zgoda i zarządzanie cookies",
    body: [
      "Cookies niezbędne do działania serwisu mogą być wykorzystywane bez dodatkowej zgody, ponieważ są potrzebne do świadczenia usługi żądanej przez użytkownika.",
      "Przy pierwszej wizycie serwis wyświetla banner cookies. Google Analytics jest ładowane dopiero po wybraniu zgody na analitykę. Odrzucenie analityki nie blokuje korzystania z podstawowych funkcji serwisu.",
      "Decyzja użytkownika jest zapisywana w pamięci przeglądarki. Użytkownik może ponownie otworzyć ustawienia przyciskiem Cookies widocznym po zapisaniu wyboru.",
      "Użytkownik może ograniczyć lub usunąć cookies w ustawieniach przeglądarki. Ograniczenie cookies może spowodować, że logowanie, panel organizatora, zapamiętane ustawienia lub część funkcji serwisu przestaną działać prawidłowo.",
      "Użytkownik może też korzystać z narzędzi udostępnianych przez dostawców przeglądarek lub dostawców usług analitycznych, w tym ustawień prywatności, blokowania cookies stron trzecich i rozszerzeń ograniczających śledzenie.",
    ],
  },
  {
    id: "cookies-zewnetrzne",
    title: "5. Dostawcy zewnętrzni",
    body: [
      "Serwis może korzystać z usług zewnętrznych, takich jak Supabase, Google Analytics, MapLibre i dostawcy kafelków mapowych, Cloudinary lub inne usługi techniczne potrzebne do działania portalu.",
      "Dostawcy zewnętrzni mogą przetwarzać dane zgodnie z własnymi zasadami prywatności, jeżeli użytkownik korzysta z funkcji obsługiwanych przez tych dostawców albo ładuje elementy pochodzące z ich infrastruktury.",
      "Zakres dostawców może zmieniać się wraz z rozwojem serwisu. Aktualizacja tej polityki może nastąpić po dodaniu nowych narzędzi analitycznych, reklamowych, płatniczych lub komunikacyjnych.",
    ],
  },
];

function renderSections(sections: Section[]) {
  return sections.map((section) => (
    <section className="legalSection" id={section.id} key={section.id}>
      <h2>{section.title}</h2>
      {section.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  ));
}

export default function TermsPage() {
  return (
    <main className="legalPage">
      <header className="legalHero">
        <p className="legalEyebrow">Dokumenty serwisu</p>
        <h1>Regulamin, prywatność i cookies</h1>
        <p>
          Zasady korzystania z MapaImprez.pl, publikowania wydarzeń przez
          organizatorów, przetwarzania danych osobowych oraz wykorzystywania
          plików cookies i podobnych technologii.
        </p>
        <span>Ostatnia aktualizacja: {lastUpdated}</span>
      </header>

      <nav className="legalToc" aria-label="Spis treści dokumentów">
        <Link href="#regulamin">Regulamin</Link>
        <Link href="#polityka-prywatnosci">Polityka prywatności</Link>
        <Link href="#polityka-cookies">Polityka cookies</Link>
        <Link href="#cookies-zgoda">Zarządzanie cookies</Link>
        <Link href="/">Wróć do wydarzeń</Link>
      </nav>

      <article className="legalDocument" id="regulamin">
        <div className="legalDocumentHeader">
          <span>MapaImprez.pl</span>
          <h2>Regulamin serwisu</h2>
          <p>
            Ten dokument opisuje podstawowe zasady działania portalu wydarzeń.
            Operatorem serwisu jest {operatorName}; kontakt:{" "}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </div>
        {renderSections(termsSections)}
      </article>

      <article className="legalDocument" id="polityka-prywatnosci">
        <div className="legalDocumentHeader">
          <span>RODO</span>
          <h2>Polityka prywatności</h2>
          <p>
            Informacje o administratorze danych, celach i podstawach
            przetwarzania, odbiorcach danych, okresach przechowywania oraz
            prawach użytkowników.
          </p>
        </div>
        {renderSections(privacySections)}
      </article>

      <article className="legalDocument" id="polityka-cookies">
        <div className="legalDocumentHeader">
          <span>Cookies</span>
          <h2>Polityka cookies</h2>
          <p>
            Informacje o plikach cookies, pamięci przeglądarki, analityce i
            usługach zewnętrznych wykorzystywanych przez MapaImprez.pl.
          </p>
        </div>
        {renderSections(cookieSections)}
      </article>
    </main>
  );
}
