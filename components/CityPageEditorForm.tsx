import type { AdminCityPage } from "@/lib/admin-city-pages";

type CityPageEditorFormProps = {
  action: (formData: FormData) => Promise<void>;
  cityPage?: AdminCityPage | null;
  submitLabel: string;
};

export default function CityPageEditorForm({
  action,
  cityPage,
  submitLabel
}: CityPageEditorFormProps) {
  return (
    <form action={action} className="managementForm">
      <div className="formGrid">
        <label>
          Miasto *
          <input name="city" required defaultValue={cityPage?.city?.name ?? ""} />
        </label>
        <label>
          Slug
          <input name="slug" defaultValue={cityPage?.city?.slug ?? ""} placeholder="generowany z nazwy miasta" />
        </label>
        <label className="checkboxLabel">
          <input name="is_active" type="checkbox" defaultChecked={cityPage?.city?.is_active ?? true} />
          Aktywna strona
        </label>
      </div>

      <div className="formGrid">
        <label>
          Powiat
          <input name="county" defaultValue={cityPage?.city?.county ?? ""} />
        </label>
        <label>
          Wojewodztwo
          <input name="voivodeship" defaultValue={cityPage?.city?.voivodeship ?? ""} />
        </label>
        <label>
          Liczba wydarzen
          <input value={cityPage?.eventCount ?? 0} readOnly />
        </label>
      </div>

      <div className="formGrid">
        <label>
          Szerokosc centrum
          <input name="latitude" type="number" step="0.000001" defaultValue={cityPage?.city?.latitude ?? ""} />
        </label>
        <label>
          Dlugosc centrum
          <input name="longitude" type="number" step="0.000001" defaultValue={cityPage?.city?.longitude ?? ""} />
        </label>
      </div>

      <label>
        Meta title
        <input name="meta_title" defaultValue={cityPage?.meta_title ?? ""} />
      </label>

      <label>
        Meta description
        <textarea name="meta_description" rows={3} defaultValue={cityPage?.meta_description ?? ""} />
      </label>

      <label>
        Tekst wstepny
        <textarea name="intro_text" rows={6} defaultValue={cityPage?.intro_text ?? ""} />
      </label>

      <div className="managementActions">
        <button type="submit" className="primaryButton">{submitLabel}</button>
      </div>
    </form>
  );
}
