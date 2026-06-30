export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  return botProbeNotFound();
}

export function POST() {
  return botProbeNotFound();
}

function botProbeNotFound() {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
