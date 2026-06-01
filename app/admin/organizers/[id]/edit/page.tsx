import Link from "next/link";
import { notFound } from "next/navigation";
import OrganizerEditorForm from "@/components/OrganizerEditorForm";
import {
  adminUpdateOrganizerAction,
  getAdminOrganizerForEdit
} from "@/lib/admin-organizers";

type Params = { id: string };

export const dynamic = "force-dynamic";

export default async function AdminEditOrganizerPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const organizer = await getAdminOrganizerForEdit(id);
  if (!organizer) notFound();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Edytuj organizatora</h1>
        </div>
        <Link href="/admin/organizers" className="secondaryButton">Wroc do listy</Link>
      </div>

      <section className="managementPanel">
        <OrganizerEditorForm
          action={adminUpdateOrganizerAction.bind(null, organizer.id)}
          organizer={organizer}
          submitLabel="Zapisz organizatora"
        />
      </section>
    </main>
  );
}
