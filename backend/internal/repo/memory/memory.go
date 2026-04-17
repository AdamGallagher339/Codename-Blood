// Package memory provides in-memory implementations of the repo interfaces
// for local development without DynamoDB.
package memory

import (
	"context"
	"sync"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
)

// ── Users ───────────────────────────────────────────────────────────────

type UsersRepo struct {
	mu    sync.RWMutex
	items map[string]repo.User
}

func NewUsersRepo() *UsersRepo {
	return &UsersRepo{items: make(map[string]repo.User)}
}

func (r *UsersRepo) List(_ context.Context) ([]repo.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]repo.User, 0, len(r.items))
	for _, u := range r.items {
		out = append(out, u)
	}
	return out, nil
}

func (r *UsersRepo) Get(_ context.Context, riderID string) (*repo.User, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.items[riderID]
	if !ok {
		return nil, false, nil
	}
	return &u, true, nil
}

func (r *UsersRepo) Put(_ context.Context, u *repo.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[u.RiderID] = *u
	return nil
}

func (r *UsersRepo) Delete(_ context.Context, riderID string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[riderID]; !ok {
		return false, nil
	}
	delete(r.items, riderID)
	return true, nil
}

// ── Bikes ───────────────────────────────────────────────────────────────

type BikesRepo struct {
	mu    sync.RWMutex
	items map[string]repo.Bike
}

func NewBikesRepo() *BikesRepo {
	return &BikesRepo{items: make(map[string]repo.Bike)}
}

func (r *BikesRepo) List(_ context.Context) ([]repo.Bike, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]repo.Bike, 0, len(r.items))
	for _, b := range r.items {
		out = append(out, b)
	}
	return out, nil
}

func (r *BikesRepo) Get(_ context.Context, bikeID string) (*repo.Bike, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	b, ok := r.items[bikeID]
	if !ok {
		return nil, false, nil
	}
	return &b, true, nil
}

func (r *BikesRepo) Put(_ context.Context, b *repo.Bike) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[b.ID] = *b
	return nil
}

func (r *BikesRepo) Delete(_ context.Context, bikeID string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[bikeID]; !ok {
		return false, nil
	}
	delete(r.items, bikeID)
	return true, nil
}

// ── Depots ──────────────────────────────────────────────────────────────

type DepotsRepo struct {
	mu    sync.RWMutex
	items map[string]repo.Depot
}

func NewDepotsRepo() *DepotsRepo {
	return &DepotsRepo{items: make(map[string]repo.Depot)}
}

func (r *DepotsRepo) List(_ context.Context) ([]repo.Depot, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]repo.Depot, 0, len(r.items))
	for _, d := range r.items {
		out = append(out, d)
	}
	return out, nil
}

func (r *DepotsRepo) Get(_ context.Context, depotID string) (*repo.Depot, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	d, ok := r.items[depotID]
	if !ok {
		return nil, false, nil
	}
	return &d, true, nil
}

func (r *DepotsRepo) Put(_ context.Context, d *repo.Depot) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[d.DepotID] = *d
	return nil
}

func (r *DepotsRepo) Delete(_ context.Context, depotID string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[depotID]; !ok {
		return false, nil
	}
	delete(r.items, depotID)
	return true, nil
}

// ── Jobs ────────────────────────────────────────────────────────────────

type JobsRepo struct {
	mu    sync.RWMutex
	items map[string]repo.Job
}

func NewJobsRepo() *JobsRepo {
	return &JobsRepo{items: make(map[string]repo.Job)}
}

func (r *JobsRepo) List(_ context.Context) ([]repo.Job, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]repo.Job, 0, len(r.items))
	for _, j := range r.items {
		out = append(out, j)
	}
	return out, nil
}

func (r *JobsRepo) Get(_ context.Context, jobID string) (*repo.Job, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	j, ok := r.items[jobID]
	if !ok {
		return nil, false, nil
	}
	return &j, true, nil
}

func (r *JobsRepo) Put(_ context.Context, j *repo.Job) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[j.JobID] = *j
	return nil
}

func (r *JobsRepo) Delete(_ context.Context, jobID string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[jobID]; !ok {
		return false, nil
	}
	delete(r.items, jobID)
	return true, nil
}

// ── Events ──────────────────────────────────────────────────────────────

type EventsRepo struct {
	mu    sync.RWMutex
	items map[string]repo.Event
}

func NewEventsRepo() *EventsRepo {
	return &EventsRepo{items: make(map[string]repo.Event)}
}

func (r *EventsRepo) List(_ context.Context) ([]repo.Event, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]repo.Event, 0, len(r.items))
	for _, e := range r.items {
		out = append(out, e)
	}
	return out, nil
}

func (r *EventsRepo) Get(_ context.Context, id string) (*repo.Event, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	e, ok := r.items[id]
	if !ok {
		return nil, false, nil
	}
	return &e, true, nil
}

func (r *EventsRepo) Put(_ context.Context, e *repo.Event) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[e.ID] = *e
	return nil
}

func (r *EventsRepo) Delete(_ context.Context, id string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[id]; !ok {
		return false, nil
	}
	delete(r.items, id)
	return true, nil
}

// ── Ride Sessions ───────────────────────────────────────────────────────

type RideSessionsRepo struct {
	mu    sync.RWMutex
	items map[string]repo.RideSession
}

func NewRideSessionsRepo() *RideSessionsRepo {
	return &RideSessionsRepo{items: make(map[string]repo.RideSession)}
}

func (r *RideSessionsRepo) List(_ context.Context) ([]repo.RideSession, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]repo.RideSession, 0, len(r.items))
	for _, s := range r.items {
		out = append(out, s)
	}
	return out, nil
}

func (r *RideSessionsRepo) Get(_ context.Context, sessionID string) (*repo.RideSession, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.items[sessionID]
	if !ok {
		return nil, false, nil
	}
	return &s, true, nil
}

func (r *RideSessionsRepo) Put(_ context.Context, s *repo.RideSession) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[s.SessionID] = *s
	return nil
}

func (r *RideSessionsRepo) Delete(_ context.Context, sessionID string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[sessionID]; !ok {
		return false, nil
	}
	delete(r.items, sessionID)
	return true, nil
}

func (r *RideSessionsRepo) ListByBike(_ context.Context, bikeID string) ([]repo.RideSession, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]repo.RideSession, 0)
	for _, s := range r.items {
		if s.BikeID == bikeID {
			out = append(out, s)
		}
	}
	return out, nil
}

// ── Issue Reports ───────────────────────────────────────────────────────

type IssueReportsRepo struct {
	mu    sync.RWMutex
	items map[string]repo.IssueReport
}

func NewIssueReportsRepo() *IssueReportsRepo {
	return &IssueReportsRepo{items: make(map[string]repo.IssueReport)}
}

func (r *IssueReportsRepo) List(_ context.Context) ([]repo.IssueReport, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]repo.IssueReport, 0, len(r.items))
	for _, ir := range r.items {
		out = append(out, ir)
	}
	return out, nil
}

func (r *IssueReportsRepo) Get(_ context.Context, issueID string) (*repo.IssueReport, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ir, ok := r.items[issueID]
	if !ok {
		return nil, false, nil
	}
	return &ir, true, nil
}

func (r *IssueReportsRepo) Put(_ context.Context, ir *repo.IssueReport) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[ir.IssueID] = *ir
	return nil
}

func (r *IssueReportsRepo) Delete(_ context.Context, issueID string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[issueID]; !ok {
		return false, nil
	}
	delete(r.items, issueID)
	return true, nil
}
