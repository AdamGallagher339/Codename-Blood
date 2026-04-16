# Load Simulation

`backend/cmd/simulate` is a standalone Go tool that simulates a fully active Blood Bike operation. It creates synthetic users and drives them concurrently through the real API — no mocking, no stubs. Every request hits your actual backend and writes to DynamoDB.

It is primarily used for:
- **Dashboard demos** — watch stats climb in real time
- **Stress testing** — verify the backend handles concurrent load
- **Integration validation** — confirm all job lifecycle endpoints work end-to-end

---

## How it works

### Phase 1 — User setup

Before the simulation starts, the tool creates **90 synthetic users** in parallel via `POST /api/auth/signup` and signs them all in via `POST /api/auth/signin` to obtain JWT tokens. This takes about 1–2 seconds with local auth.

Users are divided into four roles:

| Role | Count | Username pattern |
|------|-------|-----------------|
| Dispatcher | 30 | `sim-dispatcher-1` … `sim-dispatcher-30` |
| Active Rider | 40 | `sim-rider-1` … `sim-rider-40` |
| Issue Rider | 10 | `sim-issue-1` … `sim-issue-10` |
| Fleet Manager | 10 | `sim-fleet-1` … `sim-fleet-10` |

All users use the password `Simulate@1!`. They are created with `roles` embedded in the signup payload, which the local auth mode stores in the JWT `cognito:groups` claim — matching exactly what Cognito would produce in production.

All riders are then set to `available` status via `PUT /api/riders/availability/me`.

---

### Phase 2 — Concurrent simulation

All 90 goroutines run simultaneously for the configured duration. Each has its own loop:

#### Dispatchers (30)

Each dispatcher creates a new job every **3–9 seconds** (randomised):

```
POST /api/jobs
{
  "title":   "Blood Delivery — Urgent O-",
  "pickup":  "Mater Hospital, Dublin 7",
  "dropoff": "Royal Victoria Eye & Ear Hospital, Dublin 2"
}
```

Pickup/dropoff locations are randomly chosen from a pool of 12 real Irish hospitals. This drives the **Total Jobs** and **Open Jobs** stats on the dashboard.

#### Active Riders (40)

Each active rider loops continuously:

1. `GET /api/jobs` — scan for any job with `status: open` (shuffled to avoid all riders grabbing the same one)
2. `PUT /api/jobs/{id}` `{ "status": "accepted", "acceptedBy": "sim-rider-N" }` — accept it (4–7s simulated travel to pickup)
3. `PUT /api/jobs/{id}` `{ "status": "picked-up" }` — collect the blood (5–9s simulated travel to dropoff)
4. `PUT /api/jobs/{id}` `{ "status": "delivered" }` — deliver it
5. `PUT /api/jobs/{id}` `{ "status": "completed" }` — dispatcher confirms
6. `PUT /api/riders/availability/me` `{ "status": "available" }` — go back online

When a rider accepts a job, the backend automatically sets their user record to `status: on-job`. When the job is delivered/completed, the backend sets them back to `available`. This drives the **Active Riders**, **On Job**, and **Offline** stats.

#### Issue Riders (10)

These riders simulate real-world problems — breakdowns, wrong collections, emergencies:

1. Find an open job and accept it (same as active riders)
2. Wait 3–6 seconds (simulating partial completion)
3. `PUT /api/jobs/{id}` `{ "status": "cancelled" }` — abort the job
4. Go back online after a longer 6–12 second pause

This drives the **Cancelled** jobs stat and keeps the open job pool from draining completely.

#### Fleet Managers (10)

Each fleet manager registers new bikes at a rate of roughly one every **8–15 seconds**:

```
POST /api/bike/register
{
  "id":     "SIM-LT1-001",
  "model":  "Honda CB500F",
  "depot":  "Dublin",
  "status": "Available"
}
```

After registering a bike, they cycle through all their registered bikes and simulate rides:

