# Repository Structure — Codename Blood

A blood bike volunteer coordination platform for real-time delivery management, GPS tracking, fleet management, and event scheduling.

---

## 1. Main Folders

| Folder | Description |
|--------|-------------|
| `backend/` | Go HTTP API server, Lambda handlers, internal packages, and CLI tools |
| `frontend/blood-bike-web/` | Angular 20 Progressive Web App (PWA) — the main client |
| `infra/` | AWS CDK Infrastructure as Code (TypeScript) |
| `aws/` | Bundled AWS CLI v2 installer |
| `scripts/` | Utility shell scripts (e.g. GPS simulation) |
| `docs/` | Project documentation (simulation guide, tracking map) |
| `data/` | Local BoltDB data files (`push.db`, `users.db`) used in dev mode |

### Backend Sub-Folders

| Path | Purpose |
|------|---------|
| `backend/internal/httpapi/` | Central HTTP router, middleware, and route registration |
| `backend/internal/auth/` | Authentication (AWS Cognito or local dev mode), role-based access |
| `backend/internal/fleet/` | Fleet management — bikes, riders, ride sessions, issue reports |
| `backend/internal/tracking/` | Real-time GPS location tracking with in-memory store |
| `backend/internal/analytics/` | Rider performance analytics (speed, distance, active time) |
| `backend/internal/events/` | Event scheduling and lifecycle management |
| `backend/internal/push/` | Web push notifications via VAPID / webpush |
| `backend/internal/repo/` | Data repository interfaces with DynamoDB and in-memory implementations |
| `backend/internal/repo/dynamo/` | DynamoDB-backed repository implementations |
| `backend/internal/repo/memory/` | In-memory repository implementations for local development |
| `backend/internal/configdb/` | Runtime config loading from DynamoDB `AppConfig` table |
| `backend/cmd/dashboard/` | Real-time stats dashboard CLI (port 9090) |
| `backend/cmd/simulate/` | Load simulation tool — creates synthetic users and jobs |
| `backend/lambda/api/` | Lambda adapter wrapping the main HTTP API |
| `backend/lambda/getBikes/` | Standalone Lambda to list bikes from DynamoDB |
| `backend/lambda/registerBike/` | Standalone Lambda to register a new bike |

### Frontend Sub-Folders

| Path | Purpose |
|------|---------|
| `frontend/blood-bike-web/src/app/` | Angular application root (components, services, models, guards) |
| `frontend/blood-bike-web/src/app/components/` | UI components (maps, dashboards, forms, job workflows) |
| `frontend/blood-bike-web/src/app/services/` | HTTP services, auth interceptor, WebSocket clients |
| `frontend/blood-bike-web/src/app/models/` | TypeScript interfaces for jobs, locations, fleet bikes, events |
| `frontend/blood-bike-web/src/app/guards/` | Angular route guards (role-based access) |
| `frontend/blood-bike-web/src/environments/` | Environment config (AWS settings) |
| `frontend/blood-bike-web/public/` | Static assets — manifest, service worker, icons |

---

## 2. Folder Responsibilities

### `backend/`
The Go backend provides a REST + WebSocket API for the entire platform. It handles user authentication, job dispatch and lifecycle, fleet bike management, real-time GPS tracking, rider analytics, event management, push notifications, geocoding (via Nominatim proxy), and public rider application intake. It supports two runtime modes: local development (in-memory stores, local auth) and AWS deployment (DynamoDB, Cognito, Lambda).

### `frontend/blood-bike-web/`
An Angular 20 PWA that provides the user interface. Includes role-based views for dispatchers, riders, fleet managers, and HR. Key features include a live Leaflet tracking map, job workflow with signature capture, QR code scanning, availability management, analytics dashboards, and push notification support. The dev server proxies API requests to the backend on port 8080.

### `infra/`
AWS CDK v2 infrastructure stack that provisions DynamoDB tables, Lambda functions (Go), Cognito user pool and groups, and an API Gateway REST API. Defines the full cloud deployment architecture.

### `aws/`
A bundled AWS CLI v2 installer for setting up AWS credentials and CLI tools in development environments.

### `scripts/`
Shell scripts for development utilities. Currently contains `simulate-tracking.sh` which sends simulated GPS location updates to the tracking API at 3-second intervals.

### `docs/`
Markdown documentation covering the load simulation tool and the live tracking map architecture.

### `data/`
Local BoltDB database files used during development — stores push notification subscriptions and local auth user records.

---

## 3. Major Entry Points

| File | Role |
|------|------|
| `backend/main.go` | Primary backend server — loads env, initialises stores, listens on port 8080 |
| `backend/cmd/dashboard/main.go` | Stats dashboard server — reads DynamoDB tables, serves HTML + JSON on port 9090 |
| `backend/cmd/simulate/main.go` | Load simulation CLI — creates 90 synthetic users, runs concurrent job lifecycles |
| `backend/lambda/api/main.go` | AWS Lambda adapter — wraps the main HTTP handler for API Gateway |
| `backend/lambda/getBikes/main.go` | Standalone Lambda — scans Motorcycles DynamoDB table |
| `backend/lambda/registerBike/main.go` | Standalone Lambda — writes a bike record to DynamoDB |
| `frontend/blood-bike-web/src/main.ts` | Angular bootstrap — initialises the app with service worker |
| `frontend/blood-bike-web/src/index.html` | Production HTML shell |
| `frontend/blood-bike-web/src/index.dev.html` | Development HTML shell |
| `infra/bin/infra.ts` | CDK app entry point — instantiates the infrastructure stack |
| `infra/lib/infra-stack.ts` | CDK stack definition — all AWS resources declared here |
| `scripts/simulate-tracking.sh` | GPS tracking simulation script |

