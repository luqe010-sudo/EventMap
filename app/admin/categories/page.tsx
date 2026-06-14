import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import AdminTableFilters from "@/components/AdminTableFilters";
import DeleteCategoryButton from "@/components/DeleteCategoryButton";
import CategoryIcon from "@/components/CategoryIcon";
import { type AdminCategoryFilters, listAdminCategories, adminDeleteCategoryAction } from "@/lib/admin-categories";
import { formatPolishDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseCategoryFilters(await searchParams);
  const categories = await listAdminCategories(filters);

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Kategorie</h1>
        </div>
        <Link href="/admin/categories/new" className="primaryButton">Dodaj kategorie</Link>
      </div>

      <AdminSectionNav active="categories" />

      <AdminTableFilters
        action="/admin/categories"
        values={filters}
        resultCount={categories.length}
        fields={[
          { name: "q", label: "Szukaj", placeholder: "Nazwa, slug, kolor..." },
          { name: "icon", label: "Ikona", placeholder: "np. Music" }
        ]}
        sortOptions={categorySortOptions}
      />

      <section className="managementPanel">
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Kolor</th>
                <th>Nazwa</th>
                <th>Slug</th>
                <th>Ikona</th>
                <th>Kolejnosc</th>
                <th>Dodano</th>
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
                  <td>{cat.sort_order ?? "-"}</td>
                  <td>{cat.created_at ? formatDate(cat.created_at) : "-"}</td>
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
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="emptyTableCell">
                    Brak kategorii dla wybranych filtrow.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const categorySortOptions = [
  { label: "Kolejnosc", value: "sort_order" },
  { label: "Nazwa", value: "name" },
  { label: "Slug", value: "slug" },
  { label: "Ikona", value: "icon" },
  { label: "Dodano", value: "created_at" }
];

function parseCategoryFilters(params: SearchParams): AdminCategoryFilters {
  return {
    q: readParam(params.q),
    icon: readParam(params.icon),
    sort: readParam(params.sort) ?? "sort_order",
    dir: readParam(params.dir) ?? "asc"
  };
}

function readParam(value: string | string[] | undefined) {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.trim() || undefined;
}

function formatDate(value: string) {
  return formatPolishDate(value, { dateStyle: "medium", timeStyle: "short" });
}
