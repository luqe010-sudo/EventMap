"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import {
  searchAddress,
  reverseGeocode,
  type GeocodingResult
} from "@/lib/geocoding";

type LocationPickerMapProps = {
  initialLocationId?: string | null;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialCity?: string | null;
  initialAddress?: string | null;
  initialName?: string | null;
  initialPostalCode?: string | null;
  initialVoivodeship?: string | null;
  initialCounty?: string | null;
  initialMunicipality?: string | null;
  showAdministrativeFields?: boolean;
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_CENTER: [number, number] = [19.0, 52.0];
const DEFAULT_ZOOM = 5.5;
const SELECTED_ZOOM = 15;
const SEARCH_DEBOUNCE_MS = 350;

export default function LocationPickerMap({
  initialLocationId,
  initialLatitude,
  initialLongitude,
  initialCity,
  initialAddress,
  initialName,
  initialPostalCode,
  initialVoivodeship,
  initialCounty,
  initialMunicipality,
  showAdministrativeFields = false
}: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSelectionRef = useRef<((lat: number, lng: number) => void) | undefined>(undefined);
  const manualGeocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [locationId, setLocationId] = useState(initialLocationId ?? "");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  const [latitude, setLatitude] = useState<number | null>(
    initialLatitude ?? null
  );
  const [longitude, setLongitude] = useState<number | null>(
    initialLongitude ?? null
  );
  const [city, setCity] = useState(initialCity ?? "");
  const [address, setAddress] = useState(initialAddress ?? "");
  const [locationName, setLocationName] = useState(initialName ?? "");
  const [postalCode, setPostalCode] = useState(initialPostalCode ?? "");
  const [voivodeship, setVoivodeship] = useState(initialVoivodeship ?? "");
  const [county, setCounty] = useState(initialCounty ?? "");
  const [municipality, setMunicipality] = useState(initialMunicipality ?? "");

  const hasInitialLocation =
    initialLatitude != null && initialLongitude != null;

  const placeMarker = useCallback(
    (lng: number, lat: number) => {
      const map = mapRef.current;
      if (!map) return;

      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({
          color: "#d95d39",
          draggable: true
        })
          .setLngLat([lng, lat])
          .addTo(map);

        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLngLat();
          handleSelectionRef.current?.(pos.lat, pos.lng);
        });
      } else {
        markerRef.current.setLngLat([lng, lat]);
      }
    },
    []
  );

  const applyResult = useCallback((result: GeocodingResult) => {
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setCity(result.city ?? "");
    setAddress(result.address ?? "");
    setPostalCode(result.postalCode ?? "");
    setVoivodeship(result.voivodeship ?? "");
    setCounty(result.county ?? "");
    setMunicipality(result.municipality ?? "");
    setLocationId(""); // User edited/placed marker -> clear database ID
  }, []);

  const triggerManualAddressGeocode = useCallback((addrVal: string, cityVal: string) => {
    if (manualGeocodeDebounceRef.current) {
      clearTimeout(manualGeocodeDebounceRef.current);
    }

    const combinedQuery = [addrVal, cityVal].filter(Boolean).join(", ");
    if (combinedQuery.trim().length < 5) return;

    manualGeocodeDebounceRef.current = setTimeout(async () => {
      const results = await searchAddress(combinedQuery);
      if (results && results.length > 0) {
        const topResult = results[0];
        setLatitude(topResult.latitude);
        setLongitude(topResult.longitude);
        setPostalCode(topResult.postalCode ?? "");
        setVoivodeship(topResult.voivodeship ?? "");
        setCounty(topResult.county ?? "");
        setMunicipality(topResult.municipality ?? "");
        setLocationId(""); // Clear database ID when manual geocoding succeeds

        placeMarker(topResult.longitude, topResult.latitude);

        mapRef.current?.flyTo({
          center: [topResult.longitude, topResult.latitude],
          zoom: SELECTED_ZOOM,
          duration: 800
        });
      }
    }, 800);
  }, [placeMarker]);

  /* Keep the ref in sync so event handlers never go stale */
  useEffect(() => {
    handleSelectionRef.current = async (lat: number, lng: number) => {
      setLatitude(lat);
      setLongitude(lng);
      placeMarker(lng, lat);

      const result = await reverseGeocode(lat, lng);
      if (result) applyResult(result);
    };
  }, [placeMarker, applyResult]);

  const handleSuggestionSelect = useCallback(
    (result: GeocodingResult) => {
      applyResult(result);
      placeMarker(result.longitude, result.latitude);
      setQuery(result.displayName);
      setSuggestions([]);
      setShowSuggestions(false);

      mapRef.current?.flyTo({
        center: [result.longitude, result.latitude],
        zoom: SELECTED_ZOOM,
        duration: 800
      });
    },
    [applyResult, placeMarker]
  );

  const handleSearchChange = useCallback((value: string) => {
    setQuery(value);
    setLocationId("");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchAddress(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  /* Initialize map */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = hasInitialLocation
      ? [initialLongitude!, initialLatitude!]
      : DEFAULT_CENTER;
    const zoom = hasInitialLocation ? SELECTED_ZOOM : DEFAULT_ZOOM;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center,
      zoom,
      attributionControl: false
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-left"
    );
    mapRef.current = map;

    map.on("load", () => {
      applyPolishLabels(map);

      if (hasInitialLocation) {
        placeMarker(initialLongitude!, initialLatitude!);
      }
    });

    map.on("click", (e) => {
      handleSelectionRef.current?.(e.lngLat.lat, e.lngLat.lng);
      map.flyTo({
        center: [e.lngLat.lng, e.lngLat.lat],
        zoom: Math.max(map.getZoom(), 13),
        duration: 400
      });
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Close suggestions on outside click */
  useEffect(() => {
    const close = () => setShowSuggestions(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="locationPickerWrap">
      {/* Search */}
      <div
        className="locationPickerSearchWrap"
        onClick={(e) => e.stopPropagation()}
      >
        <label>
          Wyszukaj adres
          <div className="locationPickerSearchBox">
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() =>
                suggestions.length > 0 && setShowSuggestions(true)
              }
              placeholder="np. Rynek Glowny 1, Krakow"
              className="locationPickerSearchInput"
              autoComplete="off"
            />
            {loading && <span className="locationPickerSpinner" />}
          </div>
        </label>

        {showSuggestions && (
          <ul className="locationPickerSuggestions">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="locationPickerSuggestionItem"
                  onClick={() => handleSuggestionSelect(s)}
                >
                  {s.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div ref={containerRef} className="locationPickerMap" />
      <p className="locationPickerHint">
        Kliknij na mape lub przeciagnij pinezke, aby skorygowac lokalizacje.
        {latitude != null && longitude != null && (
          <>
            {" "}
            Wspolrzedne: {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </>
        )}
      </p>

      {/* Visible form fields */}
      <div className="formGrid">
        <label>
          Nazwa miejsca
          <input
            name="location_name"
            value={locationName}
            onChange={(e) => {
              setLocationName(e.target.value);
              setLocationId("");
            }}
            placeholder="np. Dom Kultury"
          />
        </label>
        <label>
          Adres
          <input
            name="location_address"
            value={address}
            onChange={(e) => {
              const val = e.target.value;
              setAddress(val);
              setLocationId("");
              triggerManualAddressGeocode(val, city);
            }}
          />
        </label>
        <label>
          Miasto
          <input
            name="location_city"
            value={city}
            onChange={(e) => {
              const val = e.target.value;
              setCity(val);
              setLocationId("");
              triggerManualAddressGeocode(address, val);
            }}
          />
        </label>
      </div>

      {/* Hidden fields — consumed by server action */}
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="location_latitude" value={latitude ?? ""} />
      <input type="hidden" name="location_longitude" value={longitude ?? ""} />
      {showAdministrativeFields ? (
        <div className="formGrid">
          <label>
            Kod pocztowy
            <input
              name="location_postal_code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </label>
          <label>
            Gmina
            <input
              name="location_municipality"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
            />
          </label>
          <label>
            Powiat
            <input
              name="location_county"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
            />
          </label>
          <label>
            Wojewodztwo
            <input
              name="location_voivodeship"
              value={voivodeship}
              onChange={(e) => setVoivodeship(e.target.value)}
            />
          </label>
        </div>
      ) : (
        <>
          <input type="hidden" name="location_postal_code" value={postalCode} />
          <input type="hidden" name="location_voivodeship" value={voivodeship} />
          <input type="hidden" name="location_county" value={county} />
          <input type="hidden" name="location_municipality" value={municipality} />
        </>
      )}
    </div>
  );
}

/* Polish labels — same logic as main MapLibreMap */
function applyPolishLabels(map: maplibregl.Map) {
  const layers = map.getStyle().layers ?? [];
  layers.forEach((layer) => {
    if (layer.type !== "symbol" || !layer.layout?.["text-field"]) return;
    const id = layer.id.toLowerCase();
    if (
      id.includes("housenumber") ||
      id.includes("address") ||
      id.includes("shield") ||
      id.includes("ref")
    )
      return;

    const field = JSON.stringify(layer.layout["text-field"]).toLowerCase();
    if (
      !field.includes("name") &&
      !id.includes("label") &&
      !id.includes("place") &&
      !id.includes("poi")
    )
      return;

    map.setLayoutProperty(layer.id, "text-field", [
      "coalesce",
      ["get", "name:pl"],
      ["get", "name"],
      ["get", "name:latin"],
      ["get", "name:nonlatin"]
    ]);
  });
}
