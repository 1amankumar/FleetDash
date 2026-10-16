
import redisClient from "../config/redis.js";
import { getSocketServer } from "../config/socket.js";

const subscriber = redisClient.duplicate();

subscriber.on("error", (error: Error) => {
  console.error("Redis subscriber error:", error.message);
});

export async function startTelemetrySubscriber(): Promise<void> {
  if (!subscriber.isOpen) {
    await subscriber.connect();
  }

  await subscriber.subscribe("telemetry:updates", (message) => {
    try {
      const telemetry = JSON.parse(message);

      getSocketServer().emit("telemetry:update", telemetry);
    } catch (error: unknown) {
      console.error("Failed to process telemetry message:", error);
    }
  });

  console.log("Redis subscriber listening on telemetry:updates");
}
