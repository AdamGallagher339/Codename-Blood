package analytics

import (
	"math"
	"sync"
	"time"
)

const (
	// maxHistoryPoints is the maximum number of speed readings kept per rider.
	maxHistoryPoints = 120
	// staleJumpMetres: if the GPS moves more than this in staleJumpSecs, treat it as noise.
	staleJumpMetres = 500.0
	staleJumpSecs   = 10.0
)

// riderState holds mutable per-rider analytics state for the current session.
type riderState struct {
	history         []SpeedPoint
	topSpeedKph     float64
	totalDistanceKm float64
	speedSum        float64
	speedCount      int
	sessionStart    time.Time
	lastLat         float64
	lastLng         float64
	lastTimestamp   time.Time
	currentSpeedKph float64
}

// Store is the in-memory analytics store for all riders.
type Store struct {
	mu   sync.RWMutex
	data map[string]*riderState
}

// GlobalStore is the package-level singleton analytics store.
var GlobalStore = &Store{data: make(map[string]*riderState)}

// Record adds a GPS observation for a rider and updates running stats.
// speedMps is the device-reported speed in m/s (may be nil).
func (s *Store) Record(riderID string, lat, lng float64, speedMps *float64, ts time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, ok := s.data[riderID]
	if !ok {
		// First observation — seed position, no movement stats yet.
		s.data[riderID] = &riderState{
			sessionStart:  ts,
			lastLat:       lat,
			lastLng:       lng,
			lastTimestamp: ts,
		}
		return
	}

	distKm := haversineKm(state.lastLat, state.lastLng, lat, lng)
	dt := ts.Sub(state.lastTimestamp).Seconds()

	// Stale-jump guard: ignore teleport or GPS drift.
	if distKm*1000 > staleJumpMetres && dt < staleJumpSecs {
		state.lastLat = lat
		state.lastLng = lng
		state.lastTimestamp = ts
		return
	}

	state.totalDistanceKm += distKm

	// Determine speed in km/h: prefer device-reported, else infer from displacement.
	var kph float64
	if speedMps != nil && *speedMps >= 0 {
		kph = *speedMps * 3.6
	} else if dt > 0 {
		kph = (distKm / dt) * 3600
	}

	state.currentSpeedKph = kph
	if kph > state.topSpeedKph {
		state.topSpeedKph = kph
	}
	state.speedSum += kph
	state.speedCount++

	state.history = append(state.history, SpeedPoint{
		Timestamp: ts,
		Speed:     round1(kph),
		Lat:       lat,
		Lng:       lng,
	})
	if len(state.history) > maxHistoryPoints {
		state.history = state.history[len(state.history)-maxHistoryPoints:]
	}

	state.lastLat = lat
	state.lastLng = lng
	state.lastTimestamp = ts
}

// GetSummary returns a snapshot of analytics for the given rider.
// Returns (summary, true) if data exists, or a zero summary with false if not.
func (s *Store) GetSummary(riderID string) (RiderSummary, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	state, ok := s.data[riderID]
	if !ok {
		return RiderSummary{}, false
	}

	var avgKph float64
	if state.speedCount > 0 {
		avgKph = state.speedSum / float64(state.speedCount)
	}

	activeMin := time.Since(state.sessionStart).Minutes()

	hist := make([]SpeedPoint, len(state.history))
	copy(hist, state.history)

	return RiderSummary{
		RiderID:           riderID,
		TopSpeedKph:       round1(state.topSpeedKph),
		AvgSpeedKph:       round1(avgKph),
		TotalDistanceKm:   round2(state.totalDistanceKm),
		ActiveTimeMinutes: round1(activeMin),
		CurrentSpeedKph:   round1(state.currentSpeedKph),
		LastLat:           state.lastLat,
		LastLng:           state.lastLng,
		LastSeen:          state.lastTimestamp,
		SpeedHistory:      hist,
		DataPoints:        state.speedCount,
	}, true
}

// AllRiderIDs returns every rider ID that has analytics data.
func (s *Store) AllRiderIDs() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ids := make([]string, 0, len(s.data))
	for id := range s.data {
		ids = append(ids, id)
	}
	return ids
}

// --- helpers ---

func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func round1(v float64) float64 { return math.Round(v*10) / 10 }
func round2(v float64) float64 { return math.Round(v*100) / 100 }
