import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_EVENT_MARKER_LIMIT, searchPublicEventMarkers } from "@/lib/events";
import { publicSearchOptionsFromParams } from "@/lib/public-search-params";
import { PUBLIC_EVENT_NO_STORE_HEADERS } from "@/lib/public-event-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  try {
    const markers = await searchPublicEventMarkers({
      ...publicSearchOptionsFromParams(params),
      maxResults: PUBLIC_EVENT_MARKER_LIMIT
    });

    return NextResponse.json({ markers }, { headers: PUBLIC_EVENT_NO_STORE_HEADERS });
  } catch (error) {
    console.error("[events-markers] Failed to load event markers", error);
    return NextResponse.json(
      { error: "Nie udalo sie pobrac pinezek wydarzen." },
      { status: 500, headers: PUBLIC_EVENT_NO_STORE_HEADERS }
    );
  }
}
