package issuereports

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
)

var globalRepo repo.IssueReportsRepository

func SetRepository(r repo.IssueReportsRepository) {
	globalRepo = r
}

func List(ctx context.Context) ([]repo.IssueReport, error) {
	if globalRepo == nil {
		return nil, errors.New("issue reports not configured")
	}
	return globalRepo.List(ctx)
}

func Get(ctx context.Context, id string) (*repo.IssueReport, bool, error) {
	if globalRepo == nil {
		return nil, false, errors.New("issue reports not configured")
	}
	return globalRepo.Get(ctx, id)
}

func Create(ctx context.Context, req CreateRequest) (*repo.IssueReport, error) {
	if req.BikeID == "" {
		return nil, errors.New("bikeId required")
	}
	if req.Description == "" {
		return nil, errors.New("description required")
	}
	typ := req.Type
	if typ != "Minor" && typ != "Major" {
		typ = "Minor"
	}

	ir := &repo.IssueReport{
		IssueID:     newID(),
		BikeID:      req.BikeID,
		RiderID:     req.RiderID,
		Type:        typ,
		Description: req.Description,
		Timestamp:   time.Now(),
		Resolved:    false,
	}
	if globalRepo != nil {
		if err := globalRepo.Put(ctx, ir); err != nil {
			return nil, err
		}
	}
	return ir, nil
}

func Resolve(ctx context.Context, id string) (*repo.IssueReport, error) {
	ir, ok, err := Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("not found")
	}
	ir.Resolved = true
	if globalRepo != nil {
		if err := globalRepo.Put(ctx, ir); err != nil {
			return nil, err
		}
	}
	return ir, nil
}

func Delete(ctx context.Context, id string) (bool, error) {
	if globalRepo == nil {
		return false, errors.New("issue reports not configured")
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
	BikeID      string `json:"bikeId"`
	RiderID     string `json:"riderId"`
	Type        string `json:"type"`
	Description string `json:"description"`
}
