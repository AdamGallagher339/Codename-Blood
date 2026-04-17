package issuereports

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

// ListOrCreate handles GET /api/issue-reports and POST /api/issue-reports
func ListOrCreate(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := List(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		var req CreateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			log.Printf("[issue-reports] failed to decode create request: %v", err)
			http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
			return
		}
		ir, err := Create(r.Context(), req)
		if err != nil {
			if isValidationError(err) {
				http.Error(w, err.Error(), http.StatusBadRequest)
			} else {
				log.Printf("[issue-reports] failed to create: %v", err)
				http.Error(w, "internal server error", http.StatusInternalServerError)
			}
			return
		}
		writeJSON(w, http.StatusCreated, ir)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// Detail handles GET/PUT/DELETE /api/issue-reports/{id}
func Detail(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/issue-reports/")
	id = strings.Trim(id, "/")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	switch r.Method {
	case http.MethodGet:
		ir, ok, err := Get(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if !ok {
			http.Error(w, "issue report not found", http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, ir)
	case http.MethodPut:
		// PUT resolves the issue
		ir, err := Resolve(r.Context(), id)
		if err != nil {
			if err.Error() == "not found" {
				http.Error(w, "issue report not found", http.StatusNotFound)
				return
			}
			log.Printf("[issue-reports] failed to resolve %s: %v", id, err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, ir)
	case http.MethodDelete:
		ok, err := Delete(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if !ok {
			http.Error(w, "issue report not found", http.StatusNotFound)
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
	return msg == "bikeId required" || msg == "description required"
}
