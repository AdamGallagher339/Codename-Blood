# Backend & Infrastructure Architecture

## Table of Contents

1. [Backend — Go Application Structure](#1-backend--go-application-structure)
2. [Backend — Entry Points](#2-backend--entry-points)
3. [Backend — Routing](#3-backend--routing)
4. [Backend — Handlers](#4-backend--handlers)
5. [Backend — Middleware](#5-backend--middleware)
6. [Backend — Authentication Verification](#6-backend--authentication-verification)
7. [Backend — JWT / Cognito Validation](#7-backend--jwt--cognito-validation)
8. [Backend — Database Interactions](#8-backend--database-interactions)
9. [Backend — Logging](#9-backend--logging)
10. [Backend — Health Endpoints](#10-backend--health-endpoints)
11. [Infrastructure — AWS CDK Stack](#11-infrastructure--aws-cdk-stack)
12. [Infrastructure — API Gateway Configuration](#12-infrastructure--api-gateway-configuration)
13. [Infrastructure — Lambda Functions](#13-infrastructure--lambda-functions)
14. [Infrastructure — DynamoDB Tables](#14-infrastructure--dynamodb-tables)
15. [Infrastructure — Cognito Setup](#15-infrastructure--cognito-setup)
16. [Infrastructure — IAM Roles](#16-infrastructure--iam-roles)
17. [Infrastructure — Environment Configuration](#17-infrastructure--environment-configuration)
18. [How All Pieces Connect](#18-how-all-pieces-connect)

---

## 1. Backend — Go Application Structure

The backend is a single Go module at `github.com/AdamGallagher339/Codename-Blood/backend` (Go 1.25.4). It follows a standard `internal/` package layout.

```
backend/
├── main.go                     # Dev/local HTTP server entry point
├── go.mod                      # Module definition & dependencies
├── cmd/
│   ├── dashboard/main.go       # Dashboard CLI tool
│   └── simulate/main.go        # Load-simulation CLI tool
├── lambda/
│   ├── api/main.go             # Lambda adapter for the full API
│   ├── getBikes/main.go        # Standalone Lambda: GET /bikes
│   └── registerBike/main.go    # Standalone Lambda: POST /bikes
└── internal/
    ├── httpapi/                 # HTTP handler assembly & route registration
    │   ├── httpapi.go           # NewHandler() — builds the entire mux
    │   └── httpapi_test.go      # Auth & CORS tests
    ├── auth/                    # Authentication & authorization
    │   ├── auth.go              # Cognito client, local-dev auth, JWT verification
    │   ├── roles.go             # Role hierarchy & permission checks
    │   └── roles_test.go
    ├── fleet/                   # Fleet management (bikes, users, rides)
    │   ├── handlers.go          # Bike CRUD, ride start/end, user tags
    │   ├── models.go            # Motorcycle, RideSession, IssueReport, User
    │   ├── storage.go           # Repository wiring
    │   ├── tracker_handlers.go  # Fleet tracker CRUD (DynamoDB-backed)
    │   ├── tracker_models.go    # FleetBike, ServiceEntry
    │   ├── tracker_store.go     # DynamoDB operations for fleet tracker
    │   ├── fleet_test.go
    │   └── tracker_test.go
    ├── tracking/                # Real-time location tracking
    │   ├── handlers.go          # HTTP + WebSocket endpoints
    │   ├── models.go            # LocationUpdate, TrackedEntity
    │   ├── riders.go            # Rider-specific tracking endpoints
    │   ├── store.go             # In-memory store with stale cleanup
    │   └── tracking_test.go
    ├── analytics/               # Rider analytics (speed, distance)
    │   ├── handlers.go          # Analytics HTTP handlers
    │   ├── models.go            # RiderSummary, SpeedPoint
    │   ├── store.go             # Haversine distance & speed calculations
    │   └── store_test.go
    ├── events/                  # Event management
    │   ├── handlers.go          # List/Create/Update/Delete events
    │   ├── models.go            # Event, CreateEventRequest
    │   └── store.go             # Event CRUD + auto-expiration
    ├── push/                    # Web Push notifications
    │   ├── handlers.go          # VAPID key, subscribe, unsubscribe, test
    │   └── push.go              # BoltDB-backed subscription store
    ├── configdb/
    │   └── configdb.go          # Load env vars from DynamoDB AppConfig table
    └── repo/                    # Repository pattern (data access layer)
        ├── repo.go              # Interface definitions
        ├── dynamo/              # DynamoDB implementations
        │   ├── dynamo.go        # Factory: creates repos from env config
        │   ├── users.go         # UsersRepository (DynamoDB)
        │   ├── bikes.go         # BikesRepository (DynamoDB)
        │   ├── depots_jobs.go   # DepotsRepository + JobsRepository
        │   ├── events.go        # EventsRepository (DynamoDB)
        │   └── tablemeta.go     # Table schema discovery
        └── memory/              # In-memory implementations (local dev)
            ├── memory.go
            └── memory_test.go
```

### Key Dependencies

| Dependency | Purpose |
|---|---|
| `aws-sdk-go-v2` | DynamoDB, Cognito, SES v2 |
| `golang-jwt/jwt/v5` | JWT parsing and validation |
| `MicahParks/keyfunc/v2` | JWKS fetching for Cognito token verification |
| `gorilla/websocket` | WebSocket support for real-time tracking |
| `go.etcd.io/bbolt` | Embedded key-value store (push subscriptions, local auth users) |
| `joho/godotenv` | `.env` file loading |
| `awslabs/aws-lambda-go-api-proxy` | Adapts `net/http` handler to Lambda proxy events |
| `google/uuid` | UUID generation for jobs, events, applications |

---

## 2. Backend — Entry Points

### 2.1 Local Development Server — [backend/main.go](backend/main.go)

The primary entry point for local development. Starts a standard `net/http` server on port 8080.

```
main()
  ├── Load .env file (godotenv)
  ├── Load env vars from DynamoDB AppConfig table (unless APP_CONFIG_ENABLED=false)
  ├── Call httpapi.NewHandler(ctx) → builds the full HTTP mux
  └── http.ListenAndServe(":8080", handler)
```

### 2.2 Lambda API — [backend/lambda/api/main.go](backend/lambda/api/main.go)

Wraps the **same** `httpapi.NewHandler()` output with `aws-lambda-go-api-proxy/httpadapter`, converting API Gateway proxy events into standard `http.Request` objects. This means the Lambda and the local server execute identical handler code.

```go
h, _ := httpapi.NewHandler(context.Background())
adapter := httpadapter.New(h)
lambda.Start(adapter.ProxyWithContext)
```

### 2.3 Standalone Lambdas

Two single-purpose Lambda functions exist for the legacy fleet/motorcycle API:

| Lambda | File | Purpose |
|---|---|---|
| `GetBikes` | [backend/lambda/getBikes/main.go](backend/lambda/getBikes/main.go) | Scans the `Motorcycles` DynamoDB table |
| `RegisterBike` | [backend/lambda/registerBike/main.go](backend/lambda/registerBike/main.go) | Puts a new item into `Motorcycles` |

### 2.4 CLI Tools

| Tool | File | Purpose |
|---|---|---|
| `dashboard` | [backend/cmd/dashboard/main.go](backend/cmd/dashboard/main.go) | Serves a terminal-based admin dashboard on port 9090 |
| `simulate` | [backend/cmd/simulate/main.go](backend/cmd/simulate/main.go) | Load simulation — creates Dispatchers, Riders, and FleetManagers, then simulates concurrent API activity |

---

## 3. Backend — Routing

All routes are registered inside `httpapi.NewHandler()` in [backend/internal/httpapi/httpapi.go](backend/internal/httpapi/httpapi.go) using Go's standard `http.ServeMux`. Routes are grouped by domain:

### Route Table

| Method | Path | Auth | Role | Handler / Package |
|---|---|---|---|---|
| GET | `/api/health` | No | — | Inline (returns `"OK"`) |
| **Auth** |
| POST | `/api/auth/signup` | No | — | `auth.SignUpHandler` |
| POST | `/api/auth/confirm` | No | — | `auth.ConfirmSignUpHandler` |
| POST | `/api/auth/signin` | No | — | `auth.SignInHandler` |
| POST | `/api/auth/challenge` | No | — | `auth.RespondToChallengeHandler` |
| POST | `/api/auth/admin/create-user` | Yes | — | `auth.AdminCreateUserHandler` |
| POST | `/api/auth/admin/reset-password` | Yes | Admin | `auth.AdminResetPasswordHandler` |
| POST | `/api/auth/confirm-forgot-password` | No | — | `auth.ConfirmForgotPasswordHandler` |
| GET | `/api/me` | Yes | — | `auth.MeHandler` |
| GET | `/api/auth/users` | Yes | — | `auth.ListUsersHandler` |
| **Fleet** |
| GET | `/api/bikes` | Yes | — | `fleet.GetAllBikes` |
| POST | `/api/ride/start` | Yes | — | `fleet.StartRide` |
| POST | `/api/ride/end` | Yes | — | `fleet.EndRide` |
| GET/POST | `/api/fleet/bikes` | Yes | — | `fleet.FleetListOrCreate` |
| GET/PUT/DELETE | `/api/fleet/bikes/{id}` | Yes | — | `fleet.FleetBikeDetail` |
| POST | `/api/bike/register` | Yes | — | `fleet.RegisterBike` |
| **Users** |
| GET | `/api/users` | Yes | — | Inline (lists from DynamoDB) |
| PUT/DELETE | `/api/users/{id}` | Yes | — | `fleet.HandleUserDetail` |
| POST | `/api/user/register` | Yes | — | `fleet.RegisterUser` |
| POST | `/api/user/roles/init` | Yes | — | `fleet.InitializeUserRoles` |
| POST | `/api/user/tags/add` | Yes | — | `fleet.AddTagToUser` |
| POST | `/api/user/tags/remove` | Yes | — | `fleet.RemoveTagFromUser` |
| GET | `/api/user?riderId=...` | Yes | — | `fleet.GetUser` |
| **Jobs** |
| GET/POST | `/api/jobs` | Yes | — | Inline (list/create jobs) |
| GET/PUT/DELETE | `/api/jobs/{id}` | Yes | — | Inline (get/update/delete job) |
| POST | `/api/jobs/receipt` | Yes | — | Inline (send SES receipt email) |
| **Rider Availability** |
| GET | `/api/riders/availability` | Yes | — | Inline (list rider statuses) |
| PUT | `/api/riders/availability/me` | Yes | — | Inline (update own availability) |
| **Tracking** |
| POST | `/api/tracking/update` | Yes | — | `tracking.HandleLocationUpdate` |
| GET | `/api/tracking/locations` | Yes | — | `tracking.HandleGetLocations` |
| GET | `/api/tracking/entities` | Yes | — | `tracking.HandleGetEntities` |
| GET | `/api/tracking/riders` | Yes | FleetManager | `tracking.HandleGetRiders` |
| WS | `/api/tracking/riders/ws` | Yes | FleetManager | `tracking.HandleRidersWebSocket` |
| **Analytics** |
| GET | `/api/analytics/` | Yes | — | `analytics.HandleGetAnalytics` |
| GET | `/api/analytics/{riderId}` | Yes | — | `analytics.HandleGetAnalytics` |
| **Events** |
| GET/POST | `/api/events` | Yes | — | `events.ListOrCreate` |
| GET/PUT/DELETE | `/api/events/{id}` | Yes | — | `events.GetUpdateOrDelete` |
| **Push Notifications** |
| GET | `/api/push/vapid-key` | No | — | `push.HandleVAPIDPublicKey` |
| POST | `/api/push/subscribe` | Yes | — | `push.HandleSubscribe` |
| POST | `/api/push/unsubscribe` | Yes | — | `push.HandleUnsubscribe` |
| POST | `/api/push/test` | Yes | — | `push.HandleTestNotification` |
| **Applications** |
| POST | `/api/applications/public` | No | — | Inline (submit volunteer application) |
| GET | `/api/applications` | Yes | HR | Inline (list all applications) |
| PATCH | `/api/applications/{id}/status` | Yes | HR | Inline (approve/deny) |
| DELETE | `/api/applications/{id}` | Yes | HR | Inline (delete application) |
| **Geocoding** |
| GET | `/api/geocode?q=...` | Yes | — | `handleGeocode` (proxies to Nominatim) |

---

## 4. Backend — Handlers

Handlers are organized into domain packages. Each package encapsulates its own models, store logic, and HTTP handlers.

### 4.1 Fleet Package — [backend/internal/fleet/](backend/internal/fleet/)

Manages motorcycles, users, ride sessions, and the fleet bike tracker.

- **`handlers.go`** — `GetAllBikes`, `RegisterBike`, `StartRide`, `EndRide`, `RegisterUser`, `GetUser`, `AddTagToUser`, `RemoveTagFromUser`, `HandleUserDetail`, `InitializeUserRoles`
- **`tracker_handlers.go`** — `FleetListOrCreate` (GET lists, POST creates), `FleetBikeDetail` (GET/PUT/DELETE with service history sub-routes)
- **`storage.go`** — `SetRepositories()` and `SetCognitoGroupManager()` wire the repo interfaces and auth client at startup
- **`tracker_store.go`** — Direct DynamoDB operations for `FleetBikes` and `FleetServiceHistory` tables

### 4.2 Tracking Package — [backend/internal/tracking/](backend/internal/tracking/)

Real-time GPS location tracking using an **in-memory store** (not persisted to DynamoDB).

- **`store.go`** — `Store` struct with goroutine-based event loop. Maintains `map[string]*LocationUpdate` keyed by entity ID. Runs a 30-second ticker to evict stale entries (default 5-minute timeout).
- **`handlers.go`** — HTTP endpoints for posting/fetching locations. WebSocket upgrade for real-time push.
- **`riders.go`** — Rider-specific tracking with FleetManager role gate.
- **`GlobalStore`** — Package-level singleton initialized in `NewHandler()`.

### 4.3 Analytics Package — [backend/internal/analytics/](backend/internal/analytics/)

Computes rider speed and distance summaries from location tracking data.

- **`store.go`** — Uses the Haversine formula for GPS distance calculations, derives speed from consecutive location updates.
- **`handlers.go`** — `HandleGetAnalytics` — serves `/api/analytics/` (list rider IDs) and `/api/analytics/{riderId}` (rider summary with speed points).

### 4.4 Events Package — [backend/internal/events/](backend/internal/events/)

Calendar event management with automatic cleanup.

- **`store.go`** — CRUD operations backed by `repo.EventsRepository`. `StartCleanupTicker()` runs a background goroutine that deletes events whose end time has passed.
- **`handlers.go`** — `ListOrCreate` (GET/POST) and `GetUpdateOrDelete` (GET/PUT/DELETE by event ID).

### 4.5 Push Package — [backend/internal/push/](backend/internal/push/)

Web Push notification support using the VAPID protocol.

- **`push.go`** — `Store` backed by BoltDB (`data/push.db`). Manages VAPID key generation/persistence, subscriber storage, and `NotifyAll()` for broadcasting.
- **`handlers.go`** — `HandleVAPIDPublicKey` (public), `HandleSubscribe`, `HandleUnsubscribe`, `HandleTestNotification`.

### 4.6 Inline Handlers (httpapi.go)

Several handlers are defined inline within `NewHandler()`:

- **Jobs** — Full CRUD with push notification on job creation (`🚨 New Job Posted`) and delivery (`✅ Job Completed`). Manages rider status transitions (available ↔ on-job ↔ offline). Supports signature capture for pickup/delivery.
- **Receipt Email** — Builds HTML receipt emails with inline signature images, sends via AWS SES v2 using raw MIME with CID attachments.
- **Rider Availability** — Lists riders from Cognito group membership cross-referenced with DynamoDB user records. Supports timed availability with auto-expiration.
- **Applications** — Public submission (no auth), HR review (list/approve/deny/delete). Generates PDF data URLs for applications. Auto-deletes denied applications after 7 days.
- **Geocoding Proxy** — Proxies requests to Nominatim OpenStreetMap with a server-side `User-Agent` header (browsers are blocked by Nominatim).

---

## 5. Backend — Middleware

Middleware is implemented as higher-order functions in [backend/internal/httpapi/httpapi.go](backend/internal/httpapi/httpapi.go).

### 5.1 CORS — `withCORS`

Applied to every route. Wraps handlers with:

```go
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
```

Handles `OPTIONS` preflight requests by returning `204 No Content`. Uses a custom `corsResponseWriter` to ensure CORS headers are set even on error responses.

### 5.2 Authentication — `authClient.RequireAuth`

Defined in [backend/internal/auth/auth.go](backend/internal/auth/auth.go). Extracts `Bearer` token from the `Authorization` header, verifies it (see [Section 7](#7-backend--jwt--cognito-validation)), and injects `sub` and `claims` into the request context.

### 5.3 Role Authorization — `requireRoleMiddleware`

Checks `auth.HasRoleOrAbove()` against the authenticated user's roles extracted from JWT claims. Returns `403 Forbidden` if the user lacks the required role.

### 5.4 Combined — `requireAuthAndRole`

Composes `RequireAuth` + `requireRoleMiddleware` into a single wrapper:

```go
requireAuthAndRole("HR", someHandler)
// Equivalent to:
authClient.RequireAuth(requireRoleMiddleware("HR")(someHandler))
```

---

## 6. Backend — Authentication Verification

Authentication is handled by the `AuthClient` in [backend/internal/auth/auth.go](backend/internal/auth/auth.go). It supports two modes:

### 6.1 Cognito Mode (Production)

Activated when `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` env vars are set and `AUTH_MODE` is not `local`.

- **Sign Up** → `cognito.SignUp` with email attribute. Supports `SECRET_HASH` when client secret is configured.
- **Confirm** → `cognito.ConfirmSignUp` with 6-digit code.
- **Sign In** → `cognito.InitiateAuth` with `USER_PASSWORD_AUTH` flow. Returns access/id/refresh tokens. Handles `NEW_PASSWORD_REQUIRED` challenge.
- **Challenge Response** → `cognito.RespondToAuthChallenge` for password change flows.
- **Admin Create User** → `cognito.AdminCreateUser` with temporary password and optional group assignment.
- **Admin Reset Password** → Admin-initiated password reset (BloodBikeAdmin role required).
- **Delete User** → `cognito.AdminDeleteUser`.

### 6.2 Local Mode (Development)

Activated when `AUTH_MODE=local` or `LOCAL_AUTH=1`.

- Users stored in BoltDB (`data/users.db`) with an in-memory map cache.
- Default admin user: `BloodBikeAdmin` / `password` with `BloodBikeAdmin` role.
- Sign-in issues HS256-signed JWTs with a dev secret (configurable via `LOCAL_AUTH_SECRET`).
- JWT claims match Cognito format: `sub`, `cognito:username`, `email`, `cognito:groups`.
- All Cognito group operations (set/list) operate against the in-memory store.

### 6.3 User Context

After authentication, the following values are available in the request context:

```go
auth.SubFromContext(ctx)        // JWT "sub" claim
auth.ClaimsFromContext(ctx)     // Full jwt.MapClaims
auth.RolesFromContext(ctx)      // []string from cognito:groups
auth.UsernameFromContext(ctx)   // cognito:username or username or sub
```

---

## 7. Backend — JWT / Cognito Validation

JWT verification is performed in `AuthClient.VerifyToken()` in [backend/internal/auth/auth.go](backend/internal/auth/auth.go#L519).

### 7.1 Cognito Mode

1. **JWKS Fetch** — On first token verification, the JWKS endpoint is fetched lazily (`sync.Once`):
   ```
   https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
   ```
2. **Key Rotation** — JWKS keys are refreshed every hour via `keyfunc.Options{RefreshInterval: time.Hour}`.
3. **Token Parsing** — `jwt.ParseWithClaims(tokenString, claims, jwks.Keyfunc)` validates signature (RS256), expiration, and structure.
4. **Claims Extraction** — The verified `jwt.MapClaims` are attached to the context.

### 7.2 Local Mode

1. Parses token with `jwt.SigningMethodHS256` using the dev secret.
2. Validates expiration and signature.
3. Returns the same `jwt.MapClaims` structure.

### 7.3 Role Hierarchy

Defined in [backend/internal/auth/roles.go](backend/internal/auth/roles.go):

```
BloodBikeAdmin (3) > FleetManager (2) > Dispatcher (1) > Rider (0)
```

`HasRoleOrAbove(roles, "Dispatcher")` returns `true` for Dispatchers, FleetManagers, and Admins. Role names are normalized (case-insensitive, hyphens/underscores removed, `BloodBike` prefix stripped).

### 7.4 SECRET_HASH

When the Cognito client is configured with a secret (`COGNITO_CLIENT_SECRET`), all auth operations compute:

```
SECRET_HASH = Base64(HMAC-SHA256(clientSecret, username + clientId))
```

This is appended to SignUp, ConfirmSignUp, SignIn, and challenge response requests.

---

## 8. Backend — Database Interactions

### 8.1 Repository Pattern

Data access follows the repository pattern defined in [backend/internal/repo/repo.go](backend/internal/repo/repo.go):

```go
type UsersRepository interface {
    List(ctx) ([]User, error)
    Get(ctx, riderID) (*User, bool, error)
    Put(ctx, *User) error
    Delete(ctx, riderID) (bool, error)
}
// Same pattern for BikesRepository, DepotsRepository, JobsRepository, EventsRepository
```

### 8.2 DynamoDB Implementation — [backend/internal/repo/dynamo/](backend/internal/repo/dynamo/)

`dynamo.New(ctx, cfg)` creates repository implementations based on env vars. Each table name is read from a corresponding env var. If a table name is empty, that repository is `nil` and the handler returns `501 Not Implemented`.

| Env Var | Table | Repository |
|---|---|---|
| `USERS_TABLE` | Users | `UsersRepository` |
| `BIKES_TABLE` | Bikes | `BikesRepository` |
| `DEPOTS_TABLE` | Depots | `DepotsRepository` |
| `JOBS_TABLE` | Jobs | `JobsRepository` |
| `EVENTS_TABLE` | Events | `EventsRepository` |
| `FLEET_BIKES_TABLE` | FleetBikes | Fleet tracker (direct DynamoDB) |
| `FLEET_SERVICE_TABLE` | FleetServiceHistory | Fleet tracker (direct DynamoDB) |
| `APPLICATIONS_TABLE` | Applications | Direct DynamoDB (in httpapi.go) |
| `MOTORCYCLES_TABLE` | Motorcycles | Standalone Lambda functions |

### 8.3 In-Memory Implementation — [backend/internal/repo/memory/](backend/internal/repo/memory/)

Fallback when DynamoDB table env vars are not set. Uses `sync.RWMutex`-protected maps. Automatically selected in `NewHandler()`:

```go
if users == nil {
    log.Println("USERS_TABLE not set – using in-memory users repo")
    users = memory.NewUsersRepo()
}
```

### 8.4 BoltDB

Used for local persistence of:
- **Push subscriptions** — `data/push.db` (VAPID keys + subscriber endpoints)
- **Local auth users** — `data/users.db` (dev-mode user accounts)

### 8.5 AppConfig Table — [backend/internal/configdb/configdb.go](backend/internal/configdb/configdb.go)

On startup, scans a DynamoDB `AppConfig` table (configurable via `APP_CONFIG_TABLE`) and loads key-value pairs as environment variables. Each item has a `key` (string) and `value` attribute. This allows centralized configuration management without redeployment.

### 8.6 In-Memory Tracking Store

Location tracking data in [backend/internal/tracking/store.go](backend/internal/tracking/store.go) is **not persisted**. It uses a goroutine event loop with channels:

- `locationChan` — incoming location updates
- `broadcast` — fan-out to WebSocket clients
- `register` / `unregister` — WebSocket client lifecycle
- 30-second ticker evicts entries older than the stale timeout (5 minutes)

---

## 9. Backend — Logging

The backend uses Go's standard `log` package throughout. Log format:

```
log.Printf("op=<OperationName> err=%v", err)
log.Printf("op=<OperationName> <key>=<value> err=%v", id, err)
```

Key logging points:

| Where | What |
|---|---|
| `main.go` | Config DB load results, server startup address |
| `httpapi.NewHandler` | Repository fallback messages, push notification status, tracker init |
| `auth.go` | Auth mode detection, sign-in secret hash debug, Cognito errors |
| Inline handlers | Operation-tagged errors (`op=ListJobs`, `op=CreateJob`, `op=UpdateRiderOnAccept`, etc.) |
| `push.go` | VAPID key generation/load, notification send results |

There is no structured logging framework, log levels, or request ID tracing. All output goes to stdout.

---

## 10. Backend — Health Endpoints

A single health endpoint is registered:

```go
mux.HandleFunc("/api/health", withCORS(func(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintln(w, "OK")
}))
```

- **Path**: `GET /api/health`
- **Authentication**: None required
- **Response**: `200 OK` with body `"OK\n"`
- **CORS**: Enabled via `withCORS` wrapper

In the API Gateway configuration, `/api/health` is explicitly defined as a public (unauthenticated) resource, separate from the Cognito-protected `{proxy+}` catch-all.

---

## 11. Infrastructure — AWS CDK Stack

The infrastructure is defined as a single CDK v2 stack in [infra/lib/infra-stack.ts](infra/lib/infra-stack.ts).

### Stack Overview

| Component | CDK Construct | Name |
|---|---|---|
| CDK App | `cdk.App` | [infra/bin/infra.ts](infra/bin/infra.ts) |
| Stack | `InfraStack` | `InfraStack` |
| Entry command | `npx ts-node --prefer-ts-exts bin/infra.ts` | [infra/cdk.json](infra/cdk.json) |

### Dependencies

```json
{
  "aws-cdk-lib": "^2.232.1",
  "@aws-cdk/aws-lambda-go-alpha": "^2.232.1-alpha.0",
  "constructs": "^10.4.3"
}
```

The `@aws-cdk/aws-lambda-go-alpha` construct enables building Go Lambda functions directly from source (`GoFunction`), handling cross-compilation automatically.

### Build & Deploy

```bash
cd infra
npm run build     # tsc compile
npx cdk synth     # generate CloudFormation template
npx cdk deploy    # deploy to AWS
```

---

## 12. Infrastructure — API Gateway Configuration

A single REST API is created with organized routes:

```typescript
const api = new apigw.RestApi(this, 'FleetApi', {
    restApiName: 'BloodBike Fleet API',
});
```

### Route Structure

```
/
├── /bikes
│   ├── GET  → GetBikesLambda (public)
│   └── POST → RegisterBikeLambda (Cognito-protected)
└── /api
    ├── /health
    │   └── GET → BackendApiLambda (public)
    ├── /auth
    │   ├── /signup   → POST (public)
    │   ├── /confirm  → POST (public)
    │   └── /signin   → POST (public)
    └── /{proxy+}
        └── ANY → BackendApiLambda (Cognito-protected)
```

### CORS Configuration

Every resource has CORS preflight configured:

```typescript
resource.addCorsPreflight({
    allowOrigins: apigw.Cors.ALL_ORIGINS,
    allowMethods: apigw.Cors.ALL_METHODS,   // or specific methods
    allowHeaders: ['Authorization', 'Content-Type'],
});
```

### Authorization Split

| Route Pattern | Auth | Integration |
|---|---|---|
| `GET /bikes` | None | `GetBikesLambda` |
| `POST /bikes` | Cognito | `RegisterBikeLambda` |
| `GET /api/health` | None | `BackendApiLambda` |
| `POST /api/auth/signup\|confirm\|signin` | None | `BackendApiLambda` |
| `ANY /api/{proxy+}` | Cognito | `BackendApiLambda` |

The Cognito authorizer is attached to API Gateway resources that require authentication. Unauthenticated requests to protected endpoints are rejected at the API Gateway level before reaching Lambda.

---

## 13. Infrastructure — Lambda Functions

Three Go Lambda functions are defined using the `GoFunction` construct:

### 13.1 GetBikes

```typescript
new golambda.GoFunction(this, 'GetBikesLambda', {
    entry: '../backend/lambda/getBikes',
    functionName: 'GetBikes',
    architecture: lambda.Architecture.X86_64,
    environment: { MOTORCYCLES_TABLE: motorcyclesTable.tableName },
});
```

- **Source**: [backend/lambda/getBikes/main.go](backend/lambda/getBikes/main.go)
- **Permissions**: Read-only on `Motorcycles` table.

### 13.2 RegisterBike

```typescript
new golambda.GoFunction(this, 'RegisterBikeLambda', {
    entry: '../backend/lambda/registerBike',
    functionName: 'RegisterBike',
    architecture: lambda.Architecture.X86_64,
    environment: { MOTORCYCLES_TABLE: motorcyclesTable.tableName },
});
```

- **Source**: [backend/lambda/registerBike/main.go](backend/lambda/registerBike/main.go)
- **Permissions**: Write-only on `Motorcycles` table.

### 13.3 BackendApi

The main Lambda that serves the entire backend API:

```typescript
new golambda.GoFunction(this, 'BackendApiLambda', {
    entry: '../backend/lambda/api',
    functionName: 'BackendApi',
    architecture: lambda.Architecture.X86_64,
    environment: {
        COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_CLIENT_SECRET,
        USERS_TABLE, BIKES_TABLE, DEPOTS_TABLE, JOBS_TABLE,
        FLEET_BIKES_TABLE, FLEET_SERVICE_TABLE,
    },
});
```

- **Source**: [backend/lambda/api/main.go](backend/lambda/api/main.go)
- **Adapter**: `aws-lambda-go-api-proxy/httpadapter` converts API Gateway proxy events to `net/http`
- **Permissions**: Read/write on all 6 data tables + Cognito admin group management

---

## 14. Infrastructure — DynamoDB Tables

Nine DynamoDB tables are provisioned, all with `PAY_PER_REQUEST` billing:

### Legacy Fleet Tables

| Table Name | Partition Key | Sort Key | Used By |
|---|---|---|---|
| `Motorcycles` | `BikeID` (S) | — | `GetBikes` / `RegisterBike` Lambdas |
| `RideSessions` | `SessionID` (S) | `BikeID` (S) | Fleet ride tracking |
| `IssueReports` | `IssueID` (S) | — | Fleet issue reporting |

### Fleet Tracker Tables

| Table Name | Partition Key | Sort Key | Used By |
|---|---|---|---|
| `FleetBikes` | `BikeID` (S) | — | Fleet tracker CRUD |
| `FleetServiceHistory` | `BikeID` (S) | `ServiceID` (S) | Service history records |

### Main Backend Tables

| Table Name | Partition Key | Sort Key | Used By |
|---|---|---|---|
| `Users` | `riderId` (S) | — | User profiles, availability, roles |
| `Bikes` | `id` (S) | — | Bike registry |
| `Depots` | `depotId` (S) | — | Depot locations (forward-compat) |
| `Jobs` | `jobId` (S) | — | Job dispatch & lifecycle |

### Additional Tables (Not in CDK)

These tables are referenced in backend code but provisioned separately or via AppConfig:

| Table Name | Purpose |
|---|---|
| `Events` | Calendar events (`EVENTS_TABLE` env var) |
| `Applications` | Volunteer applications (`APPLICATIONS_TABLE` env var) |
| `AppConfig` | Centralized env configuration (`APP_CONFIG_TABLE` env var) |

---

## 15. Infrastructure — Cognito Setup

### User Pool

```typescript
const userPool = new cognito.UserPool(this, 'UserPool', {
    userPoolName: 'BloodBikeUserPool',
    selfSignUpEnabled: true,
    signInAliases: { email: true },
});
```

- Self-signup is enabled for volunteer registration.
- Email is the sign-in alias.

### User Pool Client

```typescript
const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
    userPool,
    userPoolClientName: 'BloodBikeWebClient',
    generateSecret: false,
});
```

- No client secret (public client for browser-based SPA).

### Cognito Groups

Five groups map to the application's role hierarchy:

| Group Name | Description | Hierarchy Level |
|---|---|---|
| `BloodBikeAdmin` | Administrators | 3 (highest) |
| `FleetManager` | Fleet managers | 2 |
| `Dispatcher` | Dispatchers | 1 |
| `Rider` | Riders | 0 |
| `HR` | Human Resources | — (separate) |

### API Gateway Authorizer

```typescript
const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
    cognitoUserPools: [userPool],
});
```

Attached to protected API Gateway methods. Validates the JWT `Authorization` header at the gateway level before the request reaches Lambda.

---

## 16. Infrastructure — IAM Roles

IAM permissions are granted via CDK's `grant*` methods and explicit policy statements:

### Lambda → DynamoDB

| Lambda | Tables | Permission |
|---|---|---|
| `GetBikes` | Motorcycles | `grantReadData` |
| `RegisterBike` | Motorcycles | `grantWriteData` |
| `BackendApi` | Users, Bikes, Depots, Jobs, FleetBikes, FleetServiceHistory | `grantReadWriteData` |

### Lambda → Cognito

The `BackendApi` Lambda has an explicit IAM policy for Cognito group management:

```typescript
backendApiLambda.addToRolePolicy(
    new iam.PolicyStatement({
        actions: [
            'cognito-idp:AdminListGroupsForUser',
            'cognito-idp:AdminAddUserToGroup',
            'cognito-idp:AdminRemoveUserFromGroup',
        ],
        resources: [userPool.userPoolArn],
    })
);
```

This enables the backend to sync user roles between DynamoDB tags and Cognito groups.

### Implicit Permissions

- Each `GoFunction` automatically gets a Lambda execution role with CloudWatch Logs permissions.
- DynamoDB `grant*` methods add inline policies to the Lambda execution role.

---

## 17. Infrastructure — Environment Configuration

### CDK Stack Outputs

The stack exports key values for frontend and operational integration:

| Output | Value | Purpose |
|---|---|---|
| `UserPoolId` | Cognito User Pool ID | Frontend auth configuration |
| `UserPoolClientId` | Cognito Client ID | Frontend auth configuration |
| `ApiBaseUrl` | API Gateway URL | Frontend API base URL |
| `FleetBikesTableName` | DynamoDB table name | Operational reference |
| `FleetServiceTableName` | DynamoDB table name | Operational reference |
| `UsersTableName` | DynamoDB table name | Operational reference |
| `BikesTableName` | DynamoDB table name | Operational reference |
| `DepotsTableName` | DynamoDB table name | Operational reference |
| `JobsTableName` | DynamoDB table name | Operational reference |

### Backend Lambda Environment Variables

The `BackendApi` Lambda receives these env vars from CDK:

```
AWS_REGION            → Stack region
COGNITO_USER_POOL_ID  → userPool.userPoolId
COGNITO_CLIENT_ID     → userPoolClient.userPoolClientId
COGNITO_CLIENT_SECRET → "" (no secret)
USERS_TABLE           → usersTable.tableName
BIKES_TABLE           → bikesTable.tableName
DEPOTS_TABLE          → depotsTable.tableName
JOBS_TABLE            → jobsTable.tableName
FLEET_BIKES_TABLE     → fleetBikesTable.tableName
FLEET_SERVICE_TABLE   → fleetServiceTable.tableName
```

### Local Development

Local development uses:
- `.env` file loaded via `godotenv`
- `AUTH_MODE=local` or `LOCAL_AUTH=1` for BoltDB-backed auth
- Missing `*_TABLE` env vars trigger in-memory repository fallback
- `APP_CONFIG_ENABLED=false` skips DynamoDB config loading

---

## 18. How All Pieces Connect

### Request Flow — Production (AWS)

```
Browser/PWA
    │
    ▼
API Gateway (BloodBike Fleet API)
    │
    ├─── GET /bikes ──────────────────► GetBikes Lambda ──► Motorcycles Table
    ├─── POST /bikes ─── [Cognito] ──► RegisterBike Lambda ──► Motorcycles Table
    │
    ├─── GET /api/health ────────────► BackendApi Lambda ──► "OK"
    ├─── POST /api/auth/* ──────────► BackendApi Lambda ──► Cognito User Pool
    │
    └─── ANY /api/{proxy+} ─ [Cognito Authorizer] ─► BackendApi Lambda
                                                        │
                                                        ├── httpapi.NewHandler()
                                                        │     ├── withCORS()
                                                        │     ├── RequireAuth() ──► VerifyToken()
                                                        │     │     └── JWKS from Cognito
                                                        │     └── requireRoleMiddleware()
                                                        │
                                                        ├── repo/dynamo ──► DynamoDB
                                                        │     ├── Users, Bikes, Jobs, Depots
                                                        │     └── FleetBikes, FleetServiceHistory
                                                        │
                                                        ├── auth.Client ──► Cognito (group mgmt)
                                                        ├── tracking.Store ──► In-memory
                                                        ├── push.Store ──► (BoltDB not available in Lambda)
                                                        └── SES v2 ──► Receipt emails
```

### Request Flow — Local Development

```
Browser (localhost:4200)
    │
    ▼
Angular Dev Server (proxy.conf.json)
    │
    ▼ (proxies /api/* to localhost:8080)
    │
Go HTTP Server (main.go, port 8080)
    │
    ├── .env loaded via godotenv
    ├── AppConfig DynamoDB (optional)
    │
    └── httpapi.NewHandler()
          ├── withCORS()
          ├── RequireAuth() ──► VerifyToken() [HS256 local JWT]
          │
          ├── auth.Client (local mode)
          │     └── BoltDB (data/users.db)
          │
          ├── repo/memory (in-memory maps)
          │     └── users, bikes (no DynamoDB needed)
          │
          ├── repo/dynamo (if *_TABLE env vars set)
          ├── tracking.Store (in-memory)
          ├── push.Store ──► BoltDB (data/push.db)
          └── analytics.Store (in-memory)
```

### Key Integration Points

1. **Same handler code in Lambda and local server** — `httpapi.NewHandler()` is the single source of truth. The Lambda adapter (`httpadapter.New(h)`) simply translates API Gateway proxy events into `http.Request` objects.

2. **Double auth layer in production** — API Gateway validates the JWT via the Cognito authorizer *before* the request reaches Lambda. The Go backend's `RequireAuth()` middleware validates the JWT *again* using JWKS. This provides defense-in-depth: API Gateway rejects expired/invalid tokens at the edge, and the backend extracts claims for authorization decisions.

3. **Graceful degradation** — Missing DynamoDB table env vars cause the backend to fall back to in-memory repositories. Missing Cognito config triggers local auth mode. Missing SES config returns receipt HTML as a fallback. Missing push notification config disables push endpoints silently.

4. **Role sync between Cognito and DynamoDB** — User roles are stored as both Cognito group memberships (for API Gateway authorization) and DynamoDB user `tags` (for backend queries). The `SetUserGroups()` method keeps them in sync when roles are modified via the API.

5. **Event-driven notifications** — Job creation and delivery trigger push notifications to all subscribed users via the `push.Store.NotifyAll()` method, running in a background goroutine.

6. **CDK outputs feed frontend config** — The CDK stack exports `UserPoolId`, `UserPoolClientId`, and `ApiBaseUrl`, which are consumed by the Angular frontend's environment configuration in [frontend/blood-bike-web/src/environments/aws-config.ts](frontend/blood-bike-web/src/environments/aws-config.ts).
