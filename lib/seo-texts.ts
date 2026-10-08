import { toPluralCategoryName, formatInCity } from "./slugs";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]!);
}

export function generateSeoText(category: string | undefined, city: string | undefined): string {
  const categoryName = category ? escapeHtml(toPluralCategoryName(category)) : "Wydarzenia";
  const area = city ? escapeHtml(formatInCity(city)) : "w Polsce";
  return `
    <h2>${categoryName} ${area}</h2>
    <p>Przeglądaj dostępne wydarzenia według miejscowości, kategorii, daty i ceny. Liczba propozycji zależy od lokalnej oferty i może różnić się między miejscowościami.</p>
    <p>Sprawdź szczegóły, miejsce i źródło wybranego wydarzenia. Przed wyjazdem potwierdź aktualne informacje u organizatora.</p>
  `;
}
