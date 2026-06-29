import { NextResponse, type NextRequest } from "next/server";
import { listPublicEventsByIds } from "@/lib/events";

export const dynamic = "force-dynamic";

type Params = {
  id: string;
};

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;

  try {
    const [event] = await listPublicEventsByIds([id]);
    if (!event) {
      return NextResponse.json({ error: "Nie znaleziono wydarzenia." }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error("[event-detail-api] Failed to load event", error);
    return NextResponse.json(
      { error: "Nie udalo sie pobrac wydarzenia." },
      { status: 500 }
    );
  }
}
