
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

  // Validate vehicle ID
  if (
    typeof vehicleId !== "string" ||
    vehicleId.trim().length === 0
  ) {
    throw new Error("INVALID_TELEMETRY");
  }

  // Validate coordinates
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

  // Validate speed when provided
  if (
    speed !== undefined &&
    (!Number.isFinite(speed) || speed < 0)
  ) {
    throw new Error("INVALID_TELEMETRY");
  }

  // Validate timestamp
  const timestamp =
    recordedAt === undefined
      ? new Date()
      : new Date(recordedAt);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("INVALID_TIMESTAMP");
  }

  // 1. Get vehicle and measure lookup/cache time
  const vehicleLookupStarted = performance.now();

  const vehicle = await getCachedVehicle(vehicleId);

  const vehicleLookupMs =
    performance.now() - vehicleLookupStarted;

  if (!vehicle) {
    console.log("[Database breakdown]", {
      vehicleLookupMs: Number(vehicleLookupMs.toFixed(2)),
      bucketWriteMs: null,
      result: "VEHICLE_NOT_FOUND",
    });

    throw new Error("VEHICLE_NOT_FOUND");
  }

  // 2. Calculate the hourly bucket
  const bucketStart = new Date(timestamp);
  bucketStart.setUTCMinutes(0, 0, 0);

  const bucketEnd = new Date(
    bucketStart.getTime() + 60 * 60 * 1000
  );

  const point = {
    latitude,
    longitude,
    recordedAt: timestamp,
    ...(speed !== undefined ? { speed } : {}),
  };

  // 3. Save telemetry and measure write time
  const bucketWriteStarted = performance.now();

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

  const bucketWriteMs =
    performance.now() - bucketWriteStarted;

  // 4. Log timing breakdown
  console.log("[Database breakdown]", {
    vehicleLookupMs: Number(vehicleLookupMs.toFixed(2)),
    bucketWriteMs: Number(bucketWriteMs.toFixed(2)),
    totalDatabaseMs: Number(
      (vehicleLookupMs + bucketWriteMs).toFixed(2)
    ),
  });

  // 5. Return telemetry details
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
  const vehicle = await getCachedVehicle(vehicleId);

  if (!vehicle) {
    throw new Error("VEHICLE_NOT_FOUND");
  }

  const buckets = await TelemetryBucket.find({
    vehicle: vehicle._id,
    bucketStart: { $lt: to },
    bucketEnd: { $gt: from },
  }).sort({ bucketStart: 1 });

  const points = buckets.flatMap((bucket) =>
    bucket.points.filter(
      (point) =>
        point.recordedAt >= from &&
        point.recordedAt <= to
    )
  );

  return {
    vehicleId: vehicle.vehicleId,
    from,
    to,
    points,
  };
};
