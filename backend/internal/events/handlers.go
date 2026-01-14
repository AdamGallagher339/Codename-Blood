package events

import (
	"encoding/json"
	"net/http"
	"strings"
)

func ListOrCreate(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, List())
	case http.MethodPost:
		var req CreateEventRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		e, err := Create(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusCreated, e)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func GetUpdateOrDelete(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/events/")
	id = strings.Trim(id, "/")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		e, ok := Get(id)
		if !ok {
			http.Error(w, "event not found", http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, e)
	case http.MethodPut, http.MethodPatch:
		var req UpdateEventRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		e, err := Update(id, req)
		if err != nil {
			if err.Error() == "not found" {
				http.Error(w, "event not found", http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusOK, e)
	case http.MethodDelete:
		if ok := Delete(id); !ok {
			http.Error(w, "event not found", http.StatusNotFound)
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
