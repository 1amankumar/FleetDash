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
