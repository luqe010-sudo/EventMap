import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import CategoryEditorForm from "@/components/CategoryEditorForm";
import { adminCreateCategoryAction } from "@/lib/admin-categories";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminNewCategoryPage() {
  await requireAdmin();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Dodaj kategorię</h1>
        </div>
        <Link href="/admin/categories" className="secondaryButton">Wróć do listy</Link>
      </div>

      <AdminSectionNav active="categories" />

      <section className="managementPanel">
        <CategoryEditorForm
          action={adminCreateCategoryAction}
          submitLabel="Dodaj kategorię"
        />
      </section>
    </main>
  );
}
