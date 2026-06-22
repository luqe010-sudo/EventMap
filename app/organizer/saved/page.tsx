import { redirect } from "next/navigation";
import OrganizerSectionNav from "@/components/OrganizerSectionNav";
import SavedEventsPanel from "@/components/SavedEventsPanel";
import { getUserAccountData } from "@/lib/user-account";

export const dynamic = "force-dynamic";

export default async function OrganizerSavedEventsPage() {
  const data = await getUserAccountData();
  if (data.profile?.role !== "organizer") redirect("/account");

  return (
    <main className="appShell managementShell accountShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Zapisane wydarzenia</h1>
        </div>
      </div>

      <OrganizerSectionNav active="saved" />
      <SavedEventsPanel events={data.savedEvents} error={data.savedEventsError} />
    </main>
  );
}
