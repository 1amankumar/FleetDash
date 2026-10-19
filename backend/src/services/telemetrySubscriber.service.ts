
import redisClient from "../config/redis.js";
import { getSocketServer } from "../config/socket.js";
import { encode } from "@msgpack/msgpack";
import { checkGeofences } from "./geofence.service.js";

type TelemetryEvent = {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  recordedAt?: string;
};

const subscriber = redisClient.duplicate();
const telemetryBuffer: TelemetryEvent[] = [];

let flushInterval: ReturnType<typeof setInterval> | undefined;
let isStarted = false;

subscriber.on("error", (error: Error) => {
  console.error("Redis subscriber error:", error.message);
});

export async function startTelemetrySubscriber(): Promise<void> {
  if (isStarted) return;

  if (!subscriber.isOpen) {
    await subscriber.connect();
  }

  await subscriber.subscribe("telemetry:updates", (message) => {
    try {
      const event = JSON.parse(message) as TelemetryEvent;

      if (
        typeof event.vehicleId !== "string" ||
        !Number.isFinite(event.latitude) ||
        !Number.isFinite(event.longitude) ||
        event.latitude < -90 ||
        event.latitude > 90 ||
        event.longitude < -180 ||
        event.longitude > 180
      ) {
        console.warn("Ignoring invalid telemetry event");
        return;
      }

      telemetryBuffer.push(event);
    } catch (error) {
      console.error("Failed to parse telemetry message:", error);
    }
  });

  flushInterval = setInterval(() => {
    if (telemetryBuffer.length === 0) return;

    const batch = telemetryBuffer.splice(0, telemetryBuffer.length);

    try {
      const io = getSocketServer();

      // Check every event for geofence boundary crossings.
      const alerts = batch.flatMap((event) =>
        checkGeofences(
          event.vehicleId,
          event.latitude,
          event.longitude
        )
      );

      // Preserve binary telemetry delivery.
      const binaryPayload = encode(batch);
      io.emit("telemetry:batch:binary", binaryPayload);

      // Publish geofence alerts separately.
      for (const alert of alerts) {
        io.emit("geofence:alert", alert);
        console.log("Geofence alert:", alert);
      }

      console.log(
        `Broadcast binary telemetry batch: ${batch.length} event(s), ${binaryPayload.byteLength} bytes`
      );
    } catch (error) {
      console.error("Failed to broadcast telemetry batch:", error);
    }
  }, 100);

  isStarted = true;

  console.log("Redis subscriber listening on telemetry:updates");
}

export async function stopTelemetrySubscriber(): Promise<void> {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = undefined;
  }

  if (subscriber.isOpen) {
    await subscriber.unsubscribe("telemetry:updates");
    await subscriber.quit();
  }

  isStarted = false;
}
