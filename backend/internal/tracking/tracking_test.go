package tracking

import (
"testing"
"time"
)

// ---- ValidateCoordinates ----

func TestValidateCoordinates_Valid(t *testing.T) {
cases := []struct{ lat, lon float64 }{
{0, 0},
{90, 180},
{-90, -180},
{53.3498, -6.2603},
{-45.0, 170.0},
}
for _, c := range cases {
if !ValidateCoordinates(c.lat, c.lon) {
t.Errorf("ValidateCoordinates(%v, %v) = false, want true", c.lat, c.lon)
}
}
}

func TestValidateCoordinates_Invalid(t *testing.T) {
cases := []struct{ lat, lon float64 }{
{91, 0},
{-91, 0},
{0, 181},
{0, -181},
{90.001, 0},
{0, 180.001},
}
for _, c := range cases {
if ValidateCoordinates(c.lat, c.lon) {
t.Errorf("ValidateCoordinates(%v, %v) = true, want false", c.lat, c.lon)
}
}
}

// ---- Store ----

func newTrackingStore() *Store {
return NewStore(5 * time.Minute)
}

func TestNewStore_DefaultStaleTimeout(t *testing.T) {
s := NewStore(0)
if s.staleTimeout != 5*time.Minute {
t.Errorf("expected default stale timeout 5m, got %v", s.staleTimeout)
}
}

func TestNewStore_CustomStaleTimeout(t *testing.T) {
s := NewStore(10 * time.Minute)
if s.staleTimeout != 10*time.Minute {
t.Errorf("expected 10m, got %v", s.staleTimeout)
}
}

func TestStore_GetLocation_Empty(t *testing.T) {
s := newTrackingStore()
go s.Start()

_, ok := s.GetLocation("nonexistent")
if ok {
t.Error("expected false for unknown entity, got true")
}
}

func TestStore_UpdateAndGetLocation(t *testing.T) {
s := newTrackingStore()
go s.Start()

now := time.Now()
update := &LocationUpdate{
EntityID:   "bike-1",
EntityType: "bike",
Latitude:   53.3498,
Longitude:  -6.2603,
Timestamp:  now,
UpdatedAt:  now,
}

s.UpdateLocation(update)

// Give the event loop a moment to process
time.Sleep(20 * time.Millisecond)

loc, ok := s.GetLocation("bike-1")
if !ok {
t.Fatal("expected location to be found")
}
if loc.EntityID != "bike-1" {
t.Errorf("expected entityId bike-1, got %s", loc.EntityID)
}
if loc.Latitude != 53.3498 {
t.Errorf("expected lat 53.3498, got %v", loc.Latitude)
}
if loc.Longitude != -6.2603 {
t.Errorf("expected lon -6.2603, got %v", loc.Longitude)
}
}

func TestStore_GetAllLocations_Empty(t *testing.T) {
s := newTrackingStore()
locs := s.GetAllLocations()
if len(locs) != 0 {
t.Errorf("expected 0 locations, got %d", len(locs))
}
}

func TestStore_GetAllLocations_ReturnsActive(t *testing.T) {
s := newTrackingStore()
go s.Start()

now := time.Now()
for _, id := range []string{"bike-1", "bike-2", "rider-3"} {
entityType := "bike"
if id == "rider-3" {
entityType = "rider"
}
s.UpdateLocation(&LocationUpdate{
EntityID:   id,
EntityType: entityType,
Latitude:   53.0,
Longitude:  -6.0,
Timestamp:  now,
UpdatedAt:  now,
})
}

time.Sleep(30 * time.Millisecond)

locs := s.GetAllLocations()
if len(locs) != 3 {
t.Errorf("expected 3 locations, got %d", len(locs))
}
}

func TestStore_GetLocation_StaleReturnsNotFound(t *testing.T) {
// Very short stale timeout
s := NewStore(50 * time.Millisecond)

now := time.Now().Add(-100 * time.Millisecond) // already stale
s.mu.Lock()
s.locations["bike-1"] = &LocationUpdate{
EntityID:  "bike-1",
UpdatedAt: now,
}
s.mu.Unlock()

_, ok := s.GetLocation("bike-1")
if ok {
t.Error("expected stale location to return false, got true")
}
}

func TestStore_GetAllEntities_Empty(t *testing.T) {
s := newTrackingStore()
entities := s.GetAllEntities()
if len(entities) != 0 {
t.Errorf("expected 0 entities, got %d", len(entities))
}
}

func TestStore_GetAllEntities_AfterUpdate(t *testing.T) {
s := newTrackingStore()
go s.Start()

now := time.Now()
s.UpdateLocation(&LocationUpdate{
EntityID:   "rider-1",
EntityType: "rider",
Latitude:   53.0,
Longitude:  -6.0,
Timestamp:  now,
UpdatedAt:  now,
})

time.Sleep(30 * time.Millisecond)

entities := s.GetAllEntities()
if len(entities) != 1 {
t.Fatalf("expected 1 entity, got %d", len(entities))
}
if entities[0].EntityID != "rider-1" {
t.Errorf("expected entityId rider-1, got %s", entities[0].EntityID)
}
if !entities[0].IsActive {
t.Error("expected entity to be active")
}
}

func TestStore_CleanupStaleEntities(t *testing.T) {
s := NewStore(50 * time.Millisecond)
staleTime := time.Now().Add(-100 * time.Millisecond)

s.mu.Lock()
s.entities["old-bike"] = &TrackedEntity{
EntityID:       "old-bike",
IsActive:       true,
LastUpdateTime: staleTime,
}
s.mu.Unlock()

s.cleanupStaleLocations()

s.mu.RLock()
entity := s.entities["old-bike"]
s.mu.RUnlock()

if entity.IsActive {
t.Error("expected stale entity to be marked inactive")
}
}
