import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import EventEditorForm from "@/components/EventEditorForm";
import { adminCreateEventAction, getAdminEventEditorOptions } from "@/lib/admin-events";

export const dynamic = "force-dynamic";

export default async function AdminNewEventPage() {
  const options = await getAdminEventEditorOptions();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Dodaj wydarzenie</h1>
        </div>
        <Link href="/admin/events" className="secondaryButton">Wroc do listy</Link>
      </div>

      <AdminSectionNav active="events" />

      <section className="managementPanel">
        <EventEditorForm
          action={adminCreateEventAction}
          options={options}
          mode="admin"
          submitLabel="Dodaj wydarzenie"
        />
      </section>
    </main>
  );
}
