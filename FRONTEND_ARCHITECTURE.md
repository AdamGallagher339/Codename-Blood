# Frontend Architecture — Codename Blood

Detailed technical analysis of the Angular 20 Progressive Web App located at `frontend/blood-bike-web/`.

---

## Table of Contents

1. [Angular Application Structure](#1-angular-application-structure)
2. [Routing Structure](#2-routing-structure)
3. [Pages and Components](#3-pages-and-components)
4. [Shared Services](#4-shared-services)
5. [HTTP Interceptors](#5-http-interceptors)
6. [Authentication Handling](#6-authentication-handling)
7. [Role-Based UI Behaviour](#7-role-based-ui-behaviour)
8. [API Communication](#8-api-communication)
9. [State Management](#9-state-management)
10. [Styling Approach](#10-styling-approach)
11. [PWA Behaviour](#11-pwa-behaviour)
12. [Leaflet Map Integration](#12-leaflet-map-integration)
13. [QR Scanning Implementation](#13-qr-scanning-implementation)

---

## 1. Angular Application Structure

### Framework Version

Angular 20 with standalone components — no `NgModule` declarations anywhere. Every component uses `standalone: true` and declares its own `imports` array.

### Project Layout

```
frontend/blood-bike-web/
├── angular.json                 # Build config, assets, styles, budgets
├── tsconfig.json                # Base TS config (strict mode)
├── tsconfig.app.json            # App-specific TS config
├── tsconfig.spec.json           # Test-specific TS config
├── jest.config.js               # Jest test runner config
├── setup-jest.ts                # Jest zone.js setup
├── package.json                 # Dependencies, scripts, prettier config
├── proxy.conf.json              # Dev server API proxy
├── serve-pwa.js                 # Lightweight production PWA server
├── ngsw-config.json             # Angular service worker config
├── public/
│   ├── manifest.webmanifest     # PWA manifest
│   ├── push-sw.js               # Custom push notification service worker
│   └── icons/                   # App icons (72–512px)
└── src/
    ├── index.html               # Production HTML shell (with inline splash)
    ├── index.dev.html           # Dev HTML shell (no splash, no manifest)
    ├── main.ts                  # Bootstrap entry point
    ├── styles.scss              # Global styles & CSS custom properties
    └── app/
        ├── app.ts               # Root component (auth UI, navigation, admin)
        ├── app.html             # Root template
        ├── app.scss             # Root component styles (~900+ lines)
        ├── app.config.ts        # Application providers
        ├── app.routes.ts        # Route definitions
        ├── app.spec.ts          # Root component test
        ├── components/          # All feature components (25 files)
        ├── services/            # Injectable services (9 files)
        ├── models/              # TypeScript interfaces (4 files)
        └── guards/              # Route guards (1 file)
```

### Bootstrap Process

The app boots in [src/main.ts](frontend/blood-bike-web/src/main.ts):

```typescript
bootstrapApplication(App, appConfig)
```

The `appConfig` in [src/app/app.config.ts](frontend/blood-bike-web/src/app/app.config.ts) registers all application-level providers:

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
```

Key decisions visible here:
- **Zone coalescing** is enabled to batch change detection
- The **auth interceptor** is registered globally via `withInterceptors()`
- The **service worker** is only enabled in production mode, with a 30-second delay before registration

### Build Configurations

Defined in [angular.json](frontend/blood-bike-web/angular.json):

| Configuration | Index File | Optimisation | Source Maps | Service Worker | Output Hashing |
|---------------|-----------|--------------|-------------|----------------|----------------|
| `production` | `src/index.html` | Yes | No | Yes (`ngsw-config.json`) | All |
| `development` | `src/index.dev.html` | No | Yes | No | No |

**Production budgets:**
- Initial bundle: warning at 1MB, error at 2MB
- Any component style: warning at 12kB, error at 20kB

**Global stylesheets** loaded by the build:
- `src/styles.scss`
- `node_modules/leaflet/dist/leaflet.css`
- `node_modules/leaflet-routing-machine/dist/leaflet-routing-machine.css`

### TypeScript Configuration

[tsconfig.json](frontend/blood-bike-web/tsconfig.json) uses strict settings:
- `strict: true`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- `strictTemplates: true` (Angular compiler)
- `strictInjectionParameters: true`
- Target: `ES2022`, Module: `preserve`

### Test Setup

Two testing frameworks are configured:
- **Jest** (primary) — [jest.config.js](frontend/blood-bike-web/jest.config.js) uses `jest-preset-angular` with zone.js setup in [setup-jest.ts](frontend/blood-bike-web/setup-jest.ts)
- **Karma** (legacy) — still referenced in `angular.json` and `devDependencies` but superseded by Jest

### Dev Server Proxy

[proxy.conf.json](frontend/blood-bike-web/proxy.conf.json) proxies all `/api/*` requests to the Go backend:

```json
{
  "/api": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true,
    "ws": true,
    "logLevel": "debug"
  }
}
```

The `ws: true` setting enables WebSocket proxying.

The `start` script in [package.json](frontend/blood-bike-web/package.json) uses this proxy:
```
ng serve --proxy-config proxy.conf.json
```

### Production PWA Server

[serve-pwa.js](frontend/blood-bike-web/serve-pwa.js) is a lightweight Node.js HTTP server that:
1. Serves static files from `dist/blood-bike-web/browser/`
2. Proxies `/api/*` requests to `localhost:8080`
3. Falls back to `index.html` for Angular client-side routing (SPA fallback)

This is used to test the production build locally with service worker enabled.

---

## 2. Routing Structure

All routes are defined in [src/app/app.routes.ts](frontend/blood-bike-web/src/app/app.routes.ts). The application uses a **hybrid routing model**: some pages are rendered via Angular Router (`<router-outlet>`), while others are rendered inline by the root `App` component using `*ngIf` switches.

### Router-Managed Routes

| Path | Component | Guard | Required Roles |
|------|-----------|-------|----------------|
| `/tracking` | `TrackingMapComponent` | `hasRoleGuard` | Rider, FleetManager, Dispatcher |
| `/scan` | `QrScannerComponent` | `hasRoleGuard` | Rider, FleetManager |
| `/dispatcher` | `DispatcherComponent` | `hasRoleGuard` | Dispatcher |
| `/fleet` | `FleetManagerComponent` | `hasRoleGuard` | FleetManager |
| `/jobs` | `RiderJobsComponent` | `hasRoleGuard` | Rider |
| `/active-job` | `ActiveJobComponent` | `hasRoleGuard` | Rider |
| `/active-riders` | `ActiveRidersComponent` | `hasRoleGuard` | BloodBikeAdmin, FleetManager, Dispatcher |
| `/my-availability` | `RiderAvailabilityComponent` | `hasRoleGuard` | Rider |
| `/applications` | `ApplicationsComponent` | `hasRoleGuard` | HR |
| `/trainings` | `TrainingsComponent` | `hasRoleGuard` | HR |
| `/events` | `EventsPageComponent` | None | All authenticated |
| `/analytics` | `AnalyticsPageComponent` | `hasRoleGuard` | Rider, FleetManager, Dispatcher, BloodBikeAdmin |
| `/settings` | `SettingsComponent` | None | All authenticated |
| `/access-denied` | `AccessDeniedComponent` | None | All |
| `/` | `BlankComponent` | None | All |
| `**` | Redirect to `/access-denied` | — | — |

All eager-loaded — no lazy loading is used.

### Inline Pages (Managed by App Component)

The root `App` component in [src/app/app.ts](frontend/blood-bike-web/src/app/app.ts) manages these pages via `currentPage`:

- `welcome` — splash/landing page with login and public application form
- `login` — login form
- `signup` — registration form
- `confirm` — email confirmation code input
- `forgot-password` — password reset request
- `reset-confirm` — password reset code + new password
- `home` — authenticated home showing role-based taskbar
- `admin-roles` — admin user management panel
- `apply` — public rider application form

The `showRoutedView` flag switches between `<router-outlet>` and inline pages. When the user navigates to a route in the `routedPages` set, the router outlet is shown; otherwise the inline page renders.

### Route Guard

[src/app/guards/role.guard.ts](frontend/blood-bike-web/src/app/guards/role.guard.ts) implements `hasRoleGuard` as a functional `CanActivateFn`:

1. Reads `bb_selected_role` and `bb_roles` (JSON array) from localStorage
2. Normalises role names (lowercase, strip special characters)
3. **Admin bypass** — `BloodBikeAdmin` and `Admin` can access all guarded routes
4. Checks if the selected role or any stored role matches the route's required roles
5. Redirects to `/access-denied` on failure

---

## 3. Pages and Components

### Component Architecture

All 25 components use the standalone pattern. Most use **inline templates** (`template:` in the `@Component` decorator). Three components use external template/style files:

| Component | Template | Styles |
|-----------|----------|--------|
| `AnalyticsPageComponent` | [analytics-page.component.html](frontend/blood-bike-web/src/app/components/analytics-page.component.html) | [analytics-page.component.scss](frontend/blood-bike-web/src/app/components/analytics-page.component.scss) |
| `TrackingMapComponent` | [tracking-map.component.html](frontend/blood-bike-web/src/app/components/tracking-map.component.html) | [tracking-map.component.scss](frontend/blood-bike-web/src/app/components/tracking-map.component.scss) |
| `App` (root) | [app.html](frontend/blood-bike-web/src/app/app.html) | [app.scss](frontend/blood-bike-web/src/app/app.scss) |

All others embed templates and styles inline.

### Feature Components

| Component | File | Selector | Purpose |
|-----------|------|----------|---------|
| **TrackingMapComponent** | [tracking-map.component.ts](frontend/blood-bike-web/src/app/components/tracking-map.component.ts) | `app-tracking-map` | Full-screen Leaflet map with real-time rider markers, job markers, event waypoints, hospital markers, GPS "you are here", routing engine, and autocomplete search |
| **DispatcherComponent** | [dispatcher.component.ts](frontend/blood-bike-web/src/app/components/dispatcher.component.ts) | `app-dispatcher` | Job creation form with map pin pickers for pickup/dropoff, all-jobs list with status, delete |
| **RiderJobsComponent** | [rider-jobs.component.ts](frontend/blood-bike-web/src/app/components/rider-jobs.component.ts) | `app-rider-jobs` | Available jobs list, accept button, active job banner, job history |
| **ActiveJobComponent** | [active-job.component.ts](frontend/blood-bike-web/src/app/components/active-job.component.ts) | `app-active-job` | Active delivery workflow — status hero card, timeline, pickup/delivery action buttons |
| **ReceiptDialogComponent** | [receipt-dialog.component.ts](frontend/blood-bike-web/src/app/components/receipt-dialog.component.ts) | `app-receipt-dialog` | 3-step modal: signature capture → email selection → confirmation |
| **SignaturePadComponent** | [signature-pad.component.ts](frontend/blood-bike-web/src/app/components/signature-pad.component.ts) | `app-signature-pad` | Canvas-based signature capture (mouse + touch) |
| **FleetManagerComponent** | [fleet-manager.component.ts](frontend/blood-bike-web/src/app/components/fleet-manager.component.ts) | `app-fleet-manager` | Container for fleet dashboard with header |
| **FleetTrackerComponent** | [fleet-tracker.component.ts](frontend/blood-bike-web/src/app/components/fleet-tracker.component.ts) | `app-fleet-tracker` | Bike CRUD, service history, QR location scanning, tabbed interface |
| **ActiveRidersComponent** | [active-riders.component.ts](frontend/blood-bike-web/src/app/components/active-riders.component.ts) | `app-active-riders` | Monitor riders by status (available/on-job/offline) |
| **RiderAvailabilityComponent** | [rider-availability.component.ts](frontend/blood-bike-web/src/app/components/rider-availability.component.ts) | `app-rider-availability` | On-duty/off-duty toggle with duration chips |
| **AnalyticsPageComponent** | [analytics-page.component.ts](frontend/blood-bike-web/src/app/components/analytics-page.component.ts) | `app-analytics-page` | SVG speed history chart, stat cards, rider selector |
| **EventsPageComponent** | [events-page.component.ts](frontend/blood-bike-web/src/app/components/events-page.component.ts) | `app-events-page` | Calendar/list view toggle, event stats, date filtering |
| **EventFormComponent** | [event-form.component.ts](frontend/blood-bike-web/src/app/components/event-form.component.ts) | `app-event-form` | Modal form with map picker, QR scanner, type/priority dropdowns |
| **CalendarComponent** | [calendar.component.ts](frontend/blood-bike-web/src/app/components/calendar.component.ts) | `app-calendar` | Reusable month calendar with event indicators |
| **CommunityEventsComponent** | [community-events.component.ts](frontend/blood-bike-web/src/app/components/community-events.component.ts) | `app-community-events` | Simple event creation and listing |
| **ApplicationsComponent** | [applications.component.ts](frontend/blood-bike-web/src/app/components/applications.component.ts) | `app-applications` | HR application review with filters, search, PDF viewer |
| **TrainingsComponent** | [trainings.component.ts](frontend/blood-bike-web/src/app/components/trainings.component.ts) | `app-trainings` | Training session CRUD with status lifecycle |
| **QrScannerComponent** | [qr-scanner.component.ts](frontend/blood-bike-web/src/app/components/qr-scanner.component.ts) | `app-qr-scanner` | Device camera QR scanning with Html5Qrcode |
| **SettingsComponent** | [settings.component.ts](frontend/blood-bike-web/src/app/components/settings.component.ts) | `app-settings` | Account settings shell (UI only, no API wiring) |
| **AccessDeniedComponent** | [access-denied.component.ts](frontend/blood-bike-web/src/app/components/access-denied.component.ts) | `app-access-denied` | Permission error page with back link |
| **BlankComponent** | [blank.component.ts](frontend/blood-bike-web/src/app/components/blank.component.ts) | `app-blank` | Empty placeholder for root route |

### Shared UI Components

| Component | File | Purpose |
|-----------|------|---------|
| **DashboardPageHeaderComponent** | [dashboard-page-header.component.ts](frontend/blood-bike-web/src/app/components/dashboard-page-header.component.ts) | Reusable page header with title, subtitle, stat cards, and action slot |
| **SectionCardComponent** | [section-card.component.ts](frontend/blood-bike-web/src/app/components/section-card.component.ts) | Reusable card container with optional header and title |
| **SummaryStatCardComponent** | [summary-stat-card.component.ts](frontend/blood-bike-web/src/app/components/summary-stat-card.component.ts) | Reusable metric card (value, unit, icon, trend, colour) |
| **EmptyStateComponent** | [empty-state.component.ts](frontend/blood-bike-web/src/app/components/empty-state.component.ts) | Reusable empty state with icon, title, message, content slot |

These shared components are imported individually wherever used — no shared module.

---

## 4. Shared Services

Nine services, all `providedIn: 'root'` (singleton scope):

| Service | File | Purpose |
|---------|------|---------|
| **AuthService** | [auth.service.ts](frontend/blood-bike-web/src/app/services/auth.service.ts) | Authentication, tokens, user profile, roles |
| **JobService** | [job.service.ts](frontend/blood-bike-web/src/app/services/job.service.ts) | Job CRUD, status updates, receipts, saved contacts |
| **LocationTrackingService** | [location-tracking.service.ts](frontend/blood-bike-web/src/app/services/location-tracking.service.ts) | GPS location polling, entity tracking, connection management |
| **EventService** | [event.service.ts](frontend/blood-bike-web/src/app/services/event.service.ts) | Event CRUD with signal-based state |
| **FleetTrackerService** | [fleet-tracker.service.ts](frontend/blood-bike-web/src/app/services/fleet-tracker.service.ts) | Fleet bike management, service history |
| **AnalyticsService** | [analytics.service.ts](frontend/blood-bike-web/src/app/services/analytics.service.ts) | Rider speed/distance analytics |
| **GeocodingService** | [geocoding.service.ts](frontend/blood-bike-web/src/app/services/geocoding.service.ts) | Address search via backend Nominatim proxy |
| **PushNotificationService** | [push-notification.service.ts](frontend/blood-bike-web/src/app/services/push-notification.service.ts) | Web push subscription management |
| **authInterceptor** | [auth.interceptor.ts](frontend/blood-bike-web/src/app/services/auth.interceptor.ts) | JWT injection (functional interceptor, not `@Injectable`) |

### Service Dependency Graph

```
App component
├── AuthService ─── (used by most components)
├── PushNotificationService
├── HttpClient (direct calls for admin operations)
│
├── TrackingMapComponent
│   ├── LocationTrackingService
│   ├── EventService
│   ├── AuthService
│   └── HttpClient (job markers)
│
├── DispatcherComponent ── HttpClient, AuthService
├── RiderJobsComponent ── JobService, AuthService
├── ActiveJobComponent ── JobService, AuthService
├── ReceiptDialogComponent ── JobService, AuthService
├── FleetTrackerComponent ── FleetTrackerService, AuthService
├── AnalyticsPageComponent ── AnalyticsService, AuthService
├── EventsPageComponent ── EventService
├── ActiveRidersComponent ── HttpClient
├── RiderAvailabilityComponent ── HttpClient, AuthService
├── ApplicationsComponent ── HttpClient
└── TrainingsComponent ── HttpClient
```

---

## 5. HTTP Interceptors

A single functional interceptor is registered in [auth.interceptor.ts](frontend/blood-bike-web/src/app/services/auth.interceptor.ts).

### How It Works

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getIdToken() || auth.getAccessToken();
  const isApiRequest = req.url.startsWith('/api') || req.url.includes('/api/');

  if (!isApiRequest) return next(req);
  if (!token) return next(req);

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  }));
};
```

**Key behaviour:**
- Only intercepts requests with URL containing `/api`
- Prefers the **ID token** over the access token (Cognito convention)
- Clones the request and attaches `Authorization: Bearer <token>`
- Passes through non-API requests untouched
- Passes through unauthenticated API requests (no token) without error
- Includes `console.log` debug output for every intercepted request

**Registration** — via `provideHttpClient(withInterceptors([authInterceptor]))` in [app.config.ts](frontend/blood-bike-web/src/app/app.config.ts).

---

## 6. Authentication Handling

Authentication is managed by [AuthService](frontend/blood-bike-web/src/app/services/auth.service.ts) with the following flow:

### Auth Flow

```
Welcome ──► Login ──► (challenge?) ──► Home
  │                      │
  ├── Sign Up ──► Confirm Code ──► Login
  │
  └── Forgot Password ──► Reset Code + New Password ──► Login
```

### Token Storage

All tokens are stored in `localStorage`:

| Key | Value |
|-----|-------|
| `bb_access_token` | JWT access token from Cognito or local auth |
| `bb_id_token` | JWT ID token (preferred for API calls) |
| `bb_refresh_token` | Refresh token (stored but not currently used for auto-refresh) |
| `bb_roles` | JSON array of role names from `/api/me` response |

### Auth State Signals

```typescript
readonly user = signal<MeResponse | null>(null);       // Current user profile
readonly roles = computed(() => this.user()?.roles ?? []);  // Derived roles
readonly username = computed(() => this.user()?.username ?? '');
readonly isLoggedIn = signal<boolean>(...);             // Based on token presence
readonly lastAuthError = signal<string | null>(null);   // Latest error message
readonly pendingChallenge = signal<ChallengeResponse | null>(null);  // MFA/password challenge
```

### Challenge Response Flow

When Cognito returns a challenge (e.g. `NEW_PASSWORD_REQUIRED` for admin-created users):

1. `signIn()` receives HTTP 409 with `{ challenge, session, challengeParameters }`
2. The response is stored in `pendingChallenge` signal
3. The UI switches to a challenge form (`currentPage` logic in App component)
4. User submits new password → `respondToChallenge()` completes the auth flow
5. On success, tokens are stored and `pendingChallenge` is cleared

### Session Lifecycle

- **Login**: tokens stored → `isLoggedIn` set to `true` → `fetchMe()` loads user profile and stores roles
- **401 Response**: `fetchMe()` catches 401 → calls `logout()` → clears all tokens and signals
- **Logout**: removes all `bb_*` localStorage keys, resets `user` and `isLoggedIn` signals

---

## 7. Role-Based UI Behaviour

### Role System

Five roles exist: `BloodBikeAdmin`, `FleetManager`, `Dispatcher`, `Rider`, `HR`.

Users can hold **multiple roles simultaneously**. When a user has multiple roles, a **role selector dropdown** appears in the header (both mobile and desktop), stored as `bb_selected_role` in localStorage.

### UI Filtering

The `App` component defines an `allPages` array mapping page IDs to required roles:

```typescript
private readonly allPages = [
  { id: 'tracking',    title: 'Map',          icon: '🗺️', roles: ['Rider', 'FleetManager', 'Dispatcher'] },
  { id: 'jobs',        title: 'Jobs',         icon: '📋', roles: ['Rider'] },
  { id: 'dispatcher',  title: 'Dispatcher',   icon: '📞', roles: ['Dispatcher'] },
  { id: 'fleet',       title: 'Fleet',        icon: '🛠️', roles: ['FleetManager'] },
  { id: 'applications',title: 'Applications', icon: '📋', roles: ['HR'] },
  // ...
];
```

The **bottom taskbar** (mobile) and **navigation menu** filter these entries based on `selectedRole`. When "All Roles" is selected, pages for any of the user's roles appear.

### Per-Component Role Logic

Several components implement additional role-based behaviour internally:

- **AnalyticsPageComponent** — `canViewAll` computed signal: managers/dispatchers/admins see a rider selector dropdown; riders see only their own data
- **TrackingMapComponent** — `canRoute` computed signal: only managers/dispatchers/admins can initiate routes from other riders' markers
- **HandleGetRiders** endpoint — restricted to `FleetManager` role on the backend
- **App component** — admin panel (`admin-roles` page) only visible to `BloodBikeAdmin`

### Role Normalisation

Both the frontend guard and backend middleware normalise role names:
- Frontend: `role.toLowerCase().replace(/[^a-z0-9]/g, '')`
- Backend: strips hyphens, underscores, "bloodbike" prefix, then lowercases

This ensures `BloodBikeAdmin`, `bloodbikeadmin`, `blood-bike-admin` all match.

---

## 8. API Communication

### Communication Patterns

The frontend uses three patterns for API communication:

**1. Service-mediated (signal-backed)**
Services like `EventService`, `FleetTrackerService`, and `JobService` encapsulate HTTP calls and expose Angular signals:

```typescript
// EventService example
readonly events = signal<Event[]>([]);
createEvent(dto) {
  this.http.post('/api/events', dto).subscribe(() => this.loadEvents());
}
```

Components consume these signals reactively.

**2. Service-mediated (Observable)**
`AnalyticsService`, `GeocodingService`, and `LocationTrackingService` return RxJS Observables:

```typescript
getSummary(riderId: string): Observable<RiderSummary> {
  return this.http.get<RiderSummary>(`/api/analytics/${riderId}`);
}
```

Components subscribe in `ngOnInit` or via `async` pipe.

**3. Direct HttpClient calls**
Several components inject `HttpClient` directly for simpler CRUD:
- `App` component — admin user management
- `DispatcherComponent` — job creation
- `ActiveRidersComponent` — rider status polling
- `RiderAvailabilityComponent` — availability updates
- `ApplicationsComponent` — application management
- `TrainingsComponent` — training CRUD
- `CommunityEventsComponent` — event CRUD

### API Base Path

All API calls use relative paths starting with `/api/`. In development, the Angular dev server proxies these to `localhost:8080` via [proxy.conf.json](frontend/blood-bike-web/proxy.conf.json). In production, the serve-pwa.js or API Gateway handles routing.

### Polling Patterns

| Component/Service | Endpoint | Interval | Strategy |
|-------------------|----------|----------|----------|
| `LocationTrackingService` | `GET /api/tracking/locations` | 15 seconds | `interval()` + `switchMap()`, pauses when tab hidden (Page Visibility API), exponential backoff on error |
| `LocationTrackingService` | `GET /api/tracking/riders` | 15 seconds | Separate polling subscription for manager view |
| `AnalyticsPageComponent` | `GET /api/analytics/{riderId}` | 15 seconds | `interval()` + `switchMap()` in component |
| `TrackingMapComponent` | `GET /api/jobs` | 30 seconds | `setInterval()` in component |

### Location Update Gating

`LocationTrackingService.sendLocationViaWebSocket()` implements a **30-metre minimum distance gate** using Haversine distance calculation. This prevents GPS jitter from generating excessive API calls.

### Error Handling

- Services use `catchError()` → return `of(null)` or `of([])` for graceful degradation
- `AuthService` catches HTTP 401 → auto-logout
- `AuthService` catches HTTP 409 → challenge flow
- `lastAuthError` signal propagates error messages to the UI

---

## 9. State Management

The application uses **Angular Signals** as its primary state management approach — no NgRx, Akita, or other state library.

### Signal-Based State

| Service | Signals | Computed |
|---------|---------|----------|
| `AuthService` | `user`, `_loggedIn`, `lastAuthError`, `pendingChallenge` | `roles`, `username`, `isLoggedIn` |
| `JobService` | `_jobs`, `_loading`, `_error` | `openJobs`, `myActiveJob`, `myJobs` |
| `EventService` | `events` (lazy-loaded) | — |
| `FleetTrackerService` | `bikes`, `serviceHistory` (lazy-loaded) | — |
| `AnalyticsPageComponent` | `summary`, `riders`, `loading`, `error`, `lastRefresh` | `canViewAll`, `speedHistory`, `headerStats` |
| `TrackingMapComponent` | `showEvents` | `canRoute` (computed from auth roles) |

### Lazy Loading Pattern

`EventService` and `FleetTrackerService` use a lazy-load pattern — data is fetched on first access:

```typescript
getEvents(): Signal<Event[]> {
  if (!this.loaded) {
    this.loaded = true;
    this.loadEvents();
  }
  return this.events.asReadonly();
}
```

### Local State

Components hold local UI state in class properties and signals:
- Form field values (template-driven `[(ngModel)]`)
- Toggle flags (`showSettings`, `showRoleDropdown`, `showSplash`)
- Selected items (`selectedBikeId`, `selectedRider`)

### Persistent State (localStorage)

| Key | Scope | Purpose |
|-----|-------|---------|
| `bb_access_token` | Auth | JWT access token |
| `bb_id_token` | Auth | JWT ID token |
| `bb_refresh_token` | Auth | JWT refresh token |
| `bb_roles` | Auth | JSON array of user roles |
| `bb_selected_role` | UI | Currently active role for navigation |
| `bloodbike_saved_contacts` | Jobs | Saved receipt email contacts |

---

## 10. Styling Approach

### Design System

The application uses a **CSS Custom Properties** design system defined in [src/styles.scss](frontend/blood-bike-web/src/styles.scss):

**Colour palette:**
- Primary: `--color-red: #dc143c` (crimson)
- Secondary: `--color-dark-red: #8b0000`
- Neutrals: `--color-white`, `--color-black`, `--color-light-gray: #f5f5f5`, `--color-dark-gray: #333`

**Spacing scale:** `--spacing-xs` (0.25rem) through `--spacing-2xl` (3rem)

**Typography:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...`) with size scale from `--font-size-xs` (0.75rem) to `--font-size-3xl` (2.5rem)

**Shadows:** Three levels (`--shadow-sm`, `--shadow-md`, `--shadow-lg`)

**Transitions:** Three speeds (`--transition-fast` 150ms, `--transition-normal` 250ms, `--transition-slow` 350ms)

### SCSS Usage

- Global styles in [src/styles.scss](frontend/blood-bike-web/src/styles.scss) — reset, typography, button classes (`.btn-primary`, `.btn-secondary`, `.btn-outline`), scrollbar styling, responsive utilities, iOS safe area handling
- Component styles use SCSS with `inlineStyleLanguage: 'scss'` (configured in `angular.json`)
- Root component styles in [src/app/app.scss](frontend/blood-bike-web/src/app/app.scss) are ~900+ lines covering the header, mobile floating header, taskbar, settings dropdown, role dropdown, splash screen, welcome page, login form, admin panel, and all inline page layouts

### Responsive Design

- **Breakpoint:** `768px` is the single mobile/desktop breakpoint
- **Mobile:** floating header with logo, role dropdown pill, settings button (all with `pointer-events: none` on the container so map clicks pass through, re-enabled on child elements)
- **Desktop:** sticky header with full navigation
- **Bottom taskbar:** fixed-position, horizontally scrollable, with `safe-area-inset-bottom` padding for iOS

### iOS Safe Area Handling

Extensive safe area support in [styles.scss](frontend/blood-bike-web/src/styles.scss):

```scss
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

The `.app-header` is pushed below the notch/Dynamic Island with:
```scss
padding-top: calc(env(safe-area-inset-top) + 1.5rem);
```

A fallback targets retina iPhones specifically:
```scss
@media screen and (max-width: 430px) and (-webkit-min-device-pixel-ratio: 2) {
  .app-header {
    padding-top: max(env(safe-area-inset-top, 50px), 50px) !important;
  }
}
```

### Animation

- **Splash screen:** pulse animation (`scale(1) → scale(1.08)`) with 0.6s fade-out
- **Dropdowns:** `slideDown` keyframe (opacity + translateY)
- **Buttons:** `translateY(-2px)` on hover, snap back on active
- **Availability toggle:** smooth CSS transition on the toggle switch
- **Rider status:** pulsing green dot for "available" status

### No External CSS Framework

The project does not use Tailwind, Bootstrap, or any CSS framework. All styling is custom SCSS.

---

## 11. PWA Behaviour

### Configuration Files

| File | Purpose |
|------|---------|
| [ngsw-config.json](frontend/blood-bike-web/ngsw-config.json) | Angular service worker caching strategy |
| [public/manifest.webmanifest](frontend/blood-bike-web/public/manifest.webmanifest) | PWA install metadata |
| [public/push-sw.js](frontend/blood-bike-web/public/push-sw.js) | Custom push notification handler |
| [src/index.html](frontend/blood-bike-web/src/index.html) | Production HTML with PWA meta tags |

### Service Worker Registration

In [app.config.ts](frontend/blood-bike-web/src/app/app.config.ts):

```typescript
provideServiceWorker('ngsw-worker.js', {
  enabled: !isDevMode(),
  registrationStrategy: 'registerWhenStable:30000'
})
```

- Only enabled in production builds
- Waits 30 seconds after app stabilisation before registering (avoids interfering with initial load)

### Caching Strategy

Defined in [ngsw-config.json](frontend/blood-bike-web/ngsw-config.json):

| Asset Group | Install Mode | Files |
|-------------|-------------|-------|
| `app` | **Prefetch** | `index.html`, `index.csr.html`, `manifest.webmanifest`, `favicon.ico`, all `.css`, all `.js` |
| `assets` | **Lazy** (update: prefetch) | All images (`.svg`, `.png`, `.jpg`, `.webp`, `.gif`), fonts (`.woff`, `.woff2`) |

### PWA Manifest

[manifest.webmanifest](frontend/blood-bike-web/public/manifest.webmanifest):

- **Name:** "Blood Bike - Real-time Delivery Coordination"
- **Short name:** "Blood Bike"
- **Display:** `standalone` (hides browser chrome)
- **Orientation:** `portrait-primary`
- **Theme colour:** `#dc143c` (crimson)
- **Background:** `#ffffff`
- **Icons:** 8 sizes from 72×72 to 512×512 (all `maskable any`)
- **Categories:** business, delivery, logistics

### HTML Shell

[src/index.html](frontend/blood-bike-web/src/index.html) includes:
- `viewport-fit=cover` for edge-to-edge rendering on iOS
- `apple-mobile-web-app-capable: yes` for iOS standalone mode
- `apple-mobile-web-app-status-bar-style: black-translucent` for notch area transparency
- **Inline splash screen** styled directly in the HTML (renders before Angular loads)
- `<noscript>` fallback message

### Push Notification Service Worker

[public/push-sw.js](frontend/blood-bike-web/public/push-sw.js) is a standalone service worker for push notifications:

- Handles `push` events — parses JSON payload, shows notification with icon, badge, vibrate pattern, and action buttons
- Handles `notificationclick` events — focuses existing window or opens new one
- Uses `tag: 'blood-bike-job'` and `renotify: true` to replace existing notifications
- Serves as a fallback when the Angular `ngsw-worker.js` doesn't handle push events

### Dual-Path Push Strategy

[PushNotificationService](frontend/blood-bike-web/src/app/services/push-notification.service.ts) uses two paths:

1. **Angular SwPush** — if `ngsw-worker.js` is active (`this.swPush.isEnabled`), uses `swPush.requestSubscription()`
2. **Native PushManager** — otherwise falls back to `navigator.serviceWorker.ready` + `pushManager.subscribe()`, auto-registering `push-sw.js` if no service worker exists

---

## 12. Leaflet Map Integration

### Library Setup

Leaflet and its routing plugin are loaded via npm packages and their CSS is included in the global styles array in [angular.json](frontend/blood-bike-web/angular.json):

```json
"styles": [
  "src/styles.scss",
  "node_modules/leaflet/dist/leaflet.css",
  "node_modules/leaflet-routing-machine/dist/leaflet-routing-machine.css"
]
```

TypeScript types are provided by `@types/leaflet` and `@types/leaflet-routing-machine`.

### Map Component

[tracking-map.component.ts](frontend/blood-bike-web/src/app/components/tracking-map.component.ts) (~900+ lines) is the largest component.

**Imports:**
```typescript
import * as L from 'leaflet';
import 'leaflet-routing-machine';
```

### Map Initialisation

```typescript
private map!: L.Map;
```

The map is created in `ngAfterViewInit()` with:
- **Tile layer:** OpenStreetMap (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
- **Initial centre:** Ireland (approximately `[53.5, -7.5]`)
- **Zoom range:** 7–19
- **Bounds:** Constrained to Ireland

### Marker Layers

The map manages six distinct marker types:

| Marker Type | Icon Style | Source | Update Frequency |
|-------------|-----------|--------|-----------------|
| **Rider/Bike locations** | Custom DivIcon (green active, grey stale) | `LocationTrackingService` polling | 15 seconds |
| **"You Are Here" GPS** | Blue DivIcon with speed badge + accuracy circle | Browser Geolocation API | Continuous |
| **Job pickup** | Green DivIcon | `GET /api/jobs` | 30 seconds |
| **Job dropoff** | Red DivIcon | `GET /api/jobs` | 30 seconds |
| **Event waypoints** | Orange DivIcon | `EventService` signal (reactive via `effect()`) | Reactive |
| **Hospital markers** | Default Leaflet markers | Hardcoded coordinates | Static |

### Custom Icons

All markers use `L.divIcon` with inline SVG or emoji for maximum flexibility:

```typescript
L.divIcon({
  className: 'custom-marker',
  html: `<div style="...">🏍️</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
})
```

### Stale Detection

Locations older than 2 minutes are rendered with grey/faded markers. The `isLocationStale()` method in `LocationTrackingService` checks the `updatedAt` timestamp against a 5-minute threshold.

### GPS "You Are Here"

Uses the Browser Geolocation API (`navigator.geolocation.watchPosition()`):
- Displays a blue marker at the user's position
- Shows a speed badge above the marker (km/h)
- Draws an accuracy circle around the position
- Flies the map to the user on first fix

### Routing Engine

Uses Leaflet Routing Machine with the OSRM public router:

```typescript
L.Routing.control({
  router: L.Routing.osrmv1({
    serviceUrl: 'https://router.project-osrm.org/route/v1'
  }),
  waypoints: [startLatLng, endLatLng],
  // ...
})
```

- **Destination search:** autocomplete via backend Nominatim proxy (`GET /api/geocode?q=...`) with debounce
- **Route from riders:** managers can click a tracked rider marker and route from their position
- **Route from GPS:** riders route from their own "You Are Here" position
- **Route cleanup:** previous routes are removed before new ones to prevent visual stacking
- **Pending destination:** if GPS isn't available yet when a route is requested, the destination is queued and the route is drawn once GPS fixes

### Map in Dispatcher Component

[dispatcher.component.ts](frontend/blood-bike-web/src/app/components/dispatcher.component.ts) also embeds Leaflet maps — two small map pickers for selecting pickup and dropoff coordinates by clicking.

---

## 13. QR Scanning Implementation

### Library

Uses [html5-qrcode](https://www.npmjs.com/package/html5-qrcode) (v2.3.8) — a browser-based QR code scanner that uses the device camera via the MediaDevices API.

### Component

[qr-scanner.component.ts](frontend/blood-bike-web/src/app/components/qr-scanner.component.ts):

```typescript
@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule],
  // inline template and styles
})
export class QrScannerComponent implements OnDestroy {
  @Input() returnUrl = '/';
  @Output() scanComplete = new EventEmitter<string>();
  // ...
}
```

### Configuration

```typescript
const config = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1.0
};
```

- **Camera:** rear-facing by default (`facingMode: 'environment'`)
- **Frame rate:** 10 FPS
- **Scan area:** 250×250px box
- **Debounce:** 500ms between scans to prevent duplicates

### Scan Flow

1. User opens QR scanner page/modal
2. `startScan()` initialises `Html5Qrcode` and requests camera permission
3. On successful decode → 500ms debounce → emits `scanComplete` event with decoded text
4. `stopScan()` cleans up the scanner instance
5. `returnWithResult()` emits the result and navigates to `returnUrl`

### Error Handling

Three error states are handled:
- **Permission denied:** user declined camera access
- **No camera found:** device has no camera
- **Generic errors:** catch-all with error message display

### Integration Points

The QR scanner is used in three contexts:

1. **Standalone route** (`/scan`) — dedicated scanning page, accessible by Rider and FleetManager
2. **Fleet Tracker** — [fleet-tracker.component.ts](frontend/blood-bike-web/src/app/components/fleet-tracker.component.ts) embeds the scanner for changing bike location by scanning a location QR code
3. **Event Form** — [event-form.component.ts](frontend/blood-bike-web/src/app/components/event-form.component.ts) uses the scanner as an alternative location input method
