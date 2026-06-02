"use client";

import LocationPickerMap from "./LocationPickerMap";

type LocationSectionProps = {
  defaultLocation?: {
    id: string;
    name: string | null;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    postal_code: string | null;
    voivodeship: string | null;
    county: string | null;
    municipality: string | null;
  } | null;
};

export default function LocationSection({
  defaultLocation
}: LocationSectionProps) {
  return (
    <section className="managementSubsection">
      <h2>Lokalizacja</h2>
      <LocationPickerMap
        initialLocationId={defaultLocation?.id}
        initialLatitude={defaultLocation?.latitude}
        initialLongitude={defaultLocation?.longitude}
        initialCity={defaultLocation?.city}
        initialAddress={defaultLocation?.address}
        initialName={defaultLocation?.name}
        initialPostalCode={defaultLocation?.postal_code}
        initialVoivodeship={defaultLocation?.voivodeship}
        initialCounty={defaultLocation?.county}
        initialMunicipality={defaultLocation?.municipality}
      />
    </section>
  );
}
