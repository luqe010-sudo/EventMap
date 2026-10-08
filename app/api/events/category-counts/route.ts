import { NextResponse, type NextRequest } from "next/server";
import { searchPublicEventCategoryCounts } from "@/lib/events";
import { publicSearchOptionsFromParams } from "@/lib/public-search-params";
import { PUBLIC_EVENT_NO_STORE_HEADERS } from "@/lib/public-event-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  try {
    const categoryCounts = await searchPublicEventCategoryCounts(publicSearchOptionsFromParams(params));

    return NextResponse.json({ categoryCounts }, { headers: PUBLIC_EVENT_NO_STORE_HEADERS });
  } catch (error) {
    console.error("[events-category-counts] Failed to load category counts", error);
    return NextResponse.json(
      { error: "Nie udalo sie policzyc kategorii wydarzen." },
      { status: 500, headers: PUBLIC_EVENT_NO_STORE_HEADERS }
    );
  }
}
