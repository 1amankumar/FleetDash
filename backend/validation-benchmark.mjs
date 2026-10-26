
import { Worker } from "node:worker_threads";
import { performance } from "node:perf_hooks";

const TOTAL_EVENTS = 10_000;
const CONCURRENCY = 10;
const WORKER_COUNT = 2;

function createEvent(index) {
  return {
    vehicleId: `TRUCK-${index}`,
    latitude: 23.815,
    longitude: 86.425,
    speed: 45,
    recordedAt: new Date().toISOString(),
  };
}

function validateDirectly(event) {
  return (
    event !== null &&
    typeof event === "object" &&
    typeof event.vehicleId === "string" &&
    event.vehicleId.trim().length > 0 &&
    Number.isFinite(event.latitude) &&
    event.latitude >= -90 &&
    event.latitude <= 90 &&
    Number.isFinite(event.longitude) &&
    event.longitude >= -180 &&
    event.longitude <= 180 &&
    (event.speed === undefined ||
      (Number.isFinite(event.speed) && event.speed >= 0)) &&
    (event.recordedAt === undefined ||
      (typeof event.recordedAt === "string" &&
        !Number.isNaN(Date.parse(event.recordedAt))))
  );
}

async function benchmarkDirect(events) {
  const started = performance.now();
  let succeeded = 0;

  for (const event of events) {
    if (validateDirectly(event)) succeeded++;
  }

  return {
    name: "Direct validation",
    succeeded,
    elapsedMs: performance.now() - started,
  };
}

async function benchmarkWorkers(events) {
  const workers = Array.from(
    { length: WORKER_COUNT },
    () =>
      new Worker(
        new URL("./src/workers/telemetry.worker.js", import.meta.url)
      )
  );

  const available = [...workers];
  const queue = [...events];
  let succeeded = 0;

  const started = performance.now();

  try {
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise((resolve, reject) => {
            worker.on("error", reject);

            worker.on("message", (result) => {
              if (result.success) succeeded++;

              const nextEvent = queue.shift();

              if (nextEvent) {
                worker.postMessage(nextEvent);
              } else {
                resolve();
              }
            });

            const firstEvent = queue.shift();

            if (firstEvent) {
              worker.postMessage(firstEvent);
            } else {
              resolve();
            }
          })
      )
    );
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }

  return {
    name: "Worker-thread validation",
    succeeded,
    elapsedMs: performance.now() - started,
  };
}

async function main() {
  const events = Array.from(
    { length: TOTAL_EVENTS },
    (_, index) => createEvent(index)
  );

  console.log(`Validation-only benchmark: ${TOTAL_EVENTS} events`);
  console.log("MongoDB and Redis are not included in this test.\n");

  const direct = await benchmarkDirect(events);
  const threaded = await benchmarkWorkers(events);

  for (const result of [direct, threaded]) {
    console.log(`--- ${result.name} ---`);
    console.log(`Successful: ${result.succeeded}/${TOTAL_EVENTS}`);
    console.log(`Duration: ${result.elapsedMs.toFixed(2)} ms`);
    console.log(
      `Throughput: ${(
        result.succeeded / (result.elapsedMs / 1000)
      ).toFixed(0)} events/sec\n`
    );
  }

  console.log(
    "This measures validation overhead only; it does not predict full API throughput."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
