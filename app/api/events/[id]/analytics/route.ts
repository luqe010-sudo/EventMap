import { NextResponse } from "next/server";
import { analyticsClientKey, analyticsIngestionGuard } from "@/lib/analytics-ingestion-guard";
import { isAnalyticsUuid } from "@/lib/event-analytics-contract";
import { isSameOriginAnalyticsRequest, readAnalyticsRequest, recordPublicEventAnalytics } from "@/lib/event-analytics";
import { PUBLIC_EVENT_NO_STORE_HEADERS } from "@/lib/public-event-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const respond = (body: object, status = 200) => NextResponse.json(body, {
    status,
    headers: { ...PUBLIC_EVENT_NO_STORE_HEADERS, ...(status === 429 ? { "Retry-After": "60" } : {}) }
  });
  const { id } = await params;
  if (!isAnalyticsUuid(id)) return respond({ error: "Nieprawidłowy identyfikator wydarzenia." }, 400);
  if (!isSameOriginAnalyticsRequest(request)) return respond({ error: "Niedozwolone źródło żądania." }, 403);
  if (!analyticsIngestionGuard.consume(analyticsClientKey(request))) return respond({ error: "Zbyt wiele żądań." }, 429);
  const input = await readAnalyticsRequest(request);
  if (input.status) return respond({ error: "Nieprawidłowe żądanie analityki." }, input.status);
  const reservation = analyticsIngestionGuard.reserve(id, input.body.sessionId, input.body.eventType);
  if (reservation.kind === "duplicate") return respond({ ok: true, ignored: true });
  if (reservation.kind === "full") return respond({ error: "Zbyt wiele żądań." }, 429);
  try {
    const result = await recordPublicEventAnalytics(id.toLowerCase(), input.body);
    if (result === "not-public") {
      reservation.release();
      return respond({ error: "Wydarzenie jest niedostępne." }, 404);
    }
    reservation.settle();
    return respond({ ok: true });
  } catch {
    // Keep the short reservation: a lost response may follow a successful INSERT.
    reservation.settle();
    console.error("[analytics] Failed to record public event interaction");
    return respond({ error: "Nie udało się zapisać statystyk." }, 503);
  }
}
