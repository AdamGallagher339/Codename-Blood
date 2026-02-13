package fleet

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
)

var trackerStore *TrackerStore

var activeUIDRegex = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

func SetTrackerStore(store *TrackerStore) {
	trackerStore = store
}

func FleetListOrCreate(w http.ResponseWriter, r *http.Request) {
	if trackerStore == nil {
		http.Error(w, "fleet tracker not configured", http.StatusNotImplemented)
		return
	}

	switch r.Method {
	case http.MethodGet:
		bikes, err := trackerStore.ListBikes(r.Context())
		if err != nil {
			http.Error(w, "failed to list bikes", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, bikes)
	case http.MethodPost:
		var req CreateFleetBikeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		bikeID := newBikeID()
		if err := validateCreateBike(req, bikeID); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if trackerStore != nil {
			if err := ensureUniqueRegistration(r.Context(), req.Registration, bikeID); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		}

		make := strings.TrimSpace(req.Make)
		model := strings.TrimSpace(req.Model)
		vehicleType := strings.ToLower(strings.TrimSpace(req.VehicleType))
		registration := strings.TrimSpace(req.Registration)
		locationID := strings.TrimSpace(req.LocationID)
		active := "out_of_service" // new vehicles always start out of service

		now := time.Now()
		bike := &FleetBike{
			BikeID:       bikeID,
			Make:         make,
			Model:        model,
			VehicleType:  vehicleType,
			Registration: registration,
			LocationID:   locationID,
			Active:       active,
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		if err := trackerStore.PutBike(r.Context(), bike); err != nil {
			http.Error(w, "failed to save bike", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, bike)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func FleetBikeDetail(w http.ResponseWriter, r *http.Request) {
	if trackerStore == nil {
		http.Error(w, "fleet tracker not configured", http.StatusNotImplemented)
		return
	}

	bikeID, action := parseBikePath(r.URL.Path)
	if bikeID == "" {
		http.NotFound(w, r)
		return
	}

	if action == "service" {
		handleServiceHistory(w, r, bikeID)
		return
	}

	if action == "delete" {
		handleDeleteBike(w, r, bikeID)
		return
	}

	if action == "service-delete" {
		handleDeleteServiceEntry(w, r, bikeID)
		return
	}

	if action == "change-location" {
		handleChangeLocation(w, r, bikeID)
		return
	}

	switch r.Method {
	case http.MethodGet:
		bike, ok, err := trackerStore.GetBike(r.Context(), bikeID)
		if err != nil {
			http.Error(w, "failed to get bike", http.StatusInternalServerError)
			return
		}
		if !ok {
			http.Error(w, "bike not found", http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, bike)
	case http.MethodPatch, http.MethodPut:
		var req UpdateFleetBikeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		bike, ok, err := trackerStore.GetBike(r.Context(), bikeID)
		if err != nil {
			http.Error(w, "failed to get bike", http.StatusInternalServerError)
			return
		}
		if !ok {
			http.Error(w, "bike not found", http.StatusNotFound)
			return
		}

		// Make, Model, VehicleType, Registration, and LocationID are immutable after creation
		if req.Active != nil {
			active := strings.TrimSpace(*req.Active)
			if active != "ready" && active != "out_of_service" {
				http.Error(w, "active must be ready or out_of_service", http.StatusBadRequest)
				return
			}
			bike.Active = active
		}
		if err := validateBike(*bike, false); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		bike.UpdatedAt = time.Now()
		if err := trackerStore.PutBike(r.Context(), bike); err != nil {
			http.Error(w, "failed to update bike", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, bike)
	case http.MethodDelete:
		handleDeleteBike(w, r, bikeID)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func handleDeleteBike(w http.ResponseWriter, r *http.Request, bikeID string) {
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if err := trackerStore.DeleteBike(r.Context(), bikeID); err != nil {
		http.Error(w, "failed to delete bike", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func handleDeleteServiceEntry(w http.ResponseWriter, r *http.Request, bikeID string) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		ServiceID string `json:"serviceId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.ServiceID) == "" {
		http.Error(w, "serviceId is required", http.StatusBadRequest)
		return
	}
	if err := trackerStore.DeleteServiceEntry(r.Context(), bikeID, req.ServiceID); err != nil {
		http.Error(w, "failed to delete service entry", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func handleChangeLocation(w http.ResponseWriter, r *http.Request, bikeID string) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		LocationID string `json:"locationId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.LocationID) == "" {
		http.Error(w, "locationId is required", http.StatusBadRequest)
		return
	}

	bike, ok, err := trackerStore.GetBike(r.Context(), bikeID)
	if err != nil {
		http.Error(w, "failed to get bike", http.StatusInternalServerError)
		return
	}
	if !ok {
		http.Error(w, "bike not found", http.StatusNotFound)
		return
	}

	bike.LocationID = strings.TrimSpace(req.LocationID)
	bike.UpdatedAt = time.Now()

	if err := trackerStore.PutBike(r.Context(), bike); err != nil {
		http.Error(w, "failed to update bike", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, bike)
}

func handleServiceHistory(w http.ResponseWriter, r *http.Request, bikeID string) {
	switch r.Method {
	case http.MethodGet:
		entries, err := trackerStore.ListServiceEntries(r.Context(), bikeID)
		if err != nil {
			http.Error(w, "failed to list service history", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, entries)
	case http.MethodPost:
		var req CreateServiceEntryRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if err := validateServiceEntry(req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		serviceDate, err := parseServiceDate(req.ServiceDate)
		if err != nil {
			http.Error(w, "invalid serviceDate", http.StatusBadRequest)
			return
		}

		now := time.Now()
		entry := &ServiceEntry{
			ServiceID:   newServiceID(),
			BikeID:      bikeID,
			ServiceType: req.ServiceType,
			ServiceDate: serviceDate,
			Notes:       strings.TrimSpace(req.Notes),
			PerformedBy: strings.TrimSpace(req.PerformedBy),
			CreatedAt:   now,
		}

		if err := trackerStore.AddServiceEntry(r.Context(), entry); err != nil {
			http.Error(w, "failed to add service entry", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, entry)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func parseBikePath(path string) (string, string) {
	trimmed := strings.TrimPrefix(path, "/api/fleet/bikes/")
	trimmed = strings.Trim(trimmed, "/")
	if trimmed == "" {
		return "", ""
	}
	parts := strings.Split(trimmed, "/")
	bikeID := parts[0]
	if len(parts) == 1 {
		return bikeID, ""
	}
	return bikeID, parts[1]
}

func validateCreateBike(req CreateFleetBikeRequest, bikeID string) error {
	bike := FleetBike{
		BikeID:       strings.TrimSpace(bikeID),
		Make:         strings.TrimSpace(req.Make),
		Model:        strings.TrimSpace(req.Model),
		VehicleType:  strings.ToLower(strings.TrimSpace(req.VehicleType)),
		Registration: strings.TrimSpace(req.Registration),
		LocationID:   strings.TrimSpace(req.LocationID),
		Active:       strings.TrimSpace(req.Active),
	}
	return validateBike(bike, true)
}

func validateBike(bike FleetBike, requireAll bool) error {
	if bike.BikeID == "" {
		return errors.New("bikeId required")
	}
	if requireAll && bike.Make == "" {
		return errors.New("make required")
	}
	if bike.Model == "" {
		return errors.New("model required")
	}
	if requireAll && bike.Registration == "" {
		return errors.New("registration required")
	}
	if requireAll && bike.VehicleType == "" {
		return errors.New("vehicleType required")
	}
	if bike.LocationID == "" {
		return errors.New("locationId required")
	}
	if bike.Active == "" {
		return errors.New("active required")
	}
	if bike.VehicleType != "" {
		if bike.VehicleType != "car" && bike.VehicleType != "motorcycle" {
			return errors.New("vehicleType must be car or motorcycle")
		}
	}
	if bike.Active != "ready" && bike.Active != "out_of_service" && !activeUIDRegex.MatchString(bike.Active) {
		return errors.New("active must be ready, out_of_service, or a rider UID")
	}
	return nil
}

func validateServiceEntry(req CreateServiceEntryRequest) error {
	if req.ServiceType == "" {
		return errors.New("serviceType required")
	}
	if _, ok := validServiceTypes[req.ServiceType]; !ok {
		return errors.New("invalid serviceType")
	}
	return nil
}

func ensureUniqueRegistration(ctx context.Context, registration string, currentBikeID string) error {
	reg := strings.TrimSpace(registration)
	if reg == "" || trackerStore == nil {
		return nil
	}

	match, err := trackerStore.FindBikeByRegistration(ctx, reg)
	if err != nil {
		return errors.New("failed to validate registration")
	}
	if match != nil && match.BikeID != currentBikeID {
		return errors.New("registration must be unique")
	}
	return nil
}

func parseServiceDate(value string) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return time.Now(), nil
	}

	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t, nil
	}

	if t, err := time.Parse("2006-01-02", value); err == nil {
		return t, nil
	}

	return time.Time{}, errors.New("invalid date")
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
