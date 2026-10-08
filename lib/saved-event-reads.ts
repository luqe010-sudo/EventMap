import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";

export type SavedEventRow = Database["public"]["Functions"]["get_my_saved_events"]["Returns"][number];
const PAGE_SIZE = 500;
const MAX_SAVED_ROWS = 200_000;

/** Read every own-user RPC row even when PostgREST caps pages below PAGE_SIZE. */
export async function readCompleteSavedEvents(
  supabase: Pick<SupabaseClient<Database>, "rpc">,
  maximumRows = MAX_SAVED_ROWS
): Promise<SavedEventRow[]> {
  const rows: SavedEventRow[] = [];
  const seen = new Set<string>();
  let expected: number | null = null;
  do {
    const result = await supabase.rpc("get_my_saved_events", {}, { count: "exact" })
      .order("created_at", { ascending: false }).order("event_id", { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1);
    if (result.error || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error("Nie udało się potwierdzić liczby zapisanych wydarzeń.");
    }
    expected ??= result.count;
    if (result.count !== expected || expected > maximumRows) {
      throw new Error("Lista zapisanych wydarzeń zmieniła się lub przekracza limit odczytu.");
    }
    const page = result.data ?? [];
    if (!page.length && rows.length < expected) throw new Error("Nie udało się pobrać pełnej listy zapisanych wydarzeń.");
    for (const row of page) {
      if (!row.event_id || seen.has(row.event_id)) throw new Error("Nie udało się pobrać spójnej listy zapisanych wydarzeń.");
      seen.add(row.event_id);
      rows.push(row);
    }
    if (rows.length > expected) throw new Error("Nie udało się potwierdzić kompletności zapisanych wydarzeń.");
  } while (rows.length < expected);

  const final = await supabase.rpc("get_my_saved_events", {}, { count: "exact", head: true }).range(0, 0);
  if (final.error || final.count !== expected) throw new Error("Lista zapisanych wydarzeń zmieniła się podczas odczytu.");
  return rows;
}
