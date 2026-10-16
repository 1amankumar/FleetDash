
import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
});

redisClient.on("error", (error: Error) => {
  console.error("Redis connection error:", error.message);
});

redisClient.on("ready", () => {
  console.log("Redis client is ready");
});

export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

export default redisClient;
