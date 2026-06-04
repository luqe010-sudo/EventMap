import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import DeleteLocationButton from "@/components/DeleteLocationButton";
import { adminDeleteLocationAction, listAdminLocations } from "@/lib/admin-locations";

export const dynamic = "force-dynamic";

export default async function AdminLocationsPage() {
  const locations = await listAdminLocations();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Lokalizacje</h1>
        </div>
        <Link href="/admin/locations/new" className="primaryButton">Dodaj lokalizacje</Link>
      </div>

      <AdminSectionNav active="locations" />

      <section className="managementPanel">
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Miejsce</th>
                <th>Adres</th>
                <th>Miasto</th>
                <th>Administracja</th>
                <th>Wydarzenia</th>
                <th>Duplikaty</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id}>
                  <td>
                    <strong>{location.name ?? "Bez nazwy"}</strong>
                    <p className="tableSubtext">
                      {formatCoordinates(location.latitude, location.longitude)}
                    </p>
                  </td>
                  <td>{location.address ?? "-"}</td>
                  <td>{location.city?.name ?? "-"}</td>
                  <td>
                    {[location.municipality, location.county, location.voivodeship].filter(Boolean).join(", ") || "-"}
                  </td>
                  <td>{location.eventCount}</td>
                  <td>
                    {location.duplicateGroupSize > 1 ? (
                      <span className="warningPill">{location.duplicateGroupSize} podobne</span>
                    ) : "-"}
                  </td>
                  <td>
                    <div className="tableActions">
                      <Link href={`/admin/locations/${location.id}/edit`}>Edytuj</Link>
                      {location.eventCount === 0 ? (
                        <DeleteLocationButton
                          deleteAction={adminDeleteLocationAction.bind(null, location.id)}
                          locationName={location.name ?? location.address ?? location.city?.name ?? "bez nazwy"}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="emptyTableCell">
                    Brak lokalizacji.
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
  if (latitude == null || longitude == null) return "Brak pinezki";
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
