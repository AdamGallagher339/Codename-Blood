package fleet

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/auth"
)

// In-memory storage for now — will replace with DynamoDB in AWS step
var bikes = make(map[string]*Motorcycle)
var users = make(map[string]*User)

func GetAllBikes(w http.ResponseWriter, r *http.Request) {
	list := []*Motorcycle{}
	for _, b := range bikes {
		list = append(list, b)
	}
	json.NewEncoder(w).Encode(list)
}

func RegisterBike(w http.ResponseWriter, r *http.Request) {
	var m Motorcycle
	json.NewDecoder(r.Body).Decode(&m)
	m.UpdatedAt = time.Now()
	bikes[m.ID] = &m
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(m)
}

func StartRide(w http.ResponseWriter, r *http.Request) {
	bikeID := r.URL.Query().Get("bikeId")
	rider := r.URL.Query().Get("riderId")

	b, exists := bikes[bikeID]
	if !exists {
		http.Error(w, "Bike not found", 404)
		return
	}

	b.CurrentRiderID = rider
	b.Status = "OnDuty"
	b.UpdatedAt = time.Now()

	json.NewEncoder(w).Encode(b)
}

func EndRide(w http.ResponseWriter, r *http.Request) {
	bikeID := r.URL.Query().Get("bikeId")

	b, exists := bikes[bikeID]
	if !exists {
		http.Error(w, "Bike not found", 404)
		return
	}

	b.CurrentRiderID = ""
	b.Status = "Available"
	b.UpdatedAt = time.Now()

	json.NewEncoder(w).Encode(b)
}

// --- User / Tag management ---
func GetAllUsers(w http.ResponseWriter, r *http.Request) {
	list := []*User{}
	for _, u := range users {
		list = append(list, u)
	}
	json.NewEncoder(w).Encode(list)
}

func RegisterUser(w http.ResponseWriter, r *http.Request) {
	// Only allow admins to register users
	if !isAdminRequest(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if u.RiderID == "" {
		http.Error(w, "riderId required", http.StatusBadRequest)
		return
	}
	u.UpdatedAt = time.Now()
	users[u.RiderID] = &u
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(u)
}

// AddTagToUser expects JSON body: { "riderId": "123", "tag": "Admin" }
func AddTagToUser(w http.ResponseWriter, r *http.Request) {
	// Only allow admins to add tags
	if !isAdminRequest(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var body struct {
		RiderID string `json:"riderId"`
		Tag     string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.RiderID == "" || body.Tag == "" {
		http.Error(w, "riderId and tag required", http.StatusBadRequest)
		return
	}
	u, ok := users[body.RiderID]
	if !ok {
		// auto-register a minimal user for convenience
		u = &User{RiderID: body.RiderID}
		users[body.RiderID] = u
	}
	u.AddTag(body.Tag)
	json.NewEncoder(w).Encode(u)
}

// RemoveTagFromUser expects JSON body: { "riderId": "123", "tag": "Admin" }
func RemoveTagFromUser(w http.ResponseWriter, r *http.Request) {
	// Only allow admins to remove tags
	if !isAdminRequest(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var body struct {
		RiderID string `json:"riderId"`
		Tag     string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	u, ok := users[body.RiderID]
	if !ok {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	u.RemoveTag(body.Tag)
	json.NewEncoder(w).Encode(u)
}

func GetUser(w http.ResponseWriter, r *http.Request) {
	rider := r.URL.Query().Get("riderId")
	if rider == "" {
		http.Error(w, "riderId required", http.StatusBadRequest)
		return
	}
	u, ok := users[rider]
	if !ok {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(u)
}

// isAdminRequest returns true if the request context has auth claims with an admin role.
func isAdminRequest(r *http.Request) bool {
	claims := auth.ClaimsFromContext(r.Context())
	if claims == nil {
		return false
	}
	if raw, ok := claims["cognito:groups"]; ok {
		switch v := raw.(type) {
		case []any:
			for _, item := range v {
				if s, ok := item.(string); ok {
					if s == "admin" || s == "Admin" || s == "BloodBikeAdmin" {
						return true
					}
				}
			}
		case []string:
			for _, s := range v {
				if s == "admin" || s == "Admin" || s == "BloodBikeAdmin" {
					return true
				}
			}
		case string:
			if v == "admin" || v == "Admin" || v == "BloodBikeAdmin" {
				return true
			}
		}
	}
	return false
}
