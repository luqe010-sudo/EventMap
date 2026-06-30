import { NextResponse } from "next/server";
import { createSupabaseUserClient, hasSupabaseUserConfig } from "@/lib/supabase-user";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0"
};

export async function GET() {
  if (!hasSupabaseUserConfig()) {
    return NextResponse.json({ isLoggedIn: false }, { headers: PRIVATE_CACHE_HEADERS });
  }

  try {
    const supabase = await createSupabaseUserClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return NextResponse.json({ isLoggedIn: false }, { headers: PRIVATE_CACHE_HEADERS });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name, role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[navbar] Failed to load profile", profileError);
    }

    return NextResponse.json(
      {
        isLoggedIn: true,
        displayName: profile?.display_name ?? data.user.email ?? "Konto",
        email: data.user.email ?? "",
        role: profile?.role ?? "user"
      },
      { headers: PRIVATE_CACHE_HEADERS }
    );
  } catch (error) {
    console.error("[navbar] Failed to load auth state", error);
    return NextResponse.json({ isLoggedIn: false }, { headers: PRIVATE_CACHE_HEADERS });
  }
}
