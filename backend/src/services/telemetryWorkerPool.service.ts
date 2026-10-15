
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

interface WorkerTask {
    event: TelemetryEvent;
    resolve: (result: WorkerResult) => void;
    reject: (error: Error) => void;
}

interface WorkerSlot {
    worker: Worker;
    busy: boolean;
    failed: boolean;
    currentTask?: WorkerTask;
}

const WORKER_COUNT = 2;
const MAX_QUEUE_SIZE = 1000;

class TelemetryWorkerPool {
    private readonly slots: WorkerSlot[] = [];
    private readonly queue: WorkerTask[] = [];

    constructor() {
        for (let i = 0; i < WORKER_COUNT; i++) {
            this.slots.push(this.createWorkerSlot());
        }
    }

    private createWorkerSlot(): WorkerSlot {
        const worker = new Worker(
            new URL("../workers/telemetry.worker.js", import.meta.url)
        );

        const slot: WorkerSlot = {
            worker,
            busy: false,
            failed: false,
        };

        worker.on("message", (result: WorkerResult) => {
            if (slot.failed) return;

            const task = slot.currentTask;
            slot.currentTask = undefined;
            slot.busy = false;

            task?.resolve(result);
            this.dispatch();
        });

        worker.on("error", (error: Error) => {
            this.handleWorkerFailure(slot, error);
        });

        worker.on("exit", (code) => {
            if (!slot.failed) {
                this.handleWorkerFailure(
                    slot,
                    new Error(`Telemetry worker exited unexpectedly with code ${code}`)
                );
            }
        });

        return slot;
    }

    private handleWorkerFailure(
        slot: WorkerSlot,
        error: Error
    ): void {
        if (slot.failed) return;

        slot.failed = true;

        const task = slot.currentTask;
        slot.currentTask = undefined;
        slot.busy = false;

        task?.reject(error);

        console.error("Telemetry worker failed:", error.message);

        const index = this.slots.indexOf(slot);

        if (index !== -1) {
            this.slots[index] = this.createWorkerSlot();
        }

        this.dispatch();
    }

    process(event: TelemetryEvent): Promise<WorkerResult> {
        return new Promise((resolve, reject) => {
            if (this.queue.length >= MAX_QUEUE_SIZE) {
                reject(new Error("TELEMETRY_QUEUE_FULL"));
                return;
            }

            this.queue.push({ event, resolve, reject });
            this.dispatch();
        });
    }

    private dispatch(): void {
        for (const slot of this.slots) {
            if (!slot.failed && !slot.busy && this.queue.length > 0) {
                this.runNext(slot);
            }
        }
    }

    private runNext(slot: WorkerSlot): void {
        const task = this.queue.shift();
        if (!task) return;

        slot.busy = true;
        slot.currentTask = task;

        try {
            slot.worker.postMessage(task.event);
        } catch (error: unknown) {
            this.handleWorkerFailure(
                slot,
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }
}

const telemetryWorkerPool = new TelemetryWorkerPool();

export const processTelemetryWithPool = (
    event: TelemetryEvent
): Promise<WorkerResult> => {
    return telemetryWorkerPool.process(event);
};
