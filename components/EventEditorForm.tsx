"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import type { EditableEvent, EventEditorOptions } from "@/lib/event-editor";
import { eventStatuses, toDateTimeLocal } from "@/lib/event-editor";
import { eventTextLimits, type EventEditorState } from "@/lib/event-editor-validation";
import LocationSection from "@/components/LocationSection";

type EventEditorFormProps = {
  action: (state: EventEditorState, formData: FormData) => Promise<EventEditorState>;
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
  const selectedOrganizerId = event?.organizer_id ?? options.organizers[0]?.id ?? "";
  const showAssignedOrganizer = mode === "organizer" && selectedOrganizerId &&
    !options.organizers.some(organizer => organizer.id === selectedOrganizerId);
  const [state, formAction, pending] = useActionState<EventEditorState, FormData>(action, { fieldErrors: {}, error: null });
  const [checkedMissingWrite, setCheckedMissingWrite] = useState(false);
  const blocked = pending || Boolean(state.saveIssue && (state.saveIssue.kind === "partial" || !checkedMissingWrite));
  const attrs = (name: string) => ({
    "aria-invalid": Boolean(state.fieldErrors[name]),
    "aria-describedby": state.fieldErrors[name] ? `event-error-${name}` : undefined
  });
  const error = (name: string) => state.fieldErrors[name]
    ? <span id={`event-error-${name}`} className="formError">{state.fieldErrors[name]}</span> : null;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    // This acknowledgement enables a deliberate retry only. It grants no
    // server-side access; every new request runs the original role/owner guards.
    setCheckedMissingWrite(false);
    // Dispatch explicitly so a validation response does not reset uncontrolled
    // fields, the selected image file, or the location picker's state.
    startTransition(() => formAction(formData));
  }

  return (
    <form action={formAction} onSubmit={submit} aria-busy={pending} className="managementForm">
      {state.error ? <div className="formError" role="alert">{state.error}</div> : null}
      {state.saveIssue ? (
        <div>
          <div className="managementActions">
            <a className="primaryButton" href={state.saveIssue.editHref} target="_blank" rel="noopener noreferrer">
              {state.saveIssue.kind === "partial" ? "Otwórz zapisane wydarzenie" : "Sprawdź zapis wydarzenia"} (nowa karta)
            </a>
            <a className="secondaryButton" href={state.saveIssue.listHref} target="_blank" rel="noopener noreferrer">Lista wydarzeń (nowa karta)</a>
          </div>
          {state.saveIssue.kind === "unconfirmed" ? (
            <label className="checkboxLabel">
              <input type="checkbox" checked={checkedMissingWrite} onChange={event => setCheckedMissingWrite(event.currentTarget.checked)} disabled={pending} />
              Sprawdziłem listę i szczegóły: zapis nie został wykonany. Chcę ponowić próbę.
            </label>
          ) : <p className="formHint">Możesz skopiować zachowane dane do edytora zapisanego wydarzenia. Ten formularz nie zapisze ich ponownie.</p>}
        </div>
      ) : null}
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents" }}>
      <div className="formGrid">
        <label>
          Tytul
          <input name="title" required maxLength={eventTextLimits.title} {...attrs("title")} defaultValue={event?.title ?? ""} />
          {error("title")}
        </label>
        <label>
          Slug
          <input name="slug" maxLength={eventTextLimits.slug} {...attrs("slug")} defaultValue={event?.slug ?? ""} placeholder="generowany z tytulu" />
          {error("slug")}
        </label>
      </div>

      <label>
        Krotki opis
        <input name="short_description" maxLength={eventTextLimits.short_description} {...attrs("short_description")} defaultValue={event?.short_description ?? ""} />
        {error("short_description")}
      </label>

      <label>
        Opis
        <textarea name="description" maxLength={eventTextLimits.description} {...attrs("description")} rows={6} defaultValue={event?.description ?? ""} />
        {error("description")}
      </label>

      <div className="formGrid">
        <label>
          Start
          <input name="start_at" type="datetime-local" required {...attrs("start_at")} defaultValue={toDateTimeLocal(event?.start_at)} />
          {error("start_at")}
        </label>
        <label>
          Koniec
          <input name="end_at" type="datetime-local" {...attrs("end_at")} defaultValue={toDateTimeLocal(event?.end_at)} />
          {error("end_at")}
        </label>
        <label className="checkboxLabel">
          <input name="is_all_day" type="checkbox" defaultChecked={Boolean(event?.is_all_day)} />
          Calodniowe
        </label>
      </div>

      <div className="formGrid">
        <label>
          Kategoria
          <select name="category_id" {...attrs("category_id")} defaultValue={event?.category_id ?? ""} required>
            <option value="">Wybierz kategorie</option>
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          {error("category_id")}
        </label>
        <label>
          Organizator
          <select name="organizer_id" {...attrs("organizer_id")} defaultValue={selectedOrganizerId} disabled={mode === "organizer"} required>
            <option value="">Wybierz organizatora</option>
            {showAssignedOrganizer ? (
              <option value={selectedOrganizerId}>{event?.organizer?.name ?? "Organizator przypisany do wydarzenia"}</option>
            ) : null}
            {options.organizers.map((organizer) => (
              <option key={organizer.id} value={organizer.id}>{organizer.name}</option>
            ))}
          </select>
          {error("organizer_id")}
          {mode === "organizer" ? <input type="hidden" name="organizer_id" value={selectedOrganizerId} /> : null}
        </label>
        {mode === "admin" ? (
          <label>
            Status
            <select name="status" {...attrs("status")} defaultValue={event?.status ?? "published"}>
              {eventStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            {error("status")}
          </label>
        ) : null}
        {mode === "admin" ? (
          <label className="checkboxLabel">
            <input name="is_featured" type="checkbox" defaultChecked={Boolean(event?.is_featured)} />
            Promowane
          </label>
        ) : null}
      </div>

      {mode === "admin" ? (
        <label>
          Uwaga dla organizatora
          <textarea
            name="review_note"
            maxLength={eventTextLimits.review_note}
            {...attrs("review_note")}
            rows={3}
            defaultValue={event?.review_note ?? ""}
            placeholder="Widoczna przy odrzuceniu lub wymaganych poprawkach"
          />
          {error("review_note")}
        </label>
      ) : null}

      <LocationSection
        defaultLocation={event?.location}
        savedLocations={options.locations}
        fieldErrors={state.fieldErrors}
      />

      <div className="formGrid">
        <label>
          Typ ceny
          <select name="price_type" {...attrs("price_type")} defaultValue={event?.price_type ?? ""}>
            <option value="">Nieznana</option>
            <option value="free">Darmowe</option>
            <option value="paid">Platne</option>
            <option value="donation">Dobrowolna oplata</option>
          </select>
          {error("price_type")}
        </label>
        <label>
          Cena min
          <input name="price_min" type="number" min="0" step="0.01" {...attrs("price_min")} defaultValue={event?.price_min ?? ""} />
          {error("price_min")}
        </label>
        <label>
          Cena max
          <input name="price_max" type="number" min="0" step="0.01" {...attrs("price_max")} defaultValue={event?.price_max ?? ""} />
          {error("price_max")}
        </label>
        <label>
          Waluta
          <input name="currency" maxLength={3} {...attrs("currency")} defaultValue={event?.currency ?? "PLN"} />
          {error("currency")}
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
            <input name="main_image_file" type="file" {...attrs("main_image_file")} accept="image/jpeg,image/png,image/webp,image/gif,image/avif" />
            {error("main_image_file")}
          </label>
          <label>
            Albo podaj link
            <input name="main_image_url" type="url" maxLength={eventTextLimits.main_image_url} {...attrs("main_image_url")} defaultValue={event?.main_image_url ?? ""} />
            {error("main_image_url")}
          </label>
        </div>
        <p className="formHint">Plik zostanie wgrany do Cloudinary. Maksymalny rozmiar: 5 MB.</p>
      </section>

      <div className="formGrid">
        <label>
          Nazwa zrodla
          <input name="source_name" maxLength={eventTextLimits.source_name} {...attrs("source_name")} defaultValue={source?.source_name ?? ""} />
          {error("source_name")}
        </label>
        <label>
          URL zrodla
          <input name="source_url" type="url" maxLength={eventTextLimits.source_url} {...attrs("source_url")} defaultValue={source?.source_url ?? ""} />
          {error("source_url")}
        </label>
      </div>

      <div className="managementActions">
        <button type="submit" className="primaryButton" disabled={blocked}>{pending ? "Zapisywanie…" : submitLabel}</button>
        {mode === "organizer" && event?.status === "rejected" && !event.is_cancelled ? (
          <button type="submit" name="intent" value="resubmit" className="secondaryButton" disabled={blocked}>Wyślij ponownie do sprawdzenia</button>
        ) : null}
        {error("intent")}
      </div>
      {mode === "organizer" && event?.status === "rejected" ? <p className="formHint">Zapis zmian zachowuje odrzucenie. Po poprawieniu wydarzenia wyślij je ponownie do sprawdzenia.</p> : null}
      </fieldset>
    </form>
  );
}
