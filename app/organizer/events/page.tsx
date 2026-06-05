import Link from "next/link";
import OrganizerSectionNav from "@/components/OrganizerSectionNav";
import {
  listOrganizerEvents,
  organizerCancelEventAction,
  organizerDuplicateEventAction,
  organizerHideEventAction
} from "@/lib/organizer-events";
import { formatPolishDate } from "@/lib/date-format";
import { toPluralCategorySlug } from "@/lib/slugs";

type SearchParams = {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export const dynamic = "force-dynamic";

export default async function OrganizerEventsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const events = await listOrganizerEvents({
    status: params.status || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined
  });

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Moje wydarzenia</h1>
        </div>
        <Link href="/organizer/events/new" className="primaryButton">Dodaj wydarzenie</Link>
      </div>

      <OrganizerSectionNav active="events" />

      <section className="managementPanel organizerFilterPanel">
        <form className="formGrid">
          <label>
            Status
            <select name="status" defaultValue={params.status ?? ""}>
              <option value="">Wszystkie</option>
              <option value="draft">Szkic</option>
              <option value="pending_review">Oczekuje</option>
              <option value="published">Opublikowane</option>
              <option value="rejected">Odrzucone</option>
              <option value="archived">Archiwalne</option>
            </select>
          </label>
          <label>
            Od daty
            <input name="dateFrom" type="date" defaultValue={params.dateFrom ?? ""} />
          </label>
          <label>
            Do daty
            <input name="dateTo" type="date" defaultValue={params.dateTo ?? ""} />
          </label>
          <div className="managementActions organizerFilterActions">
            <button type="submit" className="primaryButton">Filtruj</button>
            <Link href="/organizer/events" className="secondaryButton">Wyczysc</Link>
          </div>
        </form>
      </section>

      <section className="managementPanel">
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Tytul</th>
                <th>Data</th>
                <th>Miasto</th>
                <th>Kategoria</th>
                <th>Status</th>
                <th>Jakosc</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const publicPath = getPublicEventPath(event);
                return (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.title}</strong>
                      {event.is_cancelled ? <p className="tableSubtext">Anulowane</p> : null}
                      {event.visibility === "private" ? <p className="tableSubtext">Ukryte publicznie</p> : null}
                      {event.review_note ? <p className="tableSubtext">Uwaga: {event.review_note}</p> : null}
                    </td>
                    <td>{formatDate(event.start_at)}</td>
                    <td>{event.location?.city?.name ?? "-"}</td>
                    <td>{event.category?.name ?? "-"}</td>
                    <td><span className="statusPill">{statusLabel(event.status)}</span></td>
                    <td>
                      <QualityScore event={event} />
                    </td>
                    <td>
                      <div className="tableActions">
                        <Link href={`/organizer/events/${event.id}/edit`}>Edytuj</Link>
                        {publicPath ? <Link href={publicPath}>Podglad</Link> : null}
                        <form action={organizerHideEventAction.bind(null, event.id)}>
                          <button type="submit">Ukryj</button>
                        </form>
                        <form action={organizerCancelEventAction.bind(null, event.id)}>
                          <button type="submit">Anuluj</button>
                        </form>
                        <form action={organizerDuplicateEventAction.bind(null, event.id)}>
                          <button type="submit">Duplikuj</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!events.length ? (
                <tr>
                  <td colSpan={7} className="emptyTableCell">Brak wydarzen dla wybranych filtrow.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

type EventForTable = Awaited<ReturnType<typeof listOrganizerEvents>>[number];

function QualityScore({ event }: { event: EventForTable }) {
  const items = getQualityChecklist(event);
  const done = items.filter((item) => item.done).length;

  return (
    <div className="qualityMini">
      <span>{done}/{items.length}</span>
      <progress max={items.length} value={done} />
    </div>
  );
}

function getQualityChecklist(event: EventForTable) {
  const descriptionLength = event.description?.trim().length ?? 0;
  const sourceUrl = event.sources?.some((source) => Boolean(source.source_url));
  return [
    { label: "Tytul", done: Boolean(event.title.trim()) },
    { label: "Data", done: Boolean(event.start_at) },
    { label: "Lokalizacja", done: Boolean(event.location?.city?.name || event.location?.address) },
    { label: "Opis minimum 300 znakow", done: descriptionLength >= 300 },
    { label: "Zdjecie glowne", done: Boolean(event.main_image_url) },
    { label: "Kategoria", done: Boolean(event.category) },
    { label: "Link do biletow", done: event.price_type === "free" || Boolean(sourceUrl) },
    { label: "Cena", done: event.price_type === "free" || Boolean(event.price_min || event.price_max) }
  ];
}

function getPublicEventPath(event: EventForTable) {
  if (event.status !== "published" || event.visibility !== "public" || event.is_cancelled) return null;
  if (!event.category?.slug || !event.location?.city?.slug) return null;
  return `/${toPluralCategorySlug(event.category.slug)}/${event.location.city.slug}/${event.slug}`;
}

function formatDate(value: string) {
  return formatPolishDate(value, { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(status: string | null) {
  const labels: Record<string, string> = {
    draft: "Szkic",
    pending_review: "Oczekuje",
    published: "Opublikowane",
    rejected: "Odrzucone",
    archived: "Archiwalne"
  };
  return labels[status ?? "draft"] ?? status ?? "Szkic";
}
