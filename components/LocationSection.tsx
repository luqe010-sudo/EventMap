"use client";

import LocationPickerMap from "./LocationPickerMap";

type LocationSectionProps = {
  defaultLocation?: {
    id: string;
    name: string | null;
    address: string | null;
    city: { name: string } | null;
    latitude: number | null;
    longitude: number | null;
    postal_code: string | null;
    voivodeship: string | null;
    county: string | null;
    municipality: string | null;
  } | null;
  savedLocations?: Array<{
    id: string;
    name: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    postal_code: string | null;
    voivodeship: string | null;
    county: string | null;
    municipality: string | null;
    city: { name: string } | null;
  }>;
};

export default function LocationSection({
  defaultLocation,
  savedLocations = []
}: LocationSectionProps) {
  return (
    <section className="managementSubsection">
      <h2>Lokalizacja</h2>
      <LocationPickerMap
        initialLocationId={defaultLocation?.id}
        initialLatitude={defaultLocation?.latitude}
        initialLongitude={defaultLocation?.longitude}
        initialCity={defaultLocation?.city?.name}
        initialAddress={defaultLocation?.address}
        initialName={defaultLocation?.name}
        initialPostalCode={defaultLocation?.postal_code}
        initialVoivodeship={defaultLocation?.voivodeship}
        initialCounty={defaultLocation?.county}
        initialMunicipality={defaultLocation?.municipality}
        savedLocations={savedLocations}
      />
    </section>
  );
}
