import Link from "next/link";
import EventEditorForm from "@/components/EventEditorForm";
import OrganizerSectionNav from "@/components/OrganizerSectionNav";
import {
  getOrganizerEventEditorOptions,
  organizerCreateEventAction
} from "@/lib/organizer-events";

export const dynamic = "force-dynamic";

export default async function OrganizerNewEventPage() {
  const options = await getOrganizerEventEditorOptions();

  if (!options.hasOrganizer) {
    return (
      <main className="appShell managementShell">
        <div className="emptyState">
          <h1>Brakuje organizatora</h1>
          <p>Nie mozesz dodac wydarzenia, dopoki konto nie jest polaczone z organizatorem.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Dodaj wydarzenie</h1>
        </div>
        <Link href="/organizer/events" className="secondaryButton">Wroc</Link>
      </div>

      <OrganizerSectionNav active="events" />

      <section className="managementPanel">
        <EventEditorForm
          action={organizerCreateEventAction}
          options={options}
          mode="organizer"
          submitLabel="Wyslij do akceptacji"
        />
      </section>
    </main>
  );
}
