
import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";

import {
  createTelemetryWriteQueue,
} from "./telemetryWriteQueue.service.js";

function createInput(vehicle = new Types.ObjectId()) {
  return {
    vehicle,
    bucketStart: new Date("2026-10-31T10:00:00.000Z"),
    bucketEnd: new Date("2026-10-31T11:00:00.000Z"),
    point: {
      latitude: 23.7957,
      longitude: 86.4304,
      recordedAt: new Date(),
      speed: 45,
    },
  };
}

function deferred() {
  let resolve!: () => void;

  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

test("persists a successful batch", async () => {
  let writeCount = 0;
  let persistedPoints = 0;

  const queue = createTelemetryWriteQueue(async (group) => {
    writeCount++;
    persistedPoints += group.length;
  });

  const vehicle = new Types.ObjectId();

  const requests = Array.from(
    { length: 20 },
    () => queue.enqueueTelemetryWrite(createInput(vehicle))
  );

  await Promise.all(requests);
  await queue.closeTelemetryWriteQueue();

  assert.equal(writeCount, 1);
  assert.equal(persistedPoints, 20);
});

test("rejects requests when MongoDB persistence fails", async () => {
  const queue = createTelemetryWriteQueue(async () => {
    throw new Error("DATABASE_WRITE_FAILED");
  });

  const vehicle = new Types.ObjectId();

  const requests = Array.from(
    { length: 20 },
    () => queue.enqueueTelemetryWrite(createInput(vehicle))
  );

  const results = await Promise.allSettled(requests);

  await queue.closeTelemetryWriteQueue();

  assert.equal(results.length, 20);

  for (const result of results) {
    assert.equal(result.status, "rejected");

    if (result.status === "rejected") {
      assert.match(
        result.reason.message,
        /DATABASE_WRITE_FAILED/
      );
    }
  }
});

test("rejects requests when queue capacity is exceeded", async () => {
  const firstWriteStarted = deferred();
  const releaseFirstWrite = deferred();

  let writeCount = 0;

  const queue = createTelemetryWriteQueue(async () => {
    writeCount++;

    if (writeCount === 1) {
      firstWriteStarted.resolve();
      await releaseFirstWrite.promise;
    }
  });

  const vehicle = new Types.ObjectId();

  const acceptedRequests = Array.from(
    { length: 20 },
    () => queue.enqueueTelemetryWrite(createInput(vehicle))
  );

  await firstWriteStarted.promise;

  for (let i = 0; i < 980; i++) {
    acceptedRequests.push(
      queue.enqueueTelemetryWrite(createInput(vehicle))
    );
  }

  await assert.rejects(
    queue.enqueueTelemetryWrite(createInput(vehicle)),
    /TELEMETRY_QUEUE_FULL/
  );

  releaseFirstWrite.resolve();

  await Promise.all(acceptedRequests);
  await queue.closeTelemetryWriteQueue();

  assert.equal(acceptedRequests.length, 1000);
});

test("gracefully drains a partially filled batch", async () => {
  let persistedPoints = 0;

  const queue = createTelemetryWriteQueue(async (group) => {
    persistedPoints += group.length;
  });

  const vehicle = new Types.ObjectId();

  const requests = Array.from(
    { length: 5 },
    () => queue.enqueueTelemetryWrite(createInput(vehicle))
  );

  await queue.closeTelemetryWriteQueue();
  await Promise.all(requests);

  assert.equal(persistedPoints, 5);

  await assert.rejects(
    queue.enqueueTelemetryWrite(createInput(vehicle)),
    /TELEMETRY_QUEUE_CLOSED/
  );
});
