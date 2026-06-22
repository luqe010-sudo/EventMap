import { NextResponse } from "next/server";

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/icon.svg?v=20260622", request.url), 308);
  response.headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  return response;
}
