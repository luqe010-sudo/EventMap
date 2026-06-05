import OrganizerProfileForm from "@/components/OrganizerProfileForm";
import OrganizerSectionNav from "@/components/OrganizerSectionNav";
import {
  getOrganizerProfileData,
  organizerUpdateProfileAction
} from "@/lib/organizer-events";

export const dynamic = "force-dynamic";

export default async function OrganizerProfilePage() {
  const data = await getOrganizerProfileData();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Profil organizatora</h1>
        </div>
      </div>

      <OrganizerSectionNav active="profile" />

      {data.organizers.length ? (
        <div className="organizerProfileStack">
          {data.organizers.map((organizer) => (
            <section key={organizer.id} className="managementPanel">
              <div className="managementPanelHeader">
                <h2>{organizer.name}</h2>
                {organizer.is_verified ? <span className="successPill">Zweryfikowany</span> : <span className="warningPill">Niezweryfikowany</span>}
              </div>
              <OrganizerProfileForm
                organizer={organizer}
                action={organizerUpdateProfileAction.bind(null, organizer.id)}
              />
            </section>
          ))}
        </div>
      ) : (
        <section className="managementPanel">
          <p className="panelMutedText">Brak profilu organizatora przypisanego do konta.</p>
        </section>
      )}
    </main>
  );
}
