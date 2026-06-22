import { NextResponse } from "next/server";
import { getCurrentUserSavedEventIds } from "@/lib/user-account";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getCurrentUserSavedEventIds());
  } catch (error) {
    console.error("[account] Failed to expose saved event state", error);
    return NextResponse.json({
      isLoggedIn: true,
      eventIds: [],
      error: "Nie udało się pobrać zapisanych wydarzeń."
    });
  }
}
