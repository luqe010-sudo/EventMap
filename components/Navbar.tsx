import NavbarClient from "@/components/NavbarClient";
import { createSupabaseUserClient, hasSupabaseUserConfig } from "@/lib/supabase-user";

export default async function Navbar() {
  if (!hasSupabaseUserConfig()) {
    return <NavbarClient auth={{ isLoggedIn: false }} />;
  }

  const supabase = await createSupabaseUserClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return <NavbarClient auth={{ isLoggedIn: false }} />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", data.user.id)
    .maybeSingle();

  return (
    <NavbarClient
      auth={{
        isLoggedIn: true,
        displayName: profile?.display_name ?? data.user.email ?? "Konto",
        role: profile?.role ?? "user"
      }}
    />
  );
}
