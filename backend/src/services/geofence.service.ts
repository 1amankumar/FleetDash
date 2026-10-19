
import { booleanPointInPolygon, point, polygon } from "@turf/turf";

export type Geofence = {
  id: string;
  name: string;
  coordinates: [number, number][]; // [longitude, latitude]
};

export type GeofenceAlert = {
  vehicleId: string;
  geofenceId: string;
  geofenceName: string;
  type: "entered" | "exited";
  latitude: number;
  longitude: number;
  timestamp: string;
};

export const geofences: Geofence[] = [
  {
    id: "dhanbad-zone-1",
    name: "Dhanbad Zone 1",
    coordinates: [
      [86.415, 23.805],
      [86.435, 23.805],
      [86.435, 23.825],
      [86.415, 23.825],
      [86.415, 23.805],
    ],
  },
];

const vehicleGeofenceState = new Map<string, boolean>();

export function checkGeofences(
  vehicleId: string,
  latitude: number,
  longitude: number
): GeofenceAlert[] {
  const alerts: GeofenceAlert[] = [];

  for (const geofence of geofences) {
    const area = polygon([geofence.coordinates]);
    const location = point([longitude, latitude]);
    const isInside = booleanPointInPolygon(location, area);

    const stateKey = `${vehicleId}:${geofence.id}`;
    const wasInside = vehicleGeofenceState.get(stateKey);

    // Record the first known position without generating a false alert.
    if (wasInside === undefined) {
      vehicleGeofenceState.set(stateKey, isInside);
      continue;
    }

    // Generate an alert only when the vehicle crosses the boundary.
    if (isInside !== wasInside) {
      vehicleGeofenceState.set(stateKey, isInside);

      alerts.push({
        vehicleId,
        geofenceId: geofence.id,
        geofenceName: geofence.name,
        type: isInside ? "entered" : "exited",
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return alerts;
}
