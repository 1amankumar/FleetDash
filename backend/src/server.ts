
import "dotenv/config";
import { createServer } from "node:http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { initializeSocket } from "./config/socket.js";
import { startTelemetrySubscriber } from "./services/telemetrySubscriber.service.js";

const PORT = Number(process.env.PORT) || 8000;

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    await connectRedis();

    const httpServer = createServer(app);
    initializeSocket(httpServer);
    await startTelemetrySubscriber();

    httpServer.listen(PORT, () => {
      console.log(`FleetDash API running on port ${PORT}`);
      console.log("Socket.IO server is ready");
    });
  } catch (error: unknown) {
    console.error("Failed to start FleetDash:", error);
    process.exitCode = 1;
  }
};

void startServer();
