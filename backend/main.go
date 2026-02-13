package main

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
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if it exists
	_ = godotenv.Load()

	// Initialize location tracking store with 5 minute stale timeout
	tracking.GlobalStore = tracking.NewStore(5 * time.Minute)
	go tracking.GlobalStore.Start() // Start the store event loop in a goroutine
	log.Println("Location tracking store initialized")

	// initialize Cognito auth client (reads COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID env vars)
	authClient, err := auth.NewAuthClient(context.Background())
	if err != nil {
		log.Fatal("auth client not initialized:", err)
	}

	// DynamoDB repositories (USERS_TABLE/BIKES_TABLE/DEPOTS_TABLE/JOBS_TABLE)
	dynamoRepos, err := dynamo.New(context.Background(), dynamo.ConfigFromEnv())
	if err != nil {
		log.Fatal("dynamo repos not initialized:", err)
	}
	fleet.SetRepositories(dynamoRepos.Users, dynamoRepos.Bikes)
	fleet.SetCognitoGroupManager(authClient)

	trackerStore, err := fleet.NewTrackerStore(context.Background())
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

	// --- Health Check ---
	http.HandleFunc("/api/health", withCORS(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "OK")
	}))

	// --- Fleet Management Routes ---
	http.HandleFunc("/api/bikes", withCORS(authClient.RequireAuth(fleet.GetAllBikes)))
	http.HandleFunc("/api/ride/start", withCORS(authClient.RequireAuth(fleet.StartRide)))
	http.HandleFunc("/api/ride/end", withCORS(authClient.RequireAuth(fleet.EndRide)))

	// --- Fleet Tracker Routes (DynamoDB) ---
	http.HandleFunc("/api/fleet/bikes", withCORS(authClient.RequireAuth(fleet.FleetListOrCreate)))
	http.HandleFunc("/api/fleet/bikes/", withCORS(authClient.RequireAuth(fleet.FleetBikeDetail)))

	// --- User / Tag Routes ---
	http.HandleFunc("/api/users", withCORS(getAllUsers))
	http.HandleFunc("/api/users/", withCORS(authClient.RequireAuth(fleet.HandleUserDetail))) // PUT/DELETE for individual users
	http.HandleFunc("/api/user/register", withCORS(authClient.RequireAuth(fleet.RegisterUser)))
	http.HandleFunc("/api/user/roles/init", withCORS(authClient.RequireAuth(fleet.InitializeUserRoles))) // Initial role setup after signup
	http.HandleFunc("/api/user/tags/add", withCORS(authClient.RequireAuth(fleet.AddTagToUser)))
	http.HandleFunc("/api/user/tags/remove", withCORS(authClient.RequireAuth(fleet.RemoveTagFromUser)))
	http.HandleFunc("/api/user", withCORS(authClient.RequireAuth(fleet.GetUser))) // GET ?riderId=... (generic, must come LAST)

	// --- Events Routes ---
	http.HandleFunc("/api/events", withCORS(authClient.RequireAuth(events.ListOrCreate)))
	http.HandleFunc("/api/events/", withCORS(authClient.RequireAuth(events.GetUpdateOrDelete)))

	// --- Tracking Routes ---
	// HTTP endpoints for location updates
	http.HandleFunc("/api/tracking/update", withCORS(authClient.RequireAuth(tracking.HandleLocationUpdate)))
	http.HandleFunc("/api/tracking/locations", withCORS(authClient.RequireAuth(tracking.HandleGetLocations)))
	http.HandleFunc("/api/tracking/entities", withCORS(authClient.RequireAuth(tracking.HandleGetEntities)))

	// WebSocket endpoint for real-time location updates
	// Note: WebSocket upgrade doesn't need CORS wrapper
	http.HandleFunc("/api/tracking/ws", authClient.RequireAuth(tracking.HandleWebSocket))

	// --- Auth routes (Cognito) ---
	http.HandleFunc("/api/auth/signup", withCORS(authClient.SignUpHandler))
	http.HandleFunc("/api/auth/confirm", withCORS(authClient.ConfirmSignUpHandler))
	http.HandleFunc("/api/auth/signin", withCORS(authClient.SignInHandler))

	// Example: protect register bike route with Cognito
	http.HandleFunc("/api/bike/register", withCORS(authClient.RequireAuth(fleet.RegisterBike)))
	http.HandleFunc("/api/me", withCORS(authClient.RequireAuth(authClient.MeHandler)))
	http.HandleFunc("/api/auth/users", withCORS(authClient.RequireAuth(authClient.ListUsersHandler)))

	log.Println("Backend running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// Ensure CORS headers are set for all responses, including errors
type corsResponseWriter struct {
	http.ResponseWriter
}

func (w *corsResponseWriter) WriteHeader(statusCode int) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	w.ResponseWriter.WriteHeader(statusCode)
}
