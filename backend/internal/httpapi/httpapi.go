package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	sestypes "github.com/aws/aws-sdk-go-v2/service/sesv2/types"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/auth"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/events"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/fleet"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/push"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo/dynamo"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo/memory"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/tracking"
	"github.com/google/uuid"
)

// handleGeocode proxies geocoding requests to Nominatim with a valid server-side User-Agent.
// Nominatim blocks direct browser requests, so the frontend must go through this endpoint.
func handleGeocode(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		http.Error(w, "missing query parameter 'q'", http.StatusBadRequest)
		return
	}

	nominatimURL := "https://nominatim.openstreetmap.org/search?" + url.Values{
		"q":            {q},
		"format":       {"json"},
		"limit":        {"1"},
		"countrycodes": {"ie"},
	}.Encode()

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, nominatimURL, nil)
	if err != nil {
		http.Error(w, "geocode request failed", http.StatusInternalServerError)
		return
	}
	req.Header.Set("User-Agent", "CodenameBloood/1.0 (blood-bike dispatch system; contact@example.com)")
	req.Header.Set("Accept-Language", "en")

	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "geocode upstream error", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

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

	// Fall back to in-memory repos when DynamoDB tables are not configured (local dev).
	var users repo.UsersRepository = dynamoRepos.Users
	var bikes repo.BikesRepository = dynamoRepos.Bikes
	if users == nil {
		log.Println("USERS_TABLE not set – using in-memory users repo")
		users = memory.NewUsersRepo()
	}
	if bikes == nil {
		log.Println("BIKES_TABLE not set – using in-memory bikes repo")
		bikes = memory.NewBikesRepo()
	}

	fleet.SetRepositories(users, bikes)
	fleet.SetCognitoGroupManager(authClient)

	// Set global events repository if configured
	if dynamoRepos.Events != nil {
		events.SetGlobalEventsRepository(dynamoRepos.Events)
	}

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

	// Middleware to check for required role
	requireRoleMiddleware := func(requiredRole string) func(http.HandlerFunc) http.HandlerFunc {
		return func(h http.HandlerFunc) http.HandlerFunc {
			return func(w http.ResponseWriter, r *http.Request) {
				roles := authClient.GetUserRoles(r.Context())
				if !auth.HasRoleOrAbove(roles, requiredRole) {
					http.Error(w, "insufficient permissions", http.StatusForbidden)
					return
				}
				h(w, r)
			}
		}
	}

	// Helper to apply auth + role check together
	requireAuthAndRole := func(requiredRole string, h http.HandlerFunc) http.HandlerFunc {
		return authClient.RequireAuth(requireRoleMiddleware(requiredRole)(h))
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

	// --- Push Notification Store ---
	var pushStore *push.Store
	pushStore, err = push.NewStore()
	if err != nil {
		log.Println("Push notifications disabled:", err)
	} else {
		log.Println("Push notifications enabled")
	}

	// --- Jobs Routes ---
	listOrCreateJobs := authClient.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		if dynamoRepos.Jobs == nil {
			http.Error(w, "JOBS_TABLE not configured", http.StatusNotImplemented)
			return
		}
		switch r.Method {
		case http.MethodGet:
			jobs, err := dynamoRepos.Jobs.List(r.Context())
			if err != nil {
				log.Printf("op=ListJobs err=%v", err)
				http.Error(w, "failed to list jobs", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(jobs)
		case http.MethodPost:
			var body struct {
				Title   string `json:"title"`
				Pickup  string `json:"pickup"`
				Dropoff string `json:"dropoff"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid JSON", http.StatusBadRequest)
				return
			}
			if body.Title == "" {
				http.Error(w, "title required", http.StatusBadRequest)
				return
			}

			// Extract username from JWT claims
			claims := auth.ClaimsFromContext(r.Context())
			createdBy := ""
			if claims != nil {
				if u, ok := claims["cognito:username"].(string); ok {
					createdBy = u
				} else if u, ok := claims["username"].(string); ok {
					createdBy = u
				} else if u, ok := claims["sub"].(string); ok {
					createdBy = u
				}
			}

			now := time.Now().UTC().Format(time.RFC3339)
			job := &repo.Job{
				JobID:      uuid.NewString(),
				Title:      body.Title,
				Status:     "open",
				CreatedBy:  createdBy,
				Pickup:     map[string]any{"address": body.Pickup},
				Dropoff:    map[string]any{"address": body.Dropoff},
				Timestamps: map[string]any{"created": now},
			}
			if err := dynamoRepos.Jobs.Put(r.Context(), job); err != nil {
				log.Printf("op=CreateJob err=%v", err)
				http.Error(w, "failed to create job", http.StatusInternalServerError)
				return
			}

			// Send push notification to all subscribed riders
			if pushStore != nil {
				pickupAddr := body.Pickup
				if pickupAddr == "" {
					pickupAddr = "TBD"
				}
				notifBody := fmt.Sprintf("%s — Pickup: %s", body.Title, pickupAddr)
				go pushStore.NotifyAll("🚨 New Job Posted", notifBody, "/jobs")
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(job)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	jobDetail := authClient.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		if dynamoRepos.Jobs == nil {
			http.Error(w, "JOBS_TABLE not configured", http.StatusNotImplemented)
			return
		}
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/jobs/"), "/")
		jobID := parts[0]
		if jobID == "" {
			http.Error(w, "job ID required", http.StatusBadRequest)
			return
		}
		switch r.Method {
		case http.MethodGet:
			job, found, err := dynamoRepos.Jobs.Get(r.Context(), jobID)
			if err != nil {
				log.Printf("op=GetJob err=%v", err)
				http.Error(w, "failed to get job", http.StatusInternalServerError)
				return
			}
			if !found {
				http.Error(w, "job not found", http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(job)
		case http.MethodPut:
			// Accept a job (rider sets acceptedBy + status)
			var body struct {
				Status        string `json:"status"`
				AcceptedBy    string `json:"acceptedBy"`
				SignatureData string `json:"signatureData,omitempty"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, "invalid JSON", http.StatusBadRequest)
				return
			}
			job, found, err := dynamoRepos.Jobs.Get(r.Context(), jobID)
			if err != nil {
				log.Printf("op=UpdateJob err=%v", err)
				http.Error(w, "failed to get job", http.StatusInternalServerError)
				return
			}
			if !found {
				http.Error(w, "job not found", http.StatusNotFound)
				return
			}
			if body.Status != "" {
				job.Status = body.Status
			}
			if body.AcceptedBy != "" {
				job.AcceptedBy = body.AcceptedBy
			}
			if job.Timestamps == nil {
				job.Timestamps = map[string]any{}
			}
			now := time.Now().UTC()
			job.Timestamps["updated"] = now.Format(time.RFC3339)

			// Record pickup/delivery timestamps and signature
			if body.Status == "picked-up" {
				job.Timestamps["pickedUp"] = now.Format(time.RFC3339)
				if body.SignatureData != "" {
					if job.Pickup == nil {
						job.Pickup = map[string]any{}
					}
					job.Pickup["signature"] = body.SignatureData
					job.Pickup["signedAt"] = now.Format(time.RFC3339)
				}
			}
			if body.Status == "delivered" {
				job.Timestamps["delivered"] = now.Format(time.RFC3339)
				if body.SignatureData != "" {
					if job.Dropoff == nil {
						job.Dropoff = map[string]any{}
					}
					job.Dropoff["signature"] = body.SignatureData
					job.Dropoff["signedAt"] = now.Format(time.RFC3339)
				}
			}

			if err := dynamoRepos.Jobs.Put(r.Context(), job); err != nil {
				log.Printf("op=UpdateJob err=%v", err)
				http.Error(w, "failed to update job", http.StatusInternalServerError)
				return
			}

			// When a rider accepts a job, set their availability to "on-job"
			if body.Status == "accepted" && body.AcceptedBy != "" && dynamoRepos.Users != nil {
				rider, found, _ := dynamoRepos.Users.Get(r.Context(), body.AcceptedBy)
				if !found {
					rider = &repo.User{RiderID: body.AcceptedBy, Name: body.AcceptedBy, Tags: []string{"Rider"}}
				}
				rider.Status = "on-job"
				rider.CurrentJobID = jobID
				rider.UpdatedAt = now
				if err := dynamoRepos.Users.Put(r.Context(), rider); err != nil {
					log.Printf("op=UpdateRiderOnAccept rider=%s err=%v", body.AcceptedBy, err)
				}
			}

			// When a job is delivered/completed/cancelled, set the rider back to available
			// and notify the dispatcher
			if (body.Status == "delivered" || body.Status == "completed" || body.Status == "cancelled") && job.AcceptedBy != "" && dynamoRepos.Users != nil {
				rider, found, _ := dynamoRepos.Users.Get(r.Context(), job.AcceptedBy)
				if found && (rider.Status == "on-job" || rider.Status == "on-delivery") {
					// Check if the rider's availability timer has expired
					newStatus := "available"
					if rider.AvailableUntil != "" {
						expiry, err := time.Parse(time.RFC3339, rider.AvailableUntil)
						if err == nil && now.After(expiry) {
							newStatus = "offline"
							rider.AvailableUntil = ""
						}
					}
					rider.Status = newStatus
					rider.CurrentJobID = ""
					rider.UpdatedAt = now
					if err := dynamoRepos.Users.Put(r.Context(), rider); err != nil {
						log.Printf("op=UpdateRiderOnComplete rider=%s err=%v", job.AcceptedBy, err)
					}
				}
			}

			// Send push notification to dispatchers when job is delivered
			if body.Status == "delivered" && pushStore != nil {
				riderName := job.AcceptedBy
				notifBody := fmt.Sprintf("Job \"%s\" has been delivered by %s", job.Title, riderName)
				go pushStore.NotifyAll("✅ Job Completed", notifBody, "/dispatcher")
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(job)
		case http.MethodDelete:
			deleted, err := dynamoRepos.Jobs.Delete(r.Context(), jobID)
			if err != nil {
				log.Printf("op=DeleteJob err=%v", err)
				http.Error(w, "failed to delete job", http.StatusInternalServerError)
				return
			}
			if !deleted {
				http.Error(w, "job not found", http.StatusNotFound)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/jobs", withCORS(listOrCreateJobs))
	mux.HandleFunc("/api/jobs/", withCORS(jobDetail))

	// --- Receipt Email Route ---
	sendReceipt := authClient.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			JobID          string `json:"jobId"`
			Type           string `json:"type"` // "pickup" or "delivery"
			RecipientEmail string `json:"recipientEmail"`
			RiderName      string `json:"riderName"`
			SignatureData  string `json:"signatureData"` // base64 PNG
			JobTitle       string `json:"jobTitle"`
			PickupAddress  string `json:"pickupAddress"`
			DropoffAddress string `json:"dropoffAddress"`
			Timestamp      string `json:"timestamp"`
			DispatcherName string `json:"dispatcherName"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if body.RecipientEmail == "" || body.Type == "" {
			http.Error(w, "recipientEmail and type required", http.StatusBadRequest)
			return
		}

		// Build HTML receipt
		receiptType := "Pickup Confirmation"
		if body.Type == "delivery" {
			receiptType = "Delivery Confirmation"
		}
		// Format timestamp for display
		var displayTime string
		if body.Timestamp != "" {
			if t, err := time.Parse(time.RFC3339Nano, body.Timestamp); err == nil {
				displayTime = t.Format("02 Jan 2006, 15:04")
			} else if t, err := time.Parse(time.RFC3339, body.Timestamp); err == nil {
				displayTime = t.Format("02 Jan 2006, 15:04")
			} else {
				displayTime = body.Timestamp
			}
		} else {
			displayTime = time.Now().UTC().Format("02 Jan 2006, 15:04")
		}

		dispatcher := body.DispatcherName
		if dispatcher == "" {
			dispatcher = "Dispatch"
		}

		html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>%s</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0;">🏍️ Blood Bike Ireland</h1>
    <h2 style="margin: 5px 0 0 0;">%s</h2>
  </div>
  <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
    <table style="width: 100%%; border-collapse: collapse;">
      <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Dispatched By:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
      <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Job Title:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
      <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Pickup Address:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
      <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Delivery Address:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
      <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Rider:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
      <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">%s Time:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">%s</td></tr>
    </table>
    <div style="margin-top: 20px; border-top: 2px solid #dc3545; padding-top: 15px;">
      <p style="font-weight: bold; margin-bottom: 5px;">Rider Signature:</p>
      <img src="cid:signature" alt="Signature" style="max-width: 300px; border: 1px solid #ddd; border-radius: 4px; padding: 5px;" />
    </div>
    <p style="text-align: center; color: #666; font-size: 12px; margin-top: 20px;">
      This is an automated receipt from the Blood Bike Ireland dispatch system.
    </p>
  </div>
</body>
</html>`, receiptType, receiptType, dispatcher, body.JobTitle, body.PickupAddress, body.DropoffAddress, body.RiderName, body.Type, displayTime)

		// Send via AWS SES
		sesClient, err := newSESClient(r.Context())
		if err != nil {
			log.Printf("op=SendReceipt err=%v (SES not available, returning receipt HTML)", err)
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sent":    false,
				"message": "Email service not configured. Receipt generated.",
				"html":    html,
			})
			return
		}

		subject := fmt.Sprintf("Blood Bike %s — %s", receiptType, body.JobTitle)
		err = sendSESEmailWithSignature(r.Context(), sesClient, body.RecipientEmail, subject, html, body.SignatureData)
		if err != nil {
			log.Printf("op=SendReceipt email=%s err=%v", body.RecipientEmail, err)
			// Return receipt HTML as fallback
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sent":    false,
				"message": fmt.Sprintf("Failed to send email: %v. Receipt generated.", err),
				"html":    html,
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"sent":    true,
			"message": fmt.Sprintf("Receipt sent to %s", body.RecipientEmail),
		})
	})
	mux.HandleFunc("/api/jobs/receipt", withCORS(sendReceipt))

	// --- Rider Availability Routes ---
	riderAvailabilityList := authClient.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		if dynamoRepos.Users == nil {
			http.Error(w, "USERS_TABLE not configured", http.StatusNotImplemented)
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Get all members of the Cognito "Rider" group
		riderUsernames, err := authClient.ListUsersInGroup(r.Context(), "Rider")
		if err != nil {
			log.Printf("op=ListRiderAvailability cognito err=%v", err)
			http.Error(w, "failed to list riders", http.StatusInternalServerError)
			return
		}

		// Build a map of DynamoDB availability data keyed by riderId
		allUsers, err := dynamoRepos.Users.List(r.Context())
		if err != nil {
			log.Printf("op=ListRiderAvailability dynamo err=%v", err)
			http.Error(w, "failed to list users", http.StatusInternalServerError)
			return
		}
		byID := make(map[string]*repo.User, len(allUsers))
		for i := range allUsers {
			byID[allUsers[i].RiderID] = &allUsers[i]
		}

		now := time.Now().UTC()
		riders := make([]map[string]any, 0, len(riderUsernames))
		for _, username := range riderUsernames {
			u := byID[username]

			status := "offline"
			availableUntil := ""
			currentJobID := ""
			name := username

			if u != nil {
				if u.Name != "" {
					name = u.Name
				}
				status = u.Status
				if status == "" {
					status = "offline"
				}
				availableUntil = u.AvailableUntil
				currentJobID = u.CurrentJobID

				// Auto-expire: if availableUntil is set and in the past, mark offline
				if status == "available" && availableUntil != "" {
					expiry, err := time.Parse(time.RFC3339, availableUntil)
					if err == nil && now.After(expiry) {
						status = "offline"
						availableUntil = ""
						u.Status = "offline"
						u.AvailableUntil = ""
						u.UpdatedAt = now
						_ = dynamoRepos.Users.Put(r.Context(), u)
					}
				}
			}

			riders = append(riders, map[string]any{
				"riderId":        username,
				"name":           name,
				"status":         status,
				"availableUntil": availableUntil,
				"currentJobId":   currentJobID,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(riders)
	})

	riderAvailabilityUpdate := authClient.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		if dynamoRepos.Users == nil {
			http.Error(w, "USERS_TABLE not configured", http.StatusNotImplemented)
			return
		}
		if r.Method != http.MethodPut {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			Status   string `json:"status"`
			Duration int    `json:"duration"` // hours to stay available
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if body.Status != "available" && body.Status != "offline" {
			http.Error(w, "status must be 'available' or 'offline'", http.StatusBadRequest)
			return
		}

		// Get username from JWT
		claims := auth.ClaimsFromContext(r.Context())
		username := ""
		if claims != nil {
			if u, ok := claims["cognito:username"].(string); ok {
				username = u
			} else if u, ok := claims["username"].(string); ok {
				username = u
			}
		}
		if username == "" {
			http.Error(w, "could not determine username", http.StatusUnauthorized)
			return
		}

		user, found, err := dynamoRepos.Users.Get(r.Context(), username)
		if err != nil {
			log.Printf("op=UpdateAvailability err=%v", err)
			http.Error(w, "failed to get user", http.StatusInternalServerError)
			return
		}
		if !found {
			// Auto-create user record if not found (rider may not have been registered)
			user = &repo.User{RiderID: username, Name: username, Tags: []string{"Rider"}}
		}

		user.Status = body.Status
		user.UpdatedAt = time.Now().UTC()

		if body.Status == "available" && body.Duration > 0 {
			user.AvailableUntil = time.Now().UTC().Add(time.Duration(body.Duration) * time.Hour).Format(time.RFC3339)
		} else if body.Status == "offline" {
			user.AvailableUntil = ""
			user.CurrentJobID = ""
		}

		if err := dynamoRepos.Users.Put(r.Context(), user); err != nil {
			log.Printf("op=UpdateAvailability err=%v", err)
			http.Error(w, "failed to update availability", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"riderId":        user.RiderID,
			"status":         user.Status,
			"availableUntil": user.AvailableUntil,
		})
	})

	mux.HandleFunc("/api/riders/availability", withCORS(riderAvailabilityList))
	mux.HandleFunc("/api/riders/availability/me", withCORS(riderAvailabilityUpdate))

	// --- Tracking Routes ---
	// HTTP endpoints for location updates
	mux.HandleFunc("/api/tracking/update", withCORS(authClient.RequireAuth(tracking.HandleLocationUpdate)))
	mux.HandleFunc("/api/tracking/locations", withCORS(authClient.RequireAuth(tracking.HandleGetLocations)))
	mux.HandleFunc("/api/tracking/entities", withCORS(authClient.RequireAuth(tracking.HandleGetEntities)))

	// Riders tracking endpoint (FleetManager role required)
	mux.HandleFunc("/api/tracking/riders", withCORS(requireAuthAndRole("FleetManager", tracking.HandleGetRiders)))
	mux.HandleFunc("/api/tracking/riders/ws", withCORS(requireAuthAndRole("FleetManager", tracking.HandleRidersWebSocket)))

	// Geocoding proxy — forwards to Nominatim with a proper server-side User-Agent
	mux.HandleFunc("/api/geocode", withCORS(authClient.RequireAuth(handleGeocode)))

	// WebSocket endpoint for real-time location updates
	// Note: API Gateway REST proxy does not support WebSocket upgrades.
	// We intentionally disable this endpoint and rely on HTTP polling.
	mux.HandleFunc("/api/tracking/ws", withCORS(authClient.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "websocket tracking disabled; use HTTP polling (GET /api/tracking/locations)", http.StatusNotImplemented)
	})))

	// --- Push Notification Routes ---
	if pushStore != nil {
		mux.HandleFunc("/api/push/vapid-key", withCORS(pushStore.HandleVAPIDPublicKey))
		mux.HandleFunc("/api/push/subscribe", withCORS(authClient.RequireAuth(pushStore.HandleSubscribe)))
		mux.HandleFunc("/api/push/unsubscribe", withCORS(authClient.RequireAuth(pushStore.HandleUnsubscribe)))
		mux.HandleFunc("/api/push/test", withCORS(authClient.RequireAuth(pushStore.HandleTestNotification)))
	}

	// --- Auth routes (Cognito) ---
	mux.HandleFunc("/api/auth/signup", withCORS(authClient.SignUpHandler))
	mux.HandleFunc("/api/auth/confirm", withCORS(authClient.ConfirmSignUpHandler))
	mux.HandleFunc("/api/auth/signin", withCORS(authClient.SignInHandler))
	mux.HandleFunc("/api/auth/challenge", withCORS(authClient.RespondToChallengeHandler))
	mux.HandleFunc("/api/auth/admin/create-user", withCORS(authClient.RequireAuth(authClient.AdminCreateUserHandler)))

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

