
import { performance } from "node:perf_hooks";
import Vehicle from "../models/Vehicle.js";
import TelemetryBucket from "../models/TelemetryBucket.js";

const VEHICLE_CACHE_TTL_MS = 60_000;

interface CachedVehicle {
  vehicle: InstanceType<typeof Vehicle>;
  expiresAt: number;
}

const vehicleCache = new Map<string, CachedVehicle>();

async function getCachedVehicle(vehicleId: string) {
  const key = vehicleId.trim();
  const cached = vehicleCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.vehicle;
  }

  if (cached) {
    vehicleCache.delete(key);
  }

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
  const {
    vehicleId,
    latitude,
    longitude,
    recordedAt,
    speed,
  } = input;

  // 1. Validate vehicle ID
  if (
    typeof vehicleId !== "string" ||
    vehicleId.trim().length === 0
  ) {
    throw new Error("INVALID_TELEMETRY");
  }

  // 2. Validate coordinates
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

  // 3. Validate speed when provided
  if (
    speed !== undefined &&
    (!Number.isFinite(speed) || speed < 0)
  ) {
    throw new Error("INVALID_TELEMETRY");
  }

  // 4. Validate timestamp
  const timestamp =
    recordedAt === undefined
      ? new Date()
      : new Date(recordedAt);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("INVALID_TIMESTAMP");
  }

  // 5. Measure vehicle lookup
  const vehicleStarted = performance.now();
  const vehicle = await getCachedVehicle(vehicleId);

  console.log(
    `[POST benchmark] Vehicle lookup: ${
      (performance.now() - vehicleStarted).toFixed(2)
    } ms`
  );

  if (!vehicle) {
    throw new Error("VEHICLE_NOT_FOUND");
  }

  // 6. Calculate the hourly bucket
  const bucketStart = new Date(timestamp);
  bucketStart.setUTCMinutes(0, 0, 0);

  const bucketEnd = new Date(
    bucketStart.getTime() + 60 * 60 * 1000
  );

  // 7. Prepare the telemetry point
  const point = {
    latitude,
    longitude,
    recordedAt: timestamp,
    ...(speed !== undefined ? { speed } : {}),
  };

  // 8. Measure MongoDB write
  const writeStarted = performance.now();

  await TelemetryBucket.updateOne(
    {
      vehicle: vehicle._id,
      bucketStart,
    },
    {
      $setOnInsert: {
        bucketEnd,
      },
      $push: {
        points: point,
      },
    },
    {
      upsert: true,
      runValidators: true,
    }
  );

  console.log(
    `[POST benchmark] MongoDB write: ${
      (performance.now() - writeStarted).toFixed(2)
    } ms`
  );

  // 9. Return saved telemetry details
  return {
    vehicleId: vehicle.vehicleId,
    bucketStart,
    bucketEnd,
    point,
  };
};




export const getVehicleTelemetry = async (
  vehicleId: string,
  from: Date,
  to: Date
) => {
  // 1. Measure vehicle lookup
  const vehicleStarted = performance.now();

  const vehicle = await getCachedVehicle(vehicleId);

  console.log(
    `[GET benchmark] Vehicle lookup: ${
      (performance.now() - vehicleStarted).toFixed(2)
    } ms`
  );

  if (!vehicle) {
    throw new Error("VEHICLE_NOT_FOUND");
  }

  // 2. Query matching buckets and filter points in MongoDB
  const queryStarted = performance.now();

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

  console.log(
    `[GET benchmark] MongoDB query + filtered retrieval: ${
      (performance.now() - queryStarted).toFixed(2)
    } ms; buckets: ${buckets.length}`
  );

  // 3. Combine the filtered points
  const points = buckets.flatMap((bucket) => bucket.points);

  console.log(
    `[GET benchmark] Points returned: ${points.length}`
  );

  // 4. Return the existing response structure
  return {
    vehicleId: vehicle.vehicleId,
    from,
    to,
    points,
  };
};



