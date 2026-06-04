import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSectionNav from "@/components/AdminSectionNav";
import LocationEditorForm from "@/components/LocationEditorForm";
import {
  adminUpdateLocationAction,
  getAdminLocationForEdit
} from "@/lib/admin-locations";

type Params = { id: string };

export const dynamic = "force-dynamic";

export default async function AdminEditLocationPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const location = await getAdminLocationForEdit(id);
  if (!location) notFound();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Edytuj lokalizacje</h1>
        </div>
        <Link href="/admin/locations" className="secondaryButton">Wroc do listy</Link>
      </div>

      <AdminSectionNav active="locations" />

      <section className="managementPanel">
        <LocationEditorForm
          action={adminUpdateLocationAction.bind(null, location.id)}
          location={location}
          submitLabel="Zapisz lokalizacje"
        />
      </section>
    </main>
  );
}
