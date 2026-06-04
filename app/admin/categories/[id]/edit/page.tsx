import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSectionNav from "@/components/AdminSectionNav";
import CategoryEditorForm from "@/components/CategoryEditorForm";
import {
  adminUpdateCategoryAction,
  getAdminCategoryForEdit
} from "@/lib/admin-categories";

type Params = { id: string };

export const dynamic = "force-dynamic";

export default async function AdminEditCategoryPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const category = await getAdminCategoryForEdit(id);
  if (!category) notFound();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Edytuj kategorię</h1>
        </div>
        <Link href="/admin/categories" className="secondaryButton">Wróć do listy</Link>
      </div>

      <AdminSectionNav active="categories" />

      <section className="managementPanel">
        <CategoryEditorForm
          action={adminUpdateCategoryAction.bind(null, category.id)}
          category={category}
          submitLabel="Zapisz kategorię"
        />
      </section>
    </main>
  );
}
