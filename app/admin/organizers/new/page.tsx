import Link from "next/link";
import OrganizerEditorForm from "@/components/OrganizerEditorForm";
import { adminCreateOrganizerAction } from "@/lib/admin-organizers";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminNewOrganizerPage() {
  await requireAdmin();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Dodaj organizatora</h1>
        </div>
        <Link href="/admin/organizers" className="secondaryButton">Wroc do listy</Link>
      </div>

      <section className="managementPanel">
        <OrganizerEditorForm
          action={adminCreateOrganizerAction}
          submitLabel="Dodaj organizatora"
        />
      </section>
    </main>
  );
}
