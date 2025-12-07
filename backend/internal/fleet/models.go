package fleet

import "time"

// Single motorcycle in the fleet
type Motorcycle struct {
    ID              string    `json:"id"`               // e.g. "BB21-WES"
    Model           string    `json:"model"`            // e.g. "Honda Pan European"
    Depot           string    `json:"depot"`            // e.g. "Galway"
    Mileage         int       `json:"mileage"`          // last known mileage
    LastServiceMiles int      `json:"lastServiceMiles"` // mileage when last serviced
    LastServiceDate time.Time `json:"lastServiceDate"`
    Status          string    `json:"status"`           // Available, OnDuty, InService, FaultReported
    CurrentRiderID  string    `json:"currentRiderId"`   // set when rider scans QR
    LocationLat     float64   `json:"locationLat"`
    LocationLng     float64   `json:"locationLng"`
    UpdatedAt       time.Time `json:"updatedAt"`
}

// Record rider sessions after QR scan
type RideSession struct {
    SessionID  string    `json:"sessionId"`
    RiderID    string    `json:"riderId"`
    BikeID     string    `json:"bikeId"`
    Depot      string    `json:"depot"`
    StartTime  time.Time `json:"startTime"`
    EndTime    time.Time `json:"endTime"`
    StartMiles int       `json:"startMiles"`
    EndMiles   int       `json:"endMiles"`
}

// Issue reports sent from riders
type IssueReport struct {
    IssueID     string    `json:"issueId"`
    BikeID      string    `json:"bikeId"`
    RiderID     string    `json:"riderId"`
    Type        string    `json:"type"`    // "Minor" or "Major"
    Description string    `json:"description"`
    Timestamp   time.Time `json:"timestamp"`
    Resolved    bool      `json:"resolved"`
}

// User represents a rider/team member in the system.
// For now this is an in-memory representation keyed by RiderID.
type User struct {
    RiderID   string    `json:"riderId"`
    Name      string    `json:"name,omitempty"`
    Tags      []string  `json:"tags"`
    UpdatedAt time.Time `json:"updatedAt"`
}

// AddTag adds a tag to the user if it doesn't already exist.
func (u *User) AddTag(tag string) {
    for _, t := range u.Tags {
        if t == tag {
            return
        }
    }
    u.Tags = append(u.Tags, tag)
    u.UpdatedAt = time.Now()
}

// RemoveTag removes a tag from the user if present.
func (u *User) RemoveTag(tag string) {
    out := u.Tags[:0]
    for _, t := range u.Tags {
        if t == tag {
            continue
        }
        out = append(out, t)
    }
    u.Tags = out
    u.UpdatedAt = time.Now()
}
