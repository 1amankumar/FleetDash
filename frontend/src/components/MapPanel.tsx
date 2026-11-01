
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { MutableRefObject } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import FleetCanvas from "./FleetCanvas";
import { Layers, Maximize2 } from "lucide-react";
import L from "leaflet";

import type { Vehicle as AppVehicle } from "../App";
import { useTelemetry } from "../hooks/useTelemetry";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Vehicle = Omit<AppVehicle, "vehicleId"> & {
  vehicleId: string;
};

type TelemetryPoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
  speed: number;
};

type VehicleLocation = {
  vehicle: Vehicle;
  telemetry: TelemetryPoint;
};

type VehiclesResponse = {
  success: boolean;
  data: AppVehicle[];
};

type TelemetryResponse = {
  success: boolean;
  data: TelemetryPoint[];
};

type MapPanelProps = {
  selectedVehicleId: string | null;
};

// --------------------------------------------------
// VEHICLE MARKER ICON
// --------------------------------------------------

const vehicleIcon = new L.DivIcon({
  className: "vehicle-map-marker",
  html: '<div class="vehicle-marker-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// --------------------------------------------------
// DISPLAY POSITION
// --------------------------------------------------

function getDisplayPosition(
  locations: VehicleLocation[],
  vehicleId: string
): [number, number] {
  const current = locations.find(
    (item) => item.vehicle.vehicleId === vehicleId
  );

  if (!current) {
    return [23.7957, 86.4304];
  }

  const { latitude, longitude } = current.telemetry;

  const overlapping = locations.filter(
    (item) =>
      item.telemetry.latitude === latitude &&
      item.telemetry.longitude === longitude
  );

  if (overlapping.length <= 1) {
    return [latitude, longitude];
  }

  const index = overlapping.findIndex(
    (item) => item.vehicle.vehicleId === vehicleId
  );

  const angle = (2 * Math.PI * index) / overlapping.length;
  const radius = 0.00018;

  return [
    latitude + Math.sin(angle) * radius,
    longitude + Math.cos(angle) * radius,
  ];
}

// --------------------------------------------------
// MAP CONTROLLER
// --------------------------------------------------

function MapController({
  locations,
  selectedVehicleId,
  markerRefs,
  resetView,
}: {
  locations: VehicleLocation[];
  selectedVehicleId: string | null;
  markerRefs: MutableRefObject<Record<string, L.Marker | null>>;
  resetView: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedVehicleId) {
      const selected = locations.find(
        ({ vehicle }) => vehicle.vehicleId === selectedVehicleId
      );

      if (!selected) return;

      const [latitude, longitude] = getDisplayPosition(
        locations,
        selectedVehicleId
      );

      map.flyTo([latitude, longitude], 14, {
        duration: 0.6,
      });

      const timer = window.setTimeout(() => {
        markerRefs.current[selectedVehicleId]?.openPopup();
      }, 650);

      return () => window.clearTimeout(timer);
    }

    if (locations.length === 1) {
      const [latitude, longitude] = getDisplayPosition(
        locations,
        locations[0].vehicle.vehicleId
      );

      map.setView([latitude, longitude], 13);
    } else if (locations.length > 1) {
      const points = locations.map(({ vehicle }) =>
        getDisplayPosition(locations, vehicle.vehicleId)
      );

      const bounds = L.latLngBounds(points);

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 14,
        });
      }
    }
  }, [map, locations, selectedVehicleId, markerRefs]);

  useEffect(() => {
    if (resetView === 0 || selectedVehicleId) return;

    if (locations.length === 1) {
      const [latitude, longitude] = getDisplayPosition(
        locations,
        locations[0].vehicle.vehicleId
      );

      map.setView([latitude, longitude], 13);
    } else if (locations.length > 1) {
      const points = locations.map(({ vehicle }) =>
        getDisplayPosition(locations, vehicle.vehicleId)
      );

      const bounds = L.latLngBounds(points);

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 14,
        });
      }
    }
  }, [map, resetView, locations, selectedVehicleId]);

  return null;
}

// --------------------------------------------------
// MAP PANEL
// --------------------------------------------------

