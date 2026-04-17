package repo

import (
	"context"
	"time"
)

// NOTE: These models intentionally align with existing API JSON shapes
// so the Angular frontend doesn't break.

type User struct {
	RiderID        string    `json:"riderId"`
	Name           string    `json:"name,omitempty"`
	Email          string    `json:"email,omitempty"`
	Tags           []string  `json:"tags,omitempty"`
	Status         string    `json:"status,omitempty"`
	AvailableUntil string    `json:"availableUntil,omitempty"`
	CurrentJobID   string    `json:"currentJobId,omitempty"`
	UpdatedAt      time.Time `json:"updatedAt,omitempty"`
}

type UsersRepository interface {
	List(ctx context.Context) ([]User, error)
	Get(ctx context.Context, riderID string) (*User, bool, error)
	Put(ctx context.Context, u *User) error
	Delete(ctx context.Context, riderID string) (bool, error)
}

// Bike is aligned with internal/fleet.Motorcycle JSON.
type Bike struct {
	ID               string    `json:"id"`
	Model            string    `json:"model,omitempty"`
	Depot            string    `json:"depot,omitempty"`
	Mileage          int       `json:"mileage,omitempty"`
	LastServiceMiles int       `json:"lastServiceMiles,omitempty"`
	LastServiceDate  time.Time `json:"lastServiceDate,omitempty"`
	Status           string    `json:"status,omitempty"`
	CurrentRiderID   string    `json:"currentRiderId,omitempty"`
	LocationLat      float64   `json:"locationLat,omitempty"`
	LocationLng      float64   `json:"locationLng,omitempty"`
	UpdatedAt        time.Time `json:"updatedAt,omitempty"`
}

type BikesRepository interface {
	List(ctx context.Context) ([]Bike, error)
	Get(ctx context.Context, bikeID string) (*Bike, bool, error)
	Put(ctx context.Context, b *Bike) error
	Delete(ctx context.Context, bikeID string) (bool, error)
}

// These are included for forward compatibility; the backend currently
// doesn't expose depot/job endpoints.

type Depot struct {
	DepotID string  `json:"depotId"`
	Name    string  `json:"name,omitempty"`
	Lat     float64 `json:"lat,omitempty"`
	Lng     float64 `json:"lng,omitempty"`
}

type DepotsRepository interface {
	List(ctx context.Context) ([]Depot, error)
	Get(ctx context.Context, depotID string) (*Depot, bool, error)
	Put(ctx context.Context, d *Depot) error
	Delete(ctx context.Context, depotID string) (bool, error)
}

type Job struct {
	JobID      string         `json:"jobId"`
	Title      string         `json:"title,omitempty"`
	Status     string         `json:"status,omitempty"`
	CreatedBy  string         `json:"createdBy,omitempty"`
	AcceptedBy string         `json:"acceptedBy,omitempty"`
	Pickup     map[string]any `json:"pickup,omitempty"`
	Dropoff    map[string]any `json:"dropoff,omitempty"`
	Timestamps map[string]any `json:"timestamps,omitempty"`
}

type JobsRepository interface {
	List(ctx context.Context) ([]Job, error)
	Get(ctx context.Context, jobID string) (*Job, bool, error)
	Put(ctx context.Context, j *Job) error
	Delete(ctx context.Context, jobID string) (bool, error)
}
type Event struct {
	ID             string    `json:"id"             dynamodbav:"id"`
	Title          string    `json:"title"          dynamodbav:"title"`
	Description    string    `json:"description"    dynamodbav:"description"`
	Date           time.Time `json:"date"           dynamodbav:"date"`
	StartTime      string    `json:"startTime"      dynamodbav:"startTime"`
	EndTime        string    `json:"endTime"        dynamodbav:"endTime"`
	Location       string    `json:"location"       dynamodbav:"location"`
	Lat            *float64  `json:"lat,omitempty"  dynamodbav:"lat,omitempty"`
	Lng            *float64  `json:"lng,omitempty"  dynamodbav:"lng,omitempty"`
	Type           string    `json:"type"           dynamodbav:"type"`
	Priority       string    `json:"priority"       dynamodbav:"priority"`
	AssignedRiders []string  `json:"assignedRiders,omitempty" dynamodbav:"assignedRiders,omitempty"`
	Status         string    `json:"status"         dynamodbav:"status"`
	CreatedAt      time.Time `json:"createdAt"      dynamodbav:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"      dynamodbav:"updatedAt"`
}

type EventsRepository interface {
	List(ctx context.Context) ([]Event, error)
	Get(ctx context.Context, eventID string) (*Event, bool, error)
	Put(ctx context.Context, e *Event) error
	Delete(ctx context.Context, eventID string) (bool, error)
}

// ── Ride Sessions ───────────────────────────────────────────────────────

type RideSession struct {
	SessionID  string    `json:"sessionId"  dynamodbav:"SessionID"`
	BikeID     string    `json:"bikeId"     dynamodbav:"BikeID"`
	RiderID    string    `json:"riderId"    dynamodbav:"RiderID"`
	Depot      string    `json:"depot"      dynamodbav:"Depot"`
	StartTime  time.Time `json:"startTime"  dynamodbav:"StartTime"`
	EndTime    time.Time `json:"endTime"    dynamodbav:"EndTime"`
	StartMiles int       `json:"startMiles" dynamodbav:"StartMiles"`
	EndMiles   int       `json:"endMiles"   dynamodbav:"EndMiles"`
}

type RideSessionsRepository interface {
	List(ctx context.Context) ([]RideSession, error)
	Get(ctx context.Context, sessionID string) (*RideSession, bool, error)
	Put(ctx context.Context, s *RideSession) error
	Delete(ctx context.Context, sessionID string) (bool, error)
	ListByBike(ctx context.Context, bikeID string) ([]RideSession, error)
}

// ── Issue Reports ───────────────────────────────────────────────────────

type IssueReport struct {
	IssueID     string    `json:"issueId"     dynamodbav:"IssueID"`
	BikeID      string    `json:"bikeId"      dynamodbav:"BikeID"`
	RiderID     string    `json:"riderId"     dynamodbav:"RiderID"`
	Type        string    `json:"type"        dynamodbav:"Type"`
	Description string    `json:"description" dynamodbav:"Description"`
	Timestamp   time.Time `json:"timestamp"   dynamodbav:"Timestamp"`
	Resolved    bool      `json:"resolved"    dynamodbav:"Resolved"`
}

type IssueReportsRepository interface {
	List(ctx context.Context) ([]IssueReport, error)
	Get(ctx context.Context, issueID string) (*IssueReport, bool, error)
	Put(ctx context.Context, r *IssueReport) error
	Delete(ctx context.Context, issueID string) (bool, error)
}
