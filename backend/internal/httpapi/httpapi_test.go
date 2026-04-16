package httpapi

import (
"bytes"
"context"
"encoding/json"
"net/http"
"net/http/httptest"
"os"
"testing"
)

// setupHandler builds the handler with local auth.
// Jobs/events/fleet endpoints require real AWS tables and are tested separately.
func setupHandler(t *testing.T) http.Handler {
t.Helper()
os.Setenv("LOCAL_AUTH", "1")
os.Unsetenv("USERS_TABLE")
os.Unsetenv("BIKES_TABLE")
os.Unsetenv("JOBS_TABLE")
os.Unsetenv("DEPOTS_TABLE")
os.Unsetenv("EVENTS_TABLE")
os.Unsetenv("FLEET_BIKES_TABLE")
os.Unsetenv("FLEET_SERVICE_TABLE")
os.Unsetenv("PUSH_TABLE")
os.Unsetenv("APPLICATIONS_TABLE")
os.Unsetenv("COGNITO_USER_POOL_ID")
os.Unsetenv("COGNITO_CLIENT_ID")
t.Setenv("APP_CONFIG_ENABLED", "false")

h, err := NewHandler(context.Background())
if err != nil {
t.Fatalf("NewHandler: %v", err)
}
return h
}

// signIn calls /api/auth/signin and returns the access token.
func signIn(t *testing.T, h http.Handler, username, password string) string {
t.Helper()
body, _ := json.Marshal(map[string]string{"username": username, "password": password})
req := httptest.NewRequest(http.MethodPost, "/api/auth/signin", bytes.NewReader(body))
req.Header.Set("Content-Type", "application/json")
rr := httptest.NewRecorder()
h.ServeHTTP(rr, req)
if rr.Code != http.StatusOK {
t.Fatalf("signin failed: %d %s", rr.Code, rr.Body.String())
}
var resp map[string]any
_ = json.NewDecoder(rr.Body).Decode(&resp)
token, _ := resp["accessToken"].(string)
return token
}

// authReq creates a request with an optional Bearer token.
func authReq(method, path string, body []byte, token string) *http.Request {
var req *http.Request
if body != nil {
req = httptest.NewRequest(method, path, bytes.NewReader(body))
req.Header.Set("Content-Type", "application/json")
} else {
req = httptest.NewRequest(method, path, nil)
}
if token != "" {
req.Header.Set("Authorization", "Bearer "+token)
}
return req
}

// ---- Sign-in ----

func TestSignIn_Success(t *testing.T) {
h := setupHandler(t)
token := signIn(t, h, "BloodBikeAdmin", "password")
if token == "" {
t.Error("expected non-empty access token")
}
}

func TestSignIn_WrongPassword(t *testing.T) {
h := setupHandler(t)
body, _ := json.Marshal(map[string]string{"username": "BloodBikeAdmin", "password": "wrong"})
req := httptest.NewRequest(http.MethodPost, "/api/auth/signin", bytes.NewReader(body))
req.Header.Set("Content-Type", "application/json")
rr := httptest.NewRecorder()
h.ServeHTTP(rr, req)
if rr.Code != http.StatusUnauthorized {
t.Errorf("expected 401, got %d", rr.Code)
}
}

func TestSignIn_MissingFields(t *testing.T) {
h := setupHandler(t)
body, _ := json.Marshal(map[string]string{"username": "BloodBikeAdmin"})
req := httptest.NewRequest(http.MethodPost, "/api/auth/signin", bytes.NewReader(body))
req.Header.Set("Content-Type", "application/json")
rr := httptest.NewRecorder()
h.ServeHTTP(rr, req)
if rr.Code != http.StatusBadRequest {
t.Errorf("expected 400, got %d", rr.Code)
}
}

func TestSignIn_InvalidJSON(t *testing.T) {
h := setupHandler(t)
req := httptest.NewRequest(http.MethodPost, "/api/auth/signin", bytes.NewReader([]byte("not-json")))
req.Header.Set("Content-Type", "application/json")
rr := httptest.NewRecorder()
h.ServeHTTP(rr, req)
if rr.Code != http.StatusBadRequest {
t.Errorf("expected 400 for invalid JSON, got %d", rr.Code)
}
}

// ---- /api/me ----

