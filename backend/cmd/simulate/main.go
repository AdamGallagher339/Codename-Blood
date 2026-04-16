// simulate is a load-simulation tool for Blood Bike.
// It creates synthetic users via LOCAL_AUTH and drives the full job lifecycle
// across dispatchers, riders, issue-riders, and fleet managers — all concurrently.
//
// Usage:
//
//	# Start backend with local auth first:
//	LOCAL_AUTH=1 ./backend
//
//	# Then in another terminal:
//	go run ./cmd/simulate [flags]
//
// Flags:
//
//	--url        Backend base URL (default: http://localhost:8080)
//	--duration   How long to run  (default: 5m)
//	--dispatchers  Number of dispatcher goroutines (default: 30)
//	--riders       Number of active rider goroutines (default: 40)
//	--issue-riders Number of issue/cancel rider goroutines (default: 10)
//	--fleet        Number of fleet manager goroutines (default: 10)
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const simPassword = "Simulate@1!"

// --- counters ---

var (
	cJobsCreated   atomic.Int64
	cJobsAccepted  atomic.Int64
	cJobsCompleted atomic.Int64
	cJobsCancelled atomic.Int64
	cBikesCreated  atomic.Int64
	cAPIErrors     atomic.Int64
)

// --- token store ---

var tokenStore = struct {
	mu sync.RWMutex
	m  map[string]string
}{m: make(map[string]string)}

func setToken(username, tok string) {
	tokenStore.mu.Lock()
	tokenStore.m[username] = tok
	tokenStore.mu.Unlock()
}

func getToken(username string) string {
	tokenStore.mu.RLock()
	defer tokenStore.mu.RUnlock()
	return tokenStore.m[username]
}

// --- static data ---

var pickups = []string{
	"Mater Hospital, Dublin 7",
	"St James's Hospital, Dublin 8",
	"Beaumont Hospital, Dublin 9",
	"Tallaght University Hospital, Dublin 24",
	"Cork University Hospital, Wilton",
	"University Hospital Galway",
	"Limerick University Hospital",
	"Our Lady of Lourdes Hospital, Drogheda",
	"National Blood Centre, James's Street, Dublin 8",
	"Naas General Hospital, Kildare",
	"Cavan General Hospital",
	"Sligo University Hospital",
}

var dropoffs = []string{
	"Royal Victoria Eye & Ear Hospital, Dublin 2",
	"Children's Health Ireland, Crumlin",
	"St Vincent's University Hospital, Dublin 4",
	"Connolly Hospital, Blanchardstown",
	"National Maternity Hospital, Dublin 2",
	"Coombe Women & Infants University Hospital",
	"Letterkenny University Hospital",
	"Kerry General Hospital, Tralee",
	"Portiuncula University Hospital, Ballinasloe",
	"Midland Regional Hospital, Tullamore",
	"South Tipperary General Hospital, Clonmel",
	"Wexford General Hospital",
}

var jobTitles = []string{
	"Blood Delivery — Urgent O-",
	"Blood Delivery — O+ Required",
	"Platelet Transfer — Urgent",
	"Plasma Delivery — Critical",
	"Red Cell Delivery",
	"Blood Component Transfer",
	"Urgent Blood Delivery — A+",
	"Blood Samples — Lab Transfer",
	"Emergency Blood Delivery — B-",
	"Stem Cell Transfer — Urgent",
	"FFP Delivery",
	"Cross-match Sample Transfer",
}

var bikeMakes = []string{"Honda", "BMW", "Kawasaki", "Yamaha", "Suzuki", "Triumph"}
var bikeModels = []string{"CB500F", "F800GS", "Ninja 650", "MT-07", "V-Strom 650", "Tiger 800"}

var httpClient = &http.Client{Timeout: 12 * time.Second}

// --- main ---

