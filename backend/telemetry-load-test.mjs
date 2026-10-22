const BASE_URL = "http://localhost:8000";
const VEHICLE_ID = "TRUCK-101";
const CONCURRENCY = 10;
const DURATION_MS = 10_000;
const latencies = [];
let attempted = 0;
let succeeded = 0;
let failed = 0;
async function main() {
  const deadline = Date.now() + DURATION_MS;
  async function worker() {
    while (Date.now() < deadline) {
      attempted++;
      const started = performance.now();
      try {
        const response = await fetch(`${BASE_URL}/api/telemetry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          console.error("HTTP failure:", response.status, await response.text());
        }
      } catch (error) {
        failed++;
        latencies.push(performance.now() - started);
        console.error("Request error:", error.message);
      }
    }
  }
  console.log(`Starting ${CONCURRENCY} workers for ${DURATION_MS / 1000} seconds...`);
  const started = performance.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, () => worker())
  );
  const elapsed = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  const percentile = (p) =>
    latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.ceil(p * latencies.length) - 1)]
      : 0;
  console.log("\n--- BENCHMARK RESULTS ---");
  console.log(`Attempted: ${attempted}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${elapsed.toFixed(2)} seconds`);
  console.log(`Throughput: ${(succeeded / elapsed).toFixed(2)} successful requests/sec`);
  console.log(`Failure rate: ${attempted ? (failed * 100 / attempted).toFixed(2) : "0.00"}%`);
  console.log(`p50 latency: ${percentile(0.50).toFixed(2)} ms`);
  console.log(`p95 latency: ${percentile(0.95).toFixed(2)} ms`);
  console.log(`p99 latency: ${percentile(0.99).toFixed(2)} ms`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
