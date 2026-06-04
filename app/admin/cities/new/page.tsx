import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import CityPageEditorForm from "@/components/CityPageEditorForm";
import { adminCreateCityPageAction } from "@/lib/admin-city-pages";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminNewCityPage() {
  await requireAdmin();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Dodaj miasto SEO</h1>
        </div>
        <Link href="/admin/cities" className="secondaryButton">Wroc do listy</Link>
      </div>

      <AdminSectionNav active="cities" />

      <section className="managementPanel">
        <CityPageEditorForm
          action={adminCreateCityPageAction}
          submitLabel="Dodaj miasto"
        />
      </section>
    </main>
  );
}