func main() {
	urlFlag := flag.String("url", "http://localhost:8080", "Backend base URL")
	durFlag := flag.Duration("duration", 5*time.Minute, "How long to run the simulation")
	nDispFlag := flag.Int("dispatchers", 30, "Number of dispatcher goroutines")
	nRiderFlag := flag.Int("riders", 40, "Number of active rider goroutines")
	nIssueFlag := flag.Int("issue-riders", 10, "Number of cancel/issue rider goroutines")
	nFleetFlag := flag.Int("fleet", 10, "Number of fleet manager goroutines")
	flag.Parse()

	base := *urlFlag
	total := *nDispFlag + *nRiderFlag + *nIssueFlag + *nFleetFlag

	log.Printf("╔══════════════════════════════════════════════╗")
	log.Printf("║     Blood Bike Load Simulation               ║")
	log.Printf("╚══════════════════════════════════════════════╝")
	log.Printf("  Target  : %s", base)
	log.Printf("  Duration: %s", *durFlag)
	log.Printf("  Users   : %d dispatchers | %d riders | %d issue-riders | %d fleet managers",
		*nDispFlag, *nRiderFlag, *nIssueFlag, *nFleetFlag)
	log.Printf("  Total   : %d concurrent users", total)
	log.Printf("")
	log.Println("  NOTE: Backend must be running with LOCAL_AUTH=1")
	log.Println("        e.g.  LOCAL_AUTH=1 ./backend")
	log.Println("")

	ctx, cancel := context.WithTimeout(context.Background(), *durFlag)
	defer cancel()

	// ── Phase 1: create + sign-in every user ────────────────────────────────
	log.Printf("[setup] Creating %d simulation users …", total)

	type userDef struct {
		username string
		roles    []string
	}
	var users []userDef
	for i := 1; i <= *nDispFlag; i++ {
		users = append(users, userDef{fmt.Sprintf("sim-dispatcher-%d", i), []string{"Dispatcher"}})
	}
	for i := 1; i <= *nRiderFlag; i++ {
		users = append(users, userDef{fmt.Sprintf("sim-rider-%d", i), []string{"Rider"}})
	}
	for i := 1; i <= *nIssueFlag; i++ {
		users = append(users, userDef{fmt.Sprintf("sim-issue-%d", i), []string{"Rider"}})
	}
	for i := 1; i <= *nFleetFlag; i++ {
		users = append(users, userDef{fmt.Sprintf("sim-fleet-%d", i), []string{"FleetManager"}})
	}

	var setupWg sync.WaitGroup
	for _, u := range users {
		setupWg.Add(1)
		go func(u userDef) {
			defer setupWg.Done()
			_ = signup(base, u.username, u.roles)
			tok, err := signin(base, u.username)
			if err != nil {
				log.Printf("[setup] WARN: sign-in failed for %s: %v", u.username, err)
				return
			}
			setToken(u.username, tok)
			// Register a DynamoDB user profile for riders
			if containsStr(u.roles, "Rider") {
				_ = registerUser(base, tok, u.username, u.roles)
			}
		}(u)
	}
	setupWg.Wait()

	signed := 0
	for _, u := range users {
		if getToken(u.username) != "" {
			signed++
		}
	}
	log.Printf("[setup] %d/%d users signed in successfully", signed, total)

	// ── Phase 2: mark all riders as available ───────────────────────────────
	for i := 1; i <= *nRiderFlag; i++ {
		if tok := getToken(fmt.Sprintf("sim-rider-%d", i)); tok != "" {
			_ = setAvailability(base, tok, "available", 8)
		}
	}
	for i := 1; i <= *nIssueFlag; i++ {
		if tok := getToken(fmt.Sprintf("sim-issue-%d", i)); tok != "" {
			_ = setAvailability(base, tok, "available", 8)
		}
	}

	// ── Phase 3: launch goroutines ───────────────────────────────────────────
	log.Printf("[sim] Simulation running for %s — watch your dashboard!", *durFlag)

	var wg sync.WaitGroup

	for i := 1; i <= *nDispFlag; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			runDispatcher(ctx, base, fmt.Sprintf("sim-dispatcher-%d", n))
		}(i)
	}
	for i := 1; i <= *nRiderFlag; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			runActiveRider(ctx, base, fmt.Sprintf("sim-rider-%d", n))
		}(i)
	}
	for i := 1; i <= *nIssueFlag; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			runIssueRider(ctx, base, fmt.Sprintf("sim-issue-%d", n))
		}(i)
	}
	for i := 1; i <= *nFleetFlag; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			runFleetManager(ctx, base, fmt.Sprintf("sim-fleet-%d", n))
		}(i)
	}

	// stats printer every 5s
	go func() {
		tick := time.NewTicker(5 * time.Second)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
				printStats()
			}
		}
	}()

	wg.Wait()

	log.Println("")
	log.Println("══════════════════ Final Stats ══════════════════")
	printStats()
	log.Println("═════════════════════════════════════════════════")
	log.Println("Simulation complete.")
}

// ── goroutine workers ────────────────────────────────────────────────────────

