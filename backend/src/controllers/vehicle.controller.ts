
import type { Request, Response } from "express";
import Vehicle from "../models/Vehicle.js";

export const createVehicle = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      vehicleId,
      registrationNumber,
      vehicleType,
      status,
    } = req.body;

    if (
      typeof vehicleId !== "string" ||
      !vehicleId.trim() ||
      typeof registrationNumber !== "string" ||
      !registrationNumber.trim() ||
      !["truck", "van", "car"].includes(vehicleType)
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide valid vehicle details",
      });
      return;
    }

    const vehicle = await Vehicle.create({
      vehicleId: vehicleId.trim(),
      registrationNumber: registrationNumber.trim(),
      vehicleType,
      ...(status !== undefined ? { status } : {}),
    });

    res.status(201).json({
      success: true,
      message: "Vehicle registered successfully",
      data: vehicle,
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "Vehicle ID or registration number already exists",
      });
      return;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ValidationError"
    ) {
      res.status(400).json({
        success: false,
        message: "Vehicle data failed validation",
      });
      return;
    }

    console.error("Failed to create vehicle:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getVehicles = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const vehicles = await Vehicle.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: vehicles.length,
      data: vehicles,
    });
  } catch (error: unknown) {
    console.error("Failed to retrieve vehicles:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
