import { NextResponse } from "next/server";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/icon.svg?v=20260622", request.url), 308);
}
