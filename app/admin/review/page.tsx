import Link from "next/link";
import AdminSectionNav from "@/components/AdminSectionNav";
import AdminTableFilters from "@/components/AdminTableFilters";
import AdminEventPagination from "@/components/AdminEventPagination";
import { unstable_rethrow } from "next/navigation";
import { AdminEventFilterError, adminEventSortOptions, buildAdminEventListUrl, parseAdminEventListFilters, type AdminEventListPage } from "@/lib/admin-event-list";
import {
  adminSetEventStatusAction,
  listAdminReviewEvents
} from "@/lib/admin-events";
import { formatPolishDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminReviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseAdminEventListFilters(await searchParams, true);
  let result: AdminEventListPage | null = null;
  let loadError: string | null = null;
  try { result = await listAdminReviewEvents(filters); }
  catch (error) {
    unstable_rethrow(error);
    console.error("[admin-review] Failed to load review page", error);
    loadError = error instanceof AdminEventFilterError ? error.message : "Nie udało się pobrać pełnych wyników. Zawęź zakres dat i spróbuj ponownie.";
  }
  const events = result?.events ?? [];

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
        resultCount={result?.totalCount ?? null}
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
        sortOptions={adminEventSortOptions.filter(option => option.value !== "published_at")}
      />

      {loadError ? <div role="alert" className="formError"><p>{loadError}</p><Link className="secondaryButton" href={buildAdminEventListUrl("/admin/review", filters, Number(filters.page))}>Spróbuj ponownie</Link></div> : null}
      {result ? <AdminEventPagination action="/admin/review" filters={filters} result={result} /> : null}

      <section className="managementPanel">
        <div className="managementTableWrap" tabIndex={0} role="region" aria-label="Wydarzenia do zatwierdzenia — tabela przewijana poziomo">
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
                    {loadError ? "Wyniki niedostępne." : "Brak wydarzeń oczekujących na zatwierdzenie dla wybranych filtrów."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      {result && result.pageCount > 1 ? <AdminEventPagination action="/admin/review" filters={filters} result={result} /> : null}
    </main>
  );
}

function formatDate(value: string) {
  return formatPolishDate(value, { dateStyle: "medium", timeStyle: "short" });
}
