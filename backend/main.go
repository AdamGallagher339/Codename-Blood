package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/auth"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/fleet"
)

func main() {
	ctx := context.Background()

	// Initialize JWKS (for Cognito JWT verification). If env vars are not
	// set we continue but token validation will fail until configured.
	userPoolID := os.Getenv("COGNITO_USER_POOL_ID")
	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = "us-east-1"
	}
	if userPoolID != "" {
		if err := auth.InitJWKS(ctx, region, userPoolID); err != nil {
			log.Printf("warning: failed to initialize JWKS: %v", err)
		}
	} else {
		log.Println("COGNITO_USER_POOL_ID not set; auth will not validate tokens")
	}

	// --- Health Check ---
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "OK")
	})

	// --- Fleet Management Routes (protected) ---
	http.Handle("/api/bikes", auth.AuthMiddleware(http.HandlerFunc(fleet.GetAllBikes)))
	http.Handle("/api/bike/register", auth.AuthMiddleware(http.HandlerFunc(fleet.RegisterBike)))
	http.Handle("/api/ride/start", auth.AuthMiddleware(http.HandlerFunc(fleet.StartRide)))
	http.Handle("/api/ride/end", auth.AuthMiddleware(http.HandlerFunc(fleet.EndRide)))

	log.Println("Backend running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
