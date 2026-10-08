import Link from "next/link";
import { buildAdminEventListUrl, type AdminEventListFilters, type AdminEventListPage } from "@/lib/admin-event-list";

export default function AdminEventPagination({ action, filters, result }: {
  action: "/admin/events" | "/admin/review";
  filters: AdminEventListFilters;
  result: AdminEventListPage;
}) {
  const first = result.totalCount ? (result.page - 1) * result.pageSize + 1 : 0;
  const last = result.totalCount ? first + result.events.length - 1 : 0;
  return (
    <nav className="managementActions" aria-label="Strony wydarzeń">
      <span>Pokazano {first}–{last} z {result.totalCount}. Strona {result.page} z {result.pageCount}.</span>
      {result.page > 1 ? (
        <Link className="secondaryButton" href={buildAdminEventListUrl(action, filters, result.page - 1)}>Poprzednia strona</Link>
      ) : null}
      {result.page < result.pageCount ? (
        <Link className="secondaryButton" href={buildAdminEventListUrl(action, filters, result.page + 1)}>Następna strona</Link>
      ) : null}
    </nav>
  );
}