// runDispatcher creates new jobs on a random interval.
func runDispatcher(ctx context.Context, base, username string) {
	for {
		if ctx.Err() != nil {
			return
		}
		tok := getToken(username)
		if tok == "" {
			sleep(ctx, 2*time.Second)
			continue
		}
		title := jobTitles[rand.Intn(len(jobTitles))]
		pickup := pickups[rand.Intn(len(pickups))]
		dropoff := dropoffs[rand.Intn(len(dropoffs))]
		if err := createJob(base, tok, title, pickup, dropoff); err == nil {
			cJobsCreated.Add(1)
		} else {
			cAPIErrors.Add(1)
		}
		// 3–9 s between jobs per dispatcher
		sleep(ctx, jitterMs(3000, 6000))
	}
}

// runActiveRider polls for open jobs and drives them through the full lifecycle.
func runActiveRider(ctx context.Context, base, username string) {
	for {
		if ctx.Err() != nil {
			return
		}
		tok := getToken(username)
		if tok == "" {
			sleep(ctx, 2*time.Second)
			continue
		}

		job := findOpenJob(base, tok)
		if job == nil {
			sleep(ctx, 2*time.Second)
			continue
		}

		if err := updateJob(base, tok, job.JobID, "accepted", username); err != nil {
			sleep(ctx, time.Second)
			continue
		}
		cJobsAccepted.Add(1)

		sleep(ctx, jitterMs(4000, 7000)) // travel to pickup
		if ctx.Err() != nil {
			return
		}
		_ = updateJob(base, tok, job.JobID, "picked-up", username)

		sleep(ctx, jitterMs(5000, 9000)) // travel to dropoff
		if ctx.Err() != nil {
			return
		}
		_ = updateJob(base, tok, job.JobID, "delivered", username)

		sleep(ctx, jitterMs(1000, 2500))
		_ = updateJob(base, tok, job.JobID, "completed", username)
		cJobsCompleted.Add(1)

		_ = setAvailability(base, tok, "available", 8)
		sleep(ctx, jitterMs(1000, 2000))
	}
}

// runIssueRider accepts jobs then cancels them, simulating reported issues.
func runIssueRider(ctx context.Context, base, username string) {
	for {
		if ctx.Err() != nil {
			return
		}
		tok := getToken(username)
		if tok == "" {
			sleep(ctx, 2*time.Second)
			continue
		}

		job := findOpenJob(base, tok)
		if job == nil {
			sleep(ctx, 3*time.Second)
			continue
		}

		if err := updateJob(base, tok, job.JobID, "accepted", username); err != nil {
			sleep(ctx, time.Second)
			continue
		}
		cJobsAccepted.Add(1)

		// Simulate attending then encountering an issue
		sleep(ctx, jitterMs(3000, 6000))
		if ctx.Err() != nil {
			return
		}
		_ = updateJob(base, tok, job.JobID, "cancelled", username)
		cJobsCancelled.Add(1)

		_ = setAvailability(base, tok, "available", 8)
		// longer pause before trying again
		sleep(ctx, jitterMs(6000, 12000))
	}
}

// runFleetManager creates bikes and toggles them in/out of service.
func runFleetManager(ctx context.Context, base, username string) {
	var myBikes []string
	seq := 0
	for {
		if ctx.Err() != nil {
			return
		}
		tok := getToken(username)
		if tok == "" {
			sleep(ctx, 2*time.Second)
			continue
		}

		// Create a new bike
		seq++
		make := bikeMakes[rand.Intn(len(bikeMakes))]
		model := bikeModels[rand.Intn(len(bikeModels))]
		// Registration like SIM-DSP1-3
		reg := fmt.Sprintf("SIM-%s-%d", strings.ToUpper(username[len(username)-4:]), seq)
		bikeID, err := createFleetBike(base, tok, make, model, reg)
		if err == nil {
			cBikesCreated.Add(1)
			myBikes = append(myBikes, bikeID)
		} else {
			cAPIErrors.Add(1)
		}

		// Randomly toggle existing bikes between ready / out_of_service
		for _, bid := range myBikes {
			active := "ready"
			if rand.Intn(3) == 0 { // 33% go out of service
				active = "out_of_service"
			}
			_ = setFleetBikeActive(base, tok, bid, active)
			sleep(ctx, 400*time.Millisecond)
			if ctx.Err() != nil {
				return
			}
		}

		// 10–20 s between new bike creations
		sleep(ctx, jitterMs(10000, 10000))
	}
}

