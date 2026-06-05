import { createOrganizerAccountAction, organizerUpdateAccountAction } from "@/lib/organizer-events";
import type { CurrentUserContext, OrganizerMembership } from "@/lib/auth";

type OrganizerSettingsFormProps = {
  context: CurrentUserContext;
  memberships: OrganizerMembership[];
};

export function OrganizerSettingsForm({
  context,
  memberships
}: OrganizerSettingsFormProps) {
  return (
    <div className="organizerSettingsGrid">
      <section className="managementPanel">
        <div className="managementPanelHeader">
          <h2>Ustawienia konta</h2>
        </div>
        <form action={organizerUpdateAccountAction} className="managementForm">
          <label>
            Imie / nazwa kontaktowa
            <input name="display_name" required defaultValue={context.profile?.display_name ?? ""} />
          </label>
          <label>
            Rola
            <input value={context.profile?.role ?? "user"} readOnly />
          </label>
          <div className="managementActions">
            <button type="submit" className="primaryButton">Zapisz ustawienia</button>
          </div>
        </form>
      </section>

      <section className="managementPanel">
        <div className="managementPanelHeader">
          <h2>Powiazani organizatorzy</h2>
        </div>
        {memberships.length ? (
          <ul className="organizerPlainList">
            {memberships.map((membership) => (
              <li key={membership.id}>
                <strong>{membership.organizer?.name ?? membership.organizer_id}</strong>
                <span>{membership.role ?? "member"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panelMutedText">Konto nie jest jeszcze powiazane z organizatorem.</p>
        )}
      </section>

      <section className="managementPanel">
        <div className="managementPanelHeader">
          <h2>Bezpieczenstwo i RODO</h2>
        </div>
        <div className="schemaNotice">
          Zmiana emaila, hasla i usuniecie konta wymagaja osobnych przeplywow Supabase Auth. Sekcja jest przygotowana pod kolejne akcje, bez zapisywania sekretow ani obchodzenia Auth.
        </div>
      </section>
    </div>
  );
}

export function OrganizerUpgradeForm({
  displayName
}: {
  displayName: string | null | undefined;
}) {
  return (
    <section className="managementPanel loginPanel">
      <p className="eyebrow">Panel organizatora</p>
      <h1>Rozszerz konto</h1>
      <p className="panelMutedText">
        Utworz profil organizatora, zeby dodawac wydarzenia i wysylac je do akceptacji.
      </p>
      <form action={createOrganizerAccountAction} className="managementForm">
        <label>
          Nazwa organizatora
          <input name="organizer_name" required defaultValue={displayName ?? ""} />
        </label>
        <button type="submit" className="primaryButton">Utworz konto organizatora</button>
      </form>
    </section>
  );
}
