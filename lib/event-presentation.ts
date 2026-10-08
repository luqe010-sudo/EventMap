import type { EventItem } from "./events";
import { formatPolishDate } from "./date-format";

type CardPrice = Pick<EventItem, "price_type" | "price_min" | "price_max" | "currency" | "price">;

export function formatEventCardPrice(event: CardPrice) {
  const priceType = event.price_type?.toLowerCase() ?? "";
  if (priceType === "free" || priceType === "bezplatne" || event.price.toLowerCase().includes("bezplat")) {
    return "Bezpłatne";
  }
  if (priceType === "unknown") return event.price;

  const currency = event.currency?.trim().toUpperCase();
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return event.price;

  const minimum = finitePrice(event.price_min);
  const maximum = finitePrice(event.price_max);
  const amount = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });
  const money = new Intl.NumberFormat("pl-PL", {
    style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2
  });

  if (minimum != null && maximum != null) {
    if (minimum > maximum) return event.price;
    return minimum === maximum ? money.format(minimum) : `${amount.format(minimum)}–${money.format(maximum)}`;
  }
  if (minimum != null) return `od ${money.format(minimum)}`;
  if (maximum != null) return `do ${money.format(maximum)}`;
  return event.price;
}

export function formatEventCardDate(event: Pick<EventItem, "startDate" | "is_all_day">) {
  const date = formatPolishDate(event.startDate, { weekday: "short", day: "numeric", month: "short" });
  const dateLabel = date.charAt(0).toUpperCase() + date.slice(1);
  const time = event.is_all_day ? "Cały dzień" : formatPolishDate(event.startDate, { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel} · ${time}`;
}

export function formatEventCardLocation(event: Pick<EventItem, "city" | "address" | "location">) {
  const city = event.city.trim();
  const venue = event.location?.name?.trim() || event.address.split(",")[0].trim();
  return [city, venue && venue.toLocaleLowerCase("pl-PL") !== city.toLocaleLowerCase("pl-PL") ? venue : ""].filter(Boolean).join(" · ");
}

export function formatEventCardDistance(distanceKm: number) {
  return `${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(distanceKm)} km`;
}

function finitePrice(value: number | null) {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}
