package push

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// HandleVAPIDPublicKey returns the VAPID public key so the frontend can subscribe.
// GET /api/push/vapid-key
func (s *Store) HandleVAPIDPublicKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"publicKey": s.vapidPublic,
	})
}

// HandleSubscribe stores a push subscription from the client.
// POST /api/push/subscribe  { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }
func (s *Store) HandleSubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, _ := io.ReadAll(r.Body)
	log.Printf("Push subscribe raw body: %s", string(body))

	var sub webpush.Subscription
	if err := json.Unmarshal(body, &sub); err != nil {
		log.Printf("Push subscribe decode error: %v", err)
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if sub.Endpoint == "" {
		http.Error(w, "endpoint required", http.StatusBadRequest)
		return
	}
	log.Printf("Push subscribe parsed: endpoint=%s p256dh=%s auth=%s",
		truncate(sub.Endpoint, 60),
		truncate(sub.Keys.P256dh, 20),
		truncate(sub.Keys.Auth, 20))

	if err := s.Subscribe(&sub); err != nil {
		http.Error(w, "failed to subscribe", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "subscribed"})
}

// HandleUnsubscribe removes a push subscription.
// POST /api/push/unsubscribe  { "endpoint": "..." }
func (s *Store) HandleUnsubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var reqBody struct {
		Endpoint string `json:"endpoint"`
	}
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if reqBody.Endpoint == "" {
		http.Error(w, "endpoint required", http.StatusBadRequest)
		return
	}
	_ = s.Unsubscribe(reqBody.Endpoint)
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "unsubscribed"})
}

// HandleTestNotification sends a test push to all subscribers.
// POST /api/push/test
func (s *Store) HandleTestNotification(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	count := s.SubscriberCount()
	if count == 0 {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":      "no_subscribers",
			"subscribers": 0,
		})
		return
	}
	s.NotifyAll("\U0001F514 Test Notification", "If you see this, push notifications are working!", "/")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":      "sent",
		"subscribers": count,
	})
}