function MapPanel({ selectedVehicleId }: MapPanelProps) {
  const [baseLocations, setBaseLocations] = useState<
    VehicleLocation[]
  >([]);

  const [fleetVehicles, setFleetVehicles] = useState<Vehicle[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetView, setResetView] = useState(0);

  const telemetryBatch = useTelemetry();

  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  // --------------------------------------------------
  // LATEST TELEMETRY BY VEHICLE
  // --------------------------------------------------

  const latestByVehicle = useMemo(() => {
    const latest = new Map<
      string,
      (typeof telemetryBatch)[number]
    >();

    for (const event of telemetryBatch) {
      latest.set(event.vehicleId, event);
    }

    return latest;
  }, [telemetryBatch]);

  // --------------------------------------------------
  // MERGE HISTORICAL AND LIVE TELEMETRY
  // --------------------------------------------------

  const locations = useMemo<VehicleLocation[]>(() => {
    const locationsByVehicle = new Map<
      string,
      VehicleLocation
    >();

    // Add vehicles with historical telemetry.
    for (const location of baseLocations) {
      locationsByVehicle.set(
        location.vehicle.vehicleId,
        location
      );
    }

    // Apply live telemetry.
    for (const event of latestByVehicle.values()) {
      const vehicle = fleetVehicles.find(
        (item) => item.vehicleId === event.vehicleId
      );

      if (!vehicle) continue;

      const existing = locationsByVehicle.get(event.vehicleId);

      locationsByVehicle.set(event.vehicleId, {
        vehicle: existing?.vehicle ?? vehicle,
        telemetry: {
          latitude: event.latitude,
          longitude: event.longitude,
          speed: event.speed ?? existing?.telemetry.speed ?? 0,
          recordedAt:
            event.recordedAt ??
            existing?.telemetry.recordedAt ??
            new Date().toISOString(),
        },
      });
    }

    return Array.from(locationsByVehicle.values());
  }, [baseLocations, latestByVehicle, fleetVehicles]);

  // --------------------------------------------------
  // FETCH FLEET AND HISTORICAL TELEMETRY
  // --------------------------------------------------

  const fetchFleetTelemetry = useCallback(
    async (signal: AbortSignal) => {
      try {
        setError("");

        const to = new Date();
        const from = new Date(
          to.getTime() - 48 * 60 * 60 * 1000
        );

        const query = `from=${encodeURIComponent(
          from.toISOString()
        )}&to=${encodeURIComponent(to.toISOString())}`;

        const vehiclesResponse = await fetch(
          "http://localhost:8000/api/vehicles",
          { signal }
        );

        if (!vehiclesResponse.ok) {
          throw new Error(
            `Failed to load vehicles: ${vehiclesResponse.status}`
          );
        }

        const vehiclesResult: VehiclesResponse =
          await vehiclesResponse.json();

        if (
          !vehiclesResult.success ||
          !Array.isArray(vehiclesResult.data)
        ) {
          throw new Error("Invalid vehicles response");
        }

        if (signal.aborted) return;

        // Narrow optional vehicleId to a required string.
        const registeredVehicles: Vehicle[] =
          vehiclesResult.data.filter(
            (vehicle): vehicle is Vehicle =>
              typeof vehicle.vehicleId === "string" &&
              vehicle.vehicleId.trim().length > 0
          );

        setFleetVehicles(registeredVehicles);

        // Fetch historical telemetry for registered vehicles.
        const results = await Promise.all(
          registeredVehicles.map(async (vehicle) => {
            try {
              const response = await fetch(
                `http://localhost:8000/api/telemetry/${encodeURIComponent(
                  vehicle.vehicleId
                )}?${query}`,
                { signal }
              );

              if (!response.ok) {
                console.error(
                  `Telemetry request failed for ${vehicle.vehicleId}:`,
                  response.status
                );

                return null;
              }

              const result: TelemetryResponse =
                await response.json();

              if (
                !result.success ||
                !Array.isArray(result.data)
              ) {
                console.error(
                  `Invalid telemetry response for ${vehicle.vehicleId}`
                );

                return null;
              }

              const validPoints = result.data.filter(
                (point) =>
                  Number.isFinite(point.latitude) &&
                  Number.isFinite(point.longitude) &&
                  point.latitude >= -90 &&
                  point.latitude <= 90 &&
                  point.longitude >= -180 &&
                  point.longitude <= 180 &&
                  typeof point.recordedAt === "string" &&
                  !Number.isNaN(
                    new Date(point.recordedAt).getTime()
                  )
              );

              if (validPoints.length === 0) {
                return null;
              }

              const latest = validPoints.reduce((a, b) =>
                new Date(b.recordedAt).getTime() >
                new Date(a.recordedAt).getTime()
                  ? b
                  : a
              );

              return {
                vehicle,
                telemetry: {
                  latitude: latest.latitude,
                  longitude: latest.longitude,
                  speed: latest.speed ?? 0,
                  recordedAt: latest.recordedAt,
                },
              } satisfies VehicleLocation;
            } catch (err: unknown) {
              if (
                err instanceof Error &&
                err.name === "AbortError"
              ) {
                throw err;
              }

              console.error(
                `Failed to load telemetry for ${vehicle.vehicleId}:`,
                err
              );

              return null;
            }
          })
        );

        if (!signal.aborted) {
          const validLocations = results.filter(
            (item): item is VehicleLocation => item !== null
          );

          setBaseLocations(validLocations);
        }
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          err.name === "AbortError"
        ) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load fleet data"
        );
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  // --------------------------------------------------
  // POLLING EVERY 5 SECONDS
  // --------------------------------------------------

  useEffect(() => {
    const controller = new AbortController();
    let requestInProgress = false;

    const poll = async () => {
      if (
        requestInProgress ||
        controller.signal.aborted
      ) {
        return;
      }

      requestInProgress = true;

      try {
        await fetchFleetTelemetry(controller.signal);
      } finally {
        requestInProgress = false;
      }
    };

    void poll();

    const intervalId = window.setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [fetchFleetTelemetry]);

  // --------------------------------------------------
  // RESET MAP
  // --------------------------------------------------

  const resetMap = () => {
    setResetView((value) => value + 1);
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <section className="map-panel">
      <div className="map-header">
        <div>
          <h2>Live Fleet Map</h2>

          <p>
            {locations.length} vehicle
            {locations.length === 1 ? "" : "s"} with telemetry
          </p>
        </div>

        <div className="map-tools">
          <button
            type="button"
            aria-label="Map layers"
            title="Map layers"
          >
            <Layers size={17} />
          </button>

          <button
            type="button"
            aria-label="Fit all vehicles on map"
            title="Fit all vehicles on map"
            onClick={resetMap}
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </div>

      {loading && (
        <p className="map-message">
          Loading fleet telemetry...
        </p>
      )}

      {error && (
        <p className="map-message" role="alert">
          Unable to load fleet data: {error}
        </p>
      )}

      {!loading && !error && locations.length === 0 && (
        <p className="map-message">
          No vehicles have telemetry in the last 48 hours.
        </p>
      )}

      <div className="map-container">
        <MapContainer
          center={[23.7957, 86.4304]}
          zoom={13}
          scrollWheelZoom
          className="leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController
            locations={locations}
            selectedVehicleId={selectedVehicleId}
            markerRefs={markerRefs}
            resetView={resetView}
          />

          {locations.map(({ vehicle, telemetry }) => (
            <Marker
              key={vehicle.vehicleId}
              ref={(marker) => {
                markerRefs.current[vehicle.vehicleId] = marker;
              }}
              position={getDisplayPosition(
                locations,
                vehicle.vehicleId
              )}
              icon={vehicleIcon}
            >
              <Popup>
                <strong>{vehicle.registrationNumber}</strong>
                <br />
                Vehicle ID: {vehicle.vehicleId}
                <br />
                Type: {vehicle.vehicleType}
                <br />
                Status: {vehicle.status}
                <br />
                Speed: {telemetry.speed} km/h
                <br />
                Latitude: {telemetry.latitude}
                <br />
                Longitude: {telemetry.longitude}
                <br />
                Recorded:{" "}
                {new Date(
                  telemetry.recordedAt
                ).toLocaleString()}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <FleetCanvas
        vehicles={locations.map(({ vehicle, telemetry }) => ({
          vehicleId: vehicle.vehicleId,
          latitude: telemetry.latitude,
          longitude: telemetry.longitude,
          speed: telemetry.speed,
        }))}
      />
    </section>
  );
}

export default MapPanel;
