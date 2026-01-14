package tracking

import "time"

// LocationUpdate represents a GPS location update from a tracked entity (bike/rider)
type LocationUpdate struct {
	EntityID    string    `json:"entityId"`    // ID of the bike or rider being tracked
	EntityType  string    `json:"entityType"`  // "bike" or "rider"
	Latitude    float64   `json:"latitude"`    // GPS latitude (-90 to 90)
	Longitude   float64   `json:"longitude"`   // GPS longitude (-180 to 180)
	Altitude    *float64  `json:"altitude,omitempty"`    // Optional altitude in meters
	Speed       *float64  `json:"speed,omitempty"`       // Optional speed in km/h
	Heading     *float64  `json:"heading,omitempty"`     // Optional heading in degrees (0-360)
	Accuracy    *float64  `json:"accuracy,omitempty"`    // Optional accuracy in meters
	Timestamp   time.Time `json:"timestamp"`   // When the location was recorded
	UpdatedAt   time.Time `json:"updatedAt"`   // When this update was received by server
}

// LocationUpdateRequest represents the incoming location update from a client
type LocationUpdateRequest struct {
	EntityID   string   `json:"entityId"`
	EntityType string   `json:"entityType"`
	Latitude   float64  `json:"latitude"`
	Longitude  float64  `json:"longitude"`
	Altitude   *float64 `json:"altitude,omitempty"`
	Speed      *float64 `json:"speed,omitempty"`
	Heading    *float64 `json:"heading,omitempty"`
	Accuracy   *float64 `json:"accuracy,omitempty"`
	Timestamp  *time.Time `json:"timestamp,omitempty"` // Optional, server will use current time if not provided
}

// TrackedEntity represents metadata about an entity being tracked
type TrackedEntity struct {
	EntityID       string         `json:"entityId"`
	EntityType     string         `json:"entityType"`
	Name           string         `json:"name"`
	LastLocation   *LocationUpdate `json:"lastLocation,omitempty"`
	IsActive       bool           `json:"isActive"`       // Whether actively being tracked
	LastUpdateTime time.Time      `json:"lastUpdateTime"`
}

// ValidateCoordinates checks if latitude and longitude are within valid ranges
func ValidateCoordinates(lat, lon float64) bool {
	return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}
