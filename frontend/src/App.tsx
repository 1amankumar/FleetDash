
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import DashboardHeader from "./components/DashboardHeader";
import FleetStats from "./components/FleetStats";
import MapPanel from "./components/MapPanel";
import VehicleList from "./components/VehicleList";
import GeofenceAlerts from "./components/GeofenceAlerts";

import "./App.css";

export type Vehicle = {
  _id: string;
  vehicleId?: string;
  registrationNumber: string;
  vehicleType: "truck" | "van" | "car";
  status: "active" | "inactive" | "maintenance";
};

type VehiclesResponse = {
  success: boolean;
  data: Vehicle[];
};

function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] =
    useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {

    try {
      const response = await fetch(
        "http://localhost:8000/api/vehicles"
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const result: VehiclesResponse = await response.json();

      if (
        !result.success ||
        !Array.isArray(result.data)
      ) {
        throw new Error("Invalid vehicle data received from the server");
      }

      setVehicles(result.data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load vehicles"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void fetchVehicles();
  }, 0);

  return () => window.clearTimeout(timer);
}, [fetchVehicles]);

  return (
    <main className="dashboard">
      <DashboardHeader />

      <div className="dashboard-content">
        <div className="page-heading">
          <div>
            <h2>Fleet Overview</h2>
            <p>Monitor your fleet operations at a glance.</p>
          </div>

          <div className="dashboard-actions">
            <button
              type="button"
              className="refresh-button"
              onClick={() => void fetchVehicles()}
              disabled={loading}
            >
              <RefreshCw size={16} />
              {loading ? "Refreshing..." : "Refresh Vehicles"}
            </button>

            <span className="live-indicator">
              <span className="live-dot" />
              Live Monitoring
            </span>
          </div>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <p>Unable to load vehicles: {error}</p>

            <button
              type="button"
              onClick={() => void fetchVehicles()}
              disabled={loading}
            >
              Retry
            </button>
          </div>
        )}

        <FleetStats vehicles={vehicles} />

        <div className="dashboard-grid">
          <MapPanel selectedVehicleId={selectedVehicleId} />

          <GeofenceAlerts />

          <VehicleList
            vehicles={vehicles}
            loading={loading}
            error={error}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
          />
        </div>
      </div>
    </main>
  );
}

export default App;
