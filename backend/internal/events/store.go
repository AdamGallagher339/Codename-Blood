package events

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
)

// Global repository for events (set by httpapi)
var globalEventsRepo repo.EventsRepository

var (
	// Fallback in-memory store
	fallbackEvents = make(map[string]*Event)
)

// SetGlobalEventsRepository sets the global events repository
func SetGlobalEventsRepository(r repo.EventsRepository) {
	globalEventsRepo = r
}

func List(ctx context.Context) ([]*Event, error) {
	if globalEventsRepo != nil {
		items, err := globalEventsRepo.List(ctx)
		if err != nil {
			return nil, err
		}
		events := make([]*Event, 0, len(items))
		for _, item := range items {
			e := &Event{
				ID:             item.ID,
				Title:          item.Title,
				Description:    item.Description,
				Date:           item.Date,
				StartTime:      item.StartTime,
				EndTime:        item.EndTime,
				Location:       item.Location,
				Lat:            item.Lat,
				Lng:            item.Lng,
				Type:           EventType(item.Type),
				Priority:       EventPriority(item.Priority),
				AssignedRiders: item.AssignedRiders,
				Status:         EventStatus(item.Status),
				CreatedAt:      item.CreatedAt,
				UpdatedAt:      item.UpdatedAt,
			}
			events = append(events, e)
		}
		return events, nil
	}

	// Fallback: return in-memory events
	out := make([]*Event, 0, len(fallbackEvents))
	for _, e := range fallbackEvents {
		out = append(out, e)
	}
	return out, nil
}

func Get(ctx context.Context, id string) (*Event, bool, error) {
	if globalEventsRepo != nil {
		item, ok, err := globalEventsRepo.Get(ctx, id)
		if err != nil {
			return nil, false, err
		}
		if !ok {
			return nil, false, nil
		}
		e := &Event{
			ID:             item.ID,
			Title:          item.Title,
			Description:    item.Description,
			Date:           item.Date,
			StartTime:      item.StartTime,
			EndTime:        item.EndTime,
			Location:       item.Location,
			Lat:            item.Lat,
			Lng:            item.Lng,
			Type:           EventType(item.Type),
			Priority:       EventPriority(item.Priority),
			AssignedRiders: item.AssignedRiders,
			Status:         EventStatus(item.Status),
			CreatedAt:      item.CreatedAt,
			UpdatedAt:      item.UpdatedAt,
		}
		return e, true, nil
	}

	// Fallback: return in-memory event
	e, ok := fallbackEvents[id]
	return e, ok, nil
}

func Create(ctx context.Context, req CreateEventRequest) (*Event, error) {
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
		Lat:            req.Lat,
		Lng:            req.Lng,
		Type:           req.Type,
		Priority:       req.Priority,
		AssignedRiders: req.AssignedRiders,
		Status:         EventStatusScheduled,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if globalEventsRepo != nil {
		repoItem := &repo.Event{
			ID:             e.ID,
			Title:          e.Title,
			Description:    e.Description,
			Date:           e.Date,
			StartTime:      e.StartTime,
			EndTime:        e.EndTime,
			Location:       e.Location,
			Lat:            e.Lat,
			Lng:            e.Lng,
			Type:           string(e.Type),
			Priority:       string(e.Priority),
			AssignedRiders: e.AssignedRiders,
			Status:         string(e.Status),
			CreatedAt:      e.CreatedAt,
			UpdatedAt:      e.UpdatedAt,
		}
		if err := globalEventsRepo.Put(ctx, repoItem); err != nil {
			return nil, err
		}
	} else {
		// Fallback: store in-memory
		fallbackEvents[id] = e
	}

	return e, nil
}

func Update(ctx context.Context, id string, req UpdateEventRequest) (*Event, error) {
	e, ok, err := Get(ctx, id)
	if err != nil {
		return nil, err
	}
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
	if req.Lat != nil {
		e.Lat = req.Lat
	}
	if req.Lng != nil {
		e.Lng = req.Lng
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

	if globalEventsRepo != nil {
		repoItem := &repo.Event{
			ID:             e.ID,
			Title:          e.Title,
			Description:    e.Description,
			Date:           e.Date,
			StartTime:      e.StartTime,
			EndTime:        e.EndTime,
			Location:       e.Location,
			Lat:            e.Lat,
			Lng:            e.Lng,
			Type:           string(e.Type),
			Priority:       string(e.Priority),
			AssignedRiders: e.AssignedRiders,
			Status:         string(e.Status),
			CreatedAt:      e.CreatedAt,
			UpdatedAt:      e.UpdatedAt,
		}
		if err := globalEventsRepo.Put(ctx, repoItem); err != nil {
			return nil, err
		}
	} else {
		// Fallback: update in-memory
		fallbackEvents[id] = e
	}

	return e, nil
}

func Delete(ctx context.Context, id string) (bool, error) {
	if globalEventsRepo != nil {
		return globalEventsRepo.Delete(ctx, id)
	}

	// Fallback: delete in-memory
	if _, ok := fallbackEvents[id]; !ok {
		return false, nil
	}
	delete(fallbackEvents, id)
	return true, nil
}

// StartCleanupTicker runs PurgeExpired immediately and then on a 1-minute tick
// for as long as ctx is alive. Call once at server startup.
func StartCleanupTicker(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		// Run once immediately so stale events from a previous run are cleared quickly.
		PurgeExpired(ctx)
		for {
			select {
			case <-ticker.C:
				PurgeExpired(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
	log.Println("[events] cleanup ticker started (runs every minute)")
}

// eventEndTime combines an event's Date and EndTime ("HH:MM") into a single UTC time.
func eventEndTime(e *Event) (time.Time, error) {
	if e.EndTime == "" {
		return time.Time{}, errors.New("no end time")
	}
	// Normalize: accept "HH:MM" or "HH:MM:SS"
	timePart := e.EndTime
	if len(strings.Split(timePart, ":")) == 2 {
		timePart += ":00"
	}
	dateStr := e.Date.UTC().Format("2006-01-02")
	return time.Parse("2006-01-02 15:04:05", dateStr+" "+timePart)
}

// PurgeExpired deletes all events whose end datetime is in the past.
func PurgeExpired(ctx context.Context) {
	all, err := List(ctx)
	if err != nil {
		log.Printf("[events] purge: failed to list events: %v", err)
		return
	}
	now := time.Now().UTC()
	for _, e := range all {
		end, err := eventEndTime(e)
		if err != nil {
			continue // skip events with unparseable end time
		}
		if now.After(end) {
			if _, err := Delete(ctx, e.ID); err != nil {
				log.Printf("[events] purge: failed to delete %s: %v", e.ID, err)
			} else {
				log.Printf("[events] purge: deleted expired event %q (ended %s)", e.Title, end.Format(time.RFC3339))
			}
		}
	}
}

func newID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return "evt_" + hex.EncodeToString(b)
}

