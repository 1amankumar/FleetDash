
import "dotenv/config";

import { createServer } from "node:http";
import mongoose from "mongoose";

import app from "./app.js";
import connectDB from "./config/db.js";
import redisClient, { connectRedis } from "./config/redis.js";

import {
  initializeSocket,
  getSocketServer,
} from "./config/socket.js";

import {
  startTelemetrySubscriber,
  stopTelemetrySubscriber,
} from "./services/telemetrySubscriber.service.js";

import {
  closeTelemetryWriteQueue,
} from "./services/telemetryWriteQueue.service.js";

import {
  printTelemetryMetrics,
  resetTelemetryMetrics,
} from "./services/telemetryMetrics.service.js";

const PORT = Number(process.env.PORT) || 8000;

const startServer = async (): Promise<void> => {
  let httpServer: ReturnType<typeof createServer> | undefined;
  let metricsInterval: ReturnType<typeof setInterval> | undefined;

  let isShuttingDown = false;

  try {
    // 1. Connect to MongoDB.
    await connectDB();

    // 2. Connect to Redis.
    await connectRedis();

    // 3. Create HTTP server.
    httpServer = createServer(app);

    // 4. Initialize Socket.IO.
    initializeSocket(httpServer);

    // 5. Start Redis telemetry subscriber.
    await startTelemetrySubscriber();

    // 6. Start HTTP server.
    httpServer.listen(PORT, () => {
      console.log(`FleetDash API running on port ${PORT}`);
      console.log("Socket.IO server is ready");
    });

    // 7. Print performance metrics every 10 seconds.
    metricsInterval = setInterval(() => {
      printTelemetryMetrics();
      resetTelemetryMetrics();
    }, 10_000);

    metricsInterval.unref();

    // 8. Graceful shutdown handler.
    const shutdown = async (
      signal: string
    ): Promise<void> => {
      if (isShuttingDown) return;

      isShuttingDown = true;

      console.log(
        `\n${signal} received. Starting graceful shutdown...`
      );

      try {
        // Stop periodic metrics printing.
        if (metricsInterval) {
          clearInterval(metricsInterval);
          metricsInterval = undefined;
        }

        // Close Socket.IO and its underlying HTTP server.
        const io = getSocketServer();

        await new Promise<void>((resolve) => {
          io.close(() => resolve());
        });

        console.log("HTTP and Socket.IO connections closed");

        // Stop accepting writes and drain pending MongoDB batches.
        await closeTelemetryWriteQueue();

        // Stop Redis subscriber.
        await stopTelemetrySubscriber();

        console.log("Redis subscriber stopped");

        // Close main Redis connection.
        if (redisClient.isOpen) {
          await redisClient.quit();
        }

        console.log("Redis connection closed");

        // Close MongoDB connection.
        await mongoose.disconnect();

        console.log("MongoDB connection closed");

        // Print remaining performance metrics.
        printTelemetryMetrics();
        resetTelemetryMetrics();

        console.log(
          "FleetDash shutdown completed successfully."
        );

        process.exitCode = 0;
      } catch (error: unknown) {
        console.error(
          "Error during graceful shutdown:",
          error
        );

        process.exitCode = 1;
      }
    };

    // Register termination handlers.
    process.once("SIGINT", () => {
      void shutdown("SIGINT");
    });

    process.once("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
  } catch (error: unknown) {
    console.error("Failed to start FleetDash:", error);

    try {
      if (metricsInterval) {
        clearInterval(metricsInterval);
      }

      await stopTelemetrySubscriber();

      await closeTelemetryWriteQueue();

      if (redisClient.isOpen) {
        await redisClient.quit();
      }

      await mongoose.disconnect();
    } catch (shutdownError: unknown) {
      console.error(
        "Startup cleanup failed:",
        shutdownError
      );
    }

    process.exitCode = 1;
  }
};

void startServer();
