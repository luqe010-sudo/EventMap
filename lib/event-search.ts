import { toAppDate } from "./date-format";

export type PublicEventSort = "date" | "nearest";

export type Coordinates = { latitude: number; longitude: number };
export type OptionalCoordinates = { latitude: number | null; longitude: number | null };

export function hasLocationCoordinates<T extends OptionalCoordinates>(
  value: T | null | undefined
): value is T & Coordinates {
  return value != null &&
    typeof value.latitude === "number" && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    typeof value.longitude === "number" && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}

export function distanceBetweenCoordinates(
  origin: OptionalCoordinates | null | undefined,
  destination: OptionalCoordinates | null | undefined
) {
  if (!hasLocationCoordinates(origin) || !hasLocationCoordinates(destination)) return Number.POSITIVE_INFINITY;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const angle = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(origin.latitude)) * Math.cos(toRadians(destination.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  // Rounding near antipodal points must not make sqrt(1-angle) invalid.
  const boundedAngle = Math.min(Math.max(angle, 0), 1);
  return 6371 * 2 * Math.atan2(Math.sqrt(boundedAngle), Math.sqrt(1 - boundedAngle));
}

export function radiusBoundingBox(origin: Coordinates, radiusKm: number) {
  const angularRadius = radiusKm / 6371;
  const latitudeDelta = angularRadius * 180 / Math.PI;
  const minLatitude = Math.max(-90, origin.latitude - latitudeDelta);
  const maxLatitude = Math.min(90, origin.latitude + latitudeDelta);
  if (minLatitude === -90 || maxLatitude === 90) return { minLatitude, maxLatitude };
  const longitudeDelta = Math.asin(Math.sin(angularRadius) / Math.cos(origin.latitude * Math.PI / 180)) * 180 / Math.PI;
  const minLongitude = origin.longitude - longitudeDelta;
  const maxLongitude = origin.longitude + longitudeDelta;
  // A wrapped rectangle needs OR clauses. Leaving longitude unbounded is still a correct prefilter.
  return minLongitude < -180 || maxLongitude > 180
    ? { minLatitude, maxLatitude }
    : { minLatitude, maxLatitude, minLongitude, maxLongitude };
}

type SortableEvent = OptionalCoordinates & { id: string; startDate: string };

export function comparePublicSearchItems(
  first: SortableEvent,
  second: SortableEvent,
  sortBy: PublicEventSort = "date",
  origin?: OptionalCoordinates | null
) {
  if (sortBy === "nearest") {
    const firstDistance = distanceBetweenCoordinates(origin, first);
    const secondDistance = distanceBetweenCoordinates(origin, second);
    if (firstDistance !== secondDistance) return firstDistance < secondDistance ? -1 : 1;
  }
  const firstTime = toAppDate(first.startDate).getTime();
  const secondTime = toAppDate(second.startDate).getTime();
  const dateDelta = firstTime - secondTime;
  if (Number.isFinite(dateDelta) && dateDelta !== 0) return dateDelta;
  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
}
