
import Vehicle from "../models/Vehicle.js";
import TelemetryBucket from "../models/TelemetryBucket.js";

interface AddTelemetryInput {
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

  // 1. Validate the vehicle ID and GPS coordinates.
  if (
    typeof vehicleId !== "string" ||
    !vehicleId.trim() ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    (speed !== undefined &&
      (!Number.isFinite(speed) || speed < 0))
  ) {
    throw new Error("INVALID_TELEMETRY");
  }

  // 2. Find the vehicle in MongoDB.
  const vehicle = await Vehicle.findOne({
    vehicleId: vehicleId.trim(),
  });

  if (!vehicle) {
    throw new Error("VEHICLE_NOT_FOUND");
  }

  // 3. Parse the timestamp or use the current time.
  const timestamp =
    recordedAt === undefined
      ? new Date()
      : new Date(recordedAt);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("INVALID_TIMESTAMP");
  }

  // 4. Calculate the beginning of the UTC hour.
  const bucketStart = new Date(timestamp);
  bucketStart.setUTCMinutes(0, 0, 0);

  // 5. Calculate the end of the UTC hour.
  const bucketEnd = new Date(
    bucketStart.getTime() + 60 * 60 * 1000
  );

  // 6. Prepare the GPS point.
  const point = {
    latitude,
    longitude,
    recordedAt: timestamp,
    ...(speed !== undefined ? { speed } : {}),
  };

  // 7. Find the bucket or create it, then append the point.
  await TelemetryBucket.findOneAndUpdate(
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
      new: true,
      runValidators: true,
    }
  );

  // 8. Return a summary of the saved telemetry.
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
  const vehicle = await Vehicle.findOne({
    vehicleId: vehicleId.trim(),
  });

  if (!vehicle) {
    throw new Error("VEHICLE_NOT_FOUND");
  }

  const buckets = await TelemetryBucket.find({
    vehicle: vehicle._id,
    bucketStart: { $lt: to },
    bucketEnd: { $gt: from },
  }).sort({ bucketStart: 1 });

  const points = buckets
    .flatMap((bucket) => bucket.points)
    .filter(
      (point) =>
        point.recordedAt >= from &&
        point.recordedAt <= to
    )
    .sort(
      (a, b) =>
        a.recordedAt.getTime() - b.recordedAt.getTime()
    );

  return {
    vehicleId: vehicle.vehicleId,
    count: points.length,
    data: points,
  };
};

