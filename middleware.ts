import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase-config";

export async function middleware(request: NextRequest) {
  if (!supabaseUrl || !supabasePublishableKey) return NextResponse.next();

  const outgoingCookies: Parameters<SetAllCookies>[0] = [];
  const responseHeaders = new Headers();
  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        outgoingCookies.push(...cookiesToSet);
        for (const [name, value] of Object.entries(headers)) responseHeaders.set(name, value);
      }
    }
  });

  try {
    await supabase.auth.getClaims();
  } catch {
    console.error("[organizer] Failed to refresh the session");
  }

  const response = NextResponse.next({
    request: outgoingCookies.length ? { headers: request.headers } : undefined,
    headers: responseHeaders
  });
  for (const { name, value, options } of outgoingCookies) response.cookies.set(name, value, options);
  return response;
}

export const config = { matcher: "/organizer/:path*" };
