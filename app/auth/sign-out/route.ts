import { redirect } from "next/navigation";
import { createSupabaseUserClient } from "@/lib/supabase-user";

export async function POST() {
  const supabase = await createSupabaseUserClient();
  await supabase.auth.signOut();
  redirect("/");
}
