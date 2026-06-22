import Link from "next/link";
import { redirect } from "next/navigation";
import SavedEventsPanel from "@/components/SavedEventsPanel";
import UserProfileForm from "@/components/UserProfileForm";
import { getUserAccountData } from "@/lib/user-account";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const data = await getUserAccountData();
  if (data.profile?.role === "organizer") redirect("/organizer");
  const roleLabel = data.profile?.role === "organizer"
    ? "Organizator"
    : data.profile?.role === "admin"
      ? "Administrator"
      : "Widz";

  return (
    <main className="appShell managementShell accountShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel użytkownika</p>
          <h1>Moje konto</h1>
        </div>
      </div>

      <nav className="adminSectionNav" aria-label="Nawigacja panelu użytkownika">
        <div className="adminSectionTabs">
          <Link href="#profile" className="adminSectionTab">Profil</Link>
          <Link href="#saved-events" className="adminSectionTab">Zapisane wydarzenia</Link>
        </div>
      </nav>

      <div className="accountOverviewGrid">
        <section className="managementPanel" id="profile">
          <div className="managementPanelHeader">
            <div>
              <p className="eyebrow">Profil</p>
              <h2>Nazwa użytkownika</h2>
            </div>
          </div>
          <UserProfileForm displayName={data.profile?.display_name ?? ""} />
        </section>

        <section className="managementPanel accountSummaryPanel">
          <div className="managementPanelHeader"><h2>Informacje o koncie</h2></div>
          <dl className="accountDetails">
            <div><dt>Email</dt><dd>{data.email || "Brak adresu email"}</dd></div>
            <div><dt>Typ konta</dt><dd>{roleLabel}</dd></div>
            <div><dt>Zapisane wydarzenia</dt><dd>{data.savedEvents.length}</dd></div>
          </dl>
        </section>
      </div>

      <SavedEventsPanel events={data.savedEvents} error={data.savedEventsError} />
    </main>
  );
}
