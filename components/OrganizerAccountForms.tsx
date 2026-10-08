"use client";

import Link from "next/link";
import { startTransition, useActionState, useId, useState, type FormEvent } from "react";
import { createOrganizerAccountFormAction, organizerUpdateAccountFormAction } from "@/lib/organizer-form-actions";
import { organizerTextLimits, type OrganizerFormState } from "@/lib/organizer-form-validation";
import type { CurrentUserContext, OrganizerMembership } from "@/lib/auth";

function useOrganizerForm(action: (state: OrganizerFormState, data: FormData) => Promise<OrganizerFormState>) {
  const [state, formAction, pending] = useActionState(action, { fieldErrors: {}, error: null });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || state.creationUnconfirmed) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }
  return { state, formAction, pending, submit };
}

export function OrganizerSettingsForm({ context, memberships }: { context: CurrentUserContext; memberships: OrganizerMembership[] }) {
  const { state, formAction, pending, submit } = useOrganizerForm(organizerUpdateAccountFormAction);
  const [displayName, setDisplayName] = useState(context.profile?.display_name ?? "");
  const id = useId();
  const roleLabels: Record<string, string> = { user: "Użytkownik", organizer: "Organizator", admin: "Administrator" };
  const membershipLabels: Record<string, string> = { owner: "Właściciel", member: "Członek" };
  return (
    <div className="organizerSettingsGrid">
      <section className="managementPanel">
        <div className="managementPanelHeader"><h2>Ustawienia konta</h2></div>
        <form action={formAction} onSubmit={submit} aria-busy={pending} className="managementForm">
          {state.error ? <div className="formError" role="alert">{state.error}</div> : null}
          {state.error && !Object.keys(state.fieldErrors).length ? <a href="/organizer/settings" target="_blank" rel="noopener noreferrer">Sprawdź ustawienia w nowej karcie</a> : null}
          {state.success ? <div className="formSuccess" role="status">{state.success}</div> : null}
          <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents" }}>
            <label>
              Imię / nazwa kontaktowa
              <input name="display_name" required maxLength={organizerTextLimits.display_name} value={displayName} onChange={event => setDisplayName(event.target.value)} aria-invalid={Boolean(state.fieldErrors.display_name)} aria-describedby={state.fieldErrors.display_name ? `${id}-display_name` : undefined} />
              {state.fieldErrors.display_name ? <span id={`${id}-display_name`} className="formError">{state.fieldErrors.display_name}</span> : null}
            </label>
            <label>Rola<input value={roleLabels[context.profile?.role ?? "user"] ?? "Użytkownik"} readOnly /></label>
            <div className="managementActions"><button type="submit" className="primaryButton" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz ustawienia"}</button></div>
          </fieldset>
        </form>
      </section>
      <section className="managementPanel">
        <div className="managementPanelHeader"><h2>Powiązani organizatorzy</h2></div>
        {memberships.length ? (
          <ul className="organizerPlainList">
            {memberships.map(membership => <li key={membership.id}><strong>{membership.organizer?.name ?? "Organizator"}</strong><span>{membershipLabels[membership.role ?? "member"] ?? "Członek"}</span></li>)}
          </ul>
        ) : <p className="panelMutedText">Konto nie jest jeszcze powiązane z organizatorem.</p>}
      </section>
      <section className="managementPanel">
        <div className="managementPanelHeader"><h2>Bezpieczeństwo konta</h2></div>
        <p className="panelMutedText">Aby zmienić hasło, poproś o link wysłany na adres e-mail konta.</p>
        <Link href="/forgot-password?next=%2Forganizer%2Fsettings" className="secondaryButton">Zmień hasło</Link>
      </section>
    </div>
  );
}

export function OrganizerUpgradeForm({ displayName }: { displayName: string | null | undefined }) {
  const { state, formAction, pending, submit } = useOrganizerForm(createOrganizerAccountFormAction);
  const [organizerName, setOrganizerName] = useState(displayName ?? "");
  const id = useId();
  return (
    <section className="managementPanel loginPanel">
      <p className="eyebrow">Panel organizatora</p>
      <h1>Rozszerz konto</h1>
      <p className="panelMutedText">Profil organizatora pozwala dodawać wydarzenia i wysyłać je do akceptacji.</p>
      <form action={formAction} onSubmit={submit} aria-busy={pending} className="managementForm">
        {state.error ? <div className="formError" role="alert">{state.error}</div> : null}
        {state.creationUnconfirmed ? <a href="/organizer" target="_blank" rel="noopener noreferrer">Sprawdź panel w nowej karcie</a> : null}
        <label>
          Nazwa organizatora
          <input name="organizer_name" required maxLength={organizerTextLimits.organizer_name} value={organizerName} onChange={event => setOrganizerName(event.target.value)} disabled={pending} aria-invalid={Boolean(state.fieldErrors.organizer_name)} aria-describedby={state.fieldErrors.organizer_name ? `${id}-organizer_name` : undefined} />
          {state.fieldErrors.organizer_name ? <span id={`${id}-organizer_name`} className="formError">{state.fieldErrors.organizer_name}</span> : null}
        </label>
        {state.creationUnconfirmed ? <p className="formHint">Nie ponawiaj tworzenia profilu, dopóki jego wynik nie zostanie sprawdzony. Możesz skopiować zachowaną nazwę.</p> : null}
        <button type="submit" className="primaryButton" disabled={pending || state.creationUnconfirmed}>{pending ? "Tworzenie…" : "Utwórz profil organizatora"}</button>
      </form>
    </section>
  );
}
