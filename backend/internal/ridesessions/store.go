package ridesessions

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
)

var globalRepo repo.RideSessionsRepository

func SetRepository(r repo.RideSessionsRepository) {
	globalRepo = r
}

func List(ctx context.Context) ([]repo.RideSession, error) {
	if globalRepo == nil {
		return nil, errors.New("ride sessions not configured")
	}
	return globalRepo.List(ctx)
}

func Get(ctx context.Context, id string) (*repo.RideSession, bool, error) {
	if globalRepo == nil {
		return nil, false, errors.New("ride sessions not configured")
	}
	return globalRepo.Get(ctx, id)
}

func ListByBike(ctx context.Context, bikeID string) ([]repo.RideSession, error) {
	if globalRepo == nil {
		return nil, errors.New("ride sessions not configured")
	}
	return globalRepo.ListByBike(ctx, bikeID)
}

func Create(ctx context.Context, req CreateRequest) (*repo.RideSession, error) {
	if req.BikeID == "" {
		return nil, errors.New("bikeId required")
	}
	if req.RiderID == "" {
		return nil, errors.New("riderId required")
	}

	s := &repo.RideSession{
		SessionID:  newID(),
		BikeID:     req.BikeID,
		RiderID:    req.RiderID,
		Depot:      req.Depot,
		StartTime:  time.Now(),
		StartMiles: req.StartMiles,
	}
	if globalRepo != nil {
		if err := globalRepo.Put(ctx, s); err != nil {
			return nil, err
		}
	}
	return s, nil
}

func EndSession(ctx context.Context, id string, req EndRequest) (*repo.RideSession, error) {
	s, ok, err := Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("not found")
	}
	s.EndTime = time.Now()
	s.EndMiles = req.EndMiles
	if globalRepo != nil {
		if err := globalRepo.Put(ctx, s); err != nil {
			return nil, err
		}
	}
	return s, nil
}

func Delete(ctx context.Context, id string) (bool, error) {
	if globalRepo == nil {
		return false, errors.New("ride sessions not configured")
	}
	return globalRepo.Delete(ctx, id)
}

func newID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Request types

type CreateRequest struct {
	BikeID     string `json:"bikeId"`
	RiderID    string `json:"riderId"`
	Depot      string `json:"depot"`
	StartMiles int    `json:"startMiles"`
}

type EndRequest struct {
	EndMiles int `json:"endMiles"`
}
