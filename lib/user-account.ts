import { redirect, unstable_rethrow } from "next/navigation";
import type { Database } from "@/database.types";
import { listPublicEventsByIds, type EventItem } from "@/lib/events";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { readCompleteSavedEvents, type SavedEventRow } from "@/lib/saved-event-reads";

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

  const [{ data: profile, error: profileError }, savedResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, role, created_at")
      .eq("id", authData.user.id)
      .maybeSingle(),
    readCompleteSavedEvents(supabase).then(
      rows => ({ rows, error: null }),
      (error: unknown) => ({ rows: [] as SavedEventRow[], error })
    )
  ]);

  if (profileError) throw new Error(`Nie udalo sie pobrac profilu: ${profileError.message}`);
  if (savedResult.error) {
    console.error("[account] Failed to load saved_events", savedResult.error);
    return {
      email: authData.user.email ?? "",
      profile,
      savedEvents: [],
      savedEventsError: "Nie udało się pobrać zapisanych wydarzeń. Odśwież stronę i spróbuj ponownie."
    };
  }

  const savedIds = savedResult.rows.map((row) => row.event_id);
  let publicEvents: EventItem[];
  try {
    publicEvents = await listPublicEventsByIds(savedIds);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[account] Could not load the public events in the saved list");
    return {
      email: authData.user.email ?? "",
      profile,
      savedEvents: [],
      savedEventsError: "Nie udało się pobrać zapisanych wydarzeń. Odśwież stronę i spróbuj ponownie."
    };
  }
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

    const { data, error } = await supabase.rpc("get_my_saved_events", { p_event_id: eventId });

    if (error) {
      console.error("[account] Failed to load event save state", error);
      return { isLoggedIn: true, isSaved: false };
    }
    return { isLoggedIn: true, isSaved: Boolean(data?.length) };
  } catch (error) {
    console.error("[account] Failed to create save context", error);
    return { isLoggedIn: false, isSaved: false };
  }
}

export async function getCurrentUserSavedEventIds() {
  const supabase = await createSupabaseUserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { isLoggedIn: false, eventIds: [] as string[] };

  const rows = await readCompleteSavedEvents(supabase);

  return {
    isLoggedIn: true,
    eventIds: rows.map((row) => row.event_id)
  };
}
