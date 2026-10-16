
import "dotenv/config";
import { createClient } from "redis";

const subscriber = createClient({
  url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
});

subscriber.on("error", (error: Error) => {
  console.error("Redis subscriber error:", error.message);
});

async function startSubscriber(): Promise<void> {
  await subscriber.connect();

  console.log("Listening for telemetry updates...");

  await subscriber.subscribe("telemetry:updates", (message) => {
    console.log("Received telemetry event:");
    console.log(JSON.parse(message));
  });
}

void startSubscriber().catch(console.error);
