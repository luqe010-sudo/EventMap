"use client";

import type { AdminLocation } from "@/lib/admin-locations";
import LocationPickerMap from "@/components/LocationPickerMap";

type LocationEditorFormProps = {
  action: (formData: FormData) => Promise<void>;
  location?: AdminLocation | null;
  submitLabel: string;
};

export default function LocationEditorForm({
  action,
  location,
  submitLabel
}: LocationEditorFormProps) {
  return (
    <form action={action} className="managementForm">
      <LocationPickerMap
        initialLocationId={location?.id}
        initialLatitude={location?.latitude}
        initialLongitude={location?.longitude}
        initialCity={location?.city?.name}
        initialAddress={location?.address}
        initialName={location?.name}
        initialPostalCode={location?.postal_code}
        initialVoivodeship={location?.voivodeship}
        initialCounty={location?.county}
        initialMunicipality={location?.municipality}
        showAdministrativeFields
      />

      <div className="formGrid">
        <label>
          Google Maps URL
          <input name="google_maps_url" type="url" defaultValue={location?.google_maps_url ?? ""} />
        </label>
        <label>
          Place ID
          <input name="place_id" defaultValue={location?.place_id ?? ""} />
        </label>
        <label>
          Wydarzenia
          <input value={location?.eventCount ?? 0} readOnly />
        </label>
      </div>

      <div className="managementActions">
        <button type="submit" className="primaryButton">{submitLabel}</button>
      </div>
    </form>
  );
}
