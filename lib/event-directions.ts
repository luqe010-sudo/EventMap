import type { EventItem } from "./events";
import { hasLocationCoordinates } from "./event-search";

type DirectionsEvent = Pick<EventItem, "address" | "city" | "location" | "latitude" | "longitude">;

export function getEventDirectionsUrl(event: DirectionsEvent) {
  const sourceUrl = event.location?.google_maps_url?.trim();
  if (sourceUrl) return sourceUrl;
  if (hasLocationCoordinates(event)) {
    return `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`;
  }

  const address = meaningfulPlaceText(event.address);
  const city = meaningfulPlaceText(event.city);
  const parts = [address];
  if (city && !address.toLocaleLowerCase("pl-PL").endsWith(city.toLocaleLowerCase("pl-PL"))) parts.push(city);
  const query = parts.filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

function meaningfulPlaceText(value: string) {
  const text = value.trim();
  return !text || /^(?:polska|brak\b.*|(?:lokalizacja|adres|miejsce)\s+(?:nieznan[aye]|niepodan[aye]))$/i.test(text)
    ? "" : text;
}
