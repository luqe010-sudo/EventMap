import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import AdminTableFilters from "@/components/AdminTableFilters";
import {
  type AdminEventListFilters,
  adminDeleteEventAction,
  adminSetEventStatusAction,
  listAdminEvents
} from "@/lib/admin-events";
import { formatPolishDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseEventFilters(await searchParams);
  const events = await listAdminEvents(filters);

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Wydarzenia</h1>
        </div>
        <div className="managementActions">
          <Link href="/admin/events/new" className="primaryButton">Dodaj wydarzenie</Link>
        </div>
      </div>

      <AdminSectionNav active="events" />

      <AdminTableFilters
        action="/admin/events"
        values={filters}
        resultCount={events.length}
        fields={[
          { name: "q", label: "Szukaj", placeholder: "Tytul, status, notatka..." },
          { name: "status", label: "Status", type: "select", options: eventStatusOptions },
          { name: "featured", label: "Promowane", type: "select", options: featuredOptions },
          { name: "category", label: "Kategoria", placeholder: "np. Koncert" },
          { name: "city", label: "Miasto", placeholder: "np. Wroclaw" },
          { name: "organizer", label: "Organizator", placeholder: "Nazwa" },
          { name: "eventFrom", label: "Data wydarzenia od", type: "date" },
          { name: "eventTo", label: "Data wydarzenia do", type: "date" },
          { name: "createdFrom", label: "Dodano od", type: "date" },
          { name: "createdTo", label: "Dodano do", type: "date" },
          { name: "publishedFrom", label: "Publikacja od", type: "date" },
          { name: "publishedTo", label: "Publikacja do", type: "date" }
        ]}
        sortOptions={eventSortOptions}
      />

      <section className="managementPanel">
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Tytul</th>
                <th>Data wydarzenia</th>
                <th>Dodano</th>
                <th>Edytowano</th>
                <th>Opublikowano</th>
                <th>Miasto</th>
                <th>Kategoria</th>
                <th>Organizator</th>
                <th>Status</th>
                <th>Promo</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.title}</td>
                  <td>{formatDate(event.start_at)}</td>
                  <td>{event.created_at ? formatDate(event.created_at) : "-"}</td>
                  <td>{event.updated_at ? formatDate(event.updated_at) : "-"}</td>
                  <td>{event.published_at ? formatDate(event.published_at) : "-"}</td>
                  <td>{event.location?.city?.name ?? "-"}</td>
                  <td>{event.category?.name ?? "-"}</td>
                  <td>{event.organizer?.name ?? "-"}</td>
                  <td><span className="statusPill">{event.status ?? "draft"}</span></td>
                  <td>{event.is_featured ? <span className="successPill">tak</span> : "-"}</td>
                  <td>
                    <div className="tableActions">
                      <Link href={`/admin/events/${event.id}/edit`}>Edytuj</Link>
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
                      <form action={adminSetEventStatusAction.bind(null, event.id, "archived")}>
                        <button type="submit">Archiwizuj</button>
                      </form>
                      <form action={adminDeleteEventAction.bind(null, event.id)}>
                        <button type="submit" className="dangerButton">Usun</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={11} className="emptyTableCell">
                    Brak wydarzen dla wybranych filtrow.
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

const eventStatusOptions = [
  { label: "draft", value: "draft" },
  { label: "pending_review", value: "pending_review" },
  { label: "published", value: "published" },
  { label: "rejected", value: "rejected" },
  { label: "archived", value: "archived" }
];

const featuredOptions = [
  { label: "Tak", value: "yes" },
  { label: "Nie", value: "no" }
];

const eventSortOptions = [
  { label: "Dodano", value: "created_at" },
  { label: "Edytowano", value: "updated_at" },
  { label: "Opublikowano", value: "published_at" },
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
    status: readParam(params.status),
    category: readParam(params.category),
    city: readParam(params.city),
    organizer: readParam(params.organizer),
    featured: readParam(params.featured),
    eventFrom: readParam(params.eventFrom),
    eventTo: readParam(params.eventTo),
    createdFrom: readParam(params.createdFrom),
    createdTo: readParam(params.createdTo),
    publishedFrom: readParam(params.publishedFrom),
    publishedTo: readParam(params.publishedTo),
    sort: readParam(params.sort) ?? "created_at",
    dir: readParam(params.dir) ?? "desc"
  };
}

function readParam(value: string | string[] | undefined) {
  const item = Array.isArray(value) ? value[0] : value;
  return item?.trim() || undefined;
}
