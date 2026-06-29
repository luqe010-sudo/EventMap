import { NextResponse, type NextRequest } from "next/server";
import { searchPublicEventCategoryCounts } from "@/lib/events";
import { parsePublicFilterParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const filters = parsePublicFilterParams(Object.fromEntries(params.entries()));
  const radiusKm = filters.radiusKm ?? clampInteger(params.get("radius"), 30, 5, 200);
  const lat = parseCoordinate(params.get("lat"));
  const lng = parseCoordinate(params.get("lng"));

  try {
    const categoryCounts = await searchPublicEventCategoryCounts({
      dateFilter: filters.dateFilter ?? "all",
      customDate: filters.customDate,
      categorySlug: normalizeSlug(params.get("categorySlug")),
      citySlug: normalizeSlug(params.get("citySlug")),
      location: lat != null && lng != null ? { latitude: lat, longitude: lng } : undefined,
      radiusKm: lat != null && lng != null ? radiusKm : null,
      priceMode: filters.priceMode ?? "all",
      maxPrice: filters.maxPrice
    });

    return NextResponse.json({ categoryCounts });
  } catch (error) {
    console.error("[events-category-counts] Failed to load category counts", error);
    return NextResponse.json(
      { error: "Nie udalo sie policzyc kategorii wydarzen." },
      { status: 500 }
    );
  }
}

function normalizeSlug(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function parseCoordinate(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clampInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
