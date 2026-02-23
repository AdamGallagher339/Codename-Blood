package analytics

import "time"

// SpeedPoint is a single timestamped speed reading for the chart.
type SpeedPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Speed     float64   `json:"speed"` // km/h
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
}

// RiderSummary contains computed analytics for one rider's current session.
type RiderSummary struct {
	RiderID           string       `json:"riderId"`
	TopSpeedKph       float64      `json:"topSpeedKph"`
	AvgSpeedKph       float64      `json:"avgSpeedKph"`
	TotalDistanceKm   float64      `json:"totalDistanceKm"`
	ActiveTimeMinutes float64      `json:"activeTimeMinutes"`
	CurrentSpeedKph   float64      `json:"currentSpeedKph"`
	LastLat           float64      `json:"lastLat"`
	LastLng           float64      `json:"lastLng"`
	LastSeen          time.Time    `json:"lastSeen"`
	SpeedHistory      []SpeedPoint `json:"speedHistory"`
	DataPoints        int          `json:"dataPoints"`
}