// --- SES email helpers ---

func newSESClient(ctx context.Context) (*sesv2.Client, error) {
	cfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	return sesv2.NewFromConfig(cfg), nil
}

func sendSESEmailWithSignature(ctx context.Context, client *sesv2.Client, to, subject, htmlBody, signatureDataURI string) error {
	fromEmail := os.Getenv("SES_FROM_EMAIL")
	if fromEmail == "" {
		fromEmail = "noreply@bloodbike.app"
	}
	fromHeader := fmt.Sprintf("Blood Bike Ireland <%s>", fromEmail)
	boundary := fmt.Sprintf("----=_Part_%d", time.Now().UnixNano())

	// Extract raw PNG bytes from data URI (data:image/png;base64,XXXXX)
	var sigBytes []byte
	if idx := strings.Index(signatureDataURI, ","); idx >= 0 {
		var err error
		sigBytes, err = base64.StdEncoding.DecodeString(signatureDataURI[idx+1:])
		if err != nil {
			log.Printf("op=SendReceipt warn=bad_signature_base64 err=%v", err)
		}
	}

	// Build raw MIME message
	var msg strings.Builder
	msg.WriteString(fmt.Sprintf("From: %s\r\n", fromHeader))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", to))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString(fmt.Sprintf("Reply-To: %s\r\n", fromEmail))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString(fmt.Sprintf("Content-Type: multipart/related; boundary=\"%s\"\r\n", boundary))
	msg.WriteString("\r\n")

	// HTML part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: 7bit\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)
	msg.WriteString("\r\n")

	// Signature image attachment (inline CID)
	if len(sigBytes) > 0 {
		msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		msg.WriteString("Content-Type: image/png; name=\"signature.png\"\r\n")
		msg.WriteString("Content-Transfer-Encoding: base64\r\n")
		msg.WriteString("Content-Disposition: inline; filename=\"signature.png\"\r\n")
		msg.WriteString("Content-ID: <signature>\r\n")
		msg.WriteString("\r\n")
		// Write base64 in 76-char lines
		b64 := base64.StdEncoding.EncodeToString(sigBytes)
		for i := 0; i < len(b64); i += 76 {
			end := i + 76
			if end > len(b64) {
				end = len(b64)
			}
			msg.WriteString(b64[i:end])
			msg.WriteString("\r\n")
		}
	}

	msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	rawMsg := []byte(msg.String())
	input := &sesv2.SendEmailInput{
		Content: &sestypes.EmailContent{
			Raw: &sestypes.RawMessage{
				Data: rawMsg,
			},
		},
	}
	_, err := client.SendEmail(ctx, input)
	return err
}
