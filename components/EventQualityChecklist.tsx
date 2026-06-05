import type { EditableEvent } from "@/lib/event-editor";

type EventQualityChecklistProps = {
  event: EditableEvent;
};

export default function EventQualityChecklist({ event }: EventQualityChecklistProps) {
  const items = buildChecklist(event);
  const done = items.filter((item) => item.done).length;

  return (
    <aside className="qualityChecklist">
      <div className="managementPanelHeader">
        <h2>Checklist jakości</h2>
        <span className="statusPill">{done}/{items.length}</span>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.label} className={item.done ? "qualityDone" : "qualityWarning"}>
            <span aria-hidden="true">{item.done ? "OK" : "!"}</span>
            {item.label}
          </li>
        ))}
      </ul>
      <p>Dobrze uzupelnione wydarzenia sa czesciej wyswietlane w wyszukiwarce.</p>
    </aside>
  );
}

function buildChecklist(event: EditableEvent) {
  const descriptionLength = event.description?.trim().length ?? 0;
  const sourceUrl = event.sources?.some((source) => Boolean(source.source_url));

  return [
    { label: "Tytul", done: Boolean(event.title.trim()) },
    { label: "Data", done: Boolean(event.start_at) },
    { label: "Lokalizacja", done: Boolean(event.location?.city?.name || event.location?.address) },
    { label: "Opis minimum 300 znakow", done: descriptionLength >= 300 },
    { label: "Zdjecie glowne", done: Boolean(event.main_image_url) },
    { label: "Kategoria", done: Boolean(event.category_id) },
    { label: "Link do biletow / strony", done: event.price_type === "free" || Boolean(sourceUrl) },
    { label: "Cena", done: event.price_type === "free" || Boolean(event.price_min || event.price_max) }
  ];
}
