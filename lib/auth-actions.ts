"use server";

import { redirect } from "next/navigation";
import { createSupabaseUserClient } from "@/lib/supabase-user";

export async function signInAction(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    throw new Error("Email i haslo sa wymagane.");
  }

  const supabase = await createSupabaseUserClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw new Error(`Nie udalo sie zalogowac: ${error.message}`);
  redirect("/");
}
