import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import DeleteCategoryButton from "@/components/DeleteCategoryButton";
import CategoryIcon from "@/components/CategoryIcon";
import { listAdminCategories, adminDeleteCategoryAction } from "@/lib/admin-categories";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Kategorie</h1>
        </div>
        <Link href="/admin/categories/new" className="primaryButton">Dodaj kategorię</Link>
      </div>

      <AdminSectionNav active="categories" />

      <section className="managementPanel">
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Kolor</th>
                <th>Nazwa</th>
                <th>Slug</th>
                <th>Ikona</th>
                <th>Kolejność</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: cat.color ?? "#64748b",
                        border: "2px solid rgba(0,0,0,0.1)",
                        verticalAlign: "middle"
                      }}
                    />
                  </td>
                  <td><strong>{cat.name}</strong></td>
                  <td><code>{cat.slug}</code></td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <CategoryIcon iconName={cat.icon} size={18} />
                      <span style={{ fontSize: "0.85rem", color: "var(--ink-secondary)" }}>
                        {cat.icon ?? "CircleHelp"}
                      </span>
                    </span>
                  </td>
                  <td>{cat.sort_order ?? "—"}</td>
                  <td>
                    <div className="tableActions">
                      <Link href={`/admin/categories/${cat.id}/edit`}>Edytuj</Link>
                      <DeleteCategoryButton 
                        deleteAction={adminDeleteCategoryAction.bind(null, cat.id)} 
                        categoryName={cat.name} 
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--ink-muted)" }}>
                    Brak kategorii. Dodaj pierwszą kategorię.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
