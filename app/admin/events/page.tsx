import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import AdminTableFilters from "@/components/AdminTableFilters";
import EventSaveNotice from "@/components/EventSaveNotice";
import AdminEventPagination from "@/components/AdminEventPagination";
import { unstable_rethrow } from "next/navigation";
import { AdminEventFilterError, adminEventSortOptions, buildAdminEventListUrl, parseAdminEventListFilters, type AdminEventListPage } from "@/lib/admin-event-list";
import {
  adminDeleteEventAction,
  adminSetEventStatusAction,
  listAdminEvents
} from "@/lib/admin-events";
import { formatPolishDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = parseAdminEventListFilters(params);
  let result: AdminEventListPage | null = null;
  let loadError: string | null = null;
  try { result = await listAdminEvents(filters); }
  catch (error) {
    unstable_rethrow(error);
    console.error("[admin-events] Failed to load event page", error);
    loadError = error instanceof AdminEventFilterError ? error.message : "Nie udało się pobrać pełnych wyników. Zawęź status lub zakres dat i spróbuj ponownie.";
  }
  const events = result?.events ?? [];

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
      <EventSaveNotice value={params.save} />

      <AdminTableFilters
        action="/admin/events"
        values={filters}
        resultCount={result?.totalCount ?? null}
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
        sortOptions={adminEventSortOptions}
      />

      {loadError ? <div role="alert" className="formError"><p>{loadError}</p><a className="secondaryButton" href={buildAdminEventListUrl("/admin/events", filters, Number(filters.page))}>Spróbuj ponownie</a></div> : null}
      {result ? <AdminEventPagination action="/admin/events" filters={filters} result={result} /> : null}

      <section className="managementPanel">
        <div className="managementTableWrap" tabIndex={0} role="region" aria-label="Wydarzenia — tabela przewijana poziomo">
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
                    {loadError ? "Wyniki niedostępne." : "Brak wydarzeń dla wybranych filtrów."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      {result && result.pageCount > 1 ? <AdminEventPagination action="/admin/events" filters={filters} result={result} /> : null}
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
