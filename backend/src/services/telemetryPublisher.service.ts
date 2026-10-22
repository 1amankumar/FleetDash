
import { performance } from "node:perf_hooks";
import redisClient from "../config/redis.js";

export async function publishTelemetryEvent(
  event: unknown
): Promise<void> {
  const started = performance.now();

  await redisClient.publish(
    "telemetry:updates",
    JSON.stringify(event)
  );

  console.log(
    `[POST benchmark] Redis publish: ${
      (performance.now() - started).toFixed(2)
    } ms`
  );
}
