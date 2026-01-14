# Codename Blood

Blood Bike fleet + events tooling.

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

## Infra (optional)

Infrastructure code is in `infra/` (AWS CDK). This is not required to run the app locally.

```bash
cd infra
npm install
```
