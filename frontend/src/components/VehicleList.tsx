
import { useState } from "react";
import { MapPin, Truck, Plus, X } from "lucide-react";
import type { Vehicle } from "../App";

type VehicleListProps = {
  vehicles: Vehicle[];
  loading: boolean;
  error: string;
  selectedVehicleId: string | null;
  onSelectVehicle: (vehicleId: string) => void;
  onVehicleAdded: () => Promise<void>;
};

function VehicleList({
  vehicles,
  loading,
  error,
  selectedVehicleId,
  onSelectVehicle,
  onVehicleAdded,
}: VehicleListProps) {
  const [showForm, setShowForm] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [vehicleType, setVehicleType] =
    useState<Vehicle["vehicleType"]>("truck");
  const [status, setStatus] =
    useState<Vehicle["status"]>("active");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    try {
      const response = await fetch("http://localhost:8000/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: vehicleId.trim(),
          registrationNumber: registrationNumber.trim(),
          vehicleType,
          status,
        }),
      });

      const result: {
        success: boolean;
        message?: string;
      } = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Failed to add vehicle");
      }

      await onVehicleAdded();

      setVehicleId("");
      setRegistrationNumber("");
      setVehicleType("truck");
      setStatus("active");
      setShowForm(false);
      setSuccessMessage("Vehicle added successfully.");
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to add vehicle"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="vehicle-panel">
      <div className="vehicle-panel-header">
        <div>
          <h2>Fleet Vehicles</h2>
          <p>Vehicles registered in FleetDash</p>
        </div>

        <div className="vehicle-panel-actions">
          <span>{vehicles.length} vehicles</span>
          <button
            type="button"
            className="add-vehicle-button"
            onClick={() => {
              setShowForm((visible) => !visible);
              setFormError("");
              setSuccessMessage("");
            }}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Cancel" : "Add Vehicle"}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="add-vehicle-form" onSubmit={handleSubmit}>
          <label>
            Vehicle ID
            <input
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              placeholder="e.g. TRUCK-103"
              required
            />
          </label>

          <label>
            Registration Number
            <input
              value={registrationNumber}
              onChange={(event) =>
                setRegistrationNumber(event.target.value)
              }
              placeholder="e.g. JH10AB1234"
              required
            />
          </label>

          <label>
            Vehicle Type
            <select
              value={vehicleType}
              onChange={(event) =>
                setVehicleType(event.target.value as Vehicle["vehicleType"])
              }
            >
              <option value="truck">Truck</option>
              <option value="van">Van</option>
              <option value="car">Car</option>
            </select>
          </label>

          <label>
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as Vehicle["status"])
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </label>

          {formError && <p className="form-error" role="alert">{formError}</p>}

          <button type="submit" disabled={saving}>
            {saving ? "Adding..." : "Save Vehicle"}
          </button>
        </form>
      )}

      {successMessage && (
        <p role="status" className="form-success">{successMessage}</p>
      )}

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
            const id = vehicle.vehicleId ?? vehicle._id;
            const selected = selectedVehicleId === id;

            return (
              <button
                type="button"
                className={`vehicle-item ${
                  selected ? "vehicle-item-selected" : ""
                }`}
                key={vehicle._id}
                onClick={() => onSelectVehicle(id)}
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
                    {id}
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
