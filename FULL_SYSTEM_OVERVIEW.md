# Full System Overview — Codename Blood

A comprehensive system document combining the repository structure, feature inventory, frontend architecture, and backend infrastructure into a single reference.

---

## Table of Contents

1. [Project Purpose](#1-project-purpose)
2. [System Architecture](#2-system-architecture)
3. [User Roles](#3-user-roles)
4. [End-to-End User Flows](#4-end-to-end-user-flows)
5. [API and Data Flow Mapping](#5-api-and-data-flow-mapping)
6. [Interaction Between Frontend, Backend, and Infrastructure](#6-interaction-between-frontend-backend-and-infrastructure)
7. [Important Files Guide](#7-important-files-guide)
8. [Local Development Setup](#8-local-development-setup)
9. [Deployment Overview](#9-deployment-overview)
10. [Incomplete or Unclear Areas](#10-incomplete-or-unclear-areas)
11. [Final System Summary](#11-final-system-summary)

---

## 1. Project Purpose

Codename Blood is a **blood bike volunteer coordination platform** built for organisations like Blood Bike Ireland. Blood bikes are volunteer-operated motorcycles that transport urgent medical supplies (blood samples, donor organs, medication) between hospitals, labs, and clinics — typically outside normal courier hours.

The platform solves four core operational problems:

1. **Job Dispatch** — Dispatchers create delivery jobs with pickup/dropoff locations. Riders accept and progress them through a tracked lifecycle (open → accepted → picked-up → delivered), with signature capture and email receipts at each handoff.

2. **Real-Time Tracking** — GPS location of active riders is streamed to a live Leaflet map. Fleet managers and dispatchers see all riders, jobs, events, and hospital waypoints on a single operational view with routing and search.

3. **Fleet & Volunteer Management** — Fleet managers maintain vehicle inventories with service history. HR staff review volunteer applications and manage training sessions. Admins manage user accounts and role assignments.

4. **Rider Experience** — Riders manage their on-duty availability, view and accept open jobs, follow a guided delivery workflow with signature capture, and see their own analytics (speed, distance).

The system is packaged as a **Progressive Web App** (PWA) so riders can install it on their phones and receive push notifications for new jobs — no app store required.

---

## 2. System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         CLIENTS                              │
│                                                              │
│   Browser / PWA (Angular 20)                                 │
│   ├── Leaflet Maps + OSRM Routing                            │
│   ├── QR Scanner (html5-qrcode)                              │
│   ├── Push Notifications (VAPID)                             │
│   └── Service Worker (offline + push)                        │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS (JWT Bearer)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    API LAYER                                  │
│                                                              │
│   Production: API Gateway → Lambda (Go)                      │
│   Development: Go net/http server (port 8080)                │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │              httpapi.NewHandler()                    │    │
│   │  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌────────┐  │    │
│   │  │ auth │ │fleet │ │tracking│ │events│ │  push  │  │    │
│   │  └──────┘ └──────┘ └────────┘ └──────┘ └────────┘  │    │
│   │  ┌──────────┐ ┌────────┐ ┌──────────┐              │    │
│   │  │analytics │ │  jobs  │ │  apps    │              │    │
│   │  └──────────┘ └────────┘ └──────────┘              │    │
│   └─────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────────┐
          ▼              ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│  DynamoDB    │ │   Cognito    │ │  In-Memory       │
│  (9+ tables) │ │  User Pool   │ │  Stores          │
│              │ │  (5 groups)  │ │  ├── Tracking    │
│              │ │              │ │  └── Analytics   │
└──────────────┘ └──────────────┘ └──────────────────┘
                                          │
                                  ┌───────┤
                                  ▼       ▼
                           ┌─────────┐ ┌──────┐
                           │ BoltDB  │ │ SES  │
                           │(push.db)│ │(email)│
                           └─────────┘ └──────┘
```

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Angular | 20 |
| Backend | Go | 1.25.4 |
| Infrastructure | AWS CDK | v2 (^2.232.1) |
| Database | DynamoDB | On-demand |
| Auth | Cognito (prod) / BoltDB (dev) | — |
| Maps | Leaflet + Leaflet Routing Machine | ^1.9.4 / ^3.2.12 |
| Push | Web Push (VAPID) via webpush-go | — |
| QR | html5-qrcode | ^2.3.8 |
| Email | AWS SES v2 | — |
| Routing Engine | OSRM (public) | — |
| Geocoding | Nominatim / OpenStreetMap | — |

### Project Layout

```
Codename-Blood/
├── backend/           Go API server, Lambda handlers, CLI tools
├── frontend/          Angular 20 PWA (blood-bike-web/)
├── infra/             AWS CDK infrastructure (TypeScript)
├── aws/               Bundled AWS CLI installer
├── scripts/           Utility shell scripts
├── docs/              Project documentation
└── data/              Local BoltDB files (dev mode)
```

---

## 3. User Roles

Five roles govern access throughout the system. Roles are stored as Cognito group memberships (production) or BoltDB records (dev), and embedded in JWT tokens as `cognito:groups` claims.

### Role Hierarchy

```
BloodBikeAdmin (level 3)    ← can access everything
    │
FleetManager   (level 2)
    │
Dispatcher     (level 1)
    │
Rider          (level 0)

HR             (separate)    ← no hierarchy, dedicated HR functions
```

`HasRoleOrAbove("Dispatcher")` grants access to Dispatchers, FleetManagers, and Admins. The `HR` role operates independently — it is not part of the hierarchy.

### Role-to-Feature Matrix

| Feature | Public | Rider | Dispatcher | FleetManager | Admin | HR |
|---------|--------|-------|------------|--------------|-------|-----|
| Sign up / Sign in | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit volunteer application | ✅ | — | — | — | — | — |
| View & accept jobs | — | ✅ | — | — | — | — |
| Active job workflow + signatures | — | ✅ | — | — | — | — |
| Create & manage jobs | — | — | ✅ | — | — | — |
| Manage own availability | — | ✅ | — | — | — | — |
| Live tracking map | — | ✅ | ✅ | ✅ | — | — |
| View all riders' locations | — | — | — | ✅ | — | — |
| Monitor active riders | — | — | ✅ | ✅ | ✅ | — |
| Analytics (own) | — | ✅ | — | — | — | — |
| Analytics (all riders) | — | — | ✅ | ✅ | ✅ | — |
| Fleet vehicle management | — | — | — | ✅ | — | — |
| Service history | — | — | — | ✅ | — | — |
| User & role administration | — | — | — | — | ✅ | — |
| Review applications | — | — | — | — | — | ✅ |
| Manage trainings | — | — | — | — | — | ✅ |
| Events calendar | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Push notifications | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| PWA install | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings page | — | ✅ | ✅ | ✅ | ✅ | ✅ |

### Multi-Role Support

Users can hold multiple roles simultaneously. When they do, a **role selector dropdown** appears in the UI header. The selected role (stored in `localStorage` as `bb_selected_role`) determines which navigation pages are visible. Selecting "All Roles" shows pages for every assigned role.

### Role Normalisation

Both frontend and backend normalise role names for comparison:
- **Frontend guard**: `role.toLowerCase().replace(/[^a-z0-9]/g, '')`
- **Backend middleware**: strips hyphens, underscores, `BloodBike` prefix, lowercases

This means `BloodBikeAdmin`, `bloodbikeadmin`, and `blood-bike-admin` all match.

---

## 4. End-to-End User Flows

### 4.1 Volunteer Application → Onboarding

```
Prospective volunteer visits the welcome page (unauthenticated)
    │
    ▼
Fills out public application form
(name, email, phone, motorcycle experience, ROSPA certificate, free text)
    │
    ▼
POST /api/applications/public → stored in DynamoDB Applications table
Backend generates a PDF data URL from the application data
    │
    ▼
HR staff member logs in → navigates to /applications
    │
    ▼
GET /api/applications (HR role required) → sees application list
Reviews application → approves or denies
    │
    ├── Approved: HR → Admin creates user account
    │   POST /api/auth/admin/create-user (username, email, temp password, roles)
    │   → Cognito AdminCreateUser → user added to role groups
    │   → User receives email with temporary password
    │
    └── Denied: Application auto-deleted after 7 days
```

### 4.2 Authentication → Session Start

```
User opens PWA
    │
    ├── Has stored tokens? → GET /api/me → validates session
    │   ├── 200 OK → extract roles, show home page
    │   └── 401 → clear tokens → show login
    │
    └── No tokens → show welcome/login
         │
         ▼
    User signs in: POST /api/auth/signin
         │
         ├── 200 → tokens returned (access, id, refresh)
         │   → stored in localStorage (bb_access_token, bb_id_token, etc.)
         │   → fetchMe() loads user profile and roles
         │   → push notification subscription initiated
         │   → home page with role-based navigation shown
         │
         └── 409 → challenge required (e.g. NEW_PASSWORD_REQUIRED)
             → challenge form shown → user sets new password
             → POST /api/auth/challenge → tokens returned → proceed as 200
```

### 4.3 Job Dispatch → Delivery → Receipt

```
Dispatcher creates job:
    POST /api/jobs { title, pickup, dropoff, pickupLat/Lng, dropoffLat/Lng }
    │
    ├── Push notification sent to all subscribers: "🚨 New Job Posted"
    └── Job stored with status "open" in Jobs table
         │
         ▼
Rider sees open job in /jobs list
    │
    ▼
Rider accepts: PUT /api/jobs/{id} { status: "accepted", acceptedBy: username }
    │
    ├── Rider's User record updated: status → "on-job", currentJobId set
    └── Job status → "accepted"
         │
         ▼
Rider navigates to /active-job → sees status hero card + route
    │
    ▼
Rider arrives at pickup → taps "Parcel Picked Up"
    │
    ├── Signature pad opens → rider captures signature on canvas
    ├── PUT /api/jobs/{id} { status: "picked-up", signatureData: base64PNG }
    │   → signature stored in job.pickup.signature
    └── Receipt dialog offers to email pickup confirmation
         POST /api/jobs/receipt → SES sends HTML email with inline signature
         │
         ▼
Rider arrives at dropoff → taps "Parcel Delivered"
    │
    ├── Same signature + receipt flow for delivery
    ├── PUT /api/jobs/{id} { status: "delivered", signatureData: base64PNG }
    │   → Rider status set back to "available" (or "offline" if timer expired)
    │   → Rider's currentJobId cleared
    └── Push notification: "✅ Job Completed" sent to all subscribers
```

### 4.4 Real-Time Location Tracking

```
Rider's browser (after login):
    │
    ├── navigator.geolocation.watchPosition() → continuous GPS fixes
    │
    ├── Every position change (if >30m from last update):
    │   POST /api/tracking/update { entityId, lat, lng, speed, heading, accuracy }
    │   → Backend in-memory store updated
    │   → Analytics store records speed/distance data
    │
    └── "You Are Here" marker shown on map with speed badge

Fleet Manager / Dispatcher viewing /tracking:
    │
    ├── GET /api/tracking/locations every 15 seconds (HTTP polling)
    │   → Response: all active entity locations
    │   → Markers rendered: green (active) or grey (stale >2 min)
    │
    ├── GET /api/jobs every 30 seconds → job markers (green pickup, red dropoff)
    │
    ├── EventService signal → event markers (orange) reactively updated
    │
    └── Hospital markers rendered from hardcoded coordinates (static)

Background cleanup:
    Backend goroutine runs every 30 seconds
    → Evicts locations older than 5 minutes from the in-memory store
```

### 4.5 Fleet Management Lifecycle

```
Fleet Manager navigates to /fleet
    │
    ▼
Creates vehicle: POST /api/fleet/bikes
    { make, model, vehicleType, registration, locationId }
    → status defaults to "out_of_service"
    → stored in FleetBikes DynamoDB table
    │
    ▼
Updates status: PUT /api/fleet/bikes/{bikeId}
    { active: "ready" | "out_of_service" | "{riderUID}" }
    │
    ▼
Adds service entry: POST /api/fleet/bikes/{bikeId}/service
    { type: "oil|chain|tyres|brakes|coolant", date, notes, performedBy }
    → stored in FleetServiceHistory table (BikeID + ServiceID)
    │
    ▼
Changes location via QR scan:
    QR scanner reads new location ID
    → PUT /api/fleet/bikes/{bikeId} { locationId: scannedValue }
    │
    ▼
Deletes vehicle (confirmation: type registration to confirm)
    DELETE /api/fleet/bikes/{bikeId}
```

---

## 5. API and Data Flow Mapping

### Complete API Route Map

Organised by domain. All routes are prefixed with `/api/`.

#### Public Endpoints (No Authentication)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness check → `"OK"` |
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/confirm` | Confirm email with code |
| POST | `/api/auth/signin` | Sign in → JWT tokens |
| POST | `/api/auth/challenge` | Respond to auth challenge |
| POST | `/api/auth/confirm-forgot-password` | Reset password with code |
| POST | `/api/applications/public` | Submit volunteer application |
| GET | `/api/push/vapid-key` | Get VAPID public key |

#### Authenticated Endpoints (JWT Required)

| Method | Path | Role Gate | Purpose |
|--------|------|-----------|---------|
| GET | `/api/me` | — | Current user profile |
| GET | `/api/auth/users` | — | List all auth users |
| POST | `/api/auth/admin/create-user` | — | Create user (admin) |
| POST | `/api/auth/admin/reset-password` | Admin | Reset user password |
| GET | `/api/users` | — | List user profiles |
| PUT/DELETE | `/api/users/{id}` | — | Update/delete user |
| POST | `/api/user/register` | — | Register user profile |
| POST | `/api/user/roles/init` | — | Initialise roles after signup |
| POST | `/api/user/tags/add` | — | Add tag to user |
| POST | `/api/user/tags/remove` | — | Remove tag from user |
| GET | `/api/user?riderId=...` | — | Get single user |
| GET | `/api/bikes` | — | List motorcycles |
| POST | `/api/bike/register` | — | Register motorcycle |
| POST | `/api/ride/start` | — | Start ride session |
| POST | `/api/ride/end` | — | End ride session |
| GET/POST | `/api/fleet/bikes` | — | List/create fleet vehicles |
| GET/PUT/DELETE | `/api/fleet/bikes/{id}` | — | Fleet vehicle detail |
| GET/POST | `/api/jobs` | — | List/create jobs |
| GET/PUT/DELETE | `/api/jobs/{id}` | — | Job detail |
| POST | `/api/jobs/receipt` | — | Send receipt email (SES) |
| GET | `/api/riders/availability` | — | List rider availability |
| PUT | `/api/riders/availability/me` | — | Update own availability |
| POST | `/api/tracking/update` | — | Submit location update |
| GET | `/api/tracking/locations` | — | Get all locations |
| GET | `/api/tracking/entities` | — | Get tracked entities |
| GET | `/api/tracking/riders` | FleetManager | Get rider positions |
| WS | `/api/tracking/riders/ws` | FleetManager | Rider positions WebSocket |
| GET | `/api/analytics/` | — | List tracked rider IDs |
| GET | `/api/analytics/{riderId}` | — | Rider speed/distance summary |
| GET/POST | `/api/events` | — | List/create events |
| GET/PUT/DELETE | `/api/events/{id}` | — | Event detail |
| GET | `/api/geocode?q=...` | — | Geocode address (Nominatim proxy) |
| POST | `/api/push/subscribe` | — | Subscribe to push |
| POST | `/api/push/unsubscribe` | — | Unsubscribe from push |
| POST | `/api/push/test` | — | Send test notification |
| GET | `/api/applications` | HR | List all applications |
| PATCH | `/api/applications/{id}/status` | HR | Approve/deny application |
| DELETE | `/api/applications/{id}` | HR | Delete application |

### Data Store Mapping

| Store | Technology | Persistence | Data |
|-------|-----------|-------------|------|
| Users | DynamoDB `Users` | Persistent | Profiles, availability, roles, status |
| Bikes | DynamoDB `Bikes` | Persistent | Motorcycle registry |
| Jobs | DynamoDB `Jobs` | Persistent | Delivery jobs, signatures, timestamps |
| Depots | DynamoDB `Depots` | Persistent | Depot locations (forward-compat) |
| Events | DynamoDB `Events` | Persistent | Calendar events (auto-expired) |
| FleetBikes | DynamoDB `FleetBikes` | Persistent | Fleet vehicle inventory |
| FleetServiceHistory | DynamoDB `FleetServiceHistory` | Persistent | Service records per vehicle |
| Applications | DynamoDB `Applications` | Persistent | Volunteer applications |
| AppConfig | DynamoDB `AppConfig` | Persistent | Runtime env var overrides |
| Motorcycles | DynamoDB `Motorcycles` | Persistent | Legacy bike records (standalone Lambdas) |
| RideSessions | DynamoDB `RideSessions` | Persistent | Bike check-out/in records |
| IssueReports | DynamoDB `IssueReports` | Persistent | Fleet issue reports |
| Location Tracking | In-memory (Go maps) | Session only | GPS coordinates, stale after 5 min |
| Analytics | In-memory (Go maps) | Session only | Speed/distance per rider (120 points) |
| Push Subscriptions | BoltDB `data/push.db` | Local file | VAPID keys + subscriber endpoints |
| Auth Users (dev) | BoltDB `data/users.db` | Local file | Dev-mode user accounts |
| Tokens | localStorage (browser) | Per browser | JWT access/id/refresh tokens |
| Saved Contacts | localStorage (browser) | Per browser | Receipt email contacts |

---

## 6. Interaction Between Frontend, Backend, and Infrastructure

### Production Request Flow

```
Angular PWA (Browser)
    │
    │  All /api/* requests carry Authorization: Bearer <idToken>
    │  (injected by auth.interceptor.ts)
    │
    ▼
AWS API Gateway (BloodBike Fleet API)
    │
    ├── Public routes: /api/health, /api/auth/signup|confirm|signin
    │   → Forwarded directly to BackendApi Lambda (no auth check)
    │
    ├── Protected routes: /api/{proxy+}
    │   → Cognito Authorizer validates JWT at the gateway level
    │   → Valid token: forwarded to BackendApi Lambda
    │   → Invalid/missing token: 401 returned before reaching Lambda
    │
    ├── GET /bikes → GetBikes Lambda → Motorcycles table
    └── POST /bikes → RegisterBike Lambda → Motorcycles table (Cognito-protected)

BackendApi Lambda
    │
    ├── aws-lambda-go-api-proxy converts API Gateway event → http.Request
    ├── httpapi.NewHandler() processes the request (identical code to local dev)
    │
    ├── Middleware chain:
    │   withCORS() → RequireAuth() → requireRoleMiddleware() → handler
    │
    ├── Auth verification (second layer):
    │   VerifyToken() validates JWT again via JWKS
    │   (defense-in-depth: API Gateway already validated, backend extracts claims)
    │
    ├── Data access:
    │   ├── repo/dynamo → DynamoDB (Users, Bikes, Jobs, Depots, Events)
    │   ├── fleet/tracker_store → DynamoDB (FleetBikes, FleetServiceHistory)
    │   ├── httpapi.go (direct) → DynamoDB (Applications)
    │   ├── tracking/store → In-memory (GPS locations)
    │   └── analytics/store → In-memory (speed/distance)
    │
    ├── External services:
    │   ├── Cognito → group management (AdminAddUserToGroup, etc.)
    │   ├── SES v2 → receipt emails with signature attachments
    │   └── Nominatim → geocoding proxy (server-side User-Agent)
    │
    └── Push notifications:
        └── push/store → BoltDB (subscriptions) → webpush-go (send)
            Note: BoltDB is ephemeral in Lambda (uses /tmp); persistent locally
```

### Local Development Flow

```
Angular Dev Server (port 4200)
    │
    │  proxy.conf.json forwards /api/* → localhost:8080 (ws: true)
    │
    ▼
Go HTTP Server (port 8080, backend/main.go)
    │
    ├── .env file loaded via godotenv
    ├── AppConfig DynamoDB (optional, skipped if APP_CONFIG_ENABLED=false)
    │
    ├── Auth mode: LOCAL_AUTH=1 or AUTH_MODE=local
    │   → BoltDB-backed user store (data/users.db)
    │   → HS256-signed JWTs (dev secret)
    │   → Default admin: BloodBikeAdmin / password
    │
    ├── Data access:
    │   ├── If *_TABLE env vars set → DynamoDB repos
    │   └── If not set → in-memory repos (maps with RWMutex)
    │
    ├── Push notifications → BoltDB (data/push.db) — persists locally
    ├── Tracking → in-memory store (same as production)
    └── Analytics → in-memory store (same as production)
```

### Key Integration Principles

1. **One handler, two runtimes** — `httpapi.NewHandler()` is the single source of truth. The Lambda adapter and local server both call it. No code duplication.

2. **Double auth layer (production)** — API Gateway validates the JWT via Cognito Authorizer before the request reaches Lambda. The Go backend validates again with JWKS to extract claims for authorization. This provides defense-in-depth.

3. **Graceful degradation** — Missing DynamoDB table env vars → in-memory repos. Missing Cognito → local auth mode. Missing SES → receipt HTML returned as fallback. Missing push config → push endpoints silently disabled.

4. **Role sync** — User roles exist in two places: Cognito groups (for API Gateway auth) and DynamoDB user `tags` (for backend queries). `SetUserGroups()` keeps them synchronized when roles are modified.

5. **Signal-driven frontend** — Angular Signals propagate state changes reactively. No separate state management library (no NgRx). Services expose signals; components consume them.

6. **Polling over WebSocket** — Although WebSocket code exists, API Gateway REST doesn't support WS upgrades. The production path uses HTTP polling (15s for locations, 30s for jobs) with Page Visibility API to pause when backgrounded.

---

## 7. Important Files Guide

### Backend — Must-Read Files

| File | Why It Matters |
|------|---------------|
| [backend/main.go](backend/main.go) | Application entry point — shows startup sequence |
| [backend/internal/httpapi/httpapi.go](backend/internal/httpapi/httpapi.go) | **The most important backend file.** All route registration, inline handlers for jobs/availability/applications/receipts, middleware wiring. ~1500 lines. |
| [backend/internal/auth/auth.go](backend/internal/auth/auth.go) | Complete auth system — Cognito client, local dev mode, JWT verification, signup/signin/challenge handlers, user management |
| [backend/internal/auth/roles.go](backend/internal/auth/roles.go) | Role hierarchy and permission checks |
| [backend/internal/repo/repo.go](backend/internal/repo/repo.go) | Repository interfaces — defines the data access contract |
| [backend/internal/repo/dynamo/dynamo.go](backend/internal/repo/dynamo/dynamo.go) | DynamoDB repository factory — shows how tables are wired |
| [backend/internal/tracking/store.go](backend/internal/tracking/store.go) | In-memory location store with goroutine event loop |
| [backend/internal/fleet/tracker_handlers.go](backend/internal/fleet/tracker_handlers.go) | Fleet tracker CRUD with service history |
| [backend/internal/push/push.go](backend/internal/push/push.go) | Push notification store (BoltDB + VAPID) |
| [backend/lambda/api/main.go](backend/lambda/api/main.go) | Lambda adapter — 15 lines that bridge Lambda to net/http |

### Frontend — Must-Read Files

| File | Why It Matters |
|------|---------------|
| [frontend/blood-bike-web/src/app/app.ts](frontend/blood-bike-web/src/app/app.ts) | Root component — auth UI, navigation, admin panel, role switching, inline page management |
| [frontend/blood-bike-web/src/app/app.routes.ts](frontend/blood-bike-web/src/app/app.routes.ts) | All route definitions with role guards |
| [frontend/blood-bike-web/src/app/app.config.ts](frontend/blood-bike-web/src/app/app.config.ts) | Provider registration (router, HTTP, interceptor, service worker) |
| [frontend/blood-bike-web/src/app/services/auth.service.ts](frontend/blood-bike-web/src/app/services/auth.service.ts) | Authentication signals, token management, Cognito flows |
| [frontend/blood-bike-web/src/app/services/auth.interceptor.ts](frontend/blood-bike-web/src/app/services/auth.interceptor.ts) | JWT injection on all API requests |
| [frontend/blood-bike-web/src/app/services/location-tracking.service.ts](frontend/blood-bike-web/src/app/services/location-tracking.service.ts) | GPS polling, distance gating, stale detection |
| [frontend/blood-bike-web/src/app/services/job.service.ts](frontend/blood-bike-web/src/app/services/job.service.ts) | Job CRUD with signal-based state |
| [frontend/blood-bike-web/src/app/components/tracking-map.component.ts](frontend/blood-bike-web/src/app/components/tracking-map.component.ts) | Largest component (~900+ lines) — Leaflet map with all marker types, routing, search |
| [frontend/blood-bike-web/src/app/components/dispatcher.component.ts](frontend/blood-bike-web/src/app/components/dispatcher.component.ts) | Job creation with map pin pickers |
| [frontend/blood-bike-web/src/app/components/active-job.component.ts](frontend/blood-bike-web/src/app/components/active-job.component.ts) | Delivery workflow with signature capture |
| [frontend/blood-bike-web/src/app/guards/role.guard.ts](frontend/blood-bike-web/src/app/guards/role.guard.ts) | Route guard — role checking with admin bypass |
| [frontend/blood-bike-web/src/styles.scss](frontend/blood-bike-web/src/styles.scss) | Global design system (CSS custom properties, buttons, responsive) |

### Infrastructure — Must-Read Files

| File | Why It Matters |
|------|---------------|
| [infra/lib/infra-stack.ts](infra/lib/infra-stack.ts) | **The entire AWS infrastructure** — all DynamoDB tables, Lambda functions, Cognito user pool/groups, API Gateway routes, IAM policies, and CfnOutputs |
| [infra/bin/infra.ts](infra/bin/infra.ts) | CDK app entry point |
| [infra/package.json](infra/package.json) | CDK dependencies and scripts |

### Configuration Files

| File | Purpose |
|------|---------|
| [frontend/blood-bike-web/angular.json](frontend/blood-bike-web/angular.json) | Build config, budgets, environments, global styles |
| [frontend/blood-bike-web/proxy.conf.json](frontend/blood-bike-web/proxy.conf.json) | Dev server → backend proxy |
| [frontend/blood-bike-web/ngsw-config.json](frontend/blood-bike-web/ngsw-config.json) | Service worker caching strategy |
| [frontend/blood-bike-web/public/manifest.webmanifest](frontend/blood-bike-web/public/manifest.webmanifest) | PWA install metadata |
| [infra/cdk.json](infra/cdk.json) | CDK app command and feature flags |
| [backend/go.mod](backend/go.mod) | Go module dependencies |

---

## 8. Local Development Setup

### Prerequisites

- Go 1.25+
- Node.js (for Angular CLI and CDK)
- npm

### Step 1 — Start the Backend

```bash
cd backend
go build -o backend .
./backend
```

The backend starts on port 8080. Without any DynamoDB tables configured, it falls back to:
- **In-memory repos** for Users, Bikes, Jobs, Events
- **Local auth mode** (BoltDB) if `AUTH_MODE=local` or `LOCAL_AUTH=1` is set
- **BoltDB** for push subscriptions (`data/push.db`) and local users (`data/users.db`)

Default admin credentials: `BloodBikeAdmin` / `password`

Key environment variables (set in `.env` or export):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | Server listen port |
| `AUTH_MODE` | (Cognito) | Set to `local` for dev auth |
| `LOCAL_AUTH` | — | Set to `1` for dev auth |
| `LOCAL_AUTH_SECRET` | `dev-secret-change-me` | JWT signing secret for local mode |
| `APP_CONFIG_ENABLED` | `true` | Set to `false` to skip DynamoDB config |
| `USERS_TABLE` | — | DynamoDB table name (empty = in-memory) |
| `BIKES_TABLE` | — | DynamoDB table name (empty = in-memory) |
| `JOBS_TABLE` | — | DynamoDB table name (empty = in-memory) |
| `EVENTS_TABLE` | — | DynamoDB table name (empty = in-memory) |
| `FLEET_BIKES_TABLE` | — | DynamoDB table for fleet bikes |
| `FLEET_SERVICE_TABLE` | — | DynamoDB table for service history |
| `APPLICATIONS_TABLE` | — | DynamoDB table for applications |
| `COGNITO_USER_POOL_ID` | — | Required for Cognito mode |
| `COGNITO_CLIENT_ID` | — | Required for Cognito mode |
| `COGNITO_CLIENT_SECRET` | — | Optional Cognito client secret |
| `SES_FROM_EMAIL` | `noreply@bloodbike.app` | Sender email for receipts |
| `VAPID_PUBLIC_KEY` | (auto-generated) | Push notification VAPID key |
| `VAPID_PRIVATE_KEY` | (auto-generated) | Push notification VAPID key |

### Step 2 — Start the Frontend

```bash
cd frontend/blood-bike-web
npm install
npm run start
```

The Angular dev server starts on port 4200. The `proxy.conf.json` forwards all `/api/*` requests to `localhost:8080`.

### Step 3 — Optional CLI Tools

```bash
# Stats dashboard (reads DynamoDB tables, serves on port 9090)
cd backend
go build -o dashboard ./cmd/dashboard && ./dashboard

# Load simulation (creates synthetic users, runs concurrent job lifecycles)
cd backend
go build -o simulate ./cmd/simulate && ./simulate --url http://localhost:8080 --duration 60s
```

### Step 4 — GPS Simulation

```bash
# Send simulated GPS location updates every 3 seconds
./scripts/simulate-tracking.sh
```

### Development Architecture Summary

```
localhost:4200 (Angular dev server)
    │
    │  proxy /api/* → localhost:8080
    │
    ▼
localhost:8080 (Go backend, local auth, in-memory repos)
    │
    ├── data/users.db (BoltDB — dev users)
    ├── data/push.db  (BoltDB — push subscriptions)
    └── in-memory stores (tracking, analytics, users, bikes, jobs)
```

---

## 9. Deployment Overview

### Infrastructure Provisioning

```bash
cd infra
npm install
npm run build       # tsc → compile TypeScript
npx cdk synth       # generate CloudFormation template
npx cdk deploy      # deploy to AWS
```

The single `InfraStack` provisions:

| Resource | Count | Details |
|----------|-------|---------|
| DynamoDB Tables | 9 | All PAY_PER_REQUEST billing |
| Lambda Functions | 3 | Go runtime (GoFunction construct with auto-compilation) |
| Cognito User Pool | 1 | Self-signup, email sign-in, 5 groups |
| Cognito Client | 1 | Public (no secret), for SPA |
| API Gateway (REST) | 1 | Cognito authorizer, CORS preflight on all resources |
| IAM Roles | 3 | One per Lambda, with DynamoDB + Cognito permissions |

### CDK Stack Outputs

After deployment, the stack exports values needed for frontend configuration:

| Output | Used By |
|--------|---------|
| `UserPoolId` | Frontend `aws-config.ts` |
| `UserPoolClientId` | Frontend `aws-config.ts` |
| `ApiBaseUrl` | Frontend API base URL |
| `UsersTableName` | Operational reference |
| `BikesTableName` | Operational reference |
| `JobsTableName` | Operational reference |
| `DepotsTableName` | Operational reference |
| `FleetBikesTableName` | Operational reference |
| `FleetServiceTableName` | Operational reference |

### Lambda Function Details

| Function | Source | Memory | Tables | Cognito |
|----------|--------|--------|--------|---------|
| `GetBikes` | `backend/lambda/getBikes` | Default | Motorcycles (read) | — |
| `RegisterBike` | `backend/lambda/registerBike` | Default | Motorcycles (write) | — |
| `BackendApi` | `backend/lambda/api` | Default | Users, Bikes, Depots, Jobs, FleetBikes, FleetServiceHistory (read/write) | AdminListGroups, AdminAddUserToGroup, AdminRemoveUserFromGroup |

### API Gateway Route Protection

```
/bikes
   GET  → GetBikesLambda (public)
   POST → RegisterBikeLambda (Cognito authorizer)

/api/health              → BackendApiLambda (public)
/api/auth/signup         → BackendApiLambda (public)
/api/auth/confirm        → BackendApiLambda (public)
/api/auth/signin         → BackendApiLambda (public)
/api/{proxy+}            → BackendApiLambda (Cognito authorizer)
```

### Frontend Production Build

```bash
cd frontend/blood-bike-web
npm run build           # ng build → dist/blood-bike-web/browser/
npm run serve:pwa       # test production build locally with service worker
```

Production build includes:
- Output hashing for cache busting
- Service worker registration (`ngsw-worker.js`)
- PWA manifest inclusion
- Budget enforcement (2MB initial, 20kB component styles)

---

## 10. Incomplete or Unclear Areas

### 10.1 Settings Page — UI Shell Only

[settings.component.ts](frontend/blood-bike-web/src/app/components/settings.component.ts) renders forms for account info, password change, and notification preferences, but **no API calls are wired**. The save buttons have no `(click)` handlers connected to backend endpoints.

### 10.2 Training Management — Backend Unclear

[trainings.component.ts](frontend/blood-bike-web/src/app/components/trainings.component.ts) makes calls to `/api/trainings` endpoints, but **no dedicated training handler or store file exists in the backend**. The routes may be handled inline, via the events system, or not implemented yet.

### 10.3 WebSocket Tracking — Disabled in Production

WebSocket support for real-time location streaming exists in the codebase (`tracking/handlers.go`), but the `/api/tracking/ws` endpoint explicitly returns `501 Not Implemented` with a message to use HTTP polling. This is because API Gateway REST does not support WebSocket upgrades. HTTP polling at 15-second intervals is the production path.

### 10.4 Token Refresh — Not Implemented

The refresh token is stored (`bb_refresh_token`) but **never used to automatically refresh expired access tokens**. If a token expires, `fetchMe()` receives a 401 and triggers a full logout.

### 10.5 Tables Referenced but Not in CDK

Three DynamoDB tables are used by the backend but **not provisioned in the CDK stack**:

| Table | Env Var | Status |
|-------|---------|--------|
| `Events` | `EVENTS_TABLE` | Provisioned separately or via AppConfig |
| `Applications` | `APPLICATIONS_TABLE` | Provisioned separately or via AppConfig |
| `AppConfig` | `APP_CONFIG_TABLE` | Provisioned separately |

### 10.6 Depots — Forward Compatibility Only

The `Depots` table and `DepotsRepository` are defined in both CDK and backend code, but **no HTTP endpoint exposes depot CRUD**. This appears to be forward-compatible infrastructure for future features.

### 10.7 Push Notifications in Lambda

BoltDB (`data/push.db`) is used for push subscription storage. In Lambda, the filesystem is ephemeral (`/tmp`), so **subscriptions would not persist across cold starts**. This limits push notification reliability in production unless the store is migrated to DynamoDB.

### 10.8 No Structured Logging

The backend uses Go's standard `log.Printf` with an `op=` tag convention but has no structured logging framework, log levels, request IDs, or distributed tracing.

### 10.9 No Lazy Loading

All Angular routes are eager-loaded. No `loadComponent` or `loadChildren` is used. For 25 standalone components, this means the full application is included in the initial bundle.

### 10.10 RideSessions — Limited Frontend Exposure

The ride session flow (`POST /api/ride/start`, `POST /api/ride/end`) exists in the backend but is not exposed as a standalone frontend feature. It is triggered indirectly through fleet/scan workflows.

---

## 11. Final System Summary

**Codename Blood** is a full-stack blood bike volunteer coordination platform consisting of:

- **An Angular 20 Progressive Web App** with 25 standalone components, 9 services, signal-based state management, Leaflet maps with OSRM routing, QR scanning, push notifications, signature capture, and a custom SCSS design system. It supports 5 roles with a hierarchical permission model enforced via route guards and role-filtered navigation.

- **A Go 1.25.4 backend** with a single `http.ServeMux` handler (`httpapi.NewHandler()`) that runs identically as a local server or an AWS Lambda function. It serves 40+ API endpoints across 8 domain packages (auth, fleet, tracking, analytics, events, push, jobs, applications). Authentication is dual-mode: AWS Cognito with JWKS validation in production, BoltDB-backed HS256 JWTs in development. Data access follows the repository pattern with DynamoDB and in-memory implementations.

- **An AWS CDK v2 infrastructure stack** that provisions 9 DynamoDB tables, 3 Go Lambda functions, a Cognito user pool with 5 role groups, an API Gateway REST API with Cognito authorization, and appropriate IAM policies. A single `cdk deploy` creates the entire cloud environment.

The system is designed for **graceful degradation** — every external dependency has a local fallback, allowing the full stack to run on a single developer machine with `go build && ./backend` and `npm start`, while deploying to a serverless AWS environment with `cdk deploy`.

### System Stats

| Metric | Count |
|--------|-------|
| Features | 28 |
| API endpoints | 40+ |
| Frontend components | 25 |
| Frontend services | 9 |
| Backend packages | 8 domain + 2 repo |
| DynamoDB tables | 9 (CDK) + 3 (external) |
| Lambda functions | 3 |
| Cognito groups | 5 |
| User roles | 5 |
| Lines of Go (httpapi.go alone) | ~1,500 |
| Lines of Angular (tracking-map alone) | ~900+ |
