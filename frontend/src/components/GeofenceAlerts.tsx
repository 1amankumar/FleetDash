
import { useGeofenceAlerts } from "../hooks/useGeofenceAlerts";

export default function GeofenceAlerts() {
  const alerts = useGeofenceAlerts();

  return (
    <section className="geofence-alerts">
      <h2>Geofence Alerts</h2>

      {alerts.length === 0 ? (
        <p>No geofence alerts yet.</p>
      ) : (
        <ul>
          {alerts.map((alert, index) => (
            <li key={`${alert.geofenceId}-${alert.vehicleId}-${alert.timestamp}-${index}`}>
              <strong>
                {alert.type === "entered" ? "Entered" : "Exited"}:
              </strong>{" "}
              {alert.vehicleId} — {alert.geofenceName}

              <p>
                Location: {alert.latitude}, {alert.longitude}
              </p>

              <small>
                {new Date(alert.timestamp).toLocaleString()}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
