import Link from "next/link";
import { notFound } from "next/navigation";
import EventEditorForm from "@/components/EventEditorForm";
import {
  adminUpdateEventAction,
  getAdminEventEditorOptions,
  getAdminEventForEdit
} from "@/lib/admin-events";

type Params = { id: string };

export const dynamic = "force-dynamic";

export default async function AdminEditEventPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [event, options] = await Promise.all([
    getAdminEventForEdit(id),
    getAdminEventEditorOptions()
  ]);

  if (!event) notFound();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Edytuj wydarzenie</h1>
        </div>
        <Link href="/admin/events" className="secondaryButton">Wroc do listy</Link>
      </div>

      <section className="managementPanel">
        <EventEditorForm
          action={adminUpdateEventAction.bind(null, event.id)}
          event={event}
          options={options}
          mode="admin"
          submitLabel="Zapisz wydarzenie"
        />
      </section>
    </main>
  );
}
