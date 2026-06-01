import Link from "next/link";
import { notFound } from "next/navigation";
import EventEditorForm from "@/components/EventEditorForm";
import {
  getOrganizerEventEditorOptions,
  getOrganizerEventForEdit,
  organizerUpdateEventAction
} from "@/lib/organizer-events";

type Params = { id: string };

export const dynamic = "force-dynamic";

export default async function OrganizerEditEventPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [event, options] = await Promise.all([
    getOrganizerEventForEdit(id),
    getOrganizerEventEditorOptions()
  ]);

  if (!event) notFound();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Edytuj wydarzenie</h1>
        </div>
        <Link href="/organizer" className="secondaryButton">Wroc</Link>
      </div>

      <section className="managementPanel">
        <EventEditorForm
          action={organizerUpdateEventAction.bind(null, event.id)}
          event={event}
          options={options}
          mode="organizer"
          submitLabel="Zapisz i wyslij do akceptacji"
        />
      </section>
    </main>
  );
}
