
import { Schema, model, Types, type Document } from "mongoose";

export interface IGpsPoint {
  latitude: number;
  longitude: number;
  recordedAt: Date;
  speed?: number;
}

export interface ITelemetryBucket extends Document {
  vehicle: Types.ObjectId;
  bucketStart: Date;
  bucketEnd: Date;
  points: IGpsPoint[];
  createdAt: Date;
  updatedAt: Date;
}

const gpsPointSchema = new Schema<IGpsPoint>(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    recordedAt: {
      type: Date,
      required: true,
    },
    speed: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

const telemetryBucketSchema = new Schema<ITelemetryBucket>(
  {
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    bucketStart: {
      type: Date,
      required: true,
    },
    bucketEnd: {
      type: Date,
      required: true,
    },
    points: {
      type: [gpsPointSchema],
      default: [],
    },
  },
  { timestamps: true }
);

telemetryBucketSchema.index(
  { vehicle: 1, bucketStart: 1 },
  { unique: true }
);

const TelemetryBucket = model<ITelemetryBucket>(
  "TelemetryBucket",
  telemetryBucketSchema
);

export default TelemetryBucket;
