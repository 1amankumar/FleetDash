
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { Layers, Maximize2 } from "lucide-react";
import L from "leaflet";
import type { Vehicle as AppVehicle } from "../App";

type Vehicle = Pick<
  AppVehicle,
  "vehicleId" | "registrationNumber" | "vehicleType" | "status"
> & {
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

const vehicleIcon = new L.DivIcon({
  className: "vehicle-map-marker",
  html: '<div class="vehicle-marker-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapController({
  locations,
  selectedVehicleId,
  markerRefs,
  resetView,
}: {
  locations: VehicleLocation[];
  selectedVehicleId: string | null;
  markerRefs: React.MutableRefObject<
    Record<string, L.Marker | null>
  >;
  resetView: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedVehicleId) {
      const selected = locations.find(
        ({ vehicle }) => vehicle.vehicleId === selectedVehicleId
      );

      if (!selected) return;

      const { latitude, longitude } = selected.telemetry;

      map.flyTo([latitude, longitude], 14, { duration: 0.6 });

      const timer = window.setTimeout(() => {
        markerRefs.current[selectedVehicleId]?.openPopup();
      }, 650);

      return () => window.clearTimeout(timer);
    }

    if (locations.length === 1) {
      const { latitude, longitude } = locations[0].telemetry;
      map.setView([latitude, longitude], 13);
    } else if (locations.length > 1) {
      const points = locations.map(
        ({ telemetry }) =>
          [telemetry.latitude, telemetry.longitude] as [number, number]
      );

      map.fitBounds(L.latLngBounds(points), {
        padding: [40, 40],
        maxZoom: 14,
      });
    }
  }, [map, locations, selectedVehicleId, markerRefs]);

  useEffect(() => {
    if (resetView === 0 || selectedVehicleId) return;

    if (locations.length === 1) {
      const { latitude, longitude } = locations[0].telemetry;
      map.setView([latitude, longitude], 13);
    } else if (locations.length > 1) {
      const points = locations.map(
        ({ telemetry }) =>
          [telemetry.latitude, telemetry.longitude] as [number, number]
      );

      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [map, resetView, locations, selectedVehicleId]);

  return null;
}

function MapPanel({ selectedVehicleId }: MapPanelProps) {
  const [locations, setLocations] = useState<VehicleLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetView, setResetView] = useState(0);

  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const fetchFleetTelemetry = useCallback(
    async (signal: AbortSignal) => {
      try {
        setError("");

        const to = new Date();
        const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

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

        const results = await Promise.all(
          vehiclesResult.data.map(async (vehicle) => {
            if (!vehicle.vehicleId) return null;

            try {
              const response = await fetch(
                `http://localhost:8000/api/telemetry/${encodeURIComponent(
                  vehicle.vehicleId
                )}?${query}`,
                { signal }
              );

              if (!response.ok) return null;

              const result: TelemetryResponse = await response.json();

              if (!result.success || !Array.isArray(result.data)) {
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
                  !Number.isNaN(new Date(point.recordedAt).getTime())
              );

              if (validPoints.length === 0) return null;

              const latest = validPoints.reduce((a, b) =>
                new Date(b.recordedAt).getTime() >
                new Date(a.recordedAt).getTime()
                  ? b
                  : a
              );

              return {
                vehicle: vehicle as Vehicle,
                telemetry: latest,
              };
            } catch (err: unknown) {
              if (err instanceof Error && err.name === "AbortError") {
                throw err;
              }

              return null;
            }
          })
        );

        if (!signal.aborted) {
          setLocations(
            results.filter(
              (item): item is VehicleLocation => item !== null
            )
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;

        setError(
          err instanceof Error ? err.message : "Failed to load fleet data"
        );
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    let requestInProgress = false;

    const poll = async () => {
      if (requestInProgress || controller.signal.aborted) return;

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

  const resetMap = () => setResetView((value) => value + 1);

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
        <p className="map-message">Loading fleet telemetry...</p>
      )}

      {error && (
        <p className="map-message" role="alert">
          Unable to load fleet data: {error}
        </p>
      )}

      {!loading && !error && locations.length === 0 && (
        <p className="map-message">
          No vehicles have telemetry in the last 24 hours.
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
              position={[telemetry.latitude, telemetry.longitude]}
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
                {new Date(telemetry.recordedAt).toLocaleString()}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}

export default MapPanel;
