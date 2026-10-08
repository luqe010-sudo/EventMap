"use client";

import { startTransition, useActionState, useId, useState, type FormEvent } from "react";
import type { OrganizerProfile } from "@/lib/organizer-events";
import { organizerTextLimits, type OrganizerFormState } from "@/lib/organizer-form-validation";

type OrganizerProfileFormProps = {
  action: (state: OrganizerFormState, formData: FormData) => Promise<OrganizerFormState>;
  organizer: OrganizerProfile;
};

const organizerTypes = [
  ["club", "Klub"], ["culture_center", "Dom kultury"], ["restaurant", "Restauracja"],
  ["person", "Osoba prywatna"], ["company", "Firma"], ["institution", "Instytucja"],
  ["ngo", "Organizacja / NGO"], ["venue", "Miejsce"]
];

export default function OrganizerProfileForm({ action, organizer }: OrganizerProfileFormProps) {
  const [state, formAction, pending] = useActionState(action, { fieldErrors: {}, error: null });
  const [values, setValues] = useState(() => ({
    name: organizer.name, slug: organizer.slug, type: organizer.type ?? "", description: organizer.description ?? "",
    phone: organizer.phone ?? "", email: organizer.email ?? "", website: organizer.website ?? "",
    facebook_url: organizer.facebook_url ?? "", instagram_url: organizer.instagram_url ?? "", logo_url: organizer.logo_url ?? ""
  }));
  const id = useId();
  const attrs = (name: string) => ({
    "aria-invalid": Boolean(state.fieldErrors[name]),
    "aria-describedby": state.fieldErrors[name] ? `${id}-${name}` : undefined
  });
  const error = (name: string) => state.fieldErrors[name]
    ? <span id={`${id}-${name}`} className="formError">{state.fieldErrors[name]}</span> : null;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    // Explicit dispatch and controlled values keep edits after an action response.
    startTransition(() => formAction(data));
  }
  const field = (name: "phone" | "email" | "website" | "facebook_url" | "instagram_url" | "logo_url", label: string, type = "text") => (
    <label>
      {label}
      <input name={name} type={type} maxLength={organizerTextLimits[name]} {...attrs(name)} value={values[name]} onChange={event => setValues(previous => ({ ...previous, [name]: event.target.value }))} />
      {error(name)}
    </label>
  );

  return (
    <form action={formAction} onSubmit={submit} aria-busy={pending} className="managementForm">
      {state.error ? <div className="formError" role="alert">{state.error}</div> : null}
      {state.error && !Object.keys(state.fieldErrors).length ? <a href="/organizer/profile" target="_blank" rel="noopener noreferrer">Sprawdź profil w nowej karcie</a> : null}
      {state.success ? <div className="formSuccess" role="status">{state.success}</div> : null}
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents" }}>
        <div className="formGrid">
          <label>
            Nazwa
            <input name="name" required maxLength={organizerTextLimits.name} {...attrs("name")} value={values.name} onChange={event => setValues(previous => ({ ...previous, name: event.target.value }))} />
            {error("name")}
          </label>
          <label>
            Adres profilu
            <input name="slug" maxLength={organizerTextLimits.slug} {...attrs("slug")} value={values.slug} onChange={event => setValues(previous => ({ ...previous, slug: event.target.value }))} placeholder="generowany z nazwy" />
            {error("slug")}
          </label>
          <label>
            Typ organizatora
            <select name="type" {...attrs("type")} value={values.type} onChange={event => setValues(previous => ({ ...previous, type: event.target.value }))}>
              <option value="">Nieokreślony</option>
              {organizer.type && !organizerTypes.some(([value]) => value === organizer.type) ? <option value={organizer.type}>Inny typ</option> : null}
              {organizerTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {error("type")}
          </label>
        </div>
        <label>
          Opis
          <textarea name="description" rows={6} maxLength={organizerTextLimits.description} {...attrs("description")} value={values.description} onChange={event => setValues(previous => ({ ...previous, description: event.target.value }))} />
          {error("description")}
        </label>
        <div className="formGrid">
          {field("phone", "Telefon", "tel")}
          {field("email", "E-mail", "email")}
          {field("website", "Strona internetowa", "url")}
        </div>
        <div className="formGrid">
          {field("facebook_url", "Facebook", "url")}
          {field("instagram_url", "Instagram", "url")}
          {field("logo_url", "Adres obrazu logo", "url")}
        </div>
        <div className="managementActions">
          <button type="submit" className="primaryButton" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz profil"}</button>
        </div>
      </fieldset>
    </form>
  );
}
