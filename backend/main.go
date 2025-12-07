package main

import (
	"fmt"
	"log"
	"net/http"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/fleet"
)

func main() {
	// --- Health Check ---
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "OK")
	})

	// --- Fleet Management Routes ---
	http.HandleFunc("/api/bikes", fleet.GetAllBikes)
	http.HandleFunc("/api/bike/register", fleet.RegisterBike)
	http.HandleFunc("/api/ride/start", fleet.StartRide)
	http.HandleFunc("/api/ride/end", fleet.EndRide)

	log.Println("Backend running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
