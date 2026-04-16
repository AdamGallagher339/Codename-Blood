package analytics

import (
"math"
"testing"
"time"
)

func newTestStore() *Store {
return &Store{data: make(map[string]*riderState)}
}

func TestHaversineKm_SamePoint(t *testing.T) {
d := haversineKm(53.3498, -6.2603, 53.3498, -6.2603)
if d != 0 {
t.Errorf("expected 0, got %v", d)
}
}

func TestHaversineKm_KnownDistance(t *testing.T) {
// Dublin to Cork is roughly 219-221 km
d := haversineKm(53.3498, -6.2603, 51.8985, -8.4756)
if d < 215 || d > 225 {
t.Errorf("Dublin-Cork distance out of expected range: %v km", d)
}
}

func TestRound1(t *testing.T) {
cases := []struct{ in, want float64 }{
{1.05, 1.1},
{1.04, 1.0},
{0.0, 0.0},
{99.999, 100.0},
}
for _, c := range cases {
got := round1(c.in)
if math.Abs(got-c.want) > 1e-9 {
t.Errorf("round1(%v) = %v, want %v", c.in, got, c.want)
}
}
}

func TestRound2(t *testing.T) {
cases := []struct{ in, want float64 }{
{1.006, 1.01},
{1.004, 1.0},
{0.0, 0.0},
}
for _, c := range cases {
got := round2(c.in)
if math.Abs(got-c.want) > 1e-9 {
t.Errorf("round2(%v) = %v, want %v", c.in, got, c.want)
}
}
}

func TestStore_GetSummary_NoData(t *testing.T) {
s := newTestStore()
_, ok := s.GetSummary("unknown-rider")
if ok {
t.Error("expected false for unknown rider, got true")
}
}

func TestStore_Record_FirstObservation(t *testing.T) {
s := newTestStore()
ts := time.Now()
s.Record("rider1", 53.0, -6.0, nil, ts)

sum, ok := s.GetSummary("rider1")
if !ok {
t.Fatal("expected summary after first observation")
}
if sum.DataPoints != 0 {
t.Errorf("expected 0 data points after seed, got %d", sum.DataPoints)
}
if sum.TotalDistanceKm != 0 {
t.Errorf("expected 0 distance after seed, got %v", sum.TotalDistanceKm)
}
}

func TestStore_Record_SecondObservation(t *testing.T) {
s := newTestStore()
base := time.Now()

s.Record("rider1", 53.0, -6.0, nil, base)
s.Record("rider1", 53.009, -6.0, nil, base.Add(30*time.Second))

sum, ok := s.GetSummary("rider1")
if !ok {
t.Fatal("expected summary after second observation")
}
if sum.DataPoints != 1 {
t.Errorf("expected 1 data point, got %d", sum.DataPoints)
}
if sum.TotalDistanceKm <= 0 {
t.Errorf("expected positive distance, got %v", sum.TotalDistanceKm)
}
}

func TestStore_Record_WithDeviceSpeed(t *testing.T) {
s := newTestStore()
base := time.Now()
speed := 10.0 // 10 m/s = 36 km/h

s.Record("rider1", 53.0, -6.0, nil, base)
s.Record("rider1", 53.009, -6.0, &speed, base.Add(30*time.Second))

sum, _ := s.GetSummary("rider1")

expectedKph := round1(speed * 3.6)
if math.Abs(sum.TopSpeedKph-expectedKph) > 0.2 {
t.Errorf("expected top speed ~%v kph, got %v", expectedKph, sum.TopSpeedKph)
}
if math.Abs(sum.CurrentSpeedKph-expectedKph) > 0.2 {
t.Errorf("expected current speed ~%v kph, got %v", expectedKph, sum.CurrentSpeedKph)
}
}

func TestStore_Record_StaleJumpIgnored(t *testing.T) {
s := newTestStore()
base := time.Now()

s.Record("rider1", 53.0, -6.0, nil, base)
// 10 km in 2 seconds - should be treated as stale jump
s.Record("rider1", 53.09, -6.0, nil, base.Add(2*time.Second))

sum, _ := s.GetSummary("rider1")
if sum.DataPoints != 0 {
t.Errorf("stale jump should be ignored; expected 0 data points, got %d", sum.DataPoints)
}
}

func TestStore_Record_MaxHistoryTruncated(t *testing.T) {
s := newTestStore()
base := time.Now()

s.Record("rider1", 53.0, -6.0, nil, base)

for i := 1; i <= maxHistoryPoints+10; i++ {
lat := 53.0 + float64(i)*0.00009
ts := base.Add(time.Duration(i) * time.Second)
s.Record("rider1", lat, -6.0, nil, ts)
}

sum, _ := s.GetSummary("rider1")
if len(sum.SpeedHistory) > maxHistoryPoints {
t.Errorf("speed history exceeds max: got %d, max %d", len(sum.SpeedHistory), maxHistoryPoints)
}
}

func TestStore_AllRiderIDs(t *testing.T) {
s := newTestStore()
base := time.Now()
s.Record("rider1", 53.0, -6.0, nil, base)
s.Record("rider2", 54.0, -7.0, nil, base)

ids := s.AllRiderIDs()
if len(ids) != 2 {
t.Errorf("expected 2 rider IDs, got %d", len(ids))
}
}

func TestStore_GetSummary_AvgSpeed(t *testing.T) {
s := newTestStore()
base := time.Now()
speed30 := 30.0 / 3.6
speed60 := 60.0 / 3.6

s.Record("r", 53.0, -6.0, nil, base)
s.Record("r", 53.009, -6.0, &speed30, base.Add(10*time.Second))
s.Record("r", 53.018, -6.0, &speed60, base.Add(20*time.Second))

sum, _ := s.GetSummary("r")
expectedAvg := round1((30.0 + 60.0) / 2)
if math.Abs(sum.AvgSpeedKph-expectedAvg) > 0.5 {
t.Errorf("expected avg speed ~%v kph, got %v", expectedAvg, sum.AvgSpeedKph)
}
}

func TestStore_ConcurrentAccess(t *testing.T) {
s := newTestStore()
base := time.Now()

done := make(chan struct{})
go func() {
for i := 0; i < 100; i++ {
lat := 53.0 + float64(i)*0.0001
s.Record("r", lat, -6.0, nil, base.Add(time.Duration(i)*time.Second))
}
close(done)
}()
for i := 0; i < 50; i++ {
s.GetSummary("r")
}
<-done
}
