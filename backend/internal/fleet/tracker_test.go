package fleet

import (
"strings"
"testing"
"time"
)

// ---- validateBike ----

func TestValidateBike_ValidFull(t *testing.T) {
bike := FleetBike{
BikeID:       "bike_abc123",
Make:         "Honda",
Model:        "Pan European",
VehicleType:  "motorcycle",
Registration: "212-G-1234",
LocationID:   "loc-1",
Active:       "ready",
}
if err := validateBike(bike, true); err != nil {
t.Errorf("expected no error, got: %v", err)
}
}

func TestValidateBike_ValidCar(t *testing.T) {
bike := FleetBike{
BikeID:       "bike_abc123",
Make:         "Toyota",
Model:        "Corolla",
VehicleType:  "car",
Registration: "21-G-9999",
LocationID:   "loc-1",
Active:       "out_of_service",
}
if err := validateBike(bike, true); err != nil {
t.Errorf("expected no error, got: %v", err)
}
}

func TestValidateBike_MissingBikeID(t *testing.T) {
bike := FleetBike{Model: "Pan European", LocationID: "loc-1", Active: "ready", VehicleType: "motorcycle"}
err := validateBike(bike, true)
if err == nil || !strings.Contains(err.Error(), "bikeId") {
t.Errorf("expected bikeId error, got: %v", err)
}
}

func TestValidateBike_MissingModel(t *testing.T) {
bike := FleetBike{BikeID: "bike_1", Make: "Honda", VehicleType: "motorcycle", Registration: "abc", LocationID: "loc-1", Active: "ready"}
err := validateBike(bike, true)
if err == nil || !strings.Contains(err.Error(), "model") {
t.Errorf("expected model error, got: %v", err)
}
}

func TestValidateBike_InvalidVehicleType(t *testing.T) {
bike := FleetBike{BikeID: "bike_1", Make: "X", Model: "Y", VehicleType: "helicopter", Registration: "abc", LocationID: "loc-1", Active: "ready"}
err := validateBike(bike, true)
if err == nil || !strings.Contains(err.Error(), "vehicleType") {
t.Errorf("expected vehicleType error, got: %v", err)
}
}

func TestValidateBike_ActiveRiderUID(t *testing.T) {
bike := FleetBike{BikeID: "bike_1", Make: "H", Model: "M", VehicleType: "motorcycle", Registration: "abc", LocationID: "loc-1", Active: "rider-uid_123"}
if err := validateBike(bike, true); err != nil {
t.Errorf("expected no error for rider UID active, got: %v", err)
}
}

func TestValidateBike_NotRequireAll_SkipsMake(t *testing.T) {
bike := FleetBike{BikeID: "bike_1", Model: "M", LocationID: "loc-1", Active: "ready"}
// requireAll=false, so missing Make/Registration/VehicleType is OK
if err := validateBike(bike, false); err != nil {
t.Errorf("expected no error with requireAll=false, got: %v", err)
}
}

// ---- validateServiceEntry ----

func TestValidateServiceEntry_ValidTypes(t *testing.T) {
for svcType := range validServiceTypes {
req := CreateServiceEntryRequest{ServiceType: svcType}
if err := validateServiceEntry(req); err != nil {
t.Errorf("expected valid serviceType %s, got: %v", svcType, err)
}
}
}

func TestValidateServiceEntry_Empty(t *testing.T) {
err := validateServiceEntry(CreateServiceEntryRequest{})
if err == nil || !strings.Contains(err.Error(), "serviceType") {
t.Errorf("expected serviceType error, got: %v", err)
}
}

func TestValidateServiceEntry_Invalid(t *testing.T) {
err := validateServiceEntry(CreateServiceEntryRequest{ServiceType: "turbo"})
if err == nil || !strings.Contains(err.Error(), "invalid") {
t.Errorf("expected invalid serviceType error, got: %v", err)
}
}

// ---- parseServiceDate ----

func TestParseServiceDate_Empty(t *testing.T) {
before := time.Now()
got, err := parseServiceDate("")
if err != nil {
t.Fatalf("unexpected error: %v", err)
}
if got.Before(before) {
t.Error("expected date to be approximately now for empty input")
}
}

func TestParseServiceDate_RFC3339(t *testing.T) {
input := "2024-03-15T10:30:00Z"
got, err := parseServiceDate(input)
if err != nil {
t.Fatalf("unexpected error: %v", err)
}
if got.Year() != 2024 || got.Month() != 3 || got.Day() != 15 {
t.Errorf("unexpected parsed date: %v", got)
}
}

func TestParseServiceDate_DateOnly(t *testing.T) {
got, err := parseServiceDate("2024-06-01")
if err != nil {
t.Fatalf("unexpected error: %v", err)
}
if got.Year() != 2024 || got.Month() != 6 || got.Day() != 1 {
t.Errorf("unexpected parsed date: %v", got)
}
}

func TestParseServiceDate_Invalid(t *testing.T) {
_, err := parseServiceDate("not-a-date")
if err == nil {
t.Error("expected error for invalid date")
}
}

// ---- newBikeID / newServiceID ----

func TestNewBikeID_Format(t *testing.T) {
id := newBikeID()
if !strings.HasPrefix(id, "bike_") {
t.Errorf("expected bike_ prefix, got %s", id)
}
if len(id) != len("bike_")+16 {
t.Errorf("unexpected ID length: %s", id)
}
}

func TestNewBikeID_Unique(t *testing.T) {
a := newBikeID()
b := newBikeID()
if a == b {
t.Error("expected unique IDs, got duplicates")
}
}

func TestNewServiceID_Format(t *testing.T) {
id := newServiceID()
if !strings.HasPrefix(id, "svc_") {
t.Errorf("expected svc_ prefix, got %s", id)
}
if len(id) != len("svc_")+16 {
t.Errorf("unexpected ID length: %s", id)
}
}

func TestNewServiceID_Unique(t *testing.T) {
a := newServiceID()
b := newServiceID()
if a == b {
t.Error("expected unique IDs, got duplicates")
}
}
