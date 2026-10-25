
import { useEffect, useState } from "react";
import { decode } from "@msgpack/msgpack";
import socket from "../services/socket";

export type TelemetryEvent = {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  recordedAt?: string;
};

function isTelemetryEvent(value: unknown): value is TelemetryEvent {
  if (typeof value !== "object" || value === null) return false;

  const event = value as Record<string, unknown>;

  return (
    typeof event.vehicleId === "string" &&
    typeof event.latitude === "number" &&
    Number.isFinite(event.latitude) &&
    event.latitude >= -90 &&
    event.latitude <= 90 &&
    typeof event.longitude === "number" &&
    Number.isFinite(event.longitude) &&
    event.longitude >= -180 &&
    event.longitude <= 180 &&
    (event.speed === undefined ||
      (typeof event.speed === "number" &&
        Number.isFinite(event.speed))) &&
    (event.recordedAt === undefined ||
      typeof event.recordedAt === "string")
  );
}

export function useTelemetry(): TelemetryEvent[] {
  const [latestByVehicle, setLatestByVehicle] =
    useState<Map<string, TelemetryEvent>>(() => new Map());

  useEffect(() => {
    const handleBinaryBatch = (payload: unknown) => {
      try {
        let bytes: Uint8Array;

        if (payload instanceof ArrayBuffer) {
          bytes = new Uint8Array(payload);
        } else if (payload instanceof Uint8Array) {
          bytes = payload;
        } else if (Array.isArray(payload)) {
          bytes = Uint8Array.from(payload);
        } else {
          console.error("Unexpected binary telemetry payload");
          return;
        }

        const decoded: unknown = decode(bytes);

        if (!Array.isArray(decoded)) {
          console.error("Decoded telemetry payload is not an array");
          return;
        }

        const validEvents = decoded.filter(isTelemetryEvent);

        console.log(
          "Decoded binary telemetry batch:",
          validEvents.length,
          "event(s)"
        );

        if (validEvents.length === 0) return;

        setLatestByVehicle((previous) => {
          const updated = new Map(previous);

          for (const event of validEvents) {
            const existing = updated.get(event.vehicleId);

            const eventTime = event.recordedAt
              ? new Date(event.recordedAt).getTime()
              : NaN;

            const existingTime = existing?.recordedAt
              ? new Date(existing.recordedAt).getTime()
              : NaN;

            if (
              !existing ||
              !Number.isFinite(eventTime) ||
              !Number.isFinite(existingTime) ||
              eventTime >= existingTime
            ) {
              updated.set(event.vehicleId, event);
            }
          }

          return updated;
        });
      } catch (error) {
        console.error("Failed to decode telemetry batch:", error);
      }
    };

    socket.on("telemetry:batch:binary", handleBinaryBatch);

    return () => {
      socket.off("telemetry:batch:binary", handleBinaryBatch);
    };
  }, []);

  return Array.from(latestByVehicle.values());
}
