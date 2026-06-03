import { toPluralCategoryName, formatInCity } from "./slugs";

export function generateSeoText(category: string | undefined, city: string | undefined): string {
  if (category && city) {
    const categoryPlural = toPluralCategoryName(category);
    const cityLocative = formatInCity(city);
    return `
      <h2>Najlepsze ${categoryPlural.toLowerCase()} ${cityLocative} na wyciągnięcie ręki!</h2>
      <p>Zapraszamy do zapoznania się z aktualnym, pełnym kalendarzem koncertów, imprez muzycznych, kulturalnych i rozrywkowych z kategorii <strong>${categoryPlural}</strong> w miejscowości <strong>${city}</strong>.</p>
      <p>Nasza baza jest stale aktualizowana i zawiera zarówno duże festiwale, jak i mniejsze, kameralne występy w klubach, kawiarniach czy teatrach. Dzięki wygodnym filtrom możesz szybko znaleźć wydarzenia, które odpowiadają Twoim preferencjom – od bezpłatnych imprez po biletowane koncerty znanych gwiazd sceny muzycznej. Sprawdź terminy, godziny rozpoczęcia oraz dokładne adresy lokalizacji, aby w pełni zaplanować swój czas wolny ${cityLocative}.</p>
    `;
  }
  
  if (category) {
    const categoryPlural = toPluralCategoryName(category);
    return `
      <h2>Odkryj najciekawsze ${categoryPlural.toLowerCase()} w Polsce</h2>
      <p>Szukasz wyjątkowego sposobu na spędzenie wolnego czasu? Kategoria <strong>${categoryPlural}</strong> to idealna propozycja dla każdego miłośnika dobrej muzyki, kultury, sportu i niesamowitych emocji na żywo. Na łamach portalu MapaImprez prezentujemy bogaty i stale uaktualniany terminarz nadchodzących wydarzeń, festiwali, spektakli oraz turniejów organizowanych w całej Polsce.</p>
      <p>Niezależnie od tego, czy interesują Cię masowe imprezy plenerowe w największych metropoliach (takich jak Warszawa, Kraków, Wrocław czy Poznań), czy też lokalne spotkania w mniejszych miejscowościach, u nas szybko sprawdzisz wszystkie terminy i szczegóły. Skorzystaj z naszej intuicyjnej wyszukiwarki z mapą, określ preferowany promień odległości od Twojej lokalizacji, wybierz datę i filtruj oferty po cenie wejściówek. Odkryj ${categoryPlural.toLowerCase()} w Polsce i zaplanuj niezapomniane chwile już dziś!</p>
    `;
  }

  if (city) {
    const cityLocative = formatInCity(city);
    return `
      <h2>Wydarzenia, imprezy i atrakcje ${cityLocative}</h2>
      <p>Poznaj bogaty kalendarz wydarzeń i dowiedz się, co ciekawego dzieje się w miejscowości <strong>${city}</strong>. Nasz portal agreguje najciekawsze inicjatywy kulturalne, sportowe, edukacyjne i rozrywkowe. Od koncertów znanych artystów, przez widowiska teatralne i kabarety, po targi tematyczne, warsztaty i animacje przygotowane specjalnie dla rodzin z dziećmi.</p>
      <p>Dzięki aktywnej społeczności i zaawansowanym filtrom wyszukiwania możesz w kilka sekund sprawdzić wydarzenia zaplanowane na dzisiaj, jutro lub nadchodzący weekend w tym regionie. Wszystkie wydarzenia prezentujemy na interaktywnej mapie, co pozwala łatwo sprawdzić odległość i trasę dojazdu. Niezależnie od pogody czy pory roku, ${cityLocative} zawsze czeka na Ciebie coś interesującego!</p>
    `;
  }

  return `
    <h2>Lokalny kalendarz wydarzeń i imprez w Polsce</h2>
    <p>MapaImprez to interaktywny portal gromadzący informacje o nadchodzących koncertach, festiwalach, meczach sportowych, spektaklach, piknikach rodzinnych i dożynkach w całym kraju. Naszą misją jest łączenie organizatorów wydarzeń z uczestnikami poszukującymi ciekawego sposobu na spędzenie czasu w swojej okolicy.</p>
    <p>Skorzystaj z filtrów lokalizacji, kategorii oraz czasu, aby spersonalizować swoje wyniki. Zaznacz promień odległości w kilometrach i znajdź bezpłatne oraz biletowane atrakcje w pobliżu Twojego domu. Bądź na bieżąco, ustaw wygodne powiadomienia i nigdy nie przegap interesujących wydarzeń w Twoim mieście!</p>
  `;
}
