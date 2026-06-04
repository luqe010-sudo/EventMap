import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSectionNav from "@/components/AdminSectionNav";
import CityPageEditorForm from "@/components/CityPageEditorForm";
import {
  adminUpdateCityPageAction,
  getAdminCityPageForEdit
} from "@/lib/admin-city-pages";

type Params = { id: string };

export const dynamic = "force-dynamic";

export default async function AdminEditCityPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const cityPage = await getAdminCityPageForEdit(id);
  if (!cityPage) notFound();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Edytuj miasto SEO</h1>
        </div>
        <Link href="/admin/cities" className="secondaryButton">Wroc do listy</Link>
      </div>

      <AdminSectionNav active="cities" />

      <section className="managementPanel">
        <CityPageEditorForm
          action={adminUpdateCityPageAction.bind(null, cityPage.id)}
          cityPage={cityPage}
          submitLabel="Zapisz miasto"
        />
      </section>
    </main>
  );
}
