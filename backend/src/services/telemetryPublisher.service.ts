
import redisClient from "../config/redis.js";

export async function publishTelemetryEvent(
  event: unknown
): Promise<void> {
  await redisClient.publish(
    "telemetry:updates",
    JSON.stringify(event)
  );
}