func TestGetMe_Authenticated(t *testing.T) {
h := setupHandler(t)
token := signIn(t, h, "BloodBikeAdmin", "password")

rr := httptest.NewRecorder()
h.ServeHTTP(rr, authReq(http.MethodGet, "/api/me", nil, token))
if rr.Code != http.StatusOK {
t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
}

var me map[string]any
_ = json.NewDecoder(rr.Body).Decode(&me)
if me["username"] == nil && me["sub"] == nil {
t.Error("expected username or sub in /api/me response")
}
}

func TestGetMe_Unauthenticated(t *testing.T) {
h := setupHandler(t)
rr := httptest.NewRecorder()
h.ServeHTTP(rr, authReq(http.MethodGet, "/api/me", nil, ""))
if rr.Code != http.StatusUnauthorized {
t.Errorf("expected 401, got %d", rr.Code)
}
}

func TestGetMe_InvalidToken(t *testing.T) {
h := setupHandler(t)
rr := httptest.NewRecorder()
h.ServeHTTP(rr, authReq(http.MethodGet, "/api/me", nil, "invalidtoken"))
if rr.Code != http.StatusUnauthorized {
t.Errorf("expected 401 for invalid token, got %d", rr.Code)
}
}

// ---- Sign-up ----

func TestSignUp_Success(t *testing.T) {
h := setupHandler(t)
body, _ := json.Marshal(map[string]string{
"username": "newrider",
"password": "TestPass123!",
"email":    "rider@test.com",
})
req := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
req.Header.Set("Content-Type", "application/json")
rr := httptest.NewRecorder()
h.ServeHTTP(rr, req)
// local mode auto-confirms — 200 or 201
if rr.Code != http.StatusOK && rr.Code != http.StatusCreated {
t.Errorf("expected 200/201 for signup, got %d: %s", rr.Code, rr.Body.String())
}
}

func TestSignUp_MissingUsername(t *testing.T) {
h := setupHandler(t)
body, _ := json.Marshal(map[string]string{"password": "TestPass123!", "email": "x@x.com"})
req := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
req.Header.Set("Content-Type", "application/json")
rr := httptest.NewRecorder()
h.ServeHTTP(rr, req)
if rr.Code != http.StatusBadRequest {
t.Errorf("expected 400, got %d: %s", rr.Code, rr.Body.String())
}
}

// ---- CORS ----

func TestCORS_Preflight(t *testing.T) {
h := setupHandler(t)
req := httptest.NewRequest(http.MethodOptions, "/api/jobs", nil)
rr := httptest.NewRecorder()
h.ServeHTTP(rr, req)
if rr.Code != http.StatusNoContent {
t.Errorf("expected 204 for OPTIONS, got %d", rr.Code)
}
if rr.Header().Get("Access-Control-Allow-Origin") != "*" {
t.Error("expected CORS allow-origin header")
}
}

func TestCORS_HeadersPresent(t *testing.T) {
h := setupHandler(t)
token := signIn(t, h, "BloodBikeAdmin", "password")
rr := httptest.NewRecorder()
h.ServeHTTP(rr, authReq(http.MethodGet, "/api/me", nil, token))
if rr.Header().Get("Access-Control-Allow-Origin") != "*" {
t.Error("expected CORS header on authenticated response")
}
}

// ---- Jobs endpoint requires DynamoDB — skipped when JOBS_TABLE not set ----

func TestJobs_RequiresDynamoDB(t *testing.T) {
if os.Getenv("JOBS_TABLE") == "" {
t.Skip("JOBS_TABLE not set – jobs endpoints require DynamoDB")
}
h := setupHandler(t)
token := signIn(t, h, "BloodBikeAdmin", "password")

rr := httptest.NewRecorder()
h.ServeHTTP(rr, authReq(http.MethodGet, "/api/jobs", nil, token))
if rr.Code != http.StatusOK {
t.Errorf("expected 200, got %d", rr.Code)
}
}

func TestJobs_RequiresAuth(t *testing.T) {
h := setupHandler(t)
rr := httptest.NewRecorder()
h.ServeHTTP(rr, authReq(http.MethodGet, "/api/jobs", nil, ""))
if rr.Code != http.StatusUnauthorized {
t.Errorf("expected 401 without token, got %d", rr.Code)
}
}

func TestJobs_MethodNotAllowed(t *testing.T) {
h := setupHandler(t)
token := signIn(t, h, "BloodBikeAdmin", "password")
rr := httptest.NewRecorder()
h.ServeHTTP(rr, authReq(http.MethodPatch, "/api/jobs", nil, token))
if rr.Code != http.StatusMethodNotAllowed && rr.Code != http.StatusNotImplemented {
t.Errorf("expected 405 or 501, got %d", rr.Code)
}
}
