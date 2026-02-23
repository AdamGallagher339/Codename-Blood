package push

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	webpush "github.com/SherClockHolmes/webpush-go"
	bolt "go.etcd.io/bbolt"
)

var bucketName = []byte("push_subscriptions")

// Store manages Web Push subscriptions, persisted in bbolt.
type Store struct {
	db            *bolt.DB
	vapidPublic   string
	vapidPrivate  string
	vapidContact  string
	mu            sync.RWMutex
	subscriptions map[string]*webpush.Subscription // key = endpoint
}

// NewStore opens (or creates) the push subscription database.
func NewStore() (*Store, error) {
	vapidPub := os.Getenv("VAPID_PUBLIC_KEY")
	vapidPriv := os.Getenv("VAPID_PRIVATE_KEY")
	vapidContact := os.Getenv("VAPID_CONTACT")
	if vapidPub == "" || vapidPriv == "" {
		return nil, fmt.Errorf("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set")
	}
	if vapidContact == "" {
		vapidContact = "admin@bloodbike.app"
	}
	// webpush-go adds "mailto:" automatically, so strip it if already present
	vapidContact = strings.TrimPrefix(vapidContact, "mailto:")

	dataDir := filepath.Join("..", "data")
	_ = os.MkdirAll(dataDir, 0o755)
	dbPath := filepath.Join(dataDir, "push.db")

	db, err := bolt.Open(dbPath, 0o600, &bolt.Options{Timeout: 2000000000}) // 2s
	if err != nil {
		return nil, fmt.Errorf("open push db: %w", err)
	}

	// Ensure bucket exists
	if err := db.Update(func(tx *bolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists(bucketName)
		return err
	}); err != nil {
		db.Close()
		return nil, err
	}

	s := &Store{
		db:            db,
		vapidPublic:   vapidPub,
		vapidPrivate:  vapidPriv,
		vapidContact:  vapidContact,
		subscriptions: make(map[string]*webpush.Subscription),
	}

	// Load existing subscriptions into memory
	_ = db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketName)
		return b.ForEach(func(k, v []byte) error {
			var sub webpush.Subscription
			if err := json.Unmarshal(v, &sub); err == nil {
				s.subscriptions[string(k)] = &sub
			}
			return nil
		})
	})

	log.Printf("Push store initialized with %d subscription(s)", len(s.subscriptions))
	return s, nil
}

// VAPIDPublicKey returns the public VAPID key for the frontend.
func (s *Store) VAPIDPublicKey() string {
	return s.vapidPublic
}

// Subscribe persists a push subscription.
func (s *Store) Subscribe(sub *webpush.Subscription) error {
	data, err := json.Marshal(sub)
	if err != nil {
		return err
	}
	if err := s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketName).Put([]byte(sub.Endpoint), data)
	}); err != nil {
		return err
	}
	s.mu.Lock()
	s.subscriptions[sub.Endpoint] = sub
	s.mu.Unlock()
	log.Printf("Push subscription added: %s...", truncate(sub.Endpoint, 60))
	return nil
}

// Unsubscribe removes a push subscription.
func (s *Store) Unsubscribe(endpoint string) error {
	if err := s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketName).Delete([]byte(endpoint))
	}); err != nil {
		return err
	}
	s.mu.Lock()
	delete(s.subscriptions, endpoint)
	s.mu.Unlock()
	log.Printf("Push subscription removed: %s...", truncate(endpoint, 60))
	return nil
}

// NotifyAll sends a push notification to all subscribers.
// Failed/expired subscriptions are automatically removed.
func (s *Store) NotifyAll(title, body, url string) {
	s.mu.RLock()
	subs := make([]*webpush.Subscription, 0, len(s.subscriptions))
	for _, sub := range s.subscriptions {
		subs = append(subs, sub)
	}
	s.mu.RUnlock()

	if len(subs) == 0 {
		log.Println("Push: no subscribers to notify")
		return
	}

	payload, _ := json.Marshal(map[string]any{
		"notification": map[string]any{
			"title":   title,
			"body":    body,
			"icon":    "/icons/icon-192x192.png",
			"badge":   "/icons/icon-96x96.png",
			"vibrate": []int{200, 100, 200},
			"data": map[string]string{
				"url": url,
			},
			"actions": []map[string]string{
				{"action": "open", "title": "View Job"},
			},
		},
	})

	log.Printf("Push: sending notification to %d subscriber(s): %s", len(subs), title)

	var wg sync.WaitGroup
	for _, sub := range subs {
		wg.Add(1)
		go func(sub *webpush.Subscription) {
			defer wg.Done()
			resp, err := webpush.SendNotification(payload, sub, &webpush.Options{
				Subscriber:      s.vapidContact,
				VAPIDPublicKey:  s.vapidPublic,
				VAPIDPrivateKey: s.vapidPrivate,
				TTL:             60,
				Urgency:         webpush.UrgencyHigh,
			})
			if err != nil {
				log.Printf("Push send error (%s...): %v", truncate(sub.Endpoint, 40), err)
				return
			}
			defer resp.Body.Close()
			respBody, _ := io.ReadAll(resp.Body)
			if resp.StatusCode >= 400 {
				log.Printf("Push rejected (%s...): status %d body=%s", truncate(sub.Endpoint, 40), resp.StatusCode, string(respBody))
				if resp.StatusCode == 404 || resp.StatusCode == 410 {
					_ = s.Unsubscribe(sub.Endpoint)
				}
			} else {
				log.Printf("Push sent OK (%s...): status %d", truncate(sub.Endpoint, 40), resp.StatusCode)
			}
		}(sub)
	}
	wg.Wait()
}

// SubscriberCount returns the number of active push subscribers.
func (s *Store) SubscriberCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.subscriptions)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
