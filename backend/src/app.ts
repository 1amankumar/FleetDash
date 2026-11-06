import express from "express";
import cors from "cors";

import vehicleRoute from "./routes/vehicle.routes.js";
import telemetryRoute from "./routes/telemetry.routes.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter((origin): origin is string => Boolean(origin));

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);

app.use(express.json());

app.use("/api/vehicles", vehicleRoute);
app.use("/api/telemetry", telemetryRoute);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "FleetDash Api is running",
    timestamp: new Date().toISOString(),
  });
});

export default app;