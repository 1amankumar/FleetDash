
import { Schema, model, type Document } from "mongoose";

export interface IVehicle extends Document {
  vehicleId: string;
  registrationNumber: string;
  vehicleType: "truck" | "van" | "car";
  status: "active" | "inactive" | "maintenance";
  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<IVehicle>(
  {
    vehicleId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      enum: ["truck", "van", "car"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "inactive",
    },
  },
  {
    timestamps: true,
  }
);

const Vehicle = model<IVehicle>("Vehicle", vehicleSchema);

export default Vehicle;
