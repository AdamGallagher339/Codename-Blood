package tracking

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development - should be restricted in production
		return true
	},
}

// Global store instance (initialized in main.go)
var GlobalStore *Store

// HandleLocationUpdate processes incoming location updates (HTTP POST)
func HandleLocationUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LocationUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.EntityID == "" || req.EntityType == "" {
		http.Error(w, "entityId and entityType are required", http.StatusBadRequest)
		return
	}

	// Validate coordinates
	if !ValidateCoordinates(req.Latitude, req.Longitude) {
		http.Error(w, "invalid coordinates", http.StatusBadRequest)
		return
	}

	// Validate entity type
	if req.EntityType != "bike" && req.EntityType != "rider" {
		http.Error(w, "entityType must be 'bike' or 'rider'", http.StatusBadRequest)
		return
	}

	// Use provided timestamp or current time
	timestamp := time.Now()
	if req.Timestamp != nil {
		timestamp = *req.Timestamp
	}

	// Create location update
	update := &LocationUpdate{
		EntityID:   req.EntityID,
		EntityType: req.EntityType,
		Latitude:   req.Latitude,
		Longitude:  req.Longitude,
		Altitude:   req.Altitude,
		Speed:      req.Speed,
		Heading:    req.Heading,
		Accuracy:   req.Accuracy,
		Timestamp:  timestamp,
		UpdatedAt:  time.Now(),
	}

	// Store and broadcast the update
	GlobalStore.UpdateLocation(update)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "location updated",
	})
}

// HandleGetLocations returns all active locations (HTTP GET)
func HandleGetLocations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	locations := GlobalStore.GetAllLocations()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(locations)
}

// HandleGetEntities returns all tracked entities (HTTP GET)
func HandleGetEntities(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	entities := GlobalStore.GetAllEntities()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entities)
}

// HandleWebSocket upgrades HTTP connection to WebSocket for real-time updates
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}

	client := &Client{
		store: GlobalStore,
		send:  make(chan []byte, 256),
		done:  make(chan struct{}),
	}

	GlobalStore.RegisterClient(client)

	// Send current locations on connection
	go func() {
		locations := GlobalStore.GetAllLocations()
		if data, err := json.Marshal(map[string]interface{}{
			"type":      "initial",
			"locations": locations,
		}); err == nil {
			select {
			case client.send <- data:
			case <-time.After(time.Second):
			}
		}
	}()

	// Start goroutines for reading and writing
	go client.writePump(conn)
	go client.readPump(conn)
}

// readPump handles incoming WebSocket messages from client
func (c *Client) readPump(conn *websocket.Conn) {
	defer func() {
		c.store.UnregisterClient(c)
		conn.Close()
		close(c.done)
	}()

	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("websocket error: %v", err)
			}
			break
		}

		// Handle incoming messages (e.g., location updates from client)
		var req LocationUpdateRequest
		if err := json.Unmarshal(message, &req); err == nil {
			if req.EntityID != "" && ValidateCoordinates(req.Latitude, req.Longitude) {
				timestamp := time.Now()
				if req.Timestamp != nil {
					timestamp = *req.Timestamp
				}

				update := &LocationUpdate{
					EntityID:   req.EntityID,
					EntityType: req.EntityType,
					Latitude:   req.Latitude,
					Longitude:  req.Longitude,
					Altitude:   req.Altitude,
					Speed:      req.Speed,
					Heading:    req.Heading,
					Accuracy:   req.Accuracy,
					Timestamp:  timestamp,
					UpdatedAt:  time.Now(),
				}

				c.store.UpdateLocation(update)
			}
		}
	}
}

// writePump handles outgoing WebSocket messages to client
func (c *Client) writePump(conn *websocket.Conn) {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		conn.Close()
	}()

	for {
		select {
		case <-c.done:
			return
			
		case message, ok := <-c.send:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}

			if message != nil {
				w.Write(message)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// BroadcastLocationUpdate sends a location update to all connected WebSocket clients
// This is called internally by the store
func BroadcastLocationUpdate(update *LocationUpdate) {
	data, err := json.Marshal(map[string]interface{}{
		"type":     "update",
		"location": update,
	})
	if err != nil {
		log.Printf("error marshaling location update: %v", err)
		return
	}

	// Send to all clients via store
	GlobalStore.mu.RLock()
	defer GlobalStore.mu.RUnlock()

	for client := range GlobalStore.clients {
		select {
		case client.send <- data:
		default:
			// Client is slow, skip
		}
	}
}
