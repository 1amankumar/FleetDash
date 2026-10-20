
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "./app.js";
import { after } from "node:test";
import { closeTelemetryWorkerPool } from "./services/telemetryWorkerPool.service.js";

describe("FleetDash API health check", () => {
  it("returns HTTP 200 and a success response", async () => {
    const response = await request(app).get("/api/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.message, "FleetDash Api is running");
    assert.ok(response.body.timestamp);
  });
});

describe("Vehicle API", () => {
  it("rejects a vehicle with missing required fields", async () => {
    const response = await request(app)
      .post("/api/vehicles")
      .send({ vehicleId: "TEST-101" });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(
      response.body.message,
      "Please provide valid vehicle details"
    );
  });

  it("rejects an unsupported vehicle type", async () => {
    const response = await request(app)
      .post("/api/vehicles")
      .send({
        vehicleId: "TEST-102",
        registrationNumber: "TEST-REG-102",
        vehicleType: "airplane",
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
  });
});

describe("Telemetry API", () => {
  it("rejects telemetry with missing required fields", async () => {
    const response = await request(app)
      .post("/api/telemetry")
      .send({ vehicleId: "TRUCK-101" });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(
      response.body.message,
      "Please provide valid telemetry data"
    );
  });

  it("rejects string coordinates instead of numbers", async () => {
    const response = await request(app)
      .post("/api/telemetry")
      .send({
        vehicleId: "TRUCK-101",
        latitude: "23.815",
        longitude: "86.425",
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
  });
});

describe("Telemetry query validation", () => {
  it("rejects a request missing the time range", async () => {
    const response = await request(app)
      .get("/api/telemetry/TRUCK-101");

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Provide vehicleId, from, and to");
  });

  it("rejects a time range where from is after to", async () => {
    const response = await request(app)
      .get("/api/telemetry/TRUCK-101")
      .query({
        from: "2026-10-20T12:00:00.000Z",
        to: "2026-10-20T10:00:00.000Z",
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(
      response.body.message,
      "Provide a valid time range; from must precede to"
    );
  });
});
setTimeout(() => {
  console.log("Active handles:", process.getActiveResourcesInfo());
}, 1000).unref();

after(async () => {
  await closeTelemetryWorkerPool();
});