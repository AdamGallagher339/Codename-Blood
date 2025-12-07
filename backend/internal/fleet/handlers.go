package fleet

import (
	"encoding/json"
	"net/http"
	"time"
)

// In-memory storage for now — will replace with DynamoDB in AWS step
var bikes = make(map[string]*Motorcycle)

func GetAllBikes(w http.ResponseWriter, r *http.Request) {
	list := []*Motorcycle{}
	for _, b := range bikes {
		list = append(list, b)
	}
	json.NewEncoder(w).Encode(list)
}

func RegisterBike(w http.ResponseWriter, r *http.Request) {
	var m Motorcycle
	json.NewDecoder(r.Body).Decode(&m)
	m.UpdatedAt = time.Now()
	bikes[m.ID] = &m
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(m)
}

func StartRide(w http.ResponseWriter, r *http.Request) {
	bikeID := r.URL.Query().Get("bikeId")
	rider := r.URL.Query().Get("riderId")

	b, exists := bikes[bikeID]
	if !exists {
		http.Error(w, "Bike not found", 404)
		return
	}

	b.CurrentRiderID = rider
	b.Status = "OnDuty"
	b.UpdatedAt = time.Now()

	json.NewEncoder(w).Encode(b)
}

func EndRide(w http.ResponseWriter, r *http.Request) {
	bikeID := r.URL.Query().Get("bikeId")

	b, exists := bikes[bikeID]
	if !exists {
		http.Error(w, "Bike not found", 404)
		return
	}

	b.CurrentRiderID = ""
	b.Status = "Available"
	b.UpdatedAt = time.Now()

	json.NewEncoder(w).Encode(b)
}
