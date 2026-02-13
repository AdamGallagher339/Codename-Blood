package repo

import (
	"context"
	"time"
)

// NOTE: These models intentionally align with existing API JSON shapes
// so the Angular frontend doesn't break.

type User struct {
	RiderID   string    `json:"riderId"`
	Name      string    `json:"name,omitempty"`
	Email     string    `json:"email,omitempty"`
	Tags      []string  `json:"tags,omitempty"`
	UpdatedAt time.Time `json:"updatedAt,omitempty"`
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