---

## 4. Programming Languages

| Language | Usage |
|----------|-------|
| **Go** (1.25.4) | Backend API server, Lambda functions, CLI tools |
| **TypeScript** (~5.9.2) | Angular frontend, CDK infrastructure |
| **HTML / SCSS** | Frontend templates and styles |
| **Bash** | Utility scripts, AWS CLI installer |

---

## 5. Frameworks and Libraries

### Backend (Go)

| Library | Purpose |
|---------|---------|
| `github.com/gorilla/websocket` | WebSocket connections for real-time tracking |
| `github.com/golang-jwt/jwt/v5` | JWT token parsing and validation |
| `github.com/MicahParks/keyfunc/v2` | JWKS key fetching for Cognito JWT verification |
| `github.com/joho/godotenv` | `.env` file loading |
| `go.etcd.io/bbolt` | BoltDB embedded key-value database (push subscriptions, local users) |
| `github.com/SherClockHolmes/webpush-go` | Web push notifications with VAPID |
| `github.com/aws/aws-sdk-go-v2` | AWS SDK v2 (Cognito, DynamoDB, SES) |
| `github.com/aws/aws-lambda-go` | AWS Lambda Go runtime and API Gateway proxy |
| `github.com/awslabs/aws-lambda-go-api-proxy` | Adapts `net/http` handlers to Lambda events |

### Frontend (Angular 20)

| Library | Purpose |
|---------|---------|
| `@angular/core` + framework packages | Angular 20 core framework |
| `@angular/service-worker` | Progressive Web App (PWA) support |
| `leaflet` (^1.9.4) | Interactive maps for live GPS tracking |
| `leaflet-routing-machine` (^3.2.12) | Route calculation and display on maps |
| `html5-qrcode` (^2.3.8) | QR code scanning for bike identification |
| `rxjs` | Reactive programming for async data streams |
| `zone.js` | Angular change detection |

### Infrastructure (CDK)

| Library | Purpose |
|---------|---------|
| `aws-cdk-lib` (^2.232.1) | AWS CDK v2 constructs |
| `@aws-cdk/aws-lambda-go-alpha` | CDK construct for Go Lambda functions |
| `constructs` (^10.4.3) | CDK construct base library |

---

## 6. APIs and External Services

| Service | Usage |
|---------|-------|
| **Nominatim (OpenStreetMap)** | Geocoding API — address search proxied through backend (`/api/geocode`), restricted to Ireland |
| **Web Push (VAPID)** | Browser push notifications — VAPID keys auto-generated on first run, subscriptions stored in BoltDB |
| **WebSocket** | Real-time GPS location streaming to connected clients (disabled when running on Lambda; falls back to HTTP polling) |

---

## 7. Cloud Services (AWS)

| Service | Usage |
|---------|-------|
| **Amazon DynamoDB** | Primary data store — tables: `Users`, `Bikes`, `Jobs`, `Depots`, `Motorcycles`, `RideSessions`, `IssueReports`, `FleetBikes`, `FleetServiceHistory`, `AppConfig` (all on-demand billing) |
| **Amazon Cognito** | User authentication — user pool with self-signup, email sign-in, and role groups (`BloodBikeAdmin`, `Rider`, `Dispatcher`, `FleetManager`, `HR`) |
| **AWS Lambda** | Serverless compute — main API handler, `GetBikes`, `RegisterBike` functions (Go runtime) |
| **Amazon API Gateway** | REST API — routes requests to Lambda functions, Cognito authorizer for protected endpoints |
| **Amazon SES** | Transactional email — sends delivery receipt emails with signature images |
| **AWS CloudFormation** | Deployment — CDK synthesises CloudFormation templates |

---

## 8. Build Tools and Package Managers

| Tool | Usage |
|------|-------|
| **Go Modules** (`go.mod` / `go mod download`) | Backend dependency management |
| **npm** (`package.json`) | Frontend and infrastructure dependency management |
| **Angular CLI** (`@angular/cli`) | Frontend build, serve, and test commands |
| **TypeScript Compiler** (`tsc`) | TypeScript compilation for frontend and CDK |
| **Jest** | Unit testing for frontend (via `jest-preset-angular`) and CDK infrastructure |
| **Karma** | Legacy test runner (configured but superseded by Jest) |
| **Go Build** (`go build`) | Compiles backend binaries (`backend`, `dashboard`, `simulate`) |

---

## 9. Deployment Tools

| Tool | Usage |
|------|-------|
| **AWS CDK** (`cdk deploy`) | Synthesises and deploys CloudFormation stacks from TypeScript definitions |
| **AWS CLI v2** | Bundled in `aws/` folder — used for credential configuration and manual AWS operations |
| **AWS Lambda Go API Proxy** | Adapts the standard Go `net/http` handler to run inside AWS Lambda behind API Gateway |
| **Angular Service Worker** (`ngsw-config.json`) | Enables PWA install, offline caching, and push notifications in production builds |
| **Dev Container** | Repository includes a dev container configuration (Ubuntu 24.04 environment) |
