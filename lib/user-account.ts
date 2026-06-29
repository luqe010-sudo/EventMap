import { redirect } from "next/navigation";
import type { Database } from "@/database.types";
import { listPublicEventsByIds, type EventItem } from "@/lib/events";
import { createSupabaseUserClient } from "@/lib/supabase-user";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type UserAccountData = {
  email: string;
  profile: Profile | null;
  savedEvents: EventItem[];
  savedEventsError: string | null;
};

export async function getUserAccountData(): Promise<UserAccountData> {
  const supabase = await createSupabaseUserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/login?next=/account");

  const [{ data: profile, error: profileError }, { data: savedRows, error: savedError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, role, created_at")
      .eq("id", authData.user.id)
      .maybeSingle(),
    supabase
      .from("saved_events")
      .select("event_id, created_at")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false })
  ]);

  if (profileError) throw new Error(`Nie udalo sie pobrac profilu: ${profileError.message}`);
  if (savedError) {
    console.error("[account] Failed to load saved_events", savedError);
    return {
      email: authData.user.email ?? "",
      profile,
      savedEvents: [],
      savedEventsError: "Nie udało się pobrać zapisanych wydarzeń. Sprawdź polityki RLS dla saved_events."
    };
  }

  const savedIds = (savedRows ?? []).map((row) => row.event_id);
  const publicEvents = await listPublicEventsByIds(savedIds);
  const eventsById = new Map(publicEvents.map((event) => [event.id, event]));

  return {
    email: authData.user.email ?? "",
    profile,
    savedEvents: savedIds.flatMap((eventId) => {
      const event = eventsById.get(eventId);
      return event ? [event] : [];
    }),
    savedEventsError: null
  };
}

export async function getEventSaveState(eventId: string) {
  try {
    const supabase = await createSupabaseUserClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { isLoggedIn: false, isSaved: false };

    const { data, error } = await supabase
      .from("saved_events")
      .select("event_id")
      .eq("user_id", authData.user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (error) {
      console.error("[account] Failed to load event save state", error);
      return { isLoggedIn: true, isSaved: false };
    }
    return { isLoggedIn: true, isSaved: Boolean(data) };
  } catch (error) {
    console.error("[account] Failed to create save context", error);
    return { isLoggedIn: false, isSaved: false };
  }
}

export async function getCurrentUserSavedEventIds() {
  const supabase = await createSupabaseUserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { isLoggedIn: false, eventIds: [] as string[] };

  const { data, error } = await supabase
    .from("saved_events")
    .select("event_id")
    .eq("user_id", authData.user.id);
  if (error) throw new Error(`Nie udalo sie pobrac zapisanych wydarzen: ${error.message}`);

  return {
    isLoggedIn: true,
    eventIds: (data ?? []).map((row) => row.event_id)
  };
}
