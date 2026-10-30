
import { performance } from "node:perf_hooks";
import { Types } from "mongoose";

import TelemetryBucket from "../models/TelemetryBucket.js";
import { recordMetric } from "./telemetryMetrics.service.js";

export interface TelemetryWriteInput {
  vehicle: Types.ObjectId;
  bucketStart: Date;
  bucketEnd: Date;
  point: {
    latitude: number;
    longitude: number;
    recordedAt: Date;
    speed?: number;
  };
}

interface PendingTelemetry extends TelemetryWriteInput {
  enqueuedAt: number;
  resolve: () => void;
  reject: (error: Error) => void;
  settled: boolean;
}

export type TelemetryGroupWriter = (
  group: TelemetryWriteInput[]
) => Promise<void>;

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 25;
const MAX_QUEUE_SIZE = 1000;

async function persistTelemetryGroup(
  group: TelemetryWriteInput[]
): Promise<void> {
  const first = group[0];

  if (!first) return;

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
}

export function createTelemetryWriteQueue(
  writeGroup: TelemetryGroupWriter = persistTelemetryGroup
) {
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

  async function processBatch(
    batch: PendingTelemetry[]
  ): Promise<void> {
    const flushStarted = performance.now();

    const groups = new Map<string, PendingTelemetry[]>();

    let successfulWrites = 0;
    let failedWrites = 0;

    try {
      for (const item of batch) {
        const key =
          `${item.vehicle.toString()}:${item.bucketStart.getTime()}`;

        const group = groups.get(key) ?? [];

        group.push(item);
        groups.set(key, group);
      }

      await Promise.all(
        Array.from(groups.values()).map(async (group) => {
          const writeStarted = performance.now();

          try {
            await writeGroup(
              group.map((item) => ({
                vehicle: item.vehicle,
                bucketStart: item.bucketStart,
                bucketEnd: item.bucketEnd,
                point: item.point,
              }))
            );

            successfulWrites++;

            for (const item of group) {
              settleTask(item);
            }
          } catch (error: unknown) {
            failedWrites++;

            const writeError =
              error instanceof Error
                ? error
                : new Error(String(error));

            for (const item of group) {
              settleTask(item, writeError);
            }
          } finally {
            recordMetric(
              "mongodb.telemetry_batch_write",
              performance.now() - writeStarted
            );
          }
        })
      );
    } catch (error: unknown) {
      const batchError =
        error instanceof Error
          ? error
          : new Error(String(error));

      for (const item of batch) {
        settleTask(item, batchError);
      }
    } finally {
      const duration = performance.now() - flushStarted;

      recordMetric("mongodb.telemetry_batch_flush", duration);

      console.log(
        [
          "[TELEMETRY BATCH]",
          `events=${batch.length}`,
          `groups=${groups.size}`,
          `successfulWrites=${successfulWrites}`,
          `failedWrites=${failedWrites}`,
          `duration=${duration.toFixed(2)}ms`,
        ].join(" | ")
      );
    }
  }

  function flushQueue(forcePartial = false): Promise<void> {
    if (activeFlush) {
      return activeFlush;
    }

    if (queue.length === 0) {
      return Promise.resolve();
    }

    if (!forcePartial && queue.length < BATCH_SIZE) {
      return Promise.resolve();
    }

    const runFlush = async (): Promise<void> => {
      while (
        queue.length >= BATCH_SIZE ||
        (forcePartial && queue.length > 0)
      ) {
        const batch = queue.splice(0, BATCH_SIZE);
        const batchStarted = performance.now();

        recordMetric("telemetry.queue_depth", queue.length);

        for (const item of batch) {
          recordMetric(
            "telemetry.queue_wait",
            batchStarted - item.enqueuedAt
          );
        }

        await processBatch(batch);
      }
    };

    const flushPromise = runFlush();

    activeFlush = flushPromise.finally(() => {
      activeFlush = null;

      // Handle events that arrived as the flush was finishing.
      if (queue.length >= BATCH_SIZE) {
        void flushQueue();
      }
    });

    return activeFlush;
  }

  const flushTimer = setInterval(() => {
    void flushQueue(true);
  }, FLUSH_INTERVAL_MS);

  flushTimer.unref();

  function enqueueTelemetryWrite(
    input: TelemetryWriteInput
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
        enqueuedAt: performance.now(),
        resolve,
        reject,
        settled: false,
      });

      if (queue.length >= BATCH_SIZE) {
        void flushQueue();
      }
    });
  }

  async function closeTelemetryWriteQueue(): Promise<void> {
    acceptingWrites = false;
    clearInterval(flushTimer);

    console.log(
      `Draining telemetry write queue (${pendingCount} pending event(s))...`
    );

    while (pendingCount > 0) {
      if (activeFlush) {
        await activeFlush;
      } else {
        await flushQueue(true);
      }
    }

    console.log("Telemetry write queue drained successfully");
  }

  return {
    enqueueTelemetryWrite,
    closeTelemetryWriteQueue,
  };
}

const defaultQueue = createTelemetryWriteQueue();

export const enqueueTelemetryWrite =
  defaultQueue.enqueueTelemetryWrite;

export const closeTelemetryWriteQueue =
  defaultQueue.closeTelemetryWriteQueue;
