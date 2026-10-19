
import { useEffect, useState } from "react";
import socket from "../services/socket";

export type GeofenceAlert = {
  vehicleId: string;
  geofenceId: string;
  geofenceName: string;
  type: "entered" | "exited";
  latitude: number;
  longitude: number;
  timestamp: string;
};

export function useGeofenceAlerts() {
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);

  useEffect(() => {
    const handleAlert = (alert: GeofenceAlert) => {
      setAlerts((current) => [alert, ...current].slice(0, 50));
    };

    socket.on("geofence:alert", handleAlert);

    return () => {
      socket.off("geofence:alert", handleAlert);
    };
  }, []);

  return alerts;
}
