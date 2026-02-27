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

### Required

| Tool | Version | Install |
|------|---------|---------|
| **Go** | `1.25.4` | [go.dev/dl](https://go.dev/dl/) |
| **Node.js** | LTS (v24+) | [nodejs.org](https://nodejs.org/) or via `nvm install --lts` |
| **npm** | Bundled with Node | Comes with Node.js |

### Optional

| Tool | Purpose |
|------|---------|
| **AWS CLI** | Infra workflows & deploying CDK stacks |
| **AWS credentials** | Required only for Cognito auth routes, DynamoDB-backed stores, and infra |

Verify your installs:

```bash
go version        # go1.25.4 or later
node --version    # v24.x or later
npm --version     # 11.x or later
```

---

## Setup

### 1) Clone the repo

```bash
git clone https://github.com/AdamGallagher339/Codename-Blood.git
cd Codename-Blood
```

### 2) Configure environment variables

The backend loads a `.env` file automatically on startup (via `godotenv`).
An example file is provided at `backend/.env.example` — copy it and fill in any values you need:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set the variables relevant to your setup:

#### Authentication

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_MODE` | No | Set to `local` to skip Cognito and use local dev JWTs |
| `LOCAL_AUTH` | No | Set to `true` to enable local auth (alternative flag) |
| `LOCAL_AUTH_SECRET` | No | Custom secret for signing local dev JWTs (a default is used if unset) |
| `AWS_REGION` | For Cognito | AWS region for Cognito (e.g. `eu-north-1`) |
| `COGNITO_USER_POOL_ID` | For Cognito | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | For Cognito | Cognito App Client ID |
| `COGNITO_CLIENT_SECRET` | For Cognito | Cognito App Client Secret |

#### DynamoDB tables (main backend)

These are only needed if you want the DynamoDB-backed data stores instead of the in-memory defaults:

| Variable | Description |
|----------|-------------|
| `USERS_TABLE` | DynamoDB table name for users |
| `BIKES_TABLE` | DynamoDB table name for bikes |
| `DEPOTS_TABLE` | DynamoDB table name for depots |
| `JOBS_TABLE` | DynamoDB table name for jobs |

#### DynamoDB tables (fleet tracker)

| Variable | Description |
|----------|-------------|
| `FLEET_BIKES_TABLE` | DynamoDB table name for fleet bikes |
| `FLEET_SERVICE_TABLE` | DynamoDB table name for fleet service records |

#### DynamoDB tables (Lambda)

| Variable | Description |
|----------|-------------|
| `MOTORCYCLES_TABLE` | DynamoDB table name used by Lambda functions |

> **Tip:** For local-only development without AWS, you can leave all DynamoDB and Cognito variables empty. The backend will fall back to in-memory stores and `AUTH_MODE=local` will let you authenticate without Cognito.

### 3) Install dependencies

```bash
# Backend (Go modules)
cd backend
go mod download

# Frontend (npm packages)
cd ../frontend/blood-bike-web
npm install
```

---

## Run Locally


You need two processes running — the Go backend and the frontend server. Both must be running for the app to work.

**Important: Set AWS credentials before running the backend if you want to use AWS features (Cognito, DynamoDB, etc.).**

You can set credentials in your shell before starting the backend:

```bash
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
# Optionally, export AWS_SESSION_TOKEN=your-session-token
```

Or configure them using the AWS CLI (`aws configure`).


| Service | URL | Purpose |
|---------|-----|---------|
| **Backend** | `http://localhost:8080` | Go API server |
| **Frontend** | `http://localhost:4200` | Serves UI, proxies `/api` → backend |

### 1) Start the backend


```bash
cd backend
go build -o backend .
./backend
```

The backend will automatically pull all AWS environment variables (Cognito, DynamoDB, etc.) from your `.env` file and use the AWS credentials you set above for all AWS operations (active riders, admin, etc.).

You should see log output confirming it's listening on `:8080`.

> **Quick check:** `curl http://localhost:8080/api/health`

### 2) Start the frontend

There are two options — pick one:

#### Option A: Production build + PWA server (recommended)

This builds the full Angular app and serves it with push notification and service worker support:

```bash
cd frontend/blood-bike-web
npm run build:prod
node serve-pwa.js
```

#### Option B: Angular dev server (hot reload for development)

Faster iteration with live reload, but no service worker / push notifications:

```bash
cd frontend/blood-bike-web
npm run start
```

**Open the app:** [http://localhost:4200](http://localhost:4200)

> **Proxy check:** `curl http://localhost:4200/api/health` — should return the same response as the backend directly.

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

---

## Infra (optional)

Infrastructure code is in `infra/` (AWS CDK). This is **not** required to run the app locally.

```bash
cd infra
npm install
npx cdk synth   # synthesize CloudFormation template
npx cdk deploy  # deploy to AWS (requires credentials)
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
│   │   ├── auth/        # Authentication (Cognito + local dev mode)
│   │   ├── events/      # Event management
│   │   ├── fleet/       # Fleet/bike/user management
│   │   ├── httpapi/     # HTTP router, job receipts, SES email
│   │   ├── push/        # Web push notifications (VAPID)
│   │   ├── repo/        # Data layer (DynamoDB + in-memory)
│   │   └── tracking/    # Location tracking (WebSocket + HTTP)
│   └── main.go
├── frontend/            # Angular PWA frontend
│   └── blood-bike-web/
│       ├── serve-pwa.js # Production PWA server with API proxy
│       └── src/app/
│           ├── components/  # UI components
│           ├── models/      # TypeScript models
│           └── services/    # API services
├── infra/               # AWS CDK infrastructure
├── scripts/             # Utility scripts
└── docs/                # Documentation
```
