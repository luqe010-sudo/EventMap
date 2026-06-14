import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import AdminTableFilters from "@/components/AdminTableFilters";
import { type AdminCityPageFilters, listAdminCityPages } from "@/lib/admin-city-pages";
import { formatPolishDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminCitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseCityPageFilters(await searchParams);
  const cityPages = await listAdminCityPages(filters);

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Miasta SEO</h1>
        </div>
        <Link href="/admin/cities/new" className="primaryButton">Dodaj miasto</Link>
      </div>

      <AdminSectionNav active="cities" />

      <AdminTableFilters
        action="/admin/cities"
        values={filters}
        resultCount={cityPages.length}
        fields={[
          { name: "q", label: "Szukaj", placeholder: "Miasto, slug, opis..." },
          { name: "voivodeship", label: "Wojewodztwo" },
          { name: "status", label: "Status", type: "select", options: statusOptions },
          { name: "events", label: "Wydarzenia", type: "select", options: eventCountOptions }
        ]}
        sortOptions={citySortOptions}
      />

      <section className="managementPanel">
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Miasto</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Wojewodztwo</th>
                <th>Centrum</th>
                <th>Wydarzenia</th>
                <th>Dodano</th>
                <th>Edytowano</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {cityPages.map((cityPage) => (
                <tr key={cityPage.id}>
                  <td><strong>{cityPage.city?.name ?? "Bez miasta"}</strong></td>
                  <td><code>{cityPage.city?.slug ?? "-"}</code></td>
                  <td>
                    <span className={cityPage.city?.is_active ? "successPill" : "statusPill"}>
                      {cityPage.city?.is_active ? "aktywna" : "wylaczona"}
                    </span>
                  </td>
                  <td>{cityPage.city?.voivodeship ?? "-"}</td>
                  <td>{formatCoordinates(cityPage.city?.latitude ?? null, cityPage.city?.longitude ?? null)}</td>
                  <td>{cityPage.eventCount}</td>
                  <td>{cityPage.created_at ? formatDate(cityPage.created_at) : "-"}</td>
                  <td>{cityPage.updated_at ? formatDate(cityPage.updated_at) : "-"}</td>
                  <td>
                    <div className="tableActions">
                      <Link href={`/admin/cities/${cityPage.id}/edit`}>Edytuj</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {cityPages.length === 0 ? (
                <tr>
                  <td colSpan={9} className="emptyTableCell">
                    Brak miast dla wybranych filtrow.
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

function formatCoordinates(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) return "Brak centrum";
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

const statusOptions = [
  { label: "Aktywne", value: "active" },
  { label: "Wylaczone", value: "inactive" }
];

const eventCountOptions = [
  { label: "Z wydarzeniami", value: "with" },
  { label: "Bez wydarzen", value: "without" }
];

const citySortOptions = [
  { label: "Miasto", value: "name" },
  { label: "Slug", value: "slug" },
  { label: "Wojewodztwo", value: "voivodeship" },
  { label: "Liczba wydarzen", value: "events" },
  { label: "Dodano", value: "created_at" },
  { label: "Edytowano", value: "updated_at" },
  { label: "Status", value: "status" }
];

function parseCityPageFilters(params: SearchParams): AdminCityPageFilters {
  return {
    q: readParam(params.q),
    voivodeship: readParam(params.voivodeship),
    status: readParam(params.status),
    events: readParam(params.events),
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
