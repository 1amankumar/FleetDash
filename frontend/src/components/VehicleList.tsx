
import { MapPin, Truck } from "lucide-react";
import type { Vehicle } from "../App";

type VehicleListProps = {
  vehicles: Vehicle[];
  loading: boolean;
  error: string;
  selectedVehicleId: string | null;
  onSelectVehicle: (vehicleId: string) => void;
};

function VehicleList({
  vehicles,
  loading,
  error,
  selectedVehicleId,
  onSelectVehicle,
}: VehicleListProps) {
  return (
    <section className="vehicle-panel">
      <div className="vehicle-panel-header">
        <div>
          <h2>Fleet Vehicles</h2>
          <p>Vehicles registered in FleetDash</p>
        </div>

        <span>{vehicles.length} vehicles</span>
      </div>

      {loading && <p>Loading vehicles...</p>}

      {!loading && error && (
        <p role="alert">Unable to load vehicles: {error}</p>
      )}

      {!loading && !error && vehicles.length === 0 && (
        <p>No vehicles registered yet.</p>
      )}

      {!loading && !error && (
        <div className="vehicle-list">
          {vehicles.map((vehicle) => {
            const vehicleId = vehicle.vehicleId ?? vehicle._id;
            const selected = selectedVehicleId === vehicleId;

            return (
              <button
                type="button"
                className={`vehicle-item ${selected ? "vehicle-item-selected" : ""}`}
                key={vehicle._id}
                onClick={() => onSelectVehicle(vehicleId)}
                aria-pressed={selected}
              >
                <div className="vehicle-icon">
                  <Truck size={22} />
                </div>

                <div className="vehicle-info">
                  <h3>{vehicle.registrationNumber}</h3>
                  <p>{vehicle.vehicleType}</p>
                  <p className="vehicle-location">
                    <MapPin size={14} />
                    {vehicleId}
                  </p>
                </div>

                <div className="vehicle-details">
                  <span className={`status status-${vehicle.status}`}>
                    {vehicle.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default VehicleList;
