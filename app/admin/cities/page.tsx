import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import { listAdminCityPages } from "@/lib/admin-city-pages";

export const dynamic = "force-dynamic";

export default async function AdminCitiesPage() {
  const cityPages = await listAdminCityPages();

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
                  <td>
                    <div className="tableActions">
                      <Link href={`/admin/cities/${cityPage.id}/edit`}>Edytuj</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {cityPages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="emptyTableCell">
                    Brak stron miast.
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
