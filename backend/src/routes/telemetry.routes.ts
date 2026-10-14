
import { Router } from "express";
import {createTelemetry,fetchVehicleTelemetry,} from "../controllers/telemetry.controller.js";

const router = Router();

router.post("/", createTelemetry);
router.get("/:vehicleId", fetchVehicleTelemetry);

export default router;
