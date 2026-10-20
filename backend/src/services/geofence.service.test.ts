
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checkGeofences,
  geofences,
} from "./geofence.service.js";

// Safely verify that a geofence is configured.
const testGeofence = geofences[0];

assert.ok(testGeofence, "Expected at least one geofence");

describe("Geofence service", () => {
  it("records the first position without generating an alert", () => {
    const vehicleId = "TEST-GEOFENCE-FIRST";

    const alerts = checkGeofences(
      vehicleId,
      23.815,
      86.425
    );

    assert.equal(alerts.length, 0);
  });

  it("generates an entered alert when a vehicle enters the zone", () => {
    const vehicleId = "TEST-GEOFENCE-ENTER";

    // Initialize the vehicle outside the zone.
    checkGeofences(vehicleId, 23.83, 86.44);

    // Move the vehicle inside the zone.
    const alerts = checkGeofences(
      vehicleId,
      23.815,
      86.425
    );

    assert.equal(alerts.length, 1);

    const alert = alerts[0];
    assert.ok(alert, "Expected an entered alert");

    assert.equal(alert.type, "entered");
    assert.equal(alert.vehicleId, vehicleId);
    assert.equal(alert.geofenceId, testGeofence.id);
    assert.equal(alert.geofenceName, testGeofence.name);
    assert.equal(typeof alert.timestamp, "string");
  });

  it("generates an exited alert when a vehicle leaves the zone", () => {
    const vehicleId = "TEST-GEOFENCE-EXIT";

    // Initialize the vehicle inside the zone.
    checkGeofences(vehicleId, 23.815, 86.425);

    // Move the vehicle outside the zone.
    const alerts = checkGeofences(
      vehicleId,
      23.83,
      86.44
    );

    assert.equal(alerts.length, 1);

    const alert = alerts[0];
    assert.ok(alert, "Expected an exited alert");

    assert.equal(alert.type, "exited");
    assert.equal(alert.vehicleId, vehicleId);
    assert.equal(alert.geofenceId, testGeofence.id);
    assert.equal(alert.geofenceName, testGeofence.name);
    assert.equal(typeof alert.timestamp, "string");
  });

  it("does not generate duplicate alerts when the state is unchanged", () => {
    const vehicleId = "TEST-GEOFENCE-STABLE";

    // Initialize the vehicle outside the zone.
    checkGeofences(vehicleId, 23.83, 86.44);

    // Keep the vehicle outside the zone.
    const alerts = checkGeofences(
      vehicleId,
      23.832,
      86.442
    );

    assert.equal(alerts.length, 0);
  });
});
