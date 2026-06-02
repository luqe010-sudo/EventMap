const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

export const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function normalizeSupabaseUrl(value: string | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}
