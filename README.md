{
  "vehicleId": "VAN-102",
  "latitude": 23.7957,
  "longitude": 86.4304,
  "speed": 45
}
{
  "vehicleId": "TRUCK-101",
  "latitude": 23.8005,
  "longitude": 86.4402,
  "speed": 60
}
# FleetDash — Real-Time Fleet Monitoring System

FleetDash is a full-stack fleet monitoring application designed to track vehicle telemetry, visualize vehicle locations, monitor live updates, and detect geofence events.

## Features

- **Fleet Dashboard:** Overview of total vehicles, active vehicles, alerts, and maintenance status.
- **Live Vehicle Tracking:** Visualize vehicle locations using an interactive map.
- **Telemetry Processing:** Validate and process incoming GPS telemetry using a worker pool.
- **Telemetry History:** Retrieve vehicle telemetry for a specified time range.
- **Real-Time Updates:** Redis Pub/Sub and Socket.IO for distributing telemetry events to connected clients.
- **Geofence Monitoring:** Display vehicle entry and exit alerts for configured geofences.
- **Telemetry Storage:** Store GPS points in MongoDB using hourly telemetry buckets.
- **Performance Monitoring:** Benchmark telemetry processing and retrieval operations.
- **Worker Pool Processing:** Process and validate telemetry using a bounded Node.js Worker Thread pool with two workers and a maximum queue capacity of 1,000 tasks.
- **Batched Telemetry Writes:** Buffer telemetry writes and persist events in batches of up to 20, reducing individual database operations.
- **Optimized Database Writes:** Group telemetry points by vehicle and hourly bucket before persisting them to MongoDB.
- **Binary Telemetry Broadcasting:** Use MessagePack to encode telemetry batches and Socket.IO to broadcast compact binary payloads.
- **Geofence Transition Detection:** Detect vehicle entry and exit transitions using Turf.js and prevent duplicate alerts when vehicle state remains unchanged.
- **Queue Management:** Implement queue capacity limits, write-failure handling, and graceful draining of pending telemetry writes.
- **Graceful Server Shutdown:** Handle SIGINT and SIGTERM signals, close active connections, drain pending writes, and disconnect Redis and MongoDB.
- **Automated Backend Testing:** Validate API endpoints, telemetry input, geofence transitions, queue capacity, database write failures, and graceful queue draining.
- **Continuous Integration:** Run backend tests and TypeScript checks automatically through GitHub Actions.

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Leaflet / React Leaflet

### Backend
- Node.js
- Express.js
- TypeScript
- MongoDB and Mongoose
- Redis Pub/Sub
- Socket.IO
- Node.js Worker Threads
- Turf.js – Geospatial calculations and point-in-polygon detection
- MessagePack – Binary telemetry serialization
- Node.js Worker Threads – Asynchronous telemetry processing
- Node.js Test Runner and Supertest – Backend testing
- GitHub Actions – Continuous integration and automated validation

## Project Structure

```text
FleetDash/
├── .github/
│   └── workflows/
│       └── backend-tests.yml
├── backend/
│   └── src/
├── frontend/
├── .gitignore
└── README.md
```

## Performance and Testing

FleetDash includes performance measurement and automated testing capabilities.

### Telemetry Processing
- Worker pool configured with 2 workers.
- Maximum worker task queue capacity: 1,000 tasks.
- Telemetry write batch size: 20 events.
- Telemetry write flush interval: 25 milliseconds.
- Maximum telemetry write queue capacity: 1,000 pending events.

### Benchmark Results

A local telemetry load test was performed with the following results:

| Metric | Result |
|---|---:|
| Successful requests | 1,040 |
| Failed requests | 0 |
| Throughput | 102.31 requests/second |
| P50 latency | 53.77 ms |
| P95 latency | 488.29 ms |
| P99 latency | 530.77 ms |

These results represent one local benchmark run and may vary depending on hardware, network conditions, and database performance.

### Automated Testing

The backend test suite currently includes 15 passing tests across:
- API health checks
- Vehicle API validation
- Telemetry API validation
- Telemetry query validation
- Geofence entry and exit detection
- Duplicate alert prevention
- Telemetry batch persistence
- Database failure handling
- Queue capacity limits
- Graceful queue draining

### Continuous Integration

