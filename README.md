# Codename Blood

Blood Bike fleet + events tooling with live GPS tracking.

## Features

- 🗺️ **Live Tracking Map**: Real-time GPS location tracking for bikes and riders
- 📅 **Event Management**: Schedule and coordinate blood delivery events
- 🚲 **Fleet Management**: Track bikes, riders, and assignments
- 📱 **QR Scanner**: Quick bike registration and ride management
- 🔒 **Authentication**: Secure user authentication with AWS Cognito
- 📡 **WebSocket Support**: Real-time updates via WebSocket connections

## Prerequisites

### Required (run backend + frontend locally)

- Go (this repo currently targets Go `1.25.4`)
- Node.js + npm (LTS recommended)

### Optional

- AWS credentials configured (only needed for Cognito auth routes and/or infra)
- AWS CLI (only needed for infra workflows)

## Run Locally (Backend + Frontend)

You will run two processes:

- Backend API: `http://localhost:8080`
- Frontend (Angular dev server): `http://localhost:4200` (proxies `/api` to the backend)

### 1) Start the backend (Go)

```bash
cd backend
go mod download
go run .
```

Backend health check:

```bash
curl http://localhost:8080/api/health
```

### 2) Start the frontend (Angular)

In a second terminal:

```bash
cd frontend/blood-bike-web
npm install
npm run start
```

Open:

- `http://localhost:4200`

Proxy check (frontend → backend):

```bash
curl http://localhost:4200/api/health
```

### 3) Test the Live Tracking Map

The tracking map is accessible at `http://localhost:4200/tracking` (or click "Map" in the navigation).

To simulate location updates, use the provided script:

```bash
# In a third terminal
cd scripts
./simulate-tracking.sh

# Or with custom entity ID
ENTITY_ID=bike-002 ENTITY_TYPE=bike ./simulate-tracking.sh
```

See [docs/TRACKING_MAP.md](docs/TRACKING_MAP.md) for detailed documentation.

## Environment Variables

### Backend (optional Cognito auth)

If these are not set, the backend will still run, but the Cognito auth routes won’t be enabled:

- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `AWS_REGION`

Example:

```bash
export AWS_REGION=eu-west-1
export COGNITO_USER_POOL_ID=eu-west-1_XXXXXXX
export COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Fleet Tracker (DynamoDB)

The fleet tracker endpoints use DynamoDB. Set these to enable `/api/fleet/*` routes:

- `FLEET_BIKES_TABLE`
- `FLEET_SERVICE_TABLE`

## Infra (optional)

Infrastructure code is in `infra/` (AWS CDK). This is not required to run the app locally.

```bash
cd infra
npm install
```

## API Documentation

### Tracking Endpoints

- `POST /api/tracking/update` - Submit location update
- `GET /api/tracking/locations` - Get all active locations
- `GET /api/tracking/entities` - Get all tracked entities
- `WS /api/tracking/ws` - WebSocket for real-time updates

For complete API documentation, see [docs/TRACKING_MAP.md](docs/TRACKING_MAP.md).

## Project Structure

```
├── backend/              # Go backend API
│   ├── internal/
│   │   ├── auth/        # Authentication (Cognito)
│   │   ├── events/      # Event management
│   │   ├── fleet/       # Fleet/bike management
│   │   └── tracking/    # Location tracking (WebSocket + HTTP)
│   └── main.go
├── frontend/            # Angular frontend
│   └── blood-bike-web/
│       └── src/app/
│           ├── components/  # UI components
│           ├── models/      # TypeScript models
│           └── services/    # API services
├── infra/               # AWS CDK infrastructure
├── scripts/             # Utility scripts
└── docs/                # Documentation
```
