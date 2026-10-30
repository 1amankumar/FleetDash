
import { performance } from "node:perf_hooks";
import { Types } from "mongoose";

import TelemetryBucket from "../models/TelemetryBucket.js";
import { recordMetric } from "./telemetryMetrics.service.js";

interface PendingTelemetry {
  vehicle: Types.ObjectId;
  bucketStart: Date;
  bucketEnd: Date;
  point: {
    latitude: number;
    longitude: number;
    recordedAt: Date;
    speed?: number;
  };
  resolve: () => void;
  reject: (error: Error) => void;
  settled: boolean;
}

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 50;
const MAX_QUEUE_SIZE = 1000;

const queue: PendingTelemetry[] = [];

let acceptingWrites = true;
let pendingCount = 0;
let activeFlush: Promise<void> | null = null;

function settleTask(
  task: PendingTelemetry,
  error?: Error
): void {
  if (task.settled) return;

  task.settled = true;
  pendingCount--;

  if (error) {
    task.reject(error);
  } else {
    task.resolve();
  }
}

function flushQueue(): Promise<void> {
  if (activeFlush) {
    return activeFlush;
  }

  if (queue.length === 0) {
    return Promise.resolve();
  }

  const batch = queue.splice(0, BATCH_SIZE);
  const flushStarted = performance.now();

  const flushPromise = (async (): Promise<void> => {
    try {
      const groups = new Map<string, PendingTelemetry[]>();

      // Group events targeting the same vehicle and hourly bucket.
      for (const item of batch) {
        const key = `${item.vehicle.toString()}:${item.bucketStart.getTime()}`;

        const group = groups.get(key) ?? [];
        group.push(item);

        groups.set(key, group);
      }

      // Execute one MongoDB update per vehicle/bucket group.
      await Promise.all(
        Array.from(groups.values()).map(async (group) => {
          const first = group[0];

          if (!first) return;

          try {
            await TelemetryBucket.updateOne(
              {
                vehicle: first.vehicle,
                bucketStart: first.bucketStart,
              },
              {
                $setOnInsert: {
                  bucketEnd: first.bucketEnd,
                },
                $push: {
                  points: {
                    $each: group.map((item) => item.point),
                  },
                },
              },
              {
                upsert: true,
                runValidators: true,
              }
            );

            for (const item of group) {
              settleTask(item);
            }
          } catch (error: unknown) {
            const writeError =
              error instanceof Error
                ? error
                : new Error(String(error));

            for (const item of group) {
              settleTask(item, writeError);
            }
          }
        })
      );
    } catch (error: unknown) {
      const flushError =
        error instanceof Error
          ? error
          : new Error(String(error));

      // Reject any tasks not already settled.
      for (const item of batch) {
        settleTask(item, flushError);
      }
    } finally {
      recordMetric(
        "mongodb.telemetry_batch_flush",
        performance.now() - flushStarted
      );
    }
  })();

  activeFlush = flushPromise.finally(() => {
    activeFlush = null;

    // Immediately process another full batch if available.
    if (queue.length >= BATCH_SIZE) {
      void flushQueue();
    }
  });

  return activeFlush;
}

// Periodically flush partially filled batches.
const flushTimer = setInterval(() => {
  void flushQueue();
}, FLUSH_INTERVAL_MS);

flushTimer.unref();

export function enqueueTelemetryWrite(
  input: Omit<
    PendingTelemetry,
    "resolve" | "reject" | "settled"
  >
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!acceptingWrites) {
      reject(new Error("TELEMETRY_QUEUE_CLOSED"));
      return;
    }

    if (pendingCount >= MAX_QUEUE_SIZE) {
      reject(new Error("TELEMETRY_QUEUE_FULL"));
      return;
    }

    pendingCount++;

    queue.push({
      ...input,
      resolve,
      reject,
      settled: false,
    });

    if (queue.length >= BATCH_SIZE) {
      void flushQueue();
    }
  });
}

// Stop accepting new writes and persist all pending events.
export async function closeTelemetryWriteQueue(): Promise<void> {
  if (!acceptingWrites && pendingCount === 0) {
    return;
  }

  acceptingWrites = false;

  clearInterval(flushTimer);

  console.log(
    `Draining telemetry write queue (${pendingCount} pending event(s))...`
  );

  while (pendingCount > 0) {
    if (activeFlush) {
      await activeFlush;
    } else {
      await flushQueue();
    }
  }

  console.log("Telemetry write queue drained successfully");
}
