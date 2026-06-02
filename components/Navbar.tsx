import { unstable_rethrow } from "next/navigation";
import NavbarClient from "@/components/NavbarClient";
import { createSupabaseUserClient, hasSupabaseUserConfig } from "@/lib/supabase-user";

export default async function Navbar() {
  if (!hasSupabaseUserConfig()) {
    return <NavbarClient auth={{ isLoggedIn: false }} />;
  }

  try {
    const supabase = await createSupabaseUserClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return <NavbarClient auth={{ isLoggedIn: false }} />;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name, role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[navbar] Failed to load profile", profileError);
    }

    return (
      <NavbarClient
        auth={{
          isLoggedIn: true,
          displayName: profile?.display_name ?? data.user.email ?? "Konto",
          role: profile?.role ?? "user"
        }}
      />
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("[navbar] Failed to load auth state", error);
    return <NavbarClient auth={{ isLoggedIn: false }} />;
  }
}
