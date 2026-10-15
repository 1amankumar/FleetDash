
import { processTelemetryWithPool } from "./services/telemetryWorkerPool.service.js"

const events = [
    {
        vehicleId: "TRUCK-101",
        latitude: 23.7957,
        longitude: 86.4304,
        speed: 45,
    },
    {
        vehicleId: "TRUCK-101",
        latitude: 23.8103,
        longitude: 86.4412,
        speed: 62,
    },
    {
        vehicleId: "TRUCK-101",
        latitude: 23.8201,
        longitude: 86.4505,
        speed: 50,
    },
    {
        vehicleId: "TRUCK-101",
        latitude: 120,
        longitude: 86.4304,
        speed: 45,
    },
];

const results = await Promise.all(
    events.map((event) => processTelemetryWithPool(event))
);

results.forEach((result, index) => {
    console.log(`Event ${index + 1}:`, result);
});

process.exit(0);
