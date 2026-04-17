package ridesessions

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

// ListOrCreate handles GET /api/ride-sessions and POST /api/ride-sessions
func ListOrCreate(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		bikeID := r.URL.Query().Get("bikeId")
		if bikeID != "" {
			items, err := ListByBike(r.Context(), bikeID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, items)
			return
		}
		items, err := List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		var req CreateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			log.Printf("[ride-sessions] failed to decode create request: %v", err)
			http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
			return
		}
		s, err := Create(r.Context(), req)
		if err != nil {
			if isValidationError(err) {
				http.Error(w, err.Error(), http.StatusBadRequest)
			} else {
				log.Printf("[ride-sessions] failed to create: %v", err)
				http.Error(w, "internal server error", http.StatusInternalServerError)
			}
			return
		}
		writeJSON(w, http.StatusCreated, s)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// Detail handles GET/PUT/DELETE /api/ride-sessions/{id}
func Detail(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/ride-sessions/")
	id = strings.Trim(id, "/")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		s, ok, err := Get(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if !ok {
			http.Error(w, "ride session not found", http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, s)
	case http.MethodPut:
		var req EndRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		s, err := EndSession(r.Context(), id, req)
		if err != nil {
			if err.Error() == "not found" {
				http.Error(w, "ride session not found", http.StatusNotFound)
				return
			}
			log.Printf("[ride-sessions] failed to end session %s: %v", id, err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, s)
	case http.MethodDelete:
		ok, err := Delete(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if !ok {
			http.Error(w, "ride session not found", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func isValidationError(err error) bool {
	msg := err.Error()
	return msg == "bikeId required" || msg == "riderId required"
}
