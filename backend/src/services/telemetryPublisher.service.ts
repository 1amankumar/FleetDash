
import { performance } from "node:perf_hooks";
import redisClient from "../config/redis.js";
import { recordMetric } from "./telemetryMetrics.service.js";

export async function publishTelemetryEvent(
  event: unknown
): Promise<void> {
  const started = performance.now();

  try {
    const message = JSON.stringify(event);

    await redisClient.publish(
      "telemetry:updates",
      message
    );
  } finally {
    recordMetric(
      "redis.telemetry_publish",
      performance.now() - started
    );
  }
}
