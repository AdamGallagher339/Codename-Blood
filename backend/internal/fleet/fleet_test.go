package fleet

import (
"testing"
"time"
)

// ---- User.AddTag ----

func TestUser_AddTag_New(t *testing.T) {
u := &User{RiderID: "r1"}
u.AddTag("AdvancedRider")
if len(u.Tags) != 1 || u.Tags[0] != "AdvancedRider" {
t.Errorf("expected [AdvancedRider], got %v", u.Tags)
}
}

func TestUser_AddTag_NoDuplicates(t *testing.T) {
u := &User{RiderID: "r1"}
u.AddTag("AdvancedRider")
u.AddTag("AdvancedRider")
if len(u.Tags) != 1 {
t.Errorf("expected no duplicate tags, got %v", u.Tags)
}
}

func TestUser_AddTag_Multiple(t *testing.T) {
u := &User{RiderID: "r1"}
u.AddTag("A")
u.AddTag("B")
u.AddTag("C")
if len(u.Tags) != 3 {
t.Errorf("expected 3 tags, got %v", u.Tags)
}
}

func TestUser_AddTag_UpdatesTimestamp(t *testing.T) {
u := &User{RiderID: "r1"}
before := time.Now()
u.AddTag("T")
if u.UpdatedAt.Before(before) {
t.Error("UpdatedAt should be refreshed after AddTag")
}
}

// ---- User.RemoveTag ----

func TestUser_RemoveTag_Existing(t *testing.T) {
u := &User{RiderID: "r1", Tags: []string{"A", "B", "C"}}
u.RemoveTag("B")
if len(u.Tags) != 2 {
t.Errorf("expected 2 tags after remove, got %v", u.Tags)
}
for _, tag := range u.Tags {
if tag == "B" {
t.Error("tag B should have been removed")
}
}
}

func TestUser_RemoveTag_NotPresent(t *testing.T) {
u := &User{RiderID: "r1", Tags: []string{"A", "B"}}
u.RemoveTag("Z")
if len(u.Tags) != 2 {
t.Errorf("expected tags unchanged, got %v", u.Tags)
}
}

func TestUser_RemoveTag_LastTag(t *testing.T) {
u := &User{RiderID: "r1", Tags: []string{"only"}}
u.RemoveTag("only")
if len(u.Tags) != 0 {
t.Errorf("expected empty tags, got %v", u.Tags)
}
}

func TestUser_RemoveTag_Empty(t *testing.T) {
u := &User{RiderID: "r1"}
u.RemoveTag("anything") // should not panic
if len(u.Tags) != 0 {
t.Errorf("expected empty tags, got %v", u.Tags)
}
}

func TestUser_AddThenRemove(t *testing.T) {
u := &User{RiderID: "r1"}
u.AddTag("A")
u.AddTag("B")
u.RemoveTag("A")
if len(u.Tags) != 1 || u.Tags[0] != "B" {
t.Errorf("expected [B], got %v", u.Tags)
}
}
