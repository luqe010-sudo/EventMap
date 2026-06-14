import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import AdminTableFilters from "@/components/AdminTableFilters";
import DeleteLocationButton from "@/components/DeleteLocationButton";
import { type AdminLocationFilters, adminDeleteLocationAction, listAdminLocations } from "@/lib/admin-locations";
import { formatPolishDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminLocationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseLocationFilters(await searchParams);
  const locations = await listAdminLocations(filters);

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

      <AdminTableFilters
        action="/admin/locations"
        values={filters}
        resultCount={locations.length}
        fields={[
          { name: "q", label: "Szukaj", placeholder: "Miejsce, adres, kod, place id..." },
          { name: "city", label: "Miasto" },
          { name: "voivodeship", label: "Wojewodztwo" },
          { name: "events", label: "Wydarzenia", type: "select", options: eventCountOptions },
          { name: "duplicates", label: "Duplikaty", type: "select", options: duplicateOptions }
        ]}
        sortOptions={locationSortOptions}
      />

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
                <th>Dodano</th>
                <th>Edytowano</th>
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
                  <td>{location.created_at ? formatDate(location.created_at) : "-"}</td>
                  <td>{location.updated_at ? formatDate(location.updated_at) : "-"}</td>
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
                  <td colSpan={9} className="emptyTableCell">
                    Brak lokalizacji dla wybranych filtrow.
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

const eventCountOptions = [
  { label: "Z wydarzeniami", value: "with" },
  { label: "Bez wydarzen", value: "without" }
];

const duplicateOptions = [
  { label: "Tylko podejrzane duplikaty", value: "yes" }
];

const locationSortOptions = [
  { label: "Miasto", value: "city" },
  { label: "Nazwa miejsca", value: "name" },
  { label: "Adres", value: "address" },
  { label: "Liczba wydarzen", value: "events" },
  { label: "Duplikaty", value: "duplicates" },
  { label: "Dodano", value: "created_at" },
  { label: "Edytowano", value: "updated_at" }
];

function parseLocationFilters(params: SearchParams): AdminLocationFilters {
  return {
    q: readParam(params.q),
    city: readParam(params.city),
    voivodeship: readParam(params.voivodeship),
    events: readParam(params.events),
    duplicates: readParam(params.duplicates),
    sort: readParam(params.sort) ?? "city",
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