GitHub Actions automatically executes:
1. Dependency installation using `npm ci`.
2. Backend automated tests using `npm test`.
3. TypeScript validation using `npx tsc --noEmit`.

The latest verified workflow completed successfully.

## Geofencing

FleetDash currently includes a predefined geofence named **Dhanbad Zone 1**.

The geofence is defined using geographical polygon coordinates and Turf.js is used to determine whether vehicle GPS positions fall inside or outside the configured boundary.

When a vehicle crosses the boundary:
- An `entered` event is generated when it enters the zone.
- An `exited` event is generated when it leaves the zone.
- The backend publishes alerts through Socket.IO using the `geofence:alert` event.
- The frontend updates the Geofence Alerts section and alert counter in real time.

The system also tracks the previous geofence state of each vehicle to avoid generating duplicate alerts when its state has not changed.

### Example telemetry payloads

**Van — Outside Dhanbad Zone 1**

```json
{
  "vehicleId": "VAN-102",
  "latitude": 23.7957,
  "longitude": 86.4304,
  "speed": 45
}
```

**Truck — Outside Dhanbad Zone 1**

```json
{
  "vehicleId": "TRUCK-101",
  "latitude": 23.8005,
  "longitude": 86.4402,
  "speed": 60
}
```

To generate an entry alert, initialize a vehicle outside the zone and then send a subsequent telemetry position inside the configured boundary.

## Prerequisites

Install the following before running the project:

- Node.js and npm
- MongoDB Atlas or a local MongoDB instance
- Redis server or Docker

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/1amankumar/FleetDash.git
cd FleetDash
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Create a `.env` file using the variable names expected by your backend configuration.

Typical configuration values include:

```env
PORT=8000
MONGODB_URI=your_mongodb_connection_string
REDIS_URL=redis://localhost:6379
```

Replace the example MongoDB value with your actual connection string. Check your source code for any additional required environment variables.

**Never commit your `.env` file, credentials, or API keys.**

### 3. Start Redis

If Redis is installed locally, start the Redis server.

If you use the existing Docker container, start it with:

```bash
docker start fleetdash-redis
```

If the container does not exist, configure Redis separately before starting the backend.

### 4. Start the backend

From the `backend` directory:

```bash
npm run dev
```

The API is expected to run at:

`http://localhost:8000`

### 5. Start the frontend

Open a second terminal at the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, normally:

`http://localhost:5173`

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/vehicles` | Retrieve vehicle information |
| POST | `/api/telemetry` | Submit vehicle telemetry |
| GET | `/api/telemetry/:vehicleId?from=...&to=...` | Retrieve telemetry within a time range |

The `/api/addtelemetry` endpoint is also present in earlier project development; verify whether it remains supported in the current implementation.

### Example: Submit telemetry

```json
{
  "vehicleId": "TRUCK-101",
  "latitude": 23.815,
  "longitude": 86.425,
  "speed": 45,
  "recordedAt": "2026-10-23T13:45:00.000Z"
}
```

Send the payload to `POST /api/telemetry` with `Content-Type: application/json`.

### Example: Retrieve telemetry

```http
GET /api/telemetry/TRUCK-101?from=2026-10-23T13:00:00.000Z&to=2026-10-23T14:00:00.000Z
```

The response includes the vehicle ID, requested time range, and matching telemetry points.

## Architecture Overview

1. The API receives incoming telemetry.
2. The backend validates the request and processes telemetry using a worker pool.
3. Valid GPS points are stored in MongoDB, organized into hourly buckets.
4. Telemetry events are published through Redis Pub/Sub.
5. Connected clients receive real-time updates through Socket.IO.
6. The frontend displays vehicle positions, fleet statistics, and geofence alerts.

## Running Tests

Review the scripts defined in `backend/package.json` and run the appropriate test commands. The repository includes a backend workflow at `.github/workflows/backend-tests.yml`; verify that the workflow passes in GitHub Actions.

## Future Improvements

- Add automated integration tests for telemetry ingestion and retrieval.
- Improve telemetry query performance for larger datasets.
- Add authentication and role-based access control if required.
- Add deployment configuration and production monitoring.

## Author

**Aman Kumar**

GitHub: [1amankumar](https://github.com/1amankumar)

---

FleetDash is a portfolio project demonstrating full-stack development, asynchronous processing, real-time communication, and geospatial monitoring.

for deployment i deploy backend in render and for frontend i deploy in vercel