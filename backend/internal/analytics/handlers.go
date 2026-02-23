package analytics

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/auth"
)

// HandleGetAnalytics serves:
//   GET /api/analytics/          → list of rider IDs (FleetManager/Dispatcher only)
//   GET /api/analytics/{riderId} → summary + speed history for that rider
func HandleGetAnalytics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	riderID := strings.TrimPrefix(r.URL.Path, "/api/analytics/")
	riderID = strings.Trim(riderID, "/")

	roles := auth.RolesFromContext(r.Context())
	isManager := auth.HasRoleOrAbove(roles, "FleetManager")

	if riderID == "" {
		// Return list of all tracked rider IDs — managers/dispatchers only.
		if !isManager {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		ids := GlobalStore.AllRiderIDs()
		if ids == nil {
			ids = []string{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ids)
		return
	}

	// Auth check: fleet_manager/dispatcher can see anyone; riders see own data only.
	if !isManager {
		username := auth.UsernameFromContext(r.Context())
		if username == "" || username != riderID {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	summary, found := GlobalStore.GetSummary(riderID)
	if !found {
		// No data yet — return an empty summary rather than 404.
		summary = RiderSummary{
			RiderID:      riderID,
			SpeedHistory: []SpeedPoint{},
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}
