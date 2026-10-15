
import { parentPort } from "node:worker_threads";

if (!parentPort) {
  throw new Error("Telemetry worker must run in a worker thread");
}

parentPort.on("message", (event) => {
  const valid =
    event !== null &&
    typeof event === "object" &&
    typeof event.vehicleId === "string" &&
    event.vehicleId.trim().length > 0 &&
    Number.isFinite(event.latitude) &&
    event.latitude >= -90 &&
    event.latitude <= 90 &&
    Number.isFinite(event.longitude) &&
    event.longitude >= -180 &&
    event.longitude <= 180 &&
    (event.speed === undefined ||
      (Number.isFinite(event.speed) && event.speed >= 0)) &&
    (event.recordedAt === undefined ||
      (typeof event.recordedAt === "string" &&
        !Number.isNaN(Date.parse(event.recordedAt))));

  if (!valid) {
    parentPort.postMessage({
      success: false,
      message: "Invalid telemetry event",
    });
    return;
  }

  parentPort.postMessage({
    success: true,
    data: {
      ...event,
      vehicleId: event.vehicleId.trim(),
    },
  });
});