// ── API helpers ──────────────────────────────────────────────────────────────

func signup(base, username string, roles []string) error {
	body := map[string]any{
		"username": username,
		"password": simPassword,
		"email":    username + "@sim.bloodbike.test",
		"roles":    roles,
	}
	resp, err := doJSON("POST", base+"/api/auth/signup", "", body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 201 || resp.StatusCode == 409 {
		return nil
	}
	return fmt.Errorf("signup %s: HTTP %d", username, resp.StatusCode)
}

func signin(base, username string) (string, error) {
	body := map[string]any{"username": username, "password": simPassword}
	resp, err := doJSON("POST", base+"/api/auth/signin", "", body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("signin %s: HTTP %d", username, resp.StatusCode)
	}
	var out struct {
		AccessToken string `json:"accessToken"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	return out.AccessToken, nil
}

func registerUser(base, tok, username string, roles []string) error {
	body := map[string]any{"riderId": username, "name": username, "tags": roles}
	resp, err := doJSON("POST", base+"/api/user/register", tok, body)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

func setAvailability(base, tok, status string, hours int) error {
	body := map[string]any{"status": status, "duration": hours}
	resp, err := doJSON("PUT", base+"/api/riders/availability/me", tok, body)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

type jobItem struct {
	JobID  string `json:"jobId"`
	Status string `json:"status"`
}

func findOpenJob(base, tok string) *jobItem {
	req, _ := http.NewRequest("GET", base+"/api/jobs", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	resp, err := httpClient.Do(req)
	if err != nil {
		cAPIErrors.Add(1)
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil
	}
	var jobs []jobItem
	if err := json.NewDecoder(resp.Body).Decode(&jobs); err != nil {
		return nil
	}
	// Shuffle so different riders pick different jobs
	rand.Shuffle(len(jobs), func(i, j int) { jobs[i], jobs[j] = jobs[j], jobs[i] })
	for i := range jobs {
		if jobs[i].Status == "open" {
			return &jobs[i]
		}
	}
	return nil
}

func createJob(base, tok, title, pickup, dropoff string) error {
	body := map[string]any{"title": title, "pickup": pickup, "dropoff": dropoff}
	resp, err := doJSON("POST", base+"/api/jobs", tok, body)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != 201 {
		return fmt.Errorf("createJob: HTTP %d", resp.StatusCode)
	}
	return nil
}

func updateJob(base, tok, jobID, status, acceptedBy string) error {
	body := map[string]any{"status": status, "acceptedBy": acceptedBy}
	resp, err := doJSON("PUT", base+"/api/jobs/"+jobID, tok, body)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		cAPIErrors.Add(1)
		return fmt.Errorf("updateJob %s→%s: HTTP %d", jobID, status, resp.StatusCode)
	}
	return nil
}

func createFleetBike(base, tok, make, model, reg string) (string, error) {
	body := map[string]any{
		"make":         make,
		"model":        model,
		"vehicleType":  "motorcycle",
		"registration": reg,
		"locationId":   "sim-depot",
	}
	resp, err := doJSON("POST", base+"/api/fleet/bikes", tok, body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 201 {
		return "", fmt.Errorf("createFleetBike: HTTP %d", resp.StatusCode)
	}
	var out struct {
		BikeID string `json:"bikeId"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return out.BikeID, nil
}

func setFleetBikeActive(base, tok, bikeID, active string) error {
	body := map[string]any{"active": active}
	resp, err := doJSON("PUT", base+"/api/fleet/bikes/"+bikeID, tok, body)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// ── HTTP util ────────────────────────────────────────────────────────────────

func doJSON(method, url, token string, body any) (*http.Response, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(method, url, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return httpClient.Do(req)
}

// ── misc helpers ─────────────────────────────────────────────────────────────

func containsStr(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}

func jitterMs(baseMs, extra int) time.Duration {
	return time.Duration(baseMs+rand.Intn(extra+1)) * time.Millisecond
}

func sleep(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
}

func printStats() {
	log.Printf("  Jobs created: %-5d  accepted: %-5d  completed: %-5d  cancelled: %-5d  bikes: %-4d  errors: %d",
		cJobsCreated.Load(), cJobsAccepted.Load(),
		cJobsCompleted.Load(), cJobsCancelled.Load(),
		cBikesCreated.Load(), cAPIErrors.Load())
}
