import Link from "next/link";
import { notFound } from "next/navigation";
import EventEditorForm from "@/components/EventEditorForm";
import EventQualityChecklist from "@/components/EventQualityChecklist";
import OrganizerSectionNav from "@/components/OrganizerSectionNav";
import { formatPolishDate } from "@/lib/date-format";
import {
  getOrganizerEventEditorOptions,
  getOrganizerEventForEdit,
  getOrganizerEventModerationLogs,
  organizerUpdateEventAction
} from "@/lib/organizer-events";

type Params = { id: string };

export const dynamic = "force-dynamic";

export default async function OrganizerEditEventPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [event, options, moderationLogs] = await Promise.all([
    getOrganizerEventForEdit(id),
    getOrganizerEventEditorOptions(),
    getOrganizerEventModerationLogs(id)
  ]);

  if (!event) notFound();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel organizatora</p>
          <h1>Edytuj wydarzenie</h1>
        </div>
        <Link href="/organizer/events" className="secondaryButton">Wroc</Link>
      </div>

      <OrganizerSectionNav active="events" />

      <div className="organizerEditorLayout">
        <section className="managementPanel">
          <EventEditorForm
            action={organizerUpdateEventAction.bind(null, event.id)}
            event={event}
            options={options}
            mode="organizer"
            submitLabel="Zapisz i wyslij do akceptacji"
          />
        </section>
        <div className="organizerEditorSide">
          <EventQualityChecklist event={event} />
          <section className="qualityChecklist">
            <div className="managementPanelHeader">
              <h2>Historia moderacji</h2>
            </div>
            {moderationLogs.length ? (
              <ul className="organizerPlainList">
                {moderationLogs.map((log) => (
                  <li key={log.id}>
                    <div>
                      <strong>{log.old_status ?? "brak"} - {log.new_status}</strong>
                      <span>{formatDate(log.created_at)}</span>
                      {log.note ? <p className="tableSubtext">{log.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panelMutedText">Brak historii moderacji dla tego wydarzenia.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return formatPolishDate(value, { dateStyle: "medium", timeStyle: "short" });
}
