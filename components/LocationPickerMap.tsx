"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { FilterSpecification } from "maplibre-gl";
import {
  reverseGeocode,
  searchPolishCities,
  searchStreetAddress,
  type GeocodingResult
} from "@/lib/geocoding";

type SavedLocation = {
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
};

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
  savedLocations?: SavedLocation[];
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const VOIVODESHIP_SOURCE_ID = "eventmap-voivodeships";
const DEFAULT_CENTER: [number, number] = [19.0, 52.0];
const DEFAULT_ZOOM = 5.5;
const CITY_ZOOM = 11;
const SELECTED_ZOOM = 15;
const SEARCH_DEBOUNCE_MS = 350;
const MAX_LOCAL_SUGGESTIONS = 8;

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
  showAdministrativeFields = false,
  savedLocations = []
}: LocationPickerMapProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSelectionRef = useRef<((lat: number, lng: number) => void) | undefined>(undefined);

  const initialSavedLocation = savedLocations.find((location) => location.id === initialLocationId);
  const [locationId, setLocationId] = useState(initialLocationId ?? "");
  const [savedLocationQuery, setSavedLocationQuery] = useState(
    initialSavedLocation ? formatSavedLocationLabel(initialSavedLocation) : ""
  );
  const [showSavedSuggestions, setShowSavedSuggestions] = useState(false);

  const [citySuggestions, setCitySuggestions] = useState<GeocodingResult[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);

  const [addressSuggestions, setAddressSuggestions] = useState<GeocodingResult[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);

  const [latitude, setLatitude] = useState<number | null>(initialLatitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude ?? null);
  const [city, setCity] = useState(initialCity ?? "");
  const [address, setAddress] = useState(initialAddress ?? "");
  const [locationName, setLocationName] = useState(initialName ?? "");
  const [postalCode, setPostalCode] = useState(initialPostalCode ?? "");
  const [voivodeship, setVoivodeship] = useState(initialVoivodeship ?? "");
  const [county, setCounty] = useState(initialCounty ?? "");
  const [municipality, setMunicipality] = useState(initialMunicipality ?? "");

  const hasInitialLocation = initialLatitude != null && initialLongitude != null;
  const savedLocationSuggestions = useMemo(() => {
    const query = normalizeSearch(savedLocationQuery);
    const ranked = savedLocations
      .map((location) => ({
        location,
        label: formatSavedLocationLabel(location)
      }))
      .filter((item) => {
        if (!query) return true;
        return normalizeSearch(item.label).includes(query);
      })
      .sort((a, b) => a.label.localeCompare(b.label, "pl"));

    return ranked.slice(0, MAX_LOCAL_SUGGESTIONS);
  }, [savedLocationQuery, savedLocations]);

  const placeMarker = useCallback((lng: number, lat: number) => {
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
  }, []);

  const clearMarker = useCallback(() => {
    markerRef.current?.remove();
    markerRef.current = null;
  }, []);

  const clearDatabaseSelection = useCallback(() => {
    setLocationId("");
    setSavedLocationQuery("");
  }, []);

  const clearPrecisePosition = useCallback(() => {
    setLatitude(null);
    setLongitude(null);
    clearMarker();
  }, [clearMarker]);

  const applyResult = useCallback((result: GeocodingResult) => {
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setCity(result.city ?? "");
    setAddress(result.address ?? "");
    setPostalCode(result.postalCode ?? "");
    setVoivodeship(result.voivodeship ?? "");
    setCounty(result.county ?? "");
    setMunicipality(result.municipality ?? "");
    clearDatabaseSelection();
  }, [clearDatabaseSelection]);

  const handleSavedLocationSelect = useCallback((selected: SavedLocation) => {
    setLocationId(selected.id);
    setSavedLocationQuery(formatSavedLocationLabel(selected));
    setLocationName(selected.name ?? "");
    setAddress(selected.address ?? "");
    setCity(selected.city?.name ?? "");
    setPostalCode(selected.postal_code ?? "");
    setVoivodeship(selected.voivodeship ?? "");
    setCounty(selected.county ?? "");
    setMunicipality(selected.municipality ?? "");
    setShowSavedSuggestions(false);
    setShowCitySuggestions(false);
    setShowAddressSuggestions(false);

    if (selected.latitude != null && selected.longitude != null) {
      setLatitude(selected.latitude);
      setLongitude(selected.longitude);
      placeMarker(selected.longitude, selected.latitude);
      mapRef.current?.flyTo({
        center: [selected.longitude, selected.latitude],
        zoom: SELECTED_ZOOM,
        duration: 700
      });
    } else {
      clearPrecisePosition();
    }
  }, [clearPrecisePosition, placeMarker]);

  const handleCityChange = useCallback((value: string) => {
    setCity(value);
    setAddress("");
    setPostalCode("");
    setVoivodeship("");
    setCounty("");
    setMunicipality("");
    clearDatabaseSelection();
    clearPrecisePosition();

    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);

    if (value.trim().length < 1) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      setCityLoading(false);
      return;
    }

    setCityLoading(true);
    cityDebounceRef.current = setTimeout(async () => {
      const results = await searchPolishCities(value);
      setCitySuggestions(results);
      setShowCitySuggestions(results.length > 0);
      setCityLoading(false);
    }, SEARCH_DEBOUNCE_MS);
  }, [clearDatabaseSelection, clearPrecisePosition]);

  const handleCitySelect = useCallback((result: GeocodingResult) => {
    setCity(result.city ?? result.displayName.split(",")[0] ?? "");
    setAddress("");
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setPostalCode("");
    setVoivodeship(result.voivodeship ?? "");
    setCounty(result.county ?? "");
    setMunicipality(result.municipality ?? "");
    clearDatabaseSelection();
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    placeMarker(result.longitude, result.latitude);
    mapRef.current?.flyTo({
      center: [result.longitude, result.latitude],
      zoom: CITY_ZOOM,
      duration: 700
    });
  }, [clearDatabaseSelection, placeMarker]);

  const handleAddressChange = useCallback((value: string) => {
    setAddress(value);
    setPostalCode("");
    clearDatabaseSelection();
    clearPrecisePosition();

    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);

    if (value.trim().length < 2 || city.trim().length < 2) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setAddressLoading(false);
      return;
    }

    setAddressLoading(true);
    addressDebounceRef.current = setTimeout(async () => {
      const results = await searchStreetAddress(value, city);
      setAddressSuggestions(results);
      setShowAddressSuggestions(results.length > 0);
      setAddressLoading(false);
    }, SEARCH_DEBOUNCE_MS);
  }, [city, clearDatabaseSelection, clearPrecisePosition]);

  const handleAddressSelect = useCallback((result: GeocodingResult) => {
    setLatitude(result.latitude);
    setLongitude(result.longitude);
    setAddress(result.address ?? result.displayName);
    if (result.city) setCity(result.city);
    setPostalCode(result.postalCode ?? "");
    setVoivodeship(result.voivodeship ?? voivodeship);
    setCounty(result.county ?? county);
    setMunicipality(result.municipality ?? municipality);
    clearDatabaseSelection();
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    placeMarker(result.longitude, result.latitude);
    mapRef.current?.flyTo({
      center: [result.longitude, result.latitude],
      zoom: SELECTED_ZOOM,
      duration: 700
    });
  }, [clearDatabaseSelection, county, municipality, placeMarker, voivodeship]);

  const handleAddressConfirm = useCallback(async () => {
    const typedAddress = address.trim();
    if (!typedAddress || !city.trim()) return;

    const existingSuggestion = addressSuggestions[0];
    if (existingSuggestion) {
      handleAddressSelect(existingSuggestion);
      return;
    }

    setAddressLoading(true);
    const results = await searchStreetAddress(typedAddress, city);
    setAddressLoading(false);
    if (results[0]) {
      handleAddressSelect(results[0]);
      return;
    }

    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
  }, [address, addressSuggestions, city, handleAddressSelect]);

  useEffect(() => {
    handleSelectionRef.current = async (lat: number, lng: number) => {
      setLatitude(lat);
      setLongitude(lng);
      placeMarker(lng, lat);

      const result = await reverseGeocode(lat, lng);
      if (result) applyResult(result);
    };
  }, [applyResult, placeMarker]);

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

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    mapRef.current = map;

    map.on("load", () => {
      applyPolishLabels(map);
      addAdministrativeBoundaryLayers(map);
      addHouseNumberLayer(map);
      if (hasInitialLocation) placeMarker(initialLongitude!, initialLatitude!);
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

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setShowSavedSuggestions(false);
      setShowCitySuggestions(false);
      setShowAddressSuggestions(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    return () => {
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    };
  }, []);

  return (
    <div className="locationPickerWrap" ref={rootRef}>
      {savedLocations.length ? (
        <div className="locationPickerSearchWrap">
          <label>
            Wybierz znane miejsce lub wypełnij lokalizację poniżej
            <div className="locationPickerSearchBox">
              <input
                type="text"
                value={savedLocationQuery}
                onChange={(e) => {
                  setSavedLocationQuery(e.target.value);
                  setLocationId("");
                  setShowSavedSuggestions(true);
                }}
                onFocus={() => setShowSavedSuggestions(true)}
                placeholder="Zacznij wpisywac nazwe miejsca, miasto albo adres"
                className="locationPickerSearchInput"
                autoComplete="off"
              />
            </div>
          </label>

          {showSavedSuggestions && savedLocationSuggestions.length > 0 ? (
            <ul className="locationPickerSuggestions">
              {savedLocationSuggestions.map(({ location, label }) => (
                <li key={location.id}>
                  <button
                    type="button"
                    className="locationPickerSuggestionItem"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSavedLocationSelect(location)}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div ref={containerRef} className="locationPickerMap" />
      <p className="locationPickerHint">
        Kliknij na mape lub przeciagnij pinezke, aby skorygowac lokalizacje.
        {latitude != null && longitude != null ? (
          <>
            {" "}
            Wspolrzedne: {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </>
        ) : null}
      </p>

      <div className="formGrid">
        <div className="locationPickerSearchWrap">
          <label>
            Miasto
            <div className="locationPickerSearchBox">
              <input
                name="location_city"
                value={city}
                onChange={(e) => handleCityChange(e.target.value)}
                onFocus={() => citySuggestions.length > 0 && setShowCitySuggestions(true)}
                placeholder="Wpisz miasto w Polsce"
                className="locationPickerSearchInput"
                autoComplete="off"
              />
              {cityLoading ? <span className="locationPickerSpinner" /> : null}
            </div>
          </label>

          {showCitySuggestions && citySuggestions.length > 0 ? (
            <ul className="locationPickerSuggestions">
              {citySuggestions.map((suggestion) => (
                <li key={`${suggestion.displayName}-${suggestion.latitude}-${suggestion.longitude}`}>
                  <button
                    type="button"
                    className="locationPickerSuggestionItem"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleCitySelect(suggestion)}
                  >
                    {suggestion.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="locationPickerSearchWrap">
          <label>
            Ulica i numer
            <div className="locationPickerSearchBox">
              <input
                name="location_address"
                value={address}
                onChange={(e) => handleAddressChange(e.target.value)}
                onFocus={() => addressSuggestions.length > 0 && setShowAddressSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  void handleAddressConfirm();
                }}
                placeholder={city.trim() ? "Wpisz ulice i numer" : "Najpierw wybierz miasto"}
                className="locationPickerSearchInput"
                autoComplete="off"
                disabled={!city.trim()}
              />
              {addressLoading ? <span className="locationPickerSpinner" /> : null}
            </div>
          </label>

          {showAddressSuggestions && addressSuggestions.length > 0 ? (
            <ul className="locationPickerSuggestions">
              {addressSuggestions.map((suggestion) => (
                <li key={`${suggestion.displayName}-${suggestion.latitude}-${suggestion.longitude}`}>
                  <button
                    type="button"
                    className="locationPickerSuggestionItem"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAddressSelect(suggestion)}
                  >
                    {suggestion.address ?? suggestion.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <label>
          Nazwa miejsca
          <input
            name="location_name"
            value={locationName}
            onChange={(e) => {
              setLocationName(e.target.value);
              clearDatabaseSelection();
            }}
            placeholder="np. Dom Kultury"
          />
        </label>
      </div>

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

function formatSavedLocationLabel(location: SavedLocation) {
  return [location.name, location.city?.name, location.address].filter(Boolean).join(", ");
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function applyPolishLabels(map: maplibregl.Map) {
  const layers = map.getStyle().layers ?? [];
  layers.forEach((layer) => {
    if (layer.type !== "symbol" || !layer.layout?.["text-field"]) return;
    prioritizePlaceLabel(map, layer);

    const id = layer.id.toLowerCase();
    if (
      id.includes("housenumber") ||
      id.includes("address") ||
      id.includes("shield") ||
      id.includes("ref")
    ) {
      return;
    }

    const field = JSON.stringify(layer.layout["text-field"]).toLowerCase();
    if (
      !field.includes("name") &&
      !id.includes("label") &&
      !id.includes("place") &&
      !id.includes("poi")
    ) {
      return;
    }

    map.setLayoutProperty(layer.id, "text-field", [
      "coalesce",
      ["get", "name:pl"],
      ["get", "name"],
      ["get", "name:latin"],
      ["get", "name:nonlatin"]
    ]);
  });

  addPriorityCityLabels(map);
}

function prioritizePlaceLabel(
  map: maplibregl.Map,
  layer: Extract<maplibregl.LayerSpecification, { type: "symbol" }>
) {
  if (layer.id === "label_city" || layer.id === "label_city_capital") {
    map.setLayerZoomRange(layer.id, 1, layer.maxzoom ?? 24);
    map.setLayoutProperty(layer.id, "symbol-sort-key", ["coalesce", ["get", "rank"], 99]);
    map.setLayoutProperty(layer.id, "text-padding", 1);
    return;
  }

  if (layer.id === "label_town") {
    map.setLayerZoomRange(layer.id, 1, layer.maxzoom ?? 24);
    map.setLayoutProperty(layer.id, "symbol-sort-key", ["coalesce", ["get", "rank"], 99]);
    map.setLayoutProperty(layer.id, "text-padding", 1);
    return;
  }

  if (layer.id === "label_village") {
    map.setLayerZoomRange(layer.id, 1.5, layer.maxzoom ?? 24);
    map.setLayoutProperty(layer.id, "symbol-sort-key", ["coalesce", ["get", "rank"], 99]);
    map.setLayoutProperty(layer.id, "text-padding", 1);
  }
}

function addPriorityCityLabels(map: maplibregl.Map) {
  const sourceId = getVectorTileSourceId(map);
  if (!sourceId || map.getLayer("eventmap-major-city-labels")) return;

  map.addLayer({
    id: "eventmap-major-city-labels",
    type: "symbol",
    source: sourceId,
    "source-layer": "place",
    minzoom: 1,
    maxzoom: 7,
    filter: [
      "all",
      ["in", ["get", "class"], ["literal", ["city", "town"]]],
      ["<=", ["get", "rank"], 8]
    ] as FilterSpecification,
    layout: {
      "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
      "text-allow-overlap": true,
      "text-field": [
        "coalesce",
        ["get", "name:pl"],
        ["get", "name"],
        ["get", "name:latin"],
        ["get", "name:nonlatin"]
      ],
      "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 2, 10, 5, 12, 7, 14]
    },
    paint: {
      "text-color": "#111827",
      "text-halo-blur": 0.8,
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.4
    }
  });
}

function addAdministrativeBoundaryLayers(map: maplibregl.Map) {
  const sourceId = getVectorTileSourceId(map);

  if (!map.getSource(VOIVODESHIP_SOURCE_ID)) {
    map.addSource(VOIVODESHIP_SOURCE_ID, {
      type: "geojson",
      data: "/data/wojewodztwa-min.geojson"
    });
  }

  const beforeId = findFirstSymbolLayerId(map);

  if (!map.getLayer("eventmap-voivodeship-fill")) {
    map.addLayer(
      {
        id: "eventmap-voivodeship-fill",
        type: "fill",
        source: VOIVODESHIP_SOURCE_ID,
        paint: {
          "fill-color": [
            "match",
            ["get", "nazwa"],
            "dolnośląskie",
            "#f59e0b",
            "kujawsko-pomorskie",
            "#22c55e",
            "lubelskie",
            "#3b82f6",
            "lubuskie",
            "#ec4899",
            "łódzkie",
            "#8b5cf6",
            "małopolskie",
            "#14b8a6",
            "mazowieckie",
            "#ef4444",
            "opolskie",
            "#0ea5e9",
            "podkarpackie",
            "#eab308",
            "podlaskie",
            "#10b981",
            "pomorskie",
            "#2563eb",
            "śląskie",
            "#d946ef",
            "świętokrzyskie",
            "#f97316",
            "warmińsko-mazurskie",
            "#06b6d4",
            "wielkopolskie",
            "#84cc16",
            "zachodniopomorskie",
            "#6366f1",
            "#f59e0b"
          ],
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            0.18,
            7,
            0.23,
            10,
            0.17
          ]
        }
      },
      beforeId
    );
  }

  if (!map.getLayer("eventmap-voivodeship-boundaries")) {
    map.addLayer(
      {
        id: "eventmap-voivodeship-boundaries",
        type: "line",
        source: VOIVODESHIP_SOURCE_ID,
        paint: {
          "line-color": "#dc2626",
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            0.5,
            8,
            0.68,
            11,
            0.78
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            1.4,
            8,
            2.4,
            11,
            3.4
          ],
          "line-blur": 0.12
        }
      },
      beforeId
    );
  }

  if (sourceId && !map.getLayer("eventmap-county-boundaries")) {
    map.addLayer(
      {
        id: "eventmap-county-boundaries",
        type: "line",
        source: sourceId,
        "source-layer": "boundary",
        minzoom: 3,
        filter: adminLevelFilter("6"),
        paint: {
          "line-color": "#1d4ed8",
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            0.05,
            3.5,
            0.08,
            4,
            0.12,
            5,
            0.24,
            6,
            0.42,
            10,
            0.62,
            13,
            0.78
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            0.3,
            3.5,
            0.4,
            4,
            0.5,
            5,
            0.7,
            6,
            1,
            10,
            1.8,
            13,
            2.6
          ],
          "line-dasharray": [3, 1.5]
        }
      },
      beforeId
    );
  }
}

function addHouseNumberLayer(map: maplibregl.Map) {
  const sourceId = getVectorTileSourceId(map);
  if (!sourceId || map.getLayer("eventmap-house-numbers")) return;

  map.addLayer({
    id: "eventmap-house-numbers",
    type: "symbol",
    source: sourceId,
    "source-layer": "housenumber",
    minzoom: 17,
    layout: {
      "text-field": ["get", "housenumber"],
      "text-font": ["Noto Sans Regular"],
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        17,
        10,
        19,
        12
      ],
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#4b5563",
      "text-halo-color": "rgba(255, 255, 255, 0.88)",
      "text-halo-width": 1
    }
  });
}

function getVectorTileSourceId(map: maplibregl.Map) {
  const sources = map.getStyle().sources ?? {};
  const preferredSourceIds = [
    "openmaptiles",
    "openfreemap",
    "openstreetmap",
    "openstreetmap-openmaptiles"
  ];

  const preferredSourceId = preferredSourceIds.find((sourceId) => sources[sourceId]?.type === "vector");
  if (preferredSourceId) return preferredSourceId;

  return Object.entries(sources).find(([, source]) => source.type === "vector")?.[0] ?? null;
}

function findFirstSymbolLayerId(map: maplibregl.Map) {
  return map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
}

function adminLevelFilter(adminLevel: string): FilterSpecification {
  return ["==", ["to-string", ["get", "admin_level"]], adminLevel];
}
