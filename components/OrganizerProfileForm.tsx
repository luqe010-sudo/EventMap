import type { OrganizerProfile } from "@/lib/organizer-events";

type OrganizerProfileFormProps = {
  action: (formData: FormData) => Promise<void>;
  organizer: OrganizerProfile;
};

export default function OrganizerProfileForm({
  action,
  organizer
}: OrganizerProfileFormProps) {
  return (
    <form action={action} className="managementForm">
      <div className="formGrid">
        <label>
          Nazwa
          <input name="name" required defaultValue={organizer.name} />
        </label>
        <label>
          Slug
          <input name="slug" defaultValue={organizer.slug} placeholder="generowany z nazwy" />
        </label>
        <label>
          Typ organizatora
          <select name="type" defaultValue={organizer.type ?? ""}>
            <option value="">Nieokreslony</option>
            <option value="club">Klub</option>
            <option value="culture_center">Dom kultury</option>
            <option value="restaurant">Restauracja</option>
            <option value="person">Osoba prywatna</option>
            <option value="company">Firma</option>
            <option value="institution">Instytucja</option>
            <option value="ngo">Organizacja / NGO</option>
            <option value="venue">Miejsce</option>
          </select>
        </label>
      </div>

      <label>
        Opis
        <textarea name="description" rows={6} defaultValue={organizer.description ?? ""} />
      </label>

      <div className="formGrid">
        <label>
          Telefon
          <input name="phone" defaultValue={organizer.phone ?? ""} />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={organizer.email ?? ""} />
        </label>
        <label>
          WWW
          <input name="website" type="url" defaultValue={organizer.website ?? ""} />
        </label>
      </div>

      <div className="formGrid">
        <label>
          Facebook
          <input name="facebook_url" type="url" defaultValue={organizer.facebook_url ?? ""} />
        </label>
        <label>
          Instagram
          <input name="instagram_url" type="url" defaultValue={organizer.instagram_url ?? ""} />
        </label>
        <label>
          Logo URL
          <input name="logo_url" type="url" defaultValue={organizer.logo_url ?? ""} />
        </label>
      </div>

      <div className="schemaNotice">
        Zdjecie w tle, TikTok i stale miasto dzialania wymagaja nowych kolumn w bazie. Nie zapisuje ich tutaj, zeby nie zgadywac struktury.
      </div>

      <div className="managementActions">
        <button type="submit" className="primaryButton">Zapisz profil</button>
      </div>
    </form>
  );
}
