import { normalizeSearchText } from "@/lib/slugify";

const SETTLEMENT_TYPES = new Set(["city", "town", "village", "hamlet"]);

export function isPhotonSettlement(properties: { osm_key?: string; osm_value?: string }) {
  return properties.osm_key === "place" && SETTLEMENT_TYPES.has(properties.osm_value ?? "");
}

/** Keeps the first spelling, so "Kraków" wins over a later "Krakow". */
export function uniqueSuggestionsByLabel<T extends { label: string }>(locations: T[]) {
  const seen = new Set<string>();
  return locations.filter((location) => {
    const key = normalizeSearchText(location.label).trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
