package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/auth"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/events"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/fleet"
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
		log.Println("auth client not initialized:", err)
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
			h(w, r)
		}
	}

	notConfigured := func(feature string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			http.Error(
				w,
				feature+" not configured (set AWS_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID)",
				http.StatusNotImplemented,
			)
		}
	}
	// --- Health Check ---
	http.HandleFunc("/api/health", withCORS(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "OK")
	}))

	// --- Fleet Management Routes ---
	http.HandleFunc("/api/bikes", withCORS(fleet.GetAllBikes))
	http.HandleFunc("/api/bike/register", withCORS(fleet.RegisterBike))
	http.HandleFunc("/api/ride/start", withCORS(fleet.StartRide))
	http.HandleFunc("/api/ride/end", withCORS(fleet.EndRide))

	// --- User / Tag Routes ---
	http.HandleFunc("/api/users", withCORS(fleet.GetAllUsers))
	http.HandleFunc("/api/user/register", withCORS(fleet.RegisterUser))
	http.HandleFunc("/api/user", withCORS(fleet.GetUser)) // GET ?riderId=...
	http.HandleFunc("/api/user/tags/add", withCORS(fleet.AddTagToUser))
	http.HandleFunc("/api/user/tags/remove", withCORS(fleet.RemoveTagFromUser))

	// --- Events Routes ---
	http.HandleFunc("/api/events", withCORS(events.ListOrCreate))
	http.HandleFunc("/api/events/", withCORS(events.GetUpdateOrDelete))

	// --- Tracking Routes ---
	// HTTP endpoints for location updates
	http.HandleFunc("/api/tracking/update", withCORS(tracking.HandleLocationUpdate))
	http.HandleFunc("/api/tracking/locations", withCORS(tracking.HandleGetLocations))
	http.HandleFunc("/api/tracking/entities", withCORS(tracking.HandleGetEntities))
	
	// WebSocket endpoint for real-time location updates
	// Note: WebSocket upgrade doesn't need CORS wrapper
	http.HandleFunc("/api/tracking/ws", tracking.HandleWebSocket)

	// --- Auth routes (Cognito) ---
	if authClient != nil {
		http.HandleFunc("/api/auth/signup", withCORS(authClient.SignUpHandler))
		http.HandleFunc("/api/auth/confirm", withCORS(authClient.ConfirmSignUpHandler))
		http.HandleFunc("/api/auth/signin", withCORS(authClient.SignInHandler))

		// Example: protect register bike route with Cognito
		http.HandleFunc("/api/bike/register", withCORS(authClient.RequireAuth(fleet.RegisterBike)))
		http.HandleFunc("/api/me", withCORS(authClient.RequireAuth(authClient.MeHandler)))
	} else {
		http.HandleFunc("/api/auth/signup", withCORS(notConfigured("auth")))
		http.HandleFunc("/api/auth/confirm", withCORS(notConfigured("auth")))
		http.HandleFunc("/api/auth/signin", withCORS(notConfigured("auth")))
		http.HandleFunc("/api/me", withCORS(notConfigured("auth")))
	}

	log.Println("Backend running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
