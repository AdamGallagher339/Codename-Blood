package events

import "time"

type EventType string

type EventPriority string

type EventStatus string

const (
	EventStatusScheduled  EventStatus = "scheduled"
	EventStatusInProgress EventStatus = "in-progress"
	EventStatusCompleted  EventStatus = "completed"
	EventStatusCancelled  EventStatus = "cancelled"
)

type Event struct {
	ID             string        `json:"id"`
	Title          string        `json:"title"`
	Description    string        `json:"description"`
	Date           time.Time     `json:"date"`
	StartTime      string        `json:"startTime"`
	EndTime        string        `json:"endTime"`
	Location       string        `json:"location"`
	Type           EventType     `json:"type"`
	Priority       EventPriority `json:"priority"`
	AssignedRiders []string      `json:"assignedRiders,omitempty"`
	Status         EventStatus   `json:"status"`
	CreatedAt      time.Time     `json:"createdAt"`
	UpdatedAt      time.Time     `json:"updatedAt"`
}

type CreateEventRequest struct {
	Title          string        `json:"title"`
	Description    string        `json:"description"`
	Date           time.Time     `json:"date"`
	StartTime      string        `json:"startTime"`
	EndTime        string        `json:"endTime"`
	Location       string        `json:"location"`
	Type           EventType     `json:"type"`
	Priority       EventPriority `json:"priority"`
	AssignedRiders []string      `json:"assignedRiders,omitempty"`
}

type UpdateEventRequest struct {
	Title          *string        `json:"title,omitempty"`
	Description    *string        `json:"description,omitempty"`
	Date           *time.Time     `json:"date,omitempty"`
	StartTime      *string        `json:"startTime,omitempty"`
	EndTime        *string        `json:"endTime,omitempty"`
	Location       *string        `json:"location,omitempty"`
	Type           *EventType     `json:"type,omitempty"`
	Priority       *EventPriority `json:"priority,omitempty"`
	AssignedRiders *[]string      `json:"assignedRiders,omitempty"`
	Status         *EventStatus   `json:"status,omitempty"`
}
