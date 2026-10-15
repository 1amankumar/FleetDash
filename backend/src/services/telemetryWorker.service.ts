
import { Worker } from "node:worker_threads";

interface TelemetryEvent {
  vehicleId: string;
  latitude: number;
  longitude: number;
  recordedAt?: string;
  speed?: number;
}

interface WorkerResult {
  success: boolean;
  message?: string;
  data?: TelemetryEvent;
}

export const processTelemetryInWorker = (
  event: TelemetryEvent
): Promise<WorkerResult> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/telemetry.worker.js", import.meta.url)
    );

    worker.once("message", (result: WorkerResult) => {
      resolve(result);
    });

    worker.once("error", (error) => {
      reject(error);
    });

    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(
          new Error(`Telemetry worker exited with code ${code}`)
        );
      }
    });

    worker.postMessage(event);
  });
};
