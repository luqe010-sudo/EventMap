import { createSupabaseServerClient } from "@/lib/supabase";
import { ANALYTICS_BODY_LIMIT, parseAnalyticsBody, type EventAnalyticsBody } from "@/lib/event-analytics-contract";

export async function readAnalyticsRequest(request: Request): Promise<
  { body: EventAnalyticsBody; status?: never } | { status: 400 | 413 | 415; body?: never }
> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return { status: 415 };
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > ANALYTICS_BODY_LIMIT)) return { status: 413 };
  if (!request.body) return { status: 400 };
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > ANALYTICS_BODY_LIMIT) { await reader.cancel(); return { status: 413 }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = parseAnalyticsBody(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    return body ? { body } : { status: 400 };
  } catch { return { status: 400 }; }
  finally { reader.releaseLock(); }
}

export function isSameOriginAnalyticsRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const origin = request.headers.get("origin");
    const url = new URL(request.url);
    const host = request.headers.get("host");
    // Next start can construct request.url from its bind hostname instead of
    // the hostname in the browser URL. Host identifies that actual destination.
    const destination = host ? new URL(`${url.protocol}//${host}`) : url;
    if (destination.username || destination.password || (host &&
        (destination.pathname !== "/" || destination.search || destination.hash))) return false;
    return origin !== null && new URL(origin).origin === origin && origin === destination.origin;
  } catch { return false; }
}

export async function recordPublicEventAnalytics(eventId: string, body: EventAnalyticsBody): Promise<"recorded" | "not-public"> {
  // Public client without Auth cookies: measurement is never linked to an account.
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("events").select("id")
    .eq("id", eventId).eq("status", "published").eq("visibility", "public")
    .or("is_cancelled.is.null,is_cancelled.eq.false").maybeSingle();
  if (error) throw new Error("Nie udało się sprawdzić dostępności wydarzenia.");
  if (!data) return "not-public";
  const { error: insertError } = await supabase.from("event_analytics").insert({
    event_id: eventId, event_type: body.eventType, session_id: body.sessionId, user_id: null
  });
  if (insertError) throw new Error("Nie udało się zapisać statystyk wydarzenia.");
  return "recorded";
}
