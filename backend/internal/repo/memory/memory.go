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