```
POST /api/ride/start?bikeId=SIM-LT1-001&riderId=sim-rider-12
POST /api/ride/end?bikeId=SIM-LT1-001
```

This drives the **Total Bikes** and **Bikes In Use** stats on the dashboard.

#### Public Applicants (5, always on)

Five additional goroutines submit public rider applications every 20–40 seconds via the unauthenticated endpoint:

```
POST /api/applications/public
{
  "name":  "Seán Murphy",
  "email": "applicant-3-7821@sim.test",
  ...
}
```

> **Note:** Applications only appear on the dashboard if `APPLICATIONS_TABLE` is set in your `.env`. Without it, the backend returns 501 and the counter stays at 0.

---

### Phase 3 — Stats output

Every 5 seconds the simulation prints a summary to the terminal:

```
Jobs created: 486   accepted: 240   completed: 157   cancelled: 51   bikes: 50   apps: 0   errors: 0
```

At the end of the run, a final summary is printed and all goroutines exit cleanly.

---

## AWS cost impact

The simulation makes real DynamoDB writes. Here is a realistic estimate for a 5-minute run:

| Table | Writes | Reads |
|-------|--------|-------|
| Jobs | ~1,200 creates + ~3,600 status updates | ~5,000 list scans |
| Users | ~90 creates + ~5,000 status updates | ~5,000 gets |
| Bikes | ~80 creates + ~160 start/end updates | ~80 gets |

**Total: ~15,000 writes + ~10,000 reads**

At DynamoDB on-demand pricing ($1.25/million writes, $0.25/million reads):

- Writes: ~$0.019
- Reads: ~$0.003
- **Total: ~€0.02 per 5-minute run**

A full day of continuous simulation would cost approximately **€5.76** — well within your €200 free credit.

No Cognito, SES, or Lambda calls are made during simulation.

---

## Running the simulation

### Prerequisites

1. Backend must be running with `LOCAL_AUTH=1` and `APP_CONFIG_ENABLED=false` to prevent DynamoDB AppConfig from overriding local auth:

```bash
cd backend
go build -o backend .
APP_CONFIG_ENABLED=false LOCAL_AUTH=1 ./backend
```

2. Optionally start the dashboard to watch stats update:

```bash
cd backend
go build -o dashboard ./cmd/dashboard && ./dashboard
# Open: http://localhost:9090
```

### Run

```bash
cd backend
go run ./cmd/simulate --duration 5m
```

### All flags

```
--url           Backend URL      (default: http://localhost:8080)
--duration      Run duration     (default: 5m)
--dispatchers   Dispatcher count (default: 30)
--riders        Active riders    (default: 40)
--issue-riders  Issue riders     (default: 10)
--fleet         Fleet managers   (default: 10)
```

### Quick 2-minute demo

```bash
go run ./cmd/simulate --duration 2m --dispatchers 10 --riders 15 --issue-riders 5 --fleet 5
```

### Extended stress test (30 minutes)

```bash
go run ./cmd/simulate --duration 30m --dispatchers 50 --riders 80 --issue-riders 20 --fleet 15
```

---

## Cleanup

Simulation users (`sim-dispatcher-*`, `sim-rider-*`, etc.) are stored in the local BoltDB auth store (`backend/internal/data/users.db`) — not in Cognito or DynamoDB. They are wiped automatically when you stop the backend. DynamoDB job/bike records written during simulation remain in the tables and will be visible in the dashboard until manually deleted.

To clean up DynamoDB after a simulation run, use the AWS Console to delete items from `Jobs` and `Bikes` tables, or use the AWS CLI:

```bash
# List all sim jobs (they have titles starting with "Blood Delivery")
aws dynamodb scan --table-name Jobs --filter-expression "begins_with(title, :p)" \
  --expression-attribute-values '{":p":{"S":"Blood Delivery"}}' --region eu-north-1
```
