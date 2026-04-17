# Feature Inventory — Codename Blood

Every feature implemented in the repository, verified from source code.

---

## Table of Contents

1. [Authentication & Session Management](#1-authentication--session-management)
2. [User Management & Role Administration](#2-user-management--role-administration)
3. [Role-Based Access Control](#3-role-based-access-control)
4. [Job Dispatch & Delivery Lifecycle](#4-job-dispatch--delivery-lifecycle)
5. [Rider Job Acceptance & Active Job Workflow](#5-rider-job-acceptance--active-job-workflow)
6. [Signature Capture & Receipt Emails](#6-signature-capture--receipt-emails)
7. [Real-Time GPS Location Tracking](#7-real-time-gps-location-tracking)
8. [Live Tracking Map](#8-live-tracking-map)
9. [Rider Availability Management](#9-rider-availability-management)
10. [Active Riders Monitoring](#10-active-riders-monitoring)
11. [Rider Performance Analytics](#11-rider-performance-analytics)
12. [Fleet Vehicle Management](#12-fleet-vehicle-management)
13. [Fleet Service History & Maintenance](#13-fleet-service-history--maintenance)
14. [QR Code Scanning](#14-qr-code-scanning)
15. [Event Calendar & Scheduling](#15-event-calendar--scheduling)
16. [Geocoding & Address Search](#16-geocoding--address-search)
17. [Map Routing & Directions](#17-map-routing--directions)
18. [Web Push Notifications](#18-web-push-notifications)
19. [Progressive Web App (PWA)](#19-progressive-web-app-pwa)
20. [Public Rider Application Intake](#20-public-rider-application-intake)
21. [HR Application Review](#21-hr-application-review)
22. [HR Training Management](#22-hr-training-management)
23. [Ride Sessions (Bike Check-Out / Check-In)](#23-ride-sessions-bike-check-out--check-in)
24. [Runtime Configuration Loading](#24-runtime-configuration-loading)
25. [Load Simulation Tool](#25-load-simulation-tool)
26. [Real-Time Stats Dashboard](#26-real-time-stats-dashboard)
27. [Hospital Waypoints](#27-hospital-waypoints)
28. [User Settings](#28-user-settings)

---

## 1. Authentication & Session Management

**What it does:**
Provides user sign-up, email confirmation, sign-in (with challenge/MFA support), password reset, and JWT-based session management. Supports two modes: AWS Cognito (production) and local dev auth with BoltDB persistence. Local mode creates a default `BloodBikeAdmin` / `password` user on first run.

**Frontend components:**
- `app.ts` / `app.html` — login form, signup form, confirmation code input, challenge response (new password), forgot-password flow, splash screen

**Frontend services:**
- `auth.service.ts` — `signUp()`, `signIn()`, `confirmSignUp()`, `respondToChallenge()`, `confirmForgotPassword()`, `fetchMe()`, `logout()`; manages signals: `user`, `roles`, `username`, `isLoggedIn`, `pendingChallenge`
- `auth.interceptor.ts` — injects `Authorization: Bearer <token>` on all `/api/*` requests

**Backend handlers:**
- `auth/auth.go` — `SignUpHandler`, `ConfirmSignUpHandler`, `SignInHandler`, `RespondToChallengeHandler`, `RequireAuth` (middleware), `MeHandler`, `ConfirmForgotPasswordHandler`, `VerifyToken`

**Database tables:**
- AWS Cognito User Pool (production)
- BoltDB `users.db` (local dev)

**APIs used:**
- AWS Cognito Identity Provider (SignUp, ConfirmSignUp, InitiateAuth, RespondToAuthChallenge, AdminResetUserPassword, ConfirmForgotPassword)
- JWKS endpoint for JWT verification

**Interactions with other features:**
- Provides the JWT tokens consumed by every authenticated endpoint
- Role claims extracted from tokens feed into [Role-Based Access Control](#3-role-based-access-control)
- Auth interceptor ensures all API calls carry credentials

**Accessible by:** All users (public sign-up/sign-in endpoints)

**LocalStorage keys:** `bb_access_token`, `bb_id_token`, `bb_refresh_token`, `bb_roles`

---

## 2. User Management & Role Administration

**What it does:**
Admins can list all users, create users with temporary passwords, update user roles, reset passwords, and delete users. Roles are synced bidirectionally with Cognito groups. Users have profiles with name, email, tags, status, and availability timestamps.

**Frontend components:**
- `app.ts` / `app.html` — admin user list table, create-user form (username, email, temporary password, role checkboxes), role update dropdown, delete user button, reset password button

**Frontend services:**
- `auth.service.ts` — `fetchMe()`
- Direct `HttpClient` calls in `app.ts` — `GET /api/auth/users`, `PUT /api/users/{username}`, `DELETE /api/users/{username}`, `POST /api/auth/admin/reset-password`

**Backend handlers:**
- `auth/auth.go` — `ListUsersHandler`, `AdminCreateUserHandler`, `AdminResetPasswordHandler`
- `fleet/handlers.go` — `GetAllUsers`, `RegisterUser`, `GetUser`, `HandleUserDetail` (PUT/DELETE), `handleUpdateUserRolesRESTful`, `handleDeleteUserRESTful`, `InitializeUserRoles`, `AddTagToUser`, `RemoveTagFromUser`

**Database tables:**
- `Users` DynamoDB table (partition key: `riderId`)
- AWS Cognito User Pool (group membership)
- In-memory `UsersRepo` (local dev fallback)

**APIs used:**
- AWS Cognito (AdminCreateUser, AdminAddUserToGroup, AdminDeleteUser, ListUsers, ListUsersInGroup)

**Interactions with other features:**
- User roles determine access to every other feature via [Role-Based Access Control](#3-role-based-access-control)
- User records are referenced by [Job Dispatch](#4-job-dispatch--delivery-lifecycle), [Rider Availability](#9-rider-availability-management), and [Analytics](#11-rider-performance-analytics)
- Tags on users support flexible categorisation

**Accessible by:** `BloodBikeAdmin` (full access); authenticated users can view their own profile via `/api/me`

---

## 3. Role-Based Access Control

**What it does:**
Enforces a hierarchical permission model across the entire application. Five roles exist: `BloodBikeAdmin` > `FleetManager` / `Dispatcher` > `Rider`, plus `HR`. Admins can access all guarded routes. Users with multiple roles select their active role from a dropdown. Route guards on the frontend and middleware on the backend enforce access.

**Frontend components:**
- `app.ts` / `app.html` — role selector dropdown (stored in localStorage as `bb_selected_role`), role-filtered navigation menu (`allPages` array)
- `access-denied.component.ts` — shown when a user lacks the required role

**Frontend services:**
- `guards/role.guard.ts` — `hasRoleGuard()` function; reads `bb_selected_role` and `bb_roles` from localStorage; normalises role names; allows `BloodBikeAdmin` through all guards

**Backend handlers:**
- `httpapi/httpapi.go` — `requireRoleMiddleware(requiredRole)`, `requireAuthAndRole(requiredRole, handler)`
- `auth/roles.go` — `RolesFromContext`, `UsernameFromContext`, `HasRole`, `HasRoleOrAbove`, `normalizeRoleName`, `GetRolesFromClaims`

**Role hierarchy (backend):**
| Level | Roles |
|-------|-------|
| 3 | `BloodBikeAdmin`, `Admin` |
| 2 | `FleetManager` |
| 1 | `Dispatcher` |
| 0 | `Rider` |
| — | `HR` (separate, no hierarchy) |

**Database tables:** None (extracted from JWT claims at runtime)

**Cognito groups:** `BloodBikeAdmin`, `Rider`, `Dispatcher`, `FleetManager`, `HR`

**Interactions with other features:**
- Every authenticated feature depends on this system for access control
- The role selector in the UI determines which pages appear in navigation

**Accessible by:** All authenticated users (role checks applied per feature)

---

## 4. Job Dispatch & Delivery Lifecycle

**What it does:**
Dispatchers create delivery jobs with a title, pickup address, and dropoff address. Addresses can be entered manually or selected by clicking a Leaflet map to pin coordinates. Jobs follow a lifecycle: `open` → `accepted` → `picked-up` → `delivered` → `completed`. Jobs can also be `cancelled`. Dispatchers can view all jobs and delete them.

**Frontend components:**
- `dispatcher.component.ts` — new job form (title, pickup address + map pin, dropoff address + map pin), all-jobs list with status icons, route visualisation, delete button, toast notifications

**Frontend services:**
- `job.service.ts` — `loadJobs()`, `getJob()`, `acceptJob()`, `updateJobStatus()`, `sendReceipt()`; computed signals: `openJobs`, `myActiveJob`, `myJobs`

**Backend handlers:**
- `httpapi/httpapi.go` — routes `GET/POST /api/jobs`, `GET/PUT/DELETE /api/jobs/{jobId}`, `POST /api/jobs/receipt`
- Job CRUD is handled inline in `httpapi.go`

**Database tables:**
- `Jobs` DynamoDB table (partition key: `jobId`)
- In-memory `JobsRepo` (local dev fallback)

**APIs used:** None external (internal CRUD)

**Interactions with other features:**
- Jobs appear as map markers on the [Live Tracking Map](#8-live-tracking-map) (green for pickup, red for dropoff)
- Job acceptance triggers the [Active Job Workflow](#5-rider-job-acceptance--active-job-workflow) for riders
- Job completion triggers [Signature Capture & Receipt Emails](#6-signature-capture--receipt-emails)
- [Push Notifications](#18-web-push-notifications) can alert riders to new jobs

**Accessible by:** `Dispatcher` (create, list, delete); `Rider` (accept, update status)

---

## 5. Rider Job Acceptance & Active Job Workflow

**What it does:**
Riders see a list of open jobs and can accept one. The active job view shows a colour-coded status hero card, pickup → dropoff route visualisation, timeline progression, and action buttons for advancing the job through its stages. The rider presses "Parcel Picked Up" at pickup and "Parcel Delivered" at dropoff, each triggering a signature capture and optional receipt email.

**Frontend components:**
- `rider-jobs.component.ts` — available jobs list with accept button, active job banner (tappable), job history section; disables accept if user already has an active job
- `active-job.component.ts` — status hero card (colour-coded by status), detail chips (dispatcher, timestamps), timeline visualisation, action buttons ("Parcel Picked Up", "Parcel Delivered"), triggers `ReceiptDialogComponent`

**Frontend services:**
- `job.service.ts` — `acceptJob()`, `updateJobStatus()`, `sendReceipt()`, `openJobs` (computed), `myActiveJob` (computed), `myJobs` (computed)

**Backend handlers:**
- `httpapi/httpapi.go` — `PUT /api/jobs/{jobId}` (accepts job, updates status, records signature)

**Database tables:**
- `Jobs` DynamoDB table

**Interactions with other features:**
- Accepting a job changes rider status in [Rider Availability](#9-rider-availability-management) to "on-job"
- Completing a job feeds into [Signature Capture & Receipt Emails](#6-signature-capture--receipt-emails)
- Active job banner links to [Active Job Workflow](#5-rider-job-acceptance--active-job-workflow) page

**Accessible by:** `Rider`

---

## 6. Signature Capture & Receipt Emails

**What it does:**
A multi-step receipt workflow for job pickup and delivery confirmations. Step 1: capture a handwritten signature on a canvas. Step 2: preview the signature, select or enter a recipient email (with saved contacts support), optionally save the contact for future use. Step 3: confirmation screen with option to copy receipt HTML. Receipts are sent as MIME multipart emails via AWS SES with the signature image attached.

**Frontend components:**
- `receipt-dialog.component.ts` — three-step modal (signature → email → done), saved contacts from localStorage, receipt type colour coding (red=pickup, green=delivery)
- `signature-pad.component.ts` — canvas-based signature capture with mouse + touch support, DPR scaling, clear/confirm buttons, emits base64 PNG data URI

**Frontend services:**
- `job.service.ts` — `sendReceipt(request: ReceiptRequest)`, `getSavedContacts()`, `saveContact()`, `removeContact()`

**Backend handlers:**
- `httpapi/httpapi.go` — `POST /api/jobs/receipt`, `sendSESEmailWithSignature()`, `newSESClient()`

**Database tables:**
- `Jobs` DynamoDB table (stores signature in pickup/dropoff fields)

**APIs used:**
- AWS SES v2 — `SendEmail` with MIME multipart (text/html + image/png attachment)

**LocalStorage keys:** `bloodbike_saved_contacts`

**Interactions with other features:**
- Triggered from the [Active Job Workflow](#5-rider-job-acceptance--active-job-workflow) at pickup and delivery stages
- Requires a completed job from [Job Dispatch](#4-job-dispatch--delivery-lifecycle)

**Accessible by:** `Rider`

---

## 7. Real-Time GPS Location Tracking

**What it does:**
Riders and bikes submit GPS location updates (latitude, longitude, speed, heading, accuracy) to the backend, which stores them in an in-memory store with a 5-minute stale timeout. A cleanup goroutine runs every 30 seconds to mark stale entities as inactive. Supports both HTTP POST for updates and HTTP polling for reads. WebSocket support exists but is disabled on Lambda (HTTP polling recommended). The frontend uses a 15-second polling interval with Page Visibility API integration (pauses when tab is backgrounded) and a 30-metre minimum distance gate to eliminate GPS jitter.

**Frontend services:**
- `location-tracking.service.ts` — `updateLocation()`, `getAllLocations()`, `getAllEntities()`, `getRiders()`, `connectWebSocket()` (polling), `sendLocationViaWebSocket()` (POST with distance gate), `isLocationStale()`, `startRidersPolling()`; uses exponential backoff reconnection

**Backend handlers:**
- `tracking/handlers.go` — `HandleLocationUpdate` (POST), `HandleGetLocations` (GET), `HandleGetEntities` (GET), `HandleWebSocket` (WebSocket — disabled on Lambda)
- `tracking/riders.go` — `HandleGetRiders` (GET, FleetManager only), `HandleRidersWebSocket` (WebSocket, FleetManager only)

**Backend stores:**
- `tracking/store.go` — in-memory `Store` with `sync.RWMutex`, location map, entity map, WebSocket client registry, broadcast channel, stale cleanup ticker

**Database tables:** None (in-memory only, session-scoped)

**APIs used:** None external

**Interactions with other features:**
- Location updates feed into [Rider Performance Analytics](#11-rider-performance-analytics) for speed/distance calculation
- Consumed by the [Live Tracking Map](#8-live-tracking-map) for marker rendering
- Consumed by [Active Riders Monitoring](#10-active-riders-monitoring) for status display
- The Rider's own GPS position is shown on the [Live Tracking Map](#8-live-tracking-map) as a "You Are Here" marker

**Accessible by:** All authenticated roles (update own location); `FleetManager` (view riders endpoint)

---

## 8. Live Tracking Map

**What it does:**
An interactive Leaflet map displaying real-time rider/bike positions, job pickup/dropoff markers, event waypoints, and hospital markers. Features include: animated pulsing markers for active entities, greyed-out stale markers (>2 minutes), "You Are Here" GPS marker with speed badge and accuracy circle, auto-refresh job markers every 30 seconds, toggleable event layer, fit-all-markers control, and info panel. Managers can initiate routes from any rider's position; riders can route from their own GPS. Ireland-scoped map bounds (zoom 7–19).

**Frontend components:**
- `tracking-map.component.ts` (900+ lines) — Leaflet map initialisation, marker management (rider, job, event, hospital, GPS), info panel, search bar for destinations, route controls, event marker toggle, WebSocket/polling location subscription

**Frontend services:**
- `location-tracking.service.ts` — real-time location polling
- `event.service.ts` — event markers with coordinates
- `auth.service.ts` — role-based route initiation
- Direct `HttpClient` calls — `GET /api/jobs` for job markers

**Backend handlers:**
- `tracking/handlers.go` — location endpoints
- `httpapi/httpapi.go` — `GET /api/jobs` for job markers

**External services:**
- Leaflet.js — map rendering
- Leaflet Routing Machine — route display
- OSRM — open-source routing engine for directions
- Nominatim — address autocomplete (via backend proxy)

**Interactions with other features:**
- Displays data from [GPS Location Tracking](#7-real-time-gps-location-tracking), [Job Dispatch](#4-job-dispatch--delivery-lifecycle), [Event Calendar](#15-event-calendar--scheduling), and [Hospital Waypoints](#27-hospital-waypoints)
- [Geocoding](#16-geocoding--address-search) and [Routing](#17-map-routing--directions) are embedded in this component

**Accessible by:** `Rider`, `FleetManager`, `Dispatcher`

---

## 9. Rider Availability Management

**What it does:**
Riders toggle their on-duty / off-duty status with an optional duration. The UI shows a colour-coded status hero card (green pulse for on-duty, grey for off-duty), a large toggle switch, and duration chips (1h, 2h, 4h, 8h, custom) when going available. Availability has an optional expiry time (`availableUntil`).

**Frontend components:**
- `rider-availability.component.ts` — status hero card, toggle switch, duration chips, toast notifications

**Frontend services:**
- Direct `HttpClient` calls — `PUT /api/riders/{riderId}/availability`

**Backend handlers:**
- `httpapi/httpapi.go` — `PUT /api/riders/availability/me` (update own availability), `GET /api/riders/availability` (list all)

**Database tables:**
- `Users` DynamoDB table (`status` and `availableUntil` fields)

**Interactions with other features:**
- Availability status is shown in [Active Riders Monitoring](#10-active-riders-monitoring)
- Riders list in [Analytics](#11-rider-performance-analytics) is sourced from the availability endpoint
- Accepting a job in [Rider Job Acceptance](#5-rider-job-acceptance--active-job-workflow) changes status to "on-job"

**Accessible by:** `Rider` (update own); all authenticated roles (list)

---

## 10. Active Riders Monitoring

**What it does:**
A real-time dashboard showing all riders grouped by status: Available (green), On Job (orange), and Offline (grey). Each rider card shows name/ID, status indicator dot, and expiry time if applicable. On-job riders display their current job ID. Includes stat counters for each group and a manual refresh button.

**Frontend components:**
- `active-riders.component.ts` — stats row (available/on-job/offline counts), three collapsible sections with rider cards, refresh button

**Frontend services:**
- Direct `HttpClient` calls — `GET /api/riders/status`

**Backend handlers:**
- `httpapi/httpapi.go` — `GET /api/riders/availability` (returns all riders with status)

**Database tables:**
- `Users` DynamoDB table

**Interactions with other features:**
- Data comes from [Rider Availability Management](#9-rider-availability-management)
- Rider status reflects active jobs from [Job Dispatch](#4-job-dispatch--delivery-lifecycle)

**Accessible by:** `BloodBikeAdmin`, `FleetManager`, `Dispatcher`

---

## 11. Rider Performance Analytics

**What it does:**
Tracks rider speed, distance, and active session time from GPS location updates. Stores up to 120 speed data points per rider with stale-jump detection (ignores GPS teleports >500m in <10s). The frontend shows current speed, top speed, average speed as stat cards; a speed history chart rendered as an SVG line/area graph; and a rider selector dropdown for managers. Auto-refreshes every 15 seconds.

**Frontend components:**
- `analytics-page.component.ts` — stat cards (current/top/avg speed), SVG speed history chart, rider selector dropdown (managers only), auto-refresh polling

**Frontend services:**
- `analytics.service.ts` — `getSummary(riderId)`, `getRiders()`

**Backend handlers:**
- `analytics/handlers.go` — `HandleGetAnalytics` (list rider IDs or get rider summary); riders see only their own data, managers see all

**Backend stores:**
- `analytics/store.go` — in-memory `Store` with `riderState` per rider; `Record()` calculates Haversine distance, tracks speeds; `GetSummary()` computes averages

**Database tables:** None (in-memory only, session-scoped)

**Interactions with other features:**
- Fed by [GPS Location Tracking](#7-real-time-gps-location-tracking) — every location update with `entityType == "rider"` is recorded
- Rider list sourced from [Rider Availability](#9-rider-availability-management) endpoint

**Accessible by:** `Rider` (own data only), `FleetManager`, `Dispatcher`, `BloodBikeAdmin` (all riders)

---

## 12. Fleet Vehicle Management

**What it does:**
Fleet managers create, view, edit, and delete fleet vehicles (cars and motorcycles). Each vehicle has make, model, vehicle type, registration (unique), location ID, and active status (`ready` / `out_of_service` / rider UID). Vehicles are created with `out_of_service` status by default. Only the `active` status field can be updated after creation. Deletion requires typing the vehicle registration as confirmation. Vehicle location can be changed via QR scanner.

**Frontend components:**
- `fleet-manager.component.ts` — container with header
- `fleet-tracker.component.ts` — create form (make, model, vehicle type, registration, location ID), bike list, edit form (active status), delete confirmation (type registration), tabs (Details / Service / Remove), location scanner

**Frontend services:**
- `fleet-tracker.service.ts` — `getBikes()`, `createBike()`, `updateBike()`, `deleteBike()`, `changeLocation()`

**Backend handlers:**
- `fleet/tracker_handlers.go` — `FleetListOrCreate` (GET list / POST create), `FleetBikeDetail` (GET/PATCH/PUT/DELETE by bikeID), `handleDeleteBike`, `handleChangeLocation`

**Backend stores:**
- `fleet/tracker_store.go` — DynamoDB `TrackerStore` with `ListBikes`, `GetBike`, `PutBike`, `DeleteBike`, `FindBikeByRegistration`

**Database tables:**
- `FleetBikes` DynamoDB table (partition key: `BikeID`)

**Interactions with other features:**
- Location change uses [QR Code Scanning](#14-qr-code-scanning)
- Vehicle list references depots/locations
- Service records managed by [Fleet Service History](#13-fleet-service-history--maintenance)

**Accessible by:** `FleetManager`

---

## 13. Fleet Service History & Maintenance

**What it does:**
Fleet managers record and track vehicle maintenance history. Service types: oil, chain, tyres, brakes, coolant. Each entry records service date, notes, and who performed the service. Entries can be added and deleted per vehicle.

**Frontend components:**
- `fleet-tracker.component.ts` — Service tab with service history list, add service entry form (type dropdown, date, notes, performed-by), delete entry button

**Frontend services:**
- `fleet-tracker.service.ts` — `refreshServiceHistory(bikeId)`, `addServiceEntry(bikeId, dto)`, `deleteServiceEntry(bikeId, serviceId)`

**Backend handlers:**
- `fleet/tracker_handlers.go` — `handleServiceHistory` (GET list / POST create), `handleDeleteServiceEntry`

**Backend stores:**
- `fleet/tracker_store.go` — DynamoDB `TrackerStore` with `ListServiceEntries`, `AddServiceEntry`, `DeleteServiceEntry`

**Database tables:**
- `FleetServiceHistory` DynamoDB table (partition key: `BikeID`, sort key: `ServiceID`)

**Interactions with other features:**
- Tied to vehicles in [Fleet Vehicle Management](#12-fleet-vehicle-management)

**Accessible by:** `FleetManager`

---

## 14. QR Code Scanning

**What it does:**
Uses the device camera to scan QR codes via the Html5Qrcode library. Supports rear camera by default with 10 FPS scanning, 250×250px scan area, and 500ms debounce to prevent duplicate reads. Used for scanning bike QR codes (location change in fleet management) and for location input in event forms.

**Frontend components:**
- `qr-scanner.component.ts` — reusable scanner component with start/stop, error handling (permission denied, no camera), `scanComplete` output event
- `fleet-tracker.component.ts` — integrates scanner for bike location change
- `event-form.component.ts` — integrates scanner for event location input

**Frontend services:** None (self-contained component using Html5Qrcode library)

**Backend handlers:** None (client-side only; scanned value sent to relevant API)

**Libraries:**
- `html5-qrcode` (^2.3.8)

**Interactions with other features:**
- Used by [Fleet Vehicle Management](#12-fleet-vehicle-management) to change vehicle location
- Used by [Event Calendar](#15-event-calendar--scheduling) for location input in event form

**Accessible by:** `Rider`, `FleetManager` (standalone route); also embedded in `FleetManager` and event form components

---

## 15. Event Calendar & Scheduling

**What it does:**
A full event management system with a calendar widget, event list view, and creation form. Events have title, description, date, start/end times, location (with optional map coordinates), type (delivery, training, maintenance, meeting, emergency, other), priority (low, medium, high, urgent), assigned riders, and status lifecycle (scheduled → in-progress → completed / cancelled). A background cleanup ticker auto-deletes expired events every minute. The calendar shows date indicators for days with events.

**Frontend components:**
- `events-page.component.ts` — calendar/list view toggle, header stats (total/today/upcoming), date selection filtering, event cards with type icons and priority badges, delete button
- `calendar.component.ts` — reusable calendar widget with month navigation, date indicators, today highlight
- `event-form.component.ts` — modal form with title, description, datetime, location, type/priority dropdowns, map picker, QR scanner for location

**Frontend services:**
- `event.service.ts` — `getEvents()` (signal), `createEvent()`, `updateEvent()`, `deleteEvent()`, date filtering methods

**Backend handlers:**
- `events/handlers.go` — `ListOrCreate` (GET/POST), `GetUpdateOrDelete` (GET/PUT/PATCH/DELETE)

**Backend stores:**
- `events/store.go` — DynamoDB-backed with in-memory fallback; `StartCleanupTicker()` auto-purges expired events

**Database tables:**
- `Events` DynamoDB table (partition key: `id`, optional)
- In-memory fallback map

**Interactions with other features:**
- Events with coordinates appear as orange markers on the [Live Tracking Map](#8-live-tracking-map)
- Location input can use [QR Code Scanning](#14-qr-code-scanning) or map picker with [Geocoding](#16-geocoding--address-search)

**Accessible by:** All authenticated users

---

## 16. Geocoding & Address Search

**What it does:**
Proxies address search queries through the backend to the Nominatim (OpenStreetMap) API. Required because Nominatim blocks browser-direct requests without a proper User-Agent. Scoped to Ireland (`countrycodes=ie`). Returns latitude, longitude, and display name. Used for address autocomplete in the tracking map and dispatcher job creation.

**Frontend components:**
- `tracking-map.component.ts` — destination search bar with autocomplete suggestions and debounce
- `dispatcher.component.ts` — pickup/dropoff address search (map pin placement)

**Frontend services:**
- `geocoding.service.ts` — `geocode(query): Observable<GeocodedLocation | null>`

**Backend handlers:**
- `httpapi/httpapi.go` — `handleGeocode()` at `GET /api/geocode?q={query}`, proxies to `https://nominatim.openstreetmap.org/search`

**External APIs:**
- Nominatim OpenStreetMap geocoding API (server-side with `User-Agent: BloodBikeTracker/1.0`)

**Interactions with other features:**
- Used by [Live Tracking Map](#8-live-tracking-map) for destination search
- Used by [Job Dispatch](#4-job-dispatch--delivery-lifecycle) for address resolution
- Supports [Map Routing](#17-map-routing--directions) destination input

**Accessible by:** All authenticated users

---

## 17. Map Routing & Directions

**What it does:**
Calculates and displays driving routes on the Leaflet map using Leaflet Routing Machine backed by the OSRM (Open Source Routing Machine) public API. Managers can initiate a route from any tracked rider's position to a searched destination. Riders can route from their own GPS location. Shows distance and estimated travel time. Previous routes are cleared before drawing new ones to prevent stacking.

**Frontend components:**
- `tracking-map.component.ts` — route initiation controls, destination autocomplete via Nominatim, route rendering on map, distance/time display, route removal

**Libraries:**
- `leaflet-routing-machine` (^3.2.12)
- OSRM public routing API (`router.project-osrm.org`)

**Interactions with other features:**
- Requires positions from [GPS Location Tracking](#7-real-time-gps-location-tracking)
- Uses [Geocoding](#16-geocoding--address-search) for destination search
- Rendered on the [Live Tracking Map](#8-live-tracking-map)

**Accessible by:** `FleetManager`, `Dispatcher`, `BloodBikeAdmin` (route from any rider); `Rider` (route from own GPS)

---

## 18. Web Push Notifications

**What it does:**
Enables browser push notifications using the Web Push protocol with VAPID authentication. VAPID keys are auto-generated on first run and persisted in BoltDB. Subscriptions are stored in BoltDB and synced to an in-memory map. The frontend uses a dual-path strategy: Angular `SwPush` if the Angular service worker is active, otherwise the native Push API with a custom service worker (`push-sw.js`). Supports a test notification endpoint that sends to all subscribers. Expired subscriptions (404/410 responses) are auto-removed.

**Frontend components:**
- `app.ts` — initialises push notification subscription on login

**Frontend services:**
- `push-notification.service.ts` — `subscribe()`, `unsubscribe()`, `listenForNotificationClicks()`, `isSupported` getter; auto-registers `/push-sw.js` if needed

**Backend handlers:**
- `push/handlers.go` — `HandleVAPIDPublicKey` (GET), `HandleSubscribe` (POST), `HandleUnsubscribe` (POST), `HandleTestNotification` (POST)

**Backend stores:**
- `push/push.go` — BoltDB-backed `Store` with in-memory subscription cache; `NotifyAll()` sends to all subscribers

**Database tables:**
- BoltDB `push.db` (bucket: `push_subscriptions`)

**Libraries:**
- `github.com/SherClockHolmes/webpush-go` (backend)
- Angular `@angular/service-worker` SwPush (frontend)

**Environment variables:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` (optional, defaults to `admin@bloodbike.app`)

**Interactions with other features:**
- Can notify riders of new jobs from [Job Dispatch](#4-job-dispatch--delivery-lifecycle)
- Requires [PWA](#19-progressive-web-app-pwa) service worker registration

**Accessible by:** All authenticated users (subscribe/unsubscribe); test notification requires auth

---

## 19. Progressive Web App (PWA)

**What it does:**
The Angular frontend is configured as a full PWA with install-to-homescreen support, offline caching, and push notification capability. The manifest declares the app as "Blood Bike — Real-time Delivery Coordination" with standalone display mode, crimson theme (#dc143c), and app icons (192×192, 512×512). The Angular service worker (`ngsw-config.json`) prefetches app assets and lazily caches images, fonts, and stylesheets. Production builds include output hashing and budget limits (2MB initial, 20kB component styles).

**Frontend files:**
- `frontend/blood-bike-web/public/manifest.webmanifest` — PWA manifest
- `frontend/blood-bike-web/ngsw-config.json` — service worker caching config
- `frontend/blood-bike-web/public/push-sw.js` — custom push notification service worker
- `frontend/blood-bike-web/public/icons/` — app icons
- `frontend/blood-bike-web/src/main.ts` — registers service worker on bootstrap

**Frontend services:**
- `app.config.ts` — service worker registration provider (`ServiceWorkerModule`)

**Interactions with other features:**
- Enables [Web Push Notifications](#18-web-push-notifications) via service worker
- Provides offline access to cached app shell

**Accessible by:** All users (install prompt)

---

## 20. Public Rider Application Intake

**What it does:**
An unauthenticated public form for prospective volunteer riders to apply. Collects: name, email, phone, motorcycle experience (years), available free time per week, ROSPA certificate status, and a free-text application message. Applications are stored in DynamoDB and can be reviewed by HR staff. The backend can generate a PDF from the application data.

**Frontend components:**
- `app.ts` / `app.html` — public application form on the welcome/login page (visible before authentication)

**Backend handlers:**
- `httpapi/httpapi.go` — `POST /api/applications/public` (no auth required), `buildApplicationPDFDataURL()`, `buildSimpleApplicationPDF()`

**Database tables:**
- `Applications` DynamoDB table (partition key: application ID)

**Interactions with other features:**
- Applications are reviewed via [HR Application Review](#21-hr-application-review)
- Denied applications older than 7 days are auto-deleted (`shouldAutoDeleteDeniedApplication`)

**Accessible by:** Public (no authentication required)

---

## 21. HR Application Review

**What it does:**
HR staff can list, filter, review, approve, deny, and delete volunteer applications. The UI shows stats cards (pending/approved/denied counts), a filterable/searchable table with status badges, and a PDF viewer modal. Applications can be filtered by status and searched by name or email.

**Frontend components:**
- `applications.component.ts` — stats cards, filter/search bar, application table with status badges, approve/deny/delete buttons, PDF modal with iframe viewer

**Frontend services:**
- Direct `HttpClient` calls — `GET /api/applications`, `PUT /api/applications/{appId}`, `DELETE /api/applications/{appId}`, `GET /api/applications/{appId}/pdf`

**Backend handlers:**
- `httpapi/httpapi.go` — `GET /api/applications` (HR role), `DELETE /api/applications/{id}` (HR role), `PATCH /api/applications/{id}/status` (HR role)

**Database tables:**
- `Applications` DynamoDB table

**Interactions with other features:**
- Reviews applications submitted via [Public Rider Application Intake](#20-public-rider-application-intake)
- Approved applicants can be created as users via [User Management](#2-user-management--role-administration)

**Accessible by:** `HR`

---

## 22. HR Training Management

**What it does:**
HR staff can create, view, filter, update status, and delete training sessions. Each training has a title, description, date/time, location, trainer name, and capacity. Trainings follow a status lifecycle: upcoming → in-progress → completed (or cancelled). The UI shows stats cards, status filter dropdown, and a colour-coded training cards grid.

**Frontend components:**
- `trainings.component.ts` — create form (title, description, datetime, location, trainer, capacity), stats cards (upcoming/in-progress/completed counts), status filter dropdown, training cards grid

**Frontend services:**
- Direct `HttpClient` calls — `POST /api/trainings`, `GET /api/trainings`, `PUT /api/trainings/{id}`, `DELETE /api/trainings/{id}`

**Backend handlers:**
- Backend training endpoints are called from the frontend but the specific backend handler implementation was not found in a dedicated file; the routes are likely handled inline or via the events system.

**Database tables:**
- Likely uses the events or a dedicated trainings store

**Interactions with other features:**
- Conceptually related to [Event Calendar](#15-event-calendar--scheduling) (training is an event type)

**Accessible by:** `HR`

---

## 23. Ride Sessions (Bike Check-Out / Check-In)

**What it does:**
Tracks when a rider checks out a motorcycle (start ride) and checks it back in (end ride). Starting a ride sets the bike status to `OnDuty` and records the `CurrentRiderID`. Ending a ride sets the bike status back to `Available` and clears the rider. The data model includes start/end times and start/end mileage for each session.

**Frontend services:**
- Not directly exposed in a standalone frontend component (triggered via fleet/scan flows)

**Backend handlers:**
- `fleet/handlers.go` — `StartRide(w, r)` (`POST /api/ride/start?bikeId=X&riderId=Y`), `EndRide(w, r)` (`POST /api/ride/end?bikeId=X`)

**Backend models:**
- `fleet/models.go` — `RideSession` struct (SessionID, RiderID, BikeID, Depot, StartTime, EndTime, StartMiles, EndMiles)

**Database tables:**
- `Bikes` DynamoDB table (status and currentRiderID fields)
- `RideSessions` DynamoDB table (partition key: `SessionID`, sort key: `BikeID`)

**Interactions with other features:**
- Uses bikes from [Fleet Vehicle Management](#12-fleet-vehicle-management)
- QR scanning from [QR Code Scanning](#14-qr-code-scanning) can initiate ride sessions

**Accessible by:** All authenticated users (requires `bikeId` and `riderId`)

---

## 24. Runtime Configuration Loading

**What it does:**
On startup, the backend optionally loads environment variables from a DynamoDB `AppConfig` table. Each item has a `key` string and a `value` (string, number, or boolean) that gets set as an OS environment variable. This allows runtime config changes without redeployment. Controlled by `APP_CONFIG_ENABLED` and `APP_CONFIG_TABLE` environment variables.

**Backend files:**
- `configdb/configdb.go` — `LoadEnvFromDynamo(ctx, tableName)` scans the table and calls `os.Setenv()` for each key-value pair

**Called from:**
- `backend/main.go` — invoked at startup before server initialisation

**Database tables:**
- `AppConfig` DynamoDB table (key-value pairs)

**Interactions with other features:**
- Can configure any feature's behaviour at runtime (table names, auth mode, VAPID keys, etc.)

**Accessible by:** N/A (server startup process)

---

## 25. Load Simulation Tool

**What it does:**
A CLI tool that stress-tests the platform by creating 90 synthetic users across 4 roles (30 dispatchers, 40 riders, 10 issue riders, 10 fleet managers) plus 5 applicants. Simulates the full job lifecycle concurrently: dispatchers create jobs, riders accept and progress them through pickup → delivery → completion. Outputs real-time stats every 5 seconds. Configurable via CLI flags: `--url`, `--duration`, `--dispatchers`, `--riders`, `--issue-riders`, `--fleet`.

**Backend files:**
- `backend/cmd/simulate/main.go` — simulation entry point and orchestration

**Documentation:**
- `docs/SIMULATION.md` — detailed simulation guide with cost estimates

**Interactions with other features:**
- Exercises [Authentication](#1-authentication--session-management), [Job Dispatch](#4-job-dispatch--delivery-lifecycle), [Rider Availability](#9-rider-availability-management), [GPS Tracking](#7-real-time-gps-location-tracking), and [Public Applications](#20-public-rider-application-intake)

**Accessible by:** Developers (CLI tool)

---

## 26. Real-Time Stats Dashboard

**What it does:**
A standalone server (port 9090) that reads DynamoDB tables and displays real-time operational statistics as both an HTML page and a JSON API. Shows counts and status breakdowns for users, bikes, jobs, and events.

**Backend files:**
- `backend/cmd/dashboard/main.go` — dashboard server with `GET /` (HTML) and `GET /api/stats` (JSON)

**Database tables:**
- Reads from `Users`, `Bikes`, `Jobs`, `Events` DynamoDB tables

**Interactions with other features:**
- Read-only view across [User Management](#2-user-management--role-administration), [Fleet Management](#12-fleet-vehicle-management), [Job Dispatch](#4-job-dispatch--delivery-lifecycle), and [Event Calendar](#15-event-calendar--scheduling)

**Accessible by:** Developers / operators (separate server)

---

## 27. Hospital Waypoints

**What it does:**
Pre-configured hospital markers permanently displayed on the tracking map with popup information and a "Get Directions" button. Currently includes two hospitals: University Hospital Galway and Merlin Park Regional Hospital.

**Frontend components:**
- `tracking-map.component.ts` — hardcoded hospital marker data with coordinates, popups, and direction buttons

**Interactions with other features:**
- Rendered on the [Live Tracking Map](#8-live-tracking-map)
- "Get Directions" triggers [Map Routing](#17-map-routing--directions)

**Accessible by:** `Rider`, `FleetManager`, `Dispatcher` (anyone with map access)

---

## 28. User Settings

**What it does:**
A settings page shell with sections for account information (username, email), password change (current/new/confirm), and user preferences (notification toggle, email updates toggle). The component UI is built but does not yet have full API integration.

**Frontend components:**
- `settings.component.ts` — account info form (username disabled, email editable), change password form (3 fields), preferences checkboxes, save buttons

**Backend handlers:** Not yet connected

**Interactions with other features:**
- Account information comes from [Authentication](#1-authentication--session-management)
- Notification toggle relates to [Web Push Notifications](#18-web-push-notifications)

**Accessible by:** All authenticated users

---

## Feature-to-Role Access Matrix

| Feature | Public | Rider | Dispatcher | FleetManager | BloodBikeAdmin | HR |
|---------|--------|-------|------------|--------------|----------------|-----|
| Authentication | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| User Management | — | — | — | — | ✅ | — |
| Job Dispatch (create) | — | — | ✅ | — | — | — |
| Job Acceptance | — | ✅ | — | — | — | — |
| Active Job Workflow | — | ✅ | — | — | — | — |
| Signature & Receipts | — | ✅ | — | — | — | — |
| GPS Tracking (update) | — | ✅ | ✅ | ✅ | ✅ | — |
| GPS Tracking (riders view) | — | — | — | ✅ | — | — |
| Live Tracking Map | — | ✅ | ✅ | ✅ | — | — |
| Rider Availability | — | ✅ | — | — | — | — |
| Active Riders Monitor | — | — | ✅ | ✅ | ✅ | — |
| Analytics (own) | — | ✅ | — | — | — | — |
| Analytics (all) | — | — | ✅ | ✅ | ✅ | — |
| Fleet Management | — | — | — | ✅ | — | — |
| Service History | — | — | — | ✅ | — | — |
| QR Scanning | — | ✅ | — | ✅ | — | — |
| Event Calendar | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Geocoding | — | ✅ | ✅ | ✅ | ✅ | — |
| Map Routing | — | ✅ | ✅ | ✅ | ✅ | — |
| Push Notifications | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| PWA Install | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Public Application | ✅ | — | — | — | — | — |
| Application Review | — | — | — | — | — | ✅ |
| Training Management | — | — | — | — | — | ✅ |
| Ride Sessions | — | ✅ | — | ✅ | — | — |
| Settings | — | ✅ | ✅ | ✅ | ✅ | ✅ |
