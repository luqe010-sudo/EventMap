"use server";

import { redirect } from "next/navigation";
import { createSupabaseUserClient } from "@/lib/supabase-user";
import { createSlug } from "@/lib/event-editor";

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

export async function signUpAction(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");
  const displayName = formData.get("displayName");
  const role = formData.get("role");
  const organizerName = formData.get("organizerName");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string" ||
    typeof displayName !== "string" ||
    typeof role !== "string"
  ) {
    throw new Error("Wszystkie pola sa wymagane.");
  }

  if (password !== confirmPassword) {
    throw new Error("Hasla nie sa identyczne.");
  }

  if (password.length < 6) {
    throw new Error("Haslo musi miec co najmniej 6 znakow.");
  }

  const supabase = await createSupabaseUserClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError || !signUpData.user) {
    throw new Error(`Rejestracja nie powiodla sie: ${signUpError?.message}`);
  }

  // Ensure current server action client session is updated so RLS works
  if (signUpData.session) {
    await supabase.auth.setSession({
      access_token: signUpData.session.access_token,
      refresh_token: signUpData.session.refresh_token
    });
  }

  const authUser = signUpData.user;

  // Safe insert/update profile: triggers might create profiles automatically in some Supabase projects
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authUser.id,
        display_name: displayName,
        role: role
      });
    if (profileError) throw new Error(`Nie udalo sie utworzyc profilu uzytkownika: ${profileError.message}`);
  } else {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        role: role
      })
      .eq("id", authUser.id);
    if (updateError) throw new Error(`Nie udalo sie zaktualizowac profilu uzytkownika: ${updateError.message}`);
  }

  // Create organizer if they selected "organizer" role
  if (role === "organizer") {
    const orgName = (typeof organizerName === "string" && organizerName.trim()) || displayName;
    const orgSlug = createSlug(orgName);

    const { data: orgData, error: orgError } = await supabase
      .from("organizers")
      .insert({
        name: orgName,
        slug: orgSlug,
        email: email,
        is_verified: false
      })
      .select("id")
      .single();

    if (orgError) {
      throw new Error(`Nie udalo sie utworzyc profilu organizatora: ${orgError.message}`);
    }

    const { error: memberError } = await supabase
      .from("organizer_users")
      .insert({
        organizer_id: orgData.id,
        user_id: authUser.id,
        role: "owner"
      });

    if (memberError) {
      throw new Error(`Nie udalo sie powiazac uzytkownika z organizatorem: ${memberError.message}`);
    }
  }

  redirect("/login?signup=success");
}
