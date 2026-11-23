import { createHash, timingSafeEqual } from "node:crypto";
import {
  getPublicMapCacheSecret,
  PUBLIC_EVENT_NO_STORE_HEADERS,
  revalidatePublicMapMarkerCache
} from "@/lib/public-event-cache";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = PUBLIC_EVENT_NO_STORE_HEADERS;
  const secret = getPublicMapCacheSecret();
  if (!secret) return new Response(null, { status: 404, headers });

  const authorization = request.headers.get("Authorization");
  if (!authorization || !timingSafeEqual(hash(authorization), hash(`Bearer ${secret}`))) {
    return new Response(null, {
      status: 401,
      headers: { ...headers, "WWW-Authenticate": "Bearer" }
    });
  }

  revalidatePublicMapMarkerCache();
  return new Response(null, { status: 204, headers });
}

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}
