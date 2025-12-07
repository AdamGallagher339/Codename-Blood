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

	// --- User / Tag Routes ---
	http.HandleFunc("/api/users", fleet.GetAllUsers)
	http.HandleFunc("/api/user/register", fleet.RegisterUser)
	http.HandleFunc("/api/user", fleet.GetUser) // GET ?riderId=...
	http.HandleFunc("/api/user/tags/add", fleet.AddTagToUser)
	http.HandleFunc("/api/user/tags/remove", fleet.RemoveTagFromUser)

	log.Println("Backend running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
