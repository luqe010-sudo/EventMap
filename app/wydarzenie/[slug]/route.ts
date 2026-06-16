import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { eventPath } from "@/lib/slugs";

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
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }

  return NextResponse.redirect(new URL(eventPath(event), request.url), 308);
}
