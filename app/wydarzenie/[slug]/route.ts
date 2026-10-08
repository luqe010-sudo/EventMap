import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { eventPath } from "@/lib/slugs";
import { PUBLIC_EVENT_NO_STORE_HEADERS } from "@/lib/public-event-cache";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        ...PUBLIC_EVENT_NO_STORE_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }

  return NextResponse.redirect(new URL(eventPath(event), request.url), {
    status: 308,
    headers: PUBLIC_EVENT_NO_STORE_HEADERS
  });
}
