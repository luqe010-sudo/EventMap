import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import LocationEditorForm from "@/components/LocationEditorForm";
import { adminCreateLocationAction } from "@/lib/admin-locations";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminNewLocationPage() {
  await requireAdmin();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Dodaj lokalizacje</h1>
        </div>
        <Link href="/admin/locations" className="secondaryButton">Wroc do listy</Link>
      </div>

      <AdminSectionNav active="locations" />

      <section className="managementPanel">
        <LocationEditorForm
          action={adminCreateLocationAction}
          submitLabel="Dodaj lokalizacje"
        />
      </section>
    </main>
  );
}
