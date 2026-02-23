package tracking

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"
)

// RiderLocation represents a rider's current location and metadata
type RiderLocation struct {
	RiderID    string            `json:"riderId"`
	Name       string            `json:"name"`
	Latitude   float64           `json:"latitude"`
	Longitude  float64           `json:"longitude"`
	Altitude   *float64          `json:"altitude,omitempty"`
	Speed      *float64          `json:"speed,omitempty"`
	Heading    *float64          `json:"heading,omitempty"`
	Accuracy   *float64          `json:"accuracy,omitempty"`
	IsActive   bool              `json:"isActive"`
	LastUpdate string            `json:"lastUpdate"`
}

// HandleGetRiders returns all active riders' locations (HTTP GET)
// Requires: FleetManager role or higher
func HandleGetRiders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	locations := GlobalStore.GetAllLocations()
	riders := make([]RiderLocation, 0)
	
	// Filter for rider entities only
	for _, loc := range locations {
		if loc.EntityType == "rider" {
			riderLoc := RiderLocation{
				RiderID:    loc.EntityID,
				Latitude:   loc.Latitude,
				Longitude:  loc.Longitude,
				Altitude:   loc.Altitude,
				Speed:      loc.Speed,
				Heading:    loc.Heading,
				Accuracy:   loc.Accuracy,
				IsActive:   true,
				LastUpdate: loc.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
			}
			riders = append(riders, riderLoc)
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(riders)
}

// HandleRidersWebSocket upgrades HTTP connection to WebSocket for real-time rider updates
// Filters and broadcasts only rider location updates
// Requires: FleetManager role or higher
func HandleRidersWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// Register client with the store
	client := &Client{
		store: GlobalStore,
		send:  make(chan []byte, 256),
		done:  make(chan struct{}),
	}
	GlobalStore.register <- client
	defer func() { GlobalStore.unregister <- client }()

	// Handle incoming messages (ping/keep-alive)
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	// Send outgoing messages for rider locations only
	for {
		select {
		case msg := <-client.send:
			// Parse message and filter for riders only
			var update LocationUpdate
			if err := json.Unmarshal(msg, &update); err == nil && update.EntityType == "rider" {
				w.Header().Set("Content-Type", "application/json")
				if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					return
				}
			}
		case <-client.done:
			return
		}
	}
}

// RidersWebSocketMessage wraps a location update for WebSocket transmission
type RidersWebSocketMessage struct {
	Type     string           `json:"type"` // "rider_location", "rider_update", etc.
	Location RiderLocation    `json:"location"`
	Timestamp string          `json:"timestamp"`
}
