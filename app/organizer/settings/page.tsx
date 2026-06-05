import OrganizerSectionNav from "@/components/OrganizerSectionNav";
import {
  OrganizerSettingsForm,
  OrganizerUpgradeForm
} from "@/components/OrganizerAccountForms";
import { getOrganizerSettingsData } from "@/lib/organizer-events";

export const dynamic = "force-dynamic";

export default async function OrganizerSettingsPage() {
  const data = await getOrganizerSettingsData();
  const isOrganizer = data.profile?.role === "organizer";

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Ustawienia</h1>
        </div>
      </div>

      {isOrganizer ? <OrganizerSectionNav active="settings" /> : null}

      {isOrganizer ? (
        <OrganizerSettingsForm context={data} memberships={data.memberships} />
      ) : (
        <OrganizerUpgradeForm displayName={data.profile?.display_name} />
      )}
    </main>
  );
}
