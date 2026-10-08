import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_EVENTS_MAX_RESULTS, PUBLIC_EVENTS_PAGE_SIZE, searchPublicEvents } from "@/lib/events";
import { publicSearchOptionsFromParams } from "@/lib/public-search-params";
import { PUBLIC_EVENT_NO_STORE_HEADERS } from "@/lib/public-event-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const pageSize = clampInteger(params.get("pageSize"), PUBLIC_EVENTS_PAGE_SIZE, 1, PUBLIC_EVENTS_PAGE_SIZE);
  const page = clampInteger(params.get("page"), 1, 1, Math.ceil(PUBLIC_EVENTS_MAX_RESULTS / pageSize));

  try {
    const result = await searchPublicEvents({
      ...publicSearchOptionsFromParams(params),
      page,
      pageSize,
      maxResults: PUBLIC_EVENTS_MAX_RESULTS,
      featuredOnly: params.get("featured") === "1"
    });

    return NextResponse.json(result, { headers: PUBLIC_EVENT_NO_STORE_HEADERS });
  } catch (error) {
    console.error("[events-search] Failed to search events", error);
    return NextResponse.json(
      { error: "Nie udalo sie pobrac wydarzen." },
      { status: 500, headers: PUBLIC_EVENT_NO_STORE_HEADERS }
    );
  }
}

function clampInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
