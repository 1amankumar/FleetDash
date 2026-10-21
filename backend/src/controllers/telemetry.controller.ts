
import type { Request, Response } from "express";
import {
    addTelemetry,
    getVehicleTelemetry,
} from "../services/telemetry.service.js";
import {
    processTelemetryWithPool,
} from "../services/telemetryWorkerPool.service.js";
import {
    publishTelemetryEvent,
} from "../services/telemetryPublisher.service.js";

export const createTelemetry = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const {
            vehicleId,
            latitude,
            longitude,
            recordedAt,
            speed,
        } = req.body ?? {};

        // Step 1: Validate the incoming request.
        if (
            typeof vehicleId !== "string" ||
            !vehicleId.trim() ||
            typeof latitude !== "number" ||
            typeof longitude !== "number" ||
            (recordedAt !== undefined &&
                typeof recordedAt !== "string") ||
            (speed !== undefined &&
                typeof speed !== "number")
        ) {
            res.status(400).json({
                success: false,
                message: "Please provide valid telemetry data",
            });
            return;
        }

        // Step 2: Validate telemetry using the worker pool.
        const workerResult = await processTelemetryWithPool({
            vehicleId,
            latitude,
            longitude,
            ...(recordedAt !== undefined ? { recordedAt } : {}),
            ...(speed !== undefined ? { speed } : {}),
        });

        if (!workerResult.success || !workerResult.data) {
            res.status(400).json({
                success: false,
                message:
                    workerResult.message ?? "Invalid telemetry data",
            });
            return;
        }

        // Step 3: Save telemetry to MongoDB.
        const result = await addTelemetry(workerResult.data);

        // Step 4: Publish the saved event to Redis.
        try {
            await publishTelemetryEvent(workerResult.data);
        } catch (publishError: unknown) {
            console.error(
                "Telemetry saved, but Redis publishing failed:",
                publishError
            );
        }

        // Step 5: Return the success response.
        res.status(201).json({
            success: true,
            message: "Telemetry recorded successfully",
            data: result,
        });
    } catch (error: unknown) {
        if (res.headersSent) {
            console.error("Error after response was sent:", error);
            return;
        }

        if (error instanceof Error) {
            if (
                error.message === "INVALID_TELEMETRY" ||
                error.message === "INVALID_TIMESTAMP"
            ) {
                res.status(400).json({
                    success: false,
                    message: "Invalid telemetry data or timestamp",
                });
                return;
            }

            if (error.message === "VEHICLE_NOT_FOUND") {
                res.status(404).json({
                    success: false,
                    message:
                        "Vehicle not found. Register the vehicle first.",
                });
                return;
            }

            if (error.message === "TELEMETRY_QUEUE_FULL") {
                res.status(503).json({
                    success: false,
                    message:
                        "Telemetry processing is busy. Please retry later.",
                });
                return;
            }
        }

        console.error("Failed to save telemetry:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const fetchVehicleTelemetry = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const vehicleId = req.params.vehicleId;
        const fromValue = req.query.from;
        const toValue = req.query.to;

        if (
            typeof vehicleId !== "string" ||
            !vehicleId.trim() ||
            typeof fromValue !== "string" ||
            typeof toValue !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Provide vehicleId, from, and to",
            });
            return;
        }

        const from = new Date(fromValue);
        const to = new Date(toValue);

        if (
            Number.isNaN(from.getTime()) ||
            Number.isNaN(to.getTime()) ||
            from >= to
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Provide a valid time range; from must precede to",
            });
            return;
        }

        const result = await getVehicleTelemetry(
            vehicleId,
            from,
            to
        );

        // Keep the response shape expected by the frontend.
        res.status(200).json({
            success: true,
            vehicleId: result.vehicleId,
            from: result.from,
            to: result.to,
            data: result.points,
        });
    } catch (error: unknown) {
        if (
            error instanceof Error &&
            error.message === "VEHICLE_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "Vehicle not found",
            });
            return;
        }

        console.error("Failed to fetch telemetry:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
