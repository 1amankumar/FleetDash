
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

function isGeofenceAlert(value: unknown): value is GeofenceAlert {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const alert = value as Record<string, unknown>;

  return (
    typeof alert.vehicleId === "string" &&
    typeof alert.geofenceId === "string" &&
    typeof alert.geofenceName === "string" &&
    (alert.type === "entered" || alert.type === "exited") &&
    typeof alert.latitude === "number" &&
    Number.isFinite(alert.latitude) &&
    typeof alert.longitude === "number" &&
    Number.isFinite(alert.longitude) &&
    typeof alert.timestamp === "string" &&
    !Number.isNaN(Date.parse(alert.timestamp))
  );
}

export function useGeofenceAlerts(): GeofenceAlert[] {
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);

  useEffect(() => {
    const handleAlert = (payload: unknown) => {
      console.log("GEOFENCE ALERT EVENT RECEIVED:", payload);

      if (!isGeofenceAlert(payload)) {
        console.error("Invalid geofence alert payload:", payload);
        return;
      }

      setAlerts((currentAlerts) => {
        const updatedAlerts = [
          payload,
          ...currentAlerts,
        ].slice(0, 50);

        console.log(
          "GEOFENCE ALERT STATE UPDATED:",
          updatedAlerts.length
        );

        return updatedAlerts;
      });
    };

    const handleConnect = () => {
      console.log(
        "Geofence listener: Socket.IO connected",
        socket.id
      );
    };

    const handleDisconnect = (reason: string) => {
      console.warn(
        "Geofence listener: Socket.IO disconnected:",
        reason
      );
    };

    console.log("Registering geofence:alert listener");

    socket.on("geofence:alert", handleAlert);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    if (socket.connected) {
      console.log(
        "Geofence listener: Socket.IO already connected",
        socket.id
      );
    }

    return () => {
      console.log("Removing geofence:alert listener");

      socket.off("geofence:alert", handleAlert);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  return alerts;
}
