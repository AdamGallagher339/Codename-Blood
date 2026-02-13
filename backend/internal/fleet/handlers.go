package fleet

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/auth"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
)

func ensureBikeRepo() (repo.BikesRepository, error) {
	if bikesRepo == nil {
		return nil, errors.New("bike repository not configured (set BIKES_TABLE)")
	}
	return bikesRepo, nil
}

func ensureUserRepo() (repo.UsersRepository, error) {
	if usersRepo == nil {
		return nil, errors.New("users repository not configured (set USERS_TABLE)")
	}
	return usersRepo, nil
}

func repoBikeToAPI(b repo.Bike) Motorcycle {
	return Motorcycle{
		ID:               b.ID,
		Model:            b.Model,
		Depot:            b.Depot,
		Mileage:          b.Mileage,
		LastServiceMiles: b.LastServiceMiles,
		LastServiceDate:  b.LastServiceDate,
		Status:           b.Status,
		CurrentRiderID:   b.CurrentRiderID,
		LocationLat:      b.LocationLat,
		LocationLng:      b.LocationLng,
		UpdatedAt:        b.UpdatedAt,
	}
}

func apiBikeToRepo(m Motorcycle) repo.Bike {
	return repo.Bike{
		ID:               m.ID,
		Model:            m.Model,
		Depot:            m.Depot,
		Mileage:          m.Mileage,
		LastServiceMiles: m.LastServiceMiles,
		LastServiceDate:  m.LastServiceDate,
		Status:           m.Status,
		CurrentRiderID:   m.CurrentRiderID,
		LocationLat:      m.LocationLat,
		LocationLng:      m.LocationLng,
		UpdatedAt:        m.UpdatedAt,
	}
}

func repoUserToAPI(u repo.User) User {
	return User{RiderID: u.RiderID, Name: u.Name, Tags: u.Tags, UpdatedAt: u.UpdatedAt}
}

func apiUserToRepo(u User) repo.User {
	return repo.User{RiderID: u.RiderID, Name: u.Name, Tags: u.Tags, UpdatedAt: u.UpdatedAt}
}

func GetAllBikes(w http.ResponseWriter, r *http.Request) {
	repoBikes, err := ensureBikeRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	list, err := repoBikes.List(r.Context())
	if err != nil {
		log.Printf("op=GetAllBikes err=%v", err)
		http.Error(w, "failed to list bikes", http.StatusInternalServerError)
		return
	}
	apiList := make([]Motorcycle, 0, len(list))
	for _, b := range list {
		apiList = append(apiList, repoBikeToAPI(b))
	}
	json.NewEncoder(w).Encode(apiList)
}

