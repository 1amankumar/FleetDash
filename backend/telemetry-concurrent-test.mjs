
import { performance } from "node:perf_hooks";

const BASE_URL = "http://localhost:8000/api/telemetry";
const CONCURRENCY = 500;
const VEHICLE_ID = "TRUCK-101";

async function sendTelemetry(id) {
  const body = {
    vehicleId: VEHICLE_ID,
    latitude: 23.7957 + id * 0.0001,
    longitude: 86.4304 + id * 0.0001,
    speed: 40 + id,
  };

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(`Request ${id} failed: ${JSON.stringify(result)}`);
  }

  return result;
}

async function runTest() {
  console.log(`Starting ${CONCURRENCY} concurrent requests...`);

  const started = performance.now();

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, (_, index) =>
      sendTelemetry(index + 1)
    )
  );

  const duration = performance.now() - started;

  const successful = results.filter(
    (result) => result.status === "fulfilled"
  ).length;

  const failed = results.length - successful;

  console.log("\n--- TEST RESULTS ---");
  console.log(`Attempted: ${results.length}`);
  console.log(`Succeeded: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${duration.toFixed(2)} ms`);
  console.log(
    `Throughput: ${(successful / (duration / 1000)).toFixed(2)} req/sec`
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(result.reason);
    }
  }
}

runTest().catch(console.error);
