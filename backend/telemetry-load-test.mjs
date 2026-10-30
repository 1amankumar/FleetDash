const BASE_URL = "http://localhost:8000";
const VEHICLE_ID = "TRUCK-101";
const CONCURRENCY = 2000;
const DURATION_MS = 10_000;

const latencies = [];
let attempted = 0;
let succeeded = 0;
let failed = 0;

async function main() {
  const testStartedAt = new Date();
  const deadline = Date.now() + DURATION_MS;

  async function worker() {
    while (Date.now() < deadline) {
      attempted++;

      const started = performance.now();

      try {
        const response = await fetch(`${BASE_URL}/api/telemetry`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vehicleId: VEHICLE_ID,
            latitude: 23.815,
            longitude: 86.425,
            speed: 45,
            recordedAt: new Date().toISOString(),
          }),
        });

        latencies.push(performance.now() - started);

        if (response.status === 201) {
          succeeded++;
        } else {
          failed++;
          console.error(
            "HTTP failure:",
            response.status,
            await response.text()
          );
        }
      } catch (error) {
        failed++;
        latencies.push(performance.now() - started);

        console.error(
          "Request error:",
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  console.log(
    `Starting ${CONCURRENCY} workers for ${DURATION_MS / 1000} seconds...`
  );

  const benchmarkStarted = performance.now();

  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => worker())
  );

  const testFinishedAt = new Date();
  const elapsed = (performance.now() - benchmarkStarted) / 1000;

  // Sort latencies to calculate percentiles.
  latencies.sort((a, b) => a - b);

  const percentile = (p) =>
    latencies.length
      ? latencies[
          Math.min(
            latencies.length - 1,
            Math.ceil(p * latencies.length) - 1
          )
        ]
      : 0;

  console.log("\n--- BENCHMARK RESULTS ---");
  console.log(`Attempted: ${attempted}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${elapsed.toFixed(2)} seconds`);

  console.log(
    `Throughput: ${(succeeded / elapsed).toFixed(2)} successful requests/sec`
  );

  console.log(
    `Failure rate: ${
      attempted ? ((failed * 100) / attempted).toFixed(2) : "0.00"
    }%`
  );

  console.log(`p50 latency: ${percentile(0.50).toFixed(2)} ms`);
  console.log(`p95 latency: ${percentile(0.95).toFixed(2)} ms`);
  console.log(`p99 latency: ${percentile(0.99).toFixed(2)} ms`);

  // DATA PERSISTENCE CHECK
  console.log("\nChecking telemetry persistence in MongoDB...");

  const params = new URLSearchParams({
    from: testStartedAt.toISOString(),
    to: testFinishedAt.toISOString(),
  });

  const response = await fetch(
    `${BASE_URL}/api/telemetry/${VEHICLE_ID}?${params}`
  );

  if (!response.ok) {
    throw new Error(
      `Telemetry read failed: HTTP ${response.status} - ${await response.text()}`
    );
  }

  const result = await response.json();

  if (!Array.isArray(result.data)) {
    throw new Error(
      "Unexpected telemetry response: expected an array at result.data"
    );
  }

  const retrieved = result.data.length;
  const difference = succeeded - retrieved;

  console.log("\n--- DATA PERSISTENCE CHECK ---");
  console.log(`Successful POST requests: ${succeeded}`);
  console.log(`Retrieved telemetry points: ${retrieved}`);
  console.log(`Difference: ${difference}`);

  if (difference === 0) {
    console.log("All successful requests appear to be persisted.");
  } else if (difference > 0) {
    console.log(
      "WARNING: Fewer points were retrieved than successful POST requests."
    );
  } else {
    console.log(
      "NOTE: More points were retrieved than this test submitted. Other telemetry for this vehicle may be included."
    );
  }
}

main().catch((error) => {
  console.error("Load test failed:", error);
  process.exitCode = 1;
});
