import type { EditableEvent, EventEditorOptions } from "@/lib/event-editor";
import { eventStatuses, toDateTimeLocal } from "@/lib/event-editor";
import LocationSection from "@/components/LocationSection";

type EventEditorFormProps = {
  action: (formData: FormData) => Promise<void>;
  event?: EditableEvent | null;
  options: EventEditorOptions;
  mode: "admin" | "organizer";
  submitLabel: string;
};

export default function EventEditorForm({
  action,
  event,
  options,
  mode,
  submitLabel
}: EventEditorFormProps) {
  const source = event?.sources?.[0];

  return (
    <form action={action} className="managementForm" encType="multipart/form-data">
      <div className="formGrid">
        <label>
          Tytul
          <input name="title" required defaultValue={event?.title ?? ""} />
        </label>
        <label>
          Slug
          <input name="slug" defaultValue={event?.slug ?? ""} placeholder="generowany z tytulu" />
        </label>
      </div>

      <label>
        Krotki opis
        <input name="short_description" defaultValue={event?.short_description ?? ""} />
      </label>

      <label>
        Opis
        <textarea name="description" rows={6} defaultValue={event?.description ?? ""} />
      </label>

      <div className="formGrid">
        <label>
          Start
          <input name="start_at" type="datetime-local" required defaultValue={toDateTimeLocal(event?.start_at)} />
        </label>
        <label>
          Koniec
          <input name="end_at" type="datetime-local" defaultValue={toDateTimeLocal(event?.end_at)} />
        </label>
        <label className="checkboxLabel">
          <input name="is_all_day" type="checkbox" defaultChecked={Boolean(event?.is_all_day)} />
          Calodniowe
        </label>
      </div>

      <div className="formGrid">
        <label>
          Kategoria
          <select name="category_id" defaultValue={event?.category_id ?? ""} required>
            <option value="">Wybierz kategorie</option>
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          Organizator
          <select name="organizer_id" defaultValue={event?.organizer_id ?? options.organizers[0]?.id ?? ""} disabled={mode === "organizer"} required>
            <option value="">Wybierz organizatora</option>
            {options.organizers.map((organizer) => (
              <option key={organizer.id} value={organizer.id}>{organizer.name}</option>
            ))}
          </select>
          {mode === "organizer" ? <input type="hidden" name="organizer_id" value={event?.organizer_id ?? options.organizers[0]?.id ?? ""} /> : null}
        </label>
        {mode === "admin" ? (
          <label>
            Status
            <select name="status" defaultValue={event?.status ?? "published"}>
              {eventStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <LocationSection
        defaultLocation={event?.location}
      />

      <div className="formGrid">
        <label>
          Typ ceny
          <select name="price_type" defaultValue={event?.price_type ?? ""}>
            <option value="">Nieznana</option>
            <option value="free">Darmowe</option>
            <option value="paid">Platne</option>
            <option value="donation">Dobrowolna oplata</option>
          </select>
        </label>
        <label>
          Cena min
          <input name="price_min" type="number" step="0.01" defaultValue={event?.price_min ?? ""} />
        </label>
        <label>
          Cena max
          <input name="price_max" type="number" step="0.01" defaultValue={event?.price_max ?? ""} />
        </label>
        <label>
          Waluta
          <input name="currency" defaultValue={event?.currency ?? "PLN"} />
        </label>
      </div>

      <section className="managementSubsection">
        <h2>Obraz wydarzenia</h2>
        {event?.main_image_url ? (
          <img className="eventEditorImagePreview" src={event.main_image_url} alt="" />
        ) : null}
        <div className="formGrid">
          <label>
            Wgraj obraz
            <input name="main_image_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" />
          </label>
          <label>
            Albo podaj link
            <input name="main_image_url" type="url" defaultValue={event?.main_image_url ?? ""} />
          </label>
        </div>
        <p className="formHint">Plik zostanie wgrany do Cloudinary. Maksymalny rozmiar: 5 MB.</p>
      </section>

      <div className="formGrid">
        <label>
          Nazwa zrodla
          <input name="source_name" defaultValue={source?.source_name ?? ""} />
        </label>
        <label>
          URL zrodla
          <input name="source_url" type="url" defaultValue={source?.source_url ?? ""} />
        </label>
      </div>

      <div className="managementActions">
        <button type="submit" className="primaryButton">{submitLabel}</button>
      </div>
    </form>
  );
}
