
interface MetricSummary {
  count: number;
  totalMs: number;
  maxMs: number;
  samples: number[];
}

const metrics = new Map<string, MetricSummary>();

const MAX_SAMPLES = 10_000;

export function recordMetric(
  name: string,
  durationMs: number
): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }

  let metric = metrics.get(name);

  if (!metric) {
    metric = {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      samples: [],
    };

    metrics.set(name, metric);
  }

  metric.count++;
  metric.totalMs += durationMs;
  metric.maxMs = Math.max(metric.maxMs, durationMs);

  // Reservoir sampling prevents early samples from dominating
  // percentile calculations during long-running workloads.
  if (metric.samples.length < MAX_SAMPLES) {
    metric.samples.push(durationMs);
  } else {
    const index = Math.floor(Math.random() * metric.count);

    if (index < MAX_SAMPLES) {
      metric.samples[index] = durationMs;
    }
  }
}

export function printTelemetryMetrics(): void {
  if (metrics.size === 0) {
    console.log("\n--- TELEMETRY METRICS ---");
    console.log("No telemetry requests recorded.");
    console.log("-------------------------\n");
    return;
  }

  console.log("\n--- TELEMETRY PERFORMANCE METRICS ---");

  for (const [name, metric] of metrics) {
    const sorted = [...metric.samples].sort((a, b) => a - b);

    const percentile = (p: number): number => {
      if (sorted.length === 0) return 0;

      const index = Math.min(
        sorted.length - 1,
        Math.ceil(p * sorted.length) - 1
      );

      return sorted[index] ?? 0;
    };

    console.log(`\n${name}`);
    console.log(`Count: ${metric.count}`);
    console.log(
      `Average: ${(metric.totalMs / metric.count).toFixed(2)} ms`
    );
    console.log(`p50: ${percentile(0.50).toFixed(2)} ms`);
    console.log(`p95: ${percentile(0.95).toFixed(2)} ms`);
    console.log(`p99: ${percentile(0.99).toFixed(2)} ms`);
    console.log(`Max: ${metric.maxMs.toFixed(2)} ms`);
    console.log(`Samples: ${metric.samples.length}`);
  }

  console.log("--------------------------------------\n");
}

export function resetTelemetryMetrics(): void {
  metrics.clear();
}
