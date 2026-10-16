
import { useEffect, useState } from "react";
import socket from "../services/socket";

export type TelemetryEvent = {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  recordedAt?: string;
};

export function useTelemetry() {
  const [latestTelemetry, setLatestTelemetry] =
    useState<TelemetryEvent | null>(null);

  useEffect(() => {
    const handleTelemetry = (event: TelemetryEvent) => {
      setLatestTelemetry(event);
      console.log("Live telemetry received:", event);
    };

    socket.on("telemetry:update", handleTelemetry);

    return () => {
      socket.off("telemetry:update", handleTelemetry);
    };
  }, []);

  return latestTelemetry;
}
