package fleet

import "time"

type FleetBike struct {
	BikeID       string    `json:"bikeId" dynamodbav:"BikeID"`
	Make         string    `json:"make" dynamodbav:"Make"`
	Model        string    `json:"model" dynamodbav:"Model"`
	VehicleType  string    `json:"vehicleType" dynamodbav:"VehicleType"`
	Registration string    `json:"registration" dynamodbav:"Registration"`
	LocationID   string    `json:"locationId" dynamodbav:"LocationID"`
	Active       string    `json:"active" dynamodbav:"Active"`
	CreatedAt    time.Time `json:"createdAt" dynamodbav:"CreatedAt"`
	UpdatedAt    time.Time `json:"updatedAt" dynamodbav:"UpdatedAt"`
}

type ServiceEntry struct {
	ServiceID   string    `json:"serviceId" dynamodbav:"ServiceID"`
	BikeID      string    `json:"bikeId" dynamodbav:"BikeID"`
	ServiceType string    `json:"serviceType" dynamodbav:"ServiceType"`
	ServiceDate time.Time `json:"serviceDate" dynamodbav:"ServiceDate"`
	Notes       string    `json:"notes,omitempty" dynamodbav:"Notes,omitempty"`
	PerformedBy string    `json:"performedBy,omitempty" dynamodbav:"PerformedBy,omitempty"`
	CreatedAt   time.Time `json:"createdAt" dynamodbav:"CreatedAt"`
}

type CreateFleetBikeRequest struct {
	Make         string `json:"make"`
	Model        string `json:"model"`
	VehicleType  string `json:"vehicleType"`
	Registration string `json:"registration"`
	LocationID   string `json:"locationId"`
	Active       string `json:"active"`
}

type UpdateFleetBikeRequest struct {
	Make         *string `json:"make,omitempty"`
	Model        *string `json:"model,omitempty"`
	VehicleType  *string `json:"vehicleType,omitempty"`
	Registration *string `json:"registration,omitempty"`
	LocationID   *string `json:"locationId,omitempty"`
	Active       *string `json:"active,omitempty"`
}

type CreateServiceEntryRequest struct {
	ServiceType string `json:"serviceType"`
	ServiceDate string `json:"serviceDate,omitempty"`
	Notes       string `json:"notes,omitempty"`
	PerformedBy string `json:"performedBy,omitempty"`
}

var validServiceTypes = map[string]struct{}{
	"oil":     {},
	"chain":   {},
	"tyres":   {},
	"brakes":  {},
	"coolant": {},
}
