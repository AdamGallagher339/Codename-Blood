package tracking

import (
	"sync"
	"time"
)

// Store maintains in-memory location data and manages WebSocket connections
type Store struct {
	mu            sync.RWMutex
	locations     map[string]*LocationUpdate    // entityID -> latest location
	entities      map[string]*TrackedEntity      // entityID -> entity metadata
	clients       map[*Client]bool               // connected WebSocket clients
	broadcast     chan *LocationUpdate           // channel for broadcasting updates
	register      chan *Client                   // channel for registering clients
	unregister    chan *Client                   // channel for unregistering clients
	locationChan  chan *LocationUpdate           // channel for incoming location updates
	staleTimeout  time.Duration                  // duration after which location is considered stale
}

// Client represents a WebSocket connection
type Client struct {
	store *Store
	send  chan []byte // buffered channel for outbound messages
	done  chan struct{}
}

// NewStore creates a new tracking store with specified stale timeout
func NewStore(staleTimeout time.Duration) *Store {
	if staleTimeout == 0 {
		staleTimeout = 5 * time.Minute // default 5 minutes
	}
	
	return &Store{
		locations:    make(map[string]*LocationUpdate),
		entities:     make(map[string]*TrackedEntity),
		clients:      make(map[*Client]bool),
		broadcast:    make(chan *LocationUpdate, 256),
		register:     make(chan *Client),
		unregister:   make(chan *Client),
		locationChan: make(chan *LocationUpdate, 256),
		staleTimeout: staleTimeout,
	}
}

// Start runs the store's event loop (should be called in a goroutine)
func (s *Store) Start() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case client := <-s.register:
			s.registerClient(client)
			
		case client := <-s.unregister:
			s.unregisterClient(client)
			
		case update := <-s.locationChan:
			s.handleLocationUpdate(update)
			
		case update := <-s.broadcast:
			s.broadcastUpdate(update)
			
		case <-ticker.C:
			s.cleanupStaleLocations()
		}
	}
}

// UpdateLocation processes a new location update
func (s *Store) UpdateLocation(update *LocationUpdate) {
	s.locationChan <- update
}

// GetLocation retrieves the latest location for an entity
func (s *Store) GetLocation(entityID string) (*LocationUpdate, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	loc, ok := s.locations[entityID]
	if !ok {
		return nil, false
	}
	
	// Check if location is stale
	if time.Since(loc.UpdatedAt) > s.staleTimeout {
		return nil, false
	}
	
	return loc, true
}

// GetAllLocations returns all active (non-stale) locations
func (s *Store) GetAllLocations() []*LocationUpdate {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	var locations []*LocationUpdate
	now := time.Now()
	
	for _, loc := range s.locations {
		if now.Sub(loc.UpdatedAt) <= s.staleTimeout {
			locations = append(locations, loc)
		}
	}
	
	return locations
}

// GetAllEntities returns all tracked entities with their status
func (s *Store) GetAllEntities() []*TrackedEntity {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	entities := make([]*TrackedEntity, 0, len(s.entities))
	now := time.Now()
	
	for _, entity := range s.entities {
		// Update active status based on last update time
		entity.IsActive = now.Sub(entity.LastUpdateTime) <= s.staleTimeout
		entities = append(entities, entity)
	}
	
	return entities
}

// RegisterClient adds a new WebSocket client
func (s *Store) RegisterClient(client *Client) {
	s.register <- client
}

// UnregisterClient removes a WebSocket client
func (s *Store) UnregisterClient(client *Client) {
	s.unregister <- client
}

// Internal methods

func (s *Store) registerClient(client *Client) {
	s.mu.Lock()
	s.clients[client] = true
	s.mu.Unlock()
}

func (s *Store) unregisterClient(client *Client) {
	s.mu.Lock()
	if _, ok := s.clients[client]; ok {
		delete(s.clients, client)
		close(client.send)
	}
	s.mu.Unlock()
}

func (s *Store) handleLocationUpdate(update *LocationUpdate) {
	s.mu.Lock()
	
	// Store the location
	s.locations[update.EntityID] = update
	
	// Update or create entity metadata
	entity, exists := s.entities[update.EntityID]
	if !exists {
		entity = &TrackedEntity{
			EntityID:   update.EntityID,
			EntityType: update.EntityType,
			Name:       update.EntityID, // Default to ID, can be updated separately
			IsActive:   true,
		}
		s.entities[update.EntityID] = entity
	}
	
	entity.LastLocation = update
	entity.LastUpdateTime = update.UpdatedAt
	entity.IsActive = true
	
	s.mu.Unlock()
	
	// Broadcast to all connected clients
	s.broadcast <- update
}

func (s *Store) broadcastUpdate(update *LocationUpdate) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	// Marshal update to JSON would happen in the WebSocket handler
	// Here we just send to all client channels
	for client := range s.clients {
		select {
		case client.send <- nil: // Will be replaced with actual JSON in WebSocket handler
			// Message sent successfully
		default:
			// Client buffer is full, skip this client
			// In production, consider closing slow clients
		}
	}
}

func (s *Store) cleanupStaleLocations() {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	now := time.Now()
	
	// Mark entities as inactive if their location is stale
	for _, entity := range s.entities {
		if now.Sub(entity.LastUpdateTime) > s.staleTimeout {
			entity.IsActive = false
		}
	}
}