func RegisterBike(w http.ResponseWriter, r *http.Request) {
	repoBikes, err := ensureBikeRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	var m Motorcycle
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if m.ID == "" {
		http.Error(w, "id required", http.StatusBadRequest)
		return
	}
	m.UpdatedAt = time.Now()
	if err := repoBikes.Put(r.Context(), ptr(apiBikeToRepo(m))); err != nil {
		log.Printf("op=RegisterBike bikeId=%s err=%v", m.ID, err)
		http.Error(w, "failed to register bike", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(m)
}

func StartRide(w http.ResponseWriter, r *http.Request) {
	repoBikes, err := ensureBikeRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	bikeID := r.URL.Query().Get("bikeId")
	rider := r.URL.Query().Get("riderId")

	b, ok, err := repoBikes.Get(r.Context(), bikeID)
	if err != nil {
		log.Printf("op=StartRide bikeId=%s err=%v", bikeID, err)
		http.Error(w, "failed to get bike", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "Bike not found", 404)
		return
	}

	b.CurrentRiderID = rider
	b.Status = "OnDuty"
	b.UpdatedAt = time.Now()
	if err := repoBikes.Put(r.Context(), b); err != nil {
		log.Printf("op=StartRidePut bikeId=%s err=%v", bikeID, err)
		http.Error(w, "failed to update bike", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(repoBikeToAPI(*b))
}

func EndRide(w http.ResponseWriter, r *http.Request) {
	repoBikes, err := ensureBikeRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	bikeID := r.URL.Query().Get("bikeId")

	b, ok, err := repoBikes.Get(r.Context(), bikeID)
	if err != nil {
		log.Printf("op=EndRide bikeId=%s err=%v", bikeID, err)
		http.Error(w, "failed to get bike", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "Bike not found", 404)
		return
	}

	b.CurrentRiderID = ""
	b.Status = "Available"
	b.UpdatedAt = time.Now()
	if err := repoBikes.Put(r.Context(), b); err != nil {
		log.Printf("op=EndRidePut bikeId=%s err=%v", bikeID, err)
		http.Error(w, "failed to update bike", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(repoBikeToAPI(*b))
}

// --- User / Tag management ---
func GetAllUsers(w http.ResponseWriter, r *http.Request) {
	repoUsers, err := ensureUserRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	list, err := repoUsers.List(r.Context())
	if err != nil {
		log.Printf("op=GetAllUsers err=%v", err)
		http.Error(w, "failed to list users", http.StatusInternalServerError)
		return
	}
	apiList := make([]User, 0, len(list))
	for _, u := range list {
		apiList = append(apiList, repoUserToAPI(u))
	}
	json.NewEncoder(w).Encode(apiList)
}

func RegisterUser(w http.ResponseWriter, r *http.Request) {
	repoUsers, err := ensureUserRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	// Register or update a fleet user record
	// Called during account creation process (after auth signup)
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
	if err := repoUsers.Put(r.Context(), ptr(apiUserToRepo(u))); err != nil {
		log.Printf("op=RegisterUser riderId=%s err=%v", u.RiderID, err)
		http.Error(w, "failed to register user", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(u)
}

// AddTagToUser expects JSON body: { "riderId": "123", "tag": "Admin" }
func AddTagToUser(w http.ResponseWriter, r *http.Request) {
	repoUsers, err := ensureUserRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

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
	u, ok, err := repoUsers.Get(r.Context(), body.RiderID)
	if err != nil {
		log.Printf("op=AddTagGet riderId=%s err=%v", body.RiderID, err)
		http.Error(w, "failed to get user", http.StatusInternalServerError)
		return
	}
	apiUser := User{RiderID: body.RiderID}
	if ok {
		apiUser = repoUserToAPI(*u)
	}
	apiUser.AddTag(body.Tag)
	if err := repoUsers.Put(r.Context(), ptr(apiUserToRepo(apiUser))); err != nil {
		log.Printf("op=AddTagPut riderId=%s err=%v", body.RiderID, err)
		http.Error(w, "failed to update user", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(apiUser)
}

// RemoveTagFromUser expects JSON body: { "riderId": "123", "tag": "Admin" }
func RemoveTagFromUser(w http.ResponseWriter, r *http.Request) {
	repoUsers, err := ensureUserRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

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
	u, ok, err := repoUsers.Get(r.Context(), body.RiderID)
	if err != nil {
		log.Printf("op=RemoveTagGet riderId=%s err=%v", body.RiderID, err)
		http.Error(w, "failed to get user", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	apiUser := repoUserToAPI(*u)
	apiUser.RemoveTag(body.Tag)
	if err := repoUsers.Put(r.Context(), ptr(apiUserToRepo(apiUser))); err != nil {
		log.Printf("op=RemoveTagPut riderId=%s err=%v", body.RiderID, err)
		http.Error(w, "failed to update user", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(apiUser)
}

func GetUser(w http.ResponseWriter, r *http.Request) {
	repoUsers, err := ensureUserRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	rider := r.URL.Query().Get("riderId")
	if rider == "" {
		http.Error(w, "riderId required", http.StatusBadRequest)
		return
	}
	u, ok, err := repoUsers.Get(r.Context(), rider)
	if err != nil {
		log.Printf("op=GetUser riderId=%s err=%v", rider, err)
		http.Error(w, "failed to get user", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(repoUserToAPI(*u))
}

// InitializeUserRoles is used immediately after account creation to assign roles.
// Expects JSON body: { "riderId": "user123", "roles": ["Rider", "Dispatcher"] }
func InitializeUserRoles(w http.ResponseWriter, r *http.Request) {
	repoUsers, err := ensureUserRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	// Only allow admins to initialize roles
	if !isAdminRequest(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var body struct {
		RiderID string   `json:"riderId"`
		Roles   []string `json:"roles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.RiderID == "" {
		http.Error(w, "riderId required", http.StatusBadRequest)
		return
	}

	u, ok, err := repoUsers.Get(r.Context(), body.RiderID)
	if err != nil {
		log.Printf("op=InitializeUserRolesGet riderId=%s err=%v", body.RiderID, err)
		http.Error(w, "failed to get user", http.StatusInternalServerError)
		return
	}
	apiUser := User{RiderID: body.RiderID}
	if ok {
		apiUser = repoUserToAPI(*u)
	}
	apiUser.Tags = []string{}
	for _, role := range body.Roles {
		apiUser.AddTag(role)
	}

	// Sync roles to Cognito groups (best-effort but fail the call if it errors).
	if cognitoGroups != nil {
		if err := cognitoGroups.SetUserGroups(r.Context(), body.RiderID, body.Roles); err != nil {
			log.Printf("op=InitializeUserRolesCognito riderId=%s err=%v", body.RiderID, err)
			http.Error(w, "failed to sync roles to cognito", http.StatusBadGateway)
			return
		}
	}

	if err := repoUsers.Put(r.Context(), ptr(apiUserToRepo(apiUser))); err != nil {
		log.Printf("op=InitializeUserRolesPut riderId=%s err=%v", body.RiderID, err)
		http.Error(w, "failed to update user roles", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(apiUser)
}

// DeleteUser deletes a user from the fleet (admin only)
// Expects JSON body: { "riderId": "user123" }
// HandleUserDetail handles PUT and DELETE for individual users at /api/users/{username}
func HandleUserDetail(w http.ResponseWriter, r *http.Request) {
	// Extract username from path: /api/users/{username}
	path := r.URL.Path
	const prefix = "/api/users/"
	if len(path) <= len(prefix) {
		http.Error(w, "username required", http.StatusBadRequest)
		return
	}
	username := path[len(prefix):]

	switch r.Method {
	case http.MethodPut:
		// Update user roles
		handleUpdateUserRolesRESTful(w, r, username)
	case http.MethodDelete:
		// Delete user
		handleDeleteUserRESTful(w, r, username)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleUpdateUserRolesRESTful handles PUT /api/users/{username}/roles
func handleUpdateUserRolesRESTful(w http.ResponseWriter, r *http.Request, username string) {
	repoUsers, err := ensureUserRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	// Only allow admins to update roles
	if !isAdminRequest(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var body struct {
		Roles []string `json:"roles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Sync roles to Cognito groups first (roles used by tokens/guards)
	if cognitoGroups != nil {
		if err := cognitoGroups.SetUserGroups(r.Context(), username, body.Roles); err != nil {
			log.Printf("op=UpdateUserRolesCognito riderId=%s err=%v", username, err)
			http.Error(w, "failed to sync roles to cognito", http.StatusBadGateway)
			return
		}
	}

	u, ok, err := repoUsers.Get(r.Context(), username)
	if err != nil {
		log.Printf("op=UpdateUserRolesGet riderId=%s err=%v", username, err)
		http.Error(w, "failed to get user", http.StatusInternalServerError)
		return
	}
	apiUser := User{RiderID: username}
	if ok {
		apiUser = repoUserToAPI(*u)
	}
	apiUser.Tags = []string{}
	for _, role := range body.Roles {
		apiUser.AddTag(role)
	}

	if err := repoUsers.Put(r.Context(), ptr(apiUserToRepo(apiUser))); err != nil {
		log.Printf("op=UpdateUserRolesPut riderId=%s err=%v", username, err)
		http.Error(w, "failed to update user roles", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(apiUser)
}

// handleDeleteUserRESTful handles DELETE /api/users/{username}
func handleDeleteUserRESTful(w http.ResponseWriter, r *http.Request, username string) {
	repoUsers, err := ensureUserRepo()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	// Only allow admins to delete
	if !isAdminRequest(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	// Delete from Cognito first
	if cognitoGroups != nil {
		if err := cognitoGroups.DeleteUser(r.Context(), username); err != nil {
			log.Printf("op=DeleteCognitoUser riderId=%s err=%v", username, err)
			http.Error(w, fmt.Sprintf("failed to delete cognito user: %v", err), http.StatusInternalServerError)
			return
		}
	}

	// Then delete from DynamoDB
	_, err = repoUsers.Delete(r.Context(), username)
	if err != nil {
		log.Printf("op=DeleteUser riderId=%s err=%v", username, err)
		http.Error(w, "failed to delete user from database", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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


func ptr[T any](v T) *T {
	return &v
}
