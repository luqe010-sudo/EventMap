import { NextResponse } from "next/server";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import type { Database } from "@/database.types";

type Params = { id: string };
type EventAnalyticsInsert = Database["public"]["Tables"]["event_analytics"]["Insert"];

const allowedEventTypes = new Set([
  "view",
  "phone_click",
  "website_click",
  "ticket_click",
  "map_click",
  "share_click",
  "save_click"
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;
  const body = await readAnalyticsBody(request);
  if (!body || !allowedEventTypes.has(body.eventType)) {
    return NextResponse.json({ error: "Nieprawidlowy typ zdarzenia." }, { status: 400 });
  }

  const supabase = await createSupabaseUserClient();
  const { data: authData } = await supabase.auth.getUser();
  const payload: EventAnalyticsInsert = {
    event_id: id,
    event_type: body.eventType,
    session_id: body.sessionId ?? null,
    user_id: authData.user?.id ?? null
  };

  const { error } = await supabase.from("event_analytics").insert(payload);
  if (error) {
    console.error("[analytics] Failed to record event analytics", error);
    return NextResponse.json({ error: "Nie udalo sie zapisac zdarzenia." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function readAnalyticsBody(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return null;
    const eventType = "eventType" in body ? body.eventType : null;
    const sessionId = "sessionId" in body ? body.sessionId : null;
    if (typeof eventType !== "string") return null;
    return {
      eventType,
      sessionId: typeof sessionId === "string" ? sessionId.slice(0, 160) : null
    };
  } catch {
    return null;
  }
}
