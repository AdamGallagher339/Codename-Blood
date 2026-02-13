package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/auth"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/events"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/fleet"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo/dynamo"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/tracking"
)

// NewHandler builds and returns the HTTP handler for the main backend API.
//
// It is used both by the local dev server (net/http) and by the Lambda adapter.
func NewHandler(ctx context.Context) (http.Handler, error) {
	// Initialize location tracking store with 5 minute stale timeout (once per process).
	if tracking.GlobalStore == nil {
		tracking.GlobalStore = tracking.NewStore(5 * time.Minute)
		go tracking.GlobalStore.Start()
		log.Println("Location tracking store initialized")
	}

	// initialize Cognito auth client (reads COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID env vars)
	authClient, err := auth.NewAuthClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("auth client not initialized: %w", err)
	}

	// DynamoDB repositories (USERS_TABLE/BIKES_TABLE/DEPOTS_TABLE/JOBS_TABLE)
	dynamoRepos, err := dynamo.New(ctx, dynamo.ConfigFromEnv())
	if err != nil {
		return nil, fmt.Errorf("dynamo repos not initialized: %w", err)
	}
	fleet.SetRepositories(dynamoRepos.Users, dynamoRepos.Bikes)
	fleet.SetCognitoGroupManager(authClient)

	trackerStore, err := fleet.NewTrackerStore(ctx)
	if err != nil {
		log.Println("fleet tracker not initialized:", err)
	} else {
		fleet.SetTrackerStore(trackerStore)
	}

	withCORS := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			rw := &corsResponseWriter{ResponseWriter: w}
			h(rw, r)
		}
	}

	// GET /api/users: list from DynamoDB (single source of truth for user profiles).
	getAllUsers := authClient.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		if dynamoRepos.Users == nil {
			http.Error(w, "USERS_TABLE not configured", http.StatusNotImplemented)
			return
		}
		users, err := dynamoRepos.Users.List(r.Context())
		if err != nil {
			log.Printf("op=ListUsers err=%v", err)
			http.Error(w, "failed to list users", http.StatusInternalServerError)
			return
		}
		out := make([]map[string]any, 0, len(users))
		for _, u := range users {
			out = append(out, map[string]any{
				"riderId":   u.RiderID,
				"name":      u.Name,
				"tags":      u.Tags,
				"roles":     u.Tags, // backward compat: frontend supports tags || roles
				"updatedAt": u.UpdatedAt,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	})

	mux := http.NewServeMux()

	// --- Health Check ---
	mux.HandleFunc("/api/health", withCORS(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "OK")
	}))

	// --- Fleet Management Routes ---
	mux.HandleFunc("/api/bikes", withCORS(authClient.RequireAuth(fleet.GetAllBikes)))
	mux.HandleFunc("/api/ride/start", withCORS(authClient.RequireAuth(fleet.StartRide)))
	mux.HandleFunc("/api/ride/end", withCORS(authClient.RequireAuth(fleet.EndRide)))

	// --- Fleet Tracker Routes (DynamoDB) ---
	mux.HandleFunc("/api/fleet/bikes", withCORS(authClient.RequireAuth(fleet.FleetListOrCreate)))
	mux.HandleFunc("/api/fleet/bikes/", withCORS(authClient.RequireAuth(fleet.FleetBikeDetail)))

	// --- User / Tag Routes ---
	mux.HandleFunc("/api/users", withCORS(getAllUsers))
	mux.HandleFunc("/api/users/", withCORS(authClient.RequireAuth(fleet.HandleUserDetail))) // PUT/DELETE for individual users
	mux.HandleFunc("/api/user/register", withCORS(authClient.RequireAuth(fleet.RegisterUser)))
	mux.HandleFunc("/api/user/roles/init", withCORS(authClient.RequireAuth(fleet.InitializeUserRoles))) // Initial role setup after signup
	mux.HandleFunc("/api/user/tags/add", withCORS(authClient.RequireAuth(fleet.AddTagToUser)))
	mux.HandleFunc("/api/user/tags/remove", withCORS(authClient.RequireAuth(fleet.RemoveTagFromUser)))
	mux.HandleFunc("/api/user", withCORS(authClient.RequireAuth(fleet.GetUser))) // GET ?riderId=... (generic, must come LAST)

	// --- Events Routes ---
	mux.HandleFunc("/api/events", withCORS(authClient.RequireAuth(events.ListOrCreate)))
	mux.HandleFunc("/api/events/", withCORS(authClient.RequireAuth(events.GetUpdateOrDelete)))

	// --- Tracking Routes ---
	// HTTP endpoints for location updates
	mux.HandleFunc("/api/tracking/update", withCORS(authClient.RequireAuth(tracking.HandleLocationUpdate)))
	mux.HandleFunc("/api/tracking/locations", withCORS(authClient.RequireAuth(tracking.HandleGetLocations)))
	mux.HandleFunc("/api/tracking/entities", withCORS(authClient.RequireAuth(tracking.HandleGetEntities)))

	// WebSocket endpoint for real-time location updates
	// Note: API Gateway REST proxy does not support WebSocket upgrades.
	// We intentionally disable this endpoint and rely on HTTP polling.
	mux.HandleFunc("/api/tracking/ws", withCORS(authClient.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "websocket tracking disabled; use HTTP polling (GET /api/tracking/locations)", http.StatusNotImplemented)
	})))

	// --- Auth routes (Cognito) ---
	mux.HandleFunc("/api/auth/signup", withCORS(authClient.SignUpHandler))
	mux.HandleFunc("/api/auth/confirm", withCORS(authClient.ConfirmSignUpHandler))
	mux.HandleFunc("/api/auth/signin", withCORS(authClient.SignInHandler))

	// Example: protect register bike route with Cognito
	mux.HandleFunc("/api/bike/register", withCORS(authClient.RequireAuth(fleet.RegisterBike)))
	mux.HandleFunc("/api/me", withCORS(authClient.RequireAuth(authClient.MeHandler)))
	mux.HandleFunc("/api/auth/users", withCORS(authClient.RequireAuth(authClient.ListUsersHandler)))

	return mux, nil
}

// Ensure CORS headers are set for all responses, including errors.
type corsResponseWriter struct {
	http.ResponseWriter
}

func (w *corsResponseWriter) WriteHeader(statusCode int) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	w.ResponseWriter.WriteHeader(statusCode)
}
