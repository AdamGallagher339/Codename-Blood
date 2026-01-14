package events

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

var (
	mu     sync.RWMutex
	events = make(map[string]*Event)
)

func List() []*Event {
	mu.RLock()
	defer mu.RUnlock()

	out := make([]*Event, 0, len(events))
	for _, e := range events {
		out = append(out, e)
	}
	return out
}

func Get(id string) (*Event, bool) {
	mu.RLock()
	defer mu.RUnlock()
	e, ok := events[id]
	return e, ok
}

func Create(req CreateEventRequest) (*Event, error) {
	if req.Title == "" {
		return nil, errors.New("title required")
	}
	if req.Location == "" {
		return nil, errors.New("location required")
	}
	if req.StartTime == "" || req.EndTime == "" {
		return nil, errors.New("startTime and endTime required")
	}

	id := newID()
	now := time.Now()

	e := &Event{
		ID:             id,
		Title:          req.Title,
		Description:    req.Description,
		Date:           req.Date,
		StartTime:      req.StartTime,
		EndTime:        req.EndTime,
		Location:       req.Location,
		Type:           req.Type,
		Priority:       req.Priority,
		AssignedRiders: req.AssignedRiders,
		Status:         EventStatusScheduled,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	mu.Lock()
	events[id] = e
	mu.Unlock()

	return e, nil
}

func Update(id string, req UpdateEventRequest) (*Event, error) {
	mu.Lock()
	defer mu.Unlock()

	e, ok := events[id]
	if !ok {
		return nil, errors.New("not found")
	}

	if req.Title != nil {
		e.Title = *req.Title
	}
	if req.Description != nil {
		e.Description = *req.Description
	}
	if req.Date != nil {
		e.Date = *req.Date
	}
	if req.StartTime != nil {
		e.StartTime = *req.StartTime
	}
	if req.EndTime != nil {
		e.EndTime = *req.EndTime
	}
	if req.Location != nil {
		e.Location = *req.Location
	}
	if req.Type != nil {
		e.Type = *req.Type
	}
	if req.Priority != nil {
		e.Priority = *req.Priority
	}
	if req.AssignedRiders != nil {
		e.AssignedRiders = *req.AssignedRiders
	}
	if req.Status != nil {
		e.Status = *req.Status
	}

	e.UpdatedAt = time.Now()
	return e, nil
}

func Delete(id string) bool {
	mu.Lock()
	defer mu.Unlock()

	if _, ok := events[id]; !ok {
		return false
	}
	delete(events, id)
	return true
}

func newID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return "evt_" + hex.EncodeToString(b)
}
