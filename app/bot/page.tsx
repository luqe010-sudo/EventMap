import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MapaImprezBot — jak zbieramy informacje o wydarzeniach | MapaImprez.pl",
  description: "Informacje o automacie MapaImprezBot: jakie dane pobiera, jak respektuje robots.txt i jak zgłosić wyłączenie strony.",
  alternates: { canonical: "/bot" }
};

const rules = [
  "Odwiedzamy wyłącznie publiczne strony organizatorów, obiektów, instytucji kultury i samorządów oraz ich kalendarze (iCalendar, RSS, dane schema.org).",
  "Zawsze respektujemy robots.txt, zastrzeżenia eksploracji tekstu i danych (TDM) oraz limity serwera. Nie logujemy się, nie obchodzimy zabezpieczeń ani CAPTCHA.",
  "Pobieramy tylko fakty o wydarzeniu: nazwę, termin, miejsce, cenę i link do strony organizatora. Nie kopiujemy opisów, zdjęć ani plakatów — opisy w serwisie piszemy sami.",
  "Każde wydarzenie w MapaImprez.pl wskazuje źródło. Rekordy pochodzące z danej strony możemy w każdej chwili wycofać.",
  "Odpytujemy jeden serwis nie częściej niż co kilka sekund i korzystamy z nagłówków ETag/If-Modified-Since, aby nie pobierać niezmienionych treści."
];

export default function BotPage() {
  return (
    <main className="legalPage">
      <header className="legalHero">
        <p className="legalEyebrow">Dla organizatorów i administratorów stron</p>
        <h1>MapaImprezBot</h1>
        <p>Automat MapaImprez.pl pomaga mieszkańcom znaleźć lokalne wydarzenia w całej Polsce. Identyfikuje się nagłówkiem <code>User-Agent: MapaImprezBot/1.0 (+https://mapaimprez.pl/bot)</code>.</p>
      </header>
      <article className="legalDocument">
        <section className="legalSection">
          <h2>Zasady działania</h2>
          <ul>{rules.map(rule => <li key={rule}>{rule}</li>)}</ul>
        </section>
        <section className="legalSection">
          <h2>Jak wyłączyć lub ograniczyć pobieranie</h2>
          <p>Dodaj do pliku robots.txt regułę <code>User-agent: MapaImprezBot</code> z <code>Disallow: /</code> (lub wybraną ścieżką). Uwzględnimy ją przy najbliższej wizycie, najpóźniej w ciągu 24 godzin.</p>
          <p>Prośby o usunięcie lub poprawę wydarzeń, a także propozycje współpracy, przyjmujemy pod adresem kontakt@mapaimprez.pl. Organizatorzy mogą też dodawać wydarzenia sami — <Link href="/dla-organizatorow">dowiedz się więcej</Link>.</p>
        </section>
      </article>
    </main>
  );
}
