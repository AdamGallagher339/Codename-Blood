package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/auth"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/fleet"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if it exists
	_ = godotenv.Load()
	// initialize Cognito auth client (reads COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID env vars)
	authClient, err := auth.NewAuthClient(context.Background())
	if err != nil {
		log.Println("auth client not initialized:", err)
	}
	// --- Health Check ---
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "OK")
	})

	// --- Fleet Management Routes ---
	http.HandleFunc("/api/bikes", fleet.GetAllBikes)
	http.HandleFunc("/api/bike/register", fleet.RegisterBike)
	http.HandleFunc("/api/ride/start", fleet.StartRide)
	http.HandleFunc("/api/ride/end", fleet.EndRide)

	// --- User / Tag Routes ---
	http.HandleFunc("/api/users", fleet.GetAllUsers)
	http.HandleFunc("/api/user/register", fleet.RegisterUser)
	http.HandleFunc("/api/user", fleet.GetUser) // GET ?riderId=...
	http.HandleFunc("/api/user/tags/add", fleet.AddTagToUser)
	http.HandleFunc("/api/user/tags/remove", fleet.RemoveTagFromUser)

	// --- Auth routes (Cognito) ---
	if authClient != nil {
		http.HandleFunc("/api/auth/signup", authClient.SignUpHandler)
		http.HandleFunc("/api/auth/confirm", authClient.ConfirmSignUpHandler)
		http.HandleFunc("/api/auth/signin", authClient.SignInHandler)

		// Example: protect register bike route with Cognito
		http.HandleFunc("/api/bike/register", authClient.RequireAuth(fleet.RegisterBike))
	}

	log.Println("Backend running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
