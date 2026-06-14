import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import AdminTableFilters from "@/components/AdminTableFilters";
import {
  type AdminEventListFilters,
  adminSetEventStatusAction,
  listAdminReviewEvents
} from "@/lib/admin-events";
import { formatPolishDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminReviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseEventFilters(await searchParams);
  const events = await listAdminReviewEvents(filters);

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Do zatwierdzenia</h1>
        </div>
      </div>

      <AdminSectionNav active="review" />

      <AdminTableFilters
        action="/admin/review"
        values={filters}
        resultCount={events.length}
        fields={[
          { name: "q", label: "Szukaj", placeholder: "Tytul, miasto, organizator..." },
          { name: "category", label: "Kategoria" },
          { name: "city", label: "Miasto" },
          { name: "organizer", label: "Organizator" },
          { name: "eventFrom", label: "Data wydarzenia od", type: "date" },
          { name: "eventTo", label: "Data wydarzenia do", type: "date" },
          { name: "createdFrom", label: "Dodano od", type: "date" },
          { name: "createdTo", label: "Dodano do", type: "date" }
        ]}
        sortOptions={eventSortOptions}
      />

      <section className="managementPanel">
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Tytul</th>
                <th>Dodano</th>
                <th>Data wydarzenia</th>
                <th>Miasto</th>
                <th>Kategoria</th>
                <th>Organizator</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td><strong>{event.title}</strong></td>
                  <td>{event.created_at ? formatDate(event.created_at) : "-"}</td>
                  <td>{formatDate(event.start_at)}</td>
                  <td>{event.location?.city?.name ?? "-"}</td>
                  <td>{event.category?.name ?? "-"}</td>
                  <td>{event.organizer?.name ?? "-"}</td>
                  <td><span className="statusPill">{event.status ?? "draft"}</span></td>
                  <td>
                    <div className="tableActions">
                      <Link href={`/admin/events/${event.id}/edit`}>Sprawdz</Link>
                      <form action={adminSetEventStatusAction.bind(null, event.id, "published")}>
                        <button type="submit">Opublikuj</button>
                      </form>
                      <form action={adminSetEventStatusAction.bind(null, event.id, "rejected")}>
                        <input
                          name="review_note"
                          placeholder="Powod odrzucenia"
                          defaultValue={event.review_note ?? ""}
                          className="tableActionInput"
                        />
                        <button type="submit">Odrzuc</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="emptyTableCell">
                    Brak wydarzen oczekujacych na zatwierdzenie.
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

function formatDate(value: string) {
  return formatPolishDate(value, { dateStyle: "medium", timeStyle: "short" });
}

const eventSortOptions = [
  { label: "Dodano", value: "created_at" },
  { label: "Edytowano", value: "updated_at" },
  { label: "Data wydarzenia", value: "start_at" },
  { label: "Tytul", value: "title" },
  { label: "Miasto", value: "city" },
  { label: "Kategoria", value: "category" },
  { label: "Organizator", value: "organizer" },
  { label: "Status", value: "status" }
];

function parseEventFilters(params: SearchParams): AdminEventListFilters {
  return {
    q: readParam(params.q),
    category: readParam(params.category),
    city: readParam(params.city),
    organizer: readParam(params.organizer),
    eventFrom: readParam(params.eventFrom),
    eventTo: readParam(params.eventTo),
    createdFrom: readParam(params.createdFrom),
    createdTo: readParam(params.createdTo),
    sort: readParam(params.sort) ?? "created_at",
    dir: readParam(params.dir) ?? "desc"
  };
}

function readParam(value: string | string[] | undefined) {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.trim() || undefined;
}
