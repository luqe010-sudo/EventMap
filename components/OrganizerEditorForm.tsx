import type { AdminOrganizer } from "@/lib/admin-organizers";

type OrganizerEditorFormProps = {
  action: (formData: FormData) => Promise<void>;
  organizer?: AdminOrganizer | null;
  submitLabel: string;
};

export default function OrganizerEditorForm({
  action,
  organizer,
  submitLabel
}: OrganizerEditorFormProps) {
  const owner = organizer?.organizer_users.find((item) => item.role === "owner") ?? organizer?.organizer_users[0];

  return (
    <form action={action} className="managementForm">
      <div className="formGrid">
        <label>
          Nazwa
          <input name="name" required defaultValue={organizer?.name ?? ""} />
        </label>
        <label>
          Slug
          <input name="slug" defaultValue={organizer?.slug ?? ""} placeholder="generowany z nazwy" />
        </label>
        <label>
          Typ
          <select name="type" defaultValue={organizer?.type ?? ""}>
            <option value="">Nieokreslony</option>
            <option value="company">Firma</option>
            <option value="institution">Instytucja</option>
            <option value="ngo">Organizacja / NGO</option>
            <option value="person">Osoba</option>
            <option value="venue">Miejsce</option>
          </select>
        </label>
      </div>

      <label>
        Opis
        <textarea name="description" rows={5} defaultValue={organizer?.description ?? ""} />
      </label>

      <div className="formGrid">
        <label>
          WWW
          <input name="website" type="url" defaultValue={organizer?.website ?? ""} />
        </label>
        <label>
          Facebook
          <input name="facebook_url" type="url" defaultValue={organizer?.facebook_url ?? ""} />
        </label>
        <label>
          Logo URL
          <input name="logo_url" type="url" defaultValue={organizer?.logo_url ?? ""} />
        </label>
      </div>

      <div className="formGrid">
        <label>
          Telefon
          <input name="phone" defaultValue={organizer?.phone ?? ""} />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={organizer?.email ?? ""} />
        </label>
        <label>
          User ID ownera
          <input name="owner_user_id" defaultValue={owner?.user_id ?? ""} placeholder="auth.users.id" />
        </label>
      </div>

      <label className="checkboxLabel">
        <input name="is_verified" type="checkbox" defaultChecked={Boolean(organizer?.is_verified)} />
        Zweryfikowany organizator
      </label>

      <div className="managementActions">
        <button type="submit" className="primaryButton">{submitLabel}</button>
      </div>
    </form>
  );
}
