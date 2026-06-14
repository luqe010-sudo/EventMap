import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import AdminTableFilters from "@/components/AdminTableFilters";
import { type AdminOrganizerFilters, listAdminOrganizers } from "@/lib/admin-organizers";
import { formatPolishDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminOrganizersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseOrganizerFilters(await searchParams);
  const organizers = await listAdminOrganizers(filters);

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Organizatorzy</h1>
        </div>
        <Link href="/admin/organizers/new" className="primaryButton">Dodaj organizatora</Link>
      </div>

      <AdminSectionNav active="organizers" />

      <AdminTableFilters
        action="/admin/organizers"
        values={filters}
        resultCount={organizers.length}
        fields={[
          { name: "q", label: "Szukaj", placeholder: "Nazwa, slug, kontakt, owner..." },
          { name: "type", label: "Typ", placeholder: "np. firma" },
          { name: "verified", label: "Weryfikacja", type: "select", options: verifiedOptions }
        ]}
        sortOptions={organizerSortOptions}
      />

      <section className="managementPanel">
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Typ</th>
                <th>Kontakt</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Dodano</th>
                <th>Edytowano</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((organizer) => {
                const owner = organizer.organizer_users.find((item) => item.role === "owner") ?? organizer.organizer_users[0];
                return (
                  <tr key={organizer.id}>
                    <td>{organizer.name}</td>
                    <td>{organizer.type ?? "-"}</td>
                    <td>
                      {organizer.email ?? organizer.phone ?? organizer.website ?? "-"}
                    </td>
                    <td>{owner?.user_id ?? "-"}</td>
                    <td>
                      <span className="statusPill">{organizer.is_verified ? "verified" : "new"}</span>
                    </td>
                    <td>{organizer.created_at ? formatDate(organizer.created_at) : "-"}</td>
                    <td>{organizer.updated_at ? formatDate(organizer.updated_at) : "-"}</td>
                    <td>
                      <div className="tableActions">
                        <Link href={`/admin/organizers/${organizer.id}/edit`}>Edytuj</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {organizers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="emptyTableCell">
                    Brak organizatorow dla wybranych filtrow.
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

const verifiedOptions = [
  { label: "Zweryfikowani", value: "yes" },
  { label: "Nowi / bez weryfikacji", value: "no" }
];

const organizerSortOptions = [
  { label: "Nazwa", value: "name" },
  { label: "Dodano", value: "created_at" },
  { label: "Edytowano", value: "updated_at" },
  { label: "Typ", value: "type" },
  { label: "Weryfikacja", value: "verified" }
];

function parseOrganizerFilters(params: SearchParams): AdminOrganizerFilters {
  return {
    q: readParam(params.q),
    type: readParam(params.type),
    verified: readParam(params.verified),
    sort: readParam(params.sort) ?? "name",
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
