
import { performance } from "node:perf_hooks";

import TelemetryBucket from "../models/TelemetryBucket.js";
import Vehicle from "../models/Vehicle.js";

import { recordMetric } from "./telemetryMetrics.service.js";
import { enqueueTelemetryWrite } from "./telemetryWriteQueue.service.js";

const VEHICLE_CACHE_TTL_MS = 60_000;

interface CachedVehicle {
  vehicle: InstanceType<typeof Vehicle>;
  expiresAt: number;
}

const vehicleCache = new Map<string, CachedVehicle>();

// Share an ongoing database lookup between concurrent requests.
const vehicleLookupInFlight = new Map<
  string,
  Promise<InstanceType<typeof Vehicle> | null>
>();

async function getCachedVehicle(vehicleId: string) {
  const started = performance.now();
  const key = vehicleId.trim();

  // 1. Check completed cache entries.
  const cached = vehicleCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    recordMetric(
      "vehicle_lookup.cache_hit",
      performance.now() - started
    );

    return cached.vehicle;
  }

  if (cached) {
    vehicleCache.delete(key);
  }

  // 2. Reuse an ongoing lookup if one exists.
  const existingLookup = vehicleLookupInFlight.get(key);

  if (existingLookup) {
    const waitStarted = performance.now();

    try {
      return await existingLookup;
    } finally {
      recordMetric(
        "vehicle_lookup.inflight_wait",
        performance.now() - waitStarted
      );
    }
  }

  // 3. Start one database lookup for this vehicle.
  const lookupPromise = (async () => {
    try {
      const vehicle = await Vehicle.findOne({
        vehicleId: key,
      });

      if (vehicle) {
        vehicleCache.set(key, {
          vehicle,
          expiresAt: Date.now() + VEHICLE_CACHE_TTL_MS,
        });
      }

      return vehicle;
    } finally {
      recordMetric(
        "vehicle_lookup.cache_miss_and_db",
        performance.now() - started
      );

      vehicleLookupInFlight.delete(key);
    }
  })();

  vehicleLookupInFlight.set(key, lookupPromise);

  return lookupPromise;
}

export interface AddTelemetryInput {
  vehicleId: string;
  latitude: number;
  longitude: number;
  recordedAt?: string;
  speed?: number;
}

export const addTelemetry = async (
  input: AddTelemetryInput
) => {
  const serviceStarted = performance.now();

  try {
    const {
      vehicleId,
      latitude,
      longitude,
      recordedAt,
      speed,
    } = input;

    // 1. Validate vehicle ID.
    if (
      typeof vehicleId !== "string" ||
      vehicleId.trim().length === 0
    ) {
      throw new Error("INVALID_TELEMETRY");
    }

    // 2. Validate coordinates.
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error("INVALID_TELEMETRY");
    }

    // 3. Validate speed.
    if (
      speed !== undefined &&
      (!Number.isFinite(speed) || speed < 0)
    ) {
      throw new Error("INVALID_TELEMETRY");
    }

    // 4. Validate timestamp.
    const timestamp =
      recordedAt === undefined
        ? new Date()
        : new Date(recordedAt);

    if (Number.isNaN(timestamp.getTime())) {
      throw new Error("INVALID_TIMESTAMP");
    }

    // 5. Find vehicle using single-flight caching.
    const vehicle = await getCachedVehicle(vehicleId);

    if (!vehicle) {
      throw new Error("VEHICLE_NOT_FOUND");
    }

    // 6. Calculate hourly bucket.
    const bucketStart = new Date(timestamp);
    bucketStart.setUTCMinutes(0, 0, 0);

    const bucketEnd = new Date(
      bucketStart.getTime() + 60 * 60 * 1000
    );

    // 7. Prepare telemetry point.
    const point = {
      latitude,
      longitude,
      recordedAt: timestamp,
      ...(speed !== undefined ? { speed } : {}),
    };

    // 8. Queue the write and wait for MongoDB confirmation.
    const writeStarted = performance.now();

    try {
      await enqueueTelemetryWrite({
        vehicle: vehicle._id,
        bucketStart,
        bucketEnd,
        point,
      });
    } finally {
      recordMetric(
        "mongodb.telemetry_write",
        performance.now() - writeStarted
      );
    }

    // 9. Return saved telemetry details.
    return {
      vehicleId: vehicle.vehicleId,
      bucketStart,
      bucketEnd,
      point,
    };
  } finally {
    recordMetric(
      "telemetry_service.total",
      performance.now() - serviceStarted
    );
  }
};

export const getVehicleTelemetry = async (
  vehicleId: string,
  from: Date,
  to: Date
) => {
  const queryStarted = performance.now();

  try {
    // 1. Find vehicle.
    const vehicle = await getCachedVehicle(vehicleId);

    if (!vehicle) {
      throw new Error("VEHICLE_NOT_FOUND");
    }

    // 2. Query matching buckets.
    const buckets = await TelemetryBucket.aggregate([
      {
        $match: {
          vehicle: vehicle._id,
          bucketStart: { $lt: to },
          bucketEnd: { $gt: from },
        },
      },
      {
        $sort: {
          bucketStart: 1,
        },
      },
      {
        $project: {
          _id: 0,
          points: {
            $filter: {
              input: "$points",
              as: "point",
              cond: {
                $and: [
                  { $gte: ["$$point.recordedAt", from] },
                  { $lte: ["$$point.recordedAt", to] },
                ],
              },
            },
          },
        },
      },
    ]).exec();

    // 3. Combine filtered points.
    const points = buckets.flatMap(
      (bucket) => bucket.points
    );

    // 4. Return existing response structure.
    return {
      vehicleId: vehicle.vehicleId,
      from,
      to,
      points,
    };
  } finally {
    recordMetric(
      "mongodb.telemetry_read",
      performance.now() - queryStarted
    );
  }
};
