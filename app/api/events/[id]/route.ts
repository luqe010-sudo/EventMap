import { NextResponse, type NextRequest } from "next/server";
import { listPublicEventsByIds } from "@/lib/events";
import { PUBLIC_EVENT_NO_STORE_HEADERS } from "@/lib/public-event-cache";

export const dynamic = "force-dynamic";

type Params = {
  id: string;
};

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;

  try {
    const [event] = await listPublicEventsByIds([id]);
    if (!event) {
      return NextResponse.json({ error: "Nie znaleziono wydarzenia." }, { status: 404, headers: PUBLIC_EVENT_NO_STORE_HEADERS });
    }

    return NextResponse.json({ event }, { headers: PUBLIC_EVENT_NO_STORE_HEADERS });
  } catch (error) {
    console.error("[event-detail-api] Failed to load event", error);
    return NextResponse.json(
      { error: "Nie udalo sie pobrac wydarzenia." },
      { status: 500, headers: PUBLIC_EVENT_NO_STORE_HEADERS }
    );
  }
}
