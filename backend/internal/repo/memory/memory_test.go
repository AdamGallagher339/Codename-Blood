package memory

import (
"context"
"testing"
"time"

"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
)

var ctx = context.Background()

// ---- UsersRepo ----

func TestUsersRepo_PutAndGet(t *testing.T) {
r := NewUsersRepo()
u := &repo.User{RiderID: "rider-1", Name: "Alice"}
if err := r.Put(ctx, u); err != nil {
t.Fatalf("Put: %v", err)
}
got, ok, err := r.Get(ctx, "rider-1")
if err != nil || !ok {
t.Fatalf("Get: ok=%v err=%v", ok, err)
}
if got.Name != "Alice" {
t.Errorf("expected Name=Alice, got %s", got.Name)
}
}

func TestUsersRepo_GetNotFound(t *testing.T) {
r := NewUsersRepo()
_, ok, err := r.Get(ctx, "missing")
if err != nil {
t.Fatalf("unexpected error: %v", err)
}
if ok {
t.Error("expected false for missing key")
}
}

func TestUsersRepo_List(t *testing.T) {
r := NewUsersRepo()
for _, name := range []string{"Alice", "Bob", "Carol"} {
_ = r.Put(ctx, &repo.User{RiderID: name, Name: name})
}
users, err := r.List(ctx)
if err != nil {
t.Fatalf("List: %v", err)
}
if len(users) != 3 {
t.Errorf("expected 3 users, got %d", len(users))
}
}

func TestUsersRepo_Delete(t *testing.T) {
r := NewUsersRepo()
_ = r.Put(ctx, &repo.User{RiderID: "r1"})

deleted, err := r.Delete(ctx, "r1")
if err != nil || !deleted {
t.Fatalf("Delete: deleted=%v err=%v", deleted, err)
}

// Second delete returns false, not error
deleted, err = r.Delete(ctx, "r1")
if err != nil {
t.Fatalf("unexpected error on second delete: %v", err)
}
if deleted {
t.Error("expected false on second delete")
}
}

func TestUsersRepo_Put_Overwrites(t *testing.T) {
r := NewUsersRepo()
_ = r.Put(ctx, &repo.User{RiderID: "r1", Name: "OldName"})
_ = r.Put(ctx, &repo.User{RiderID: "r1", Name: "NewName"})
u, _, _ := r.Get(ctx, "r1")
if u.Name != "NewName" {
t.Errorf("expected NewName, got %s", u.Name)
}
}

// ---- BikesRepo ----

func TestBikesRepo_PutListGetDelete(t *testing.T) {
r := NewBikesRepo()
b := &repo.Bike{ID: "BB21-WES", Model: "Honda Pan European", Status: "Available"}
if err := r.Put(ctx, b); err != nil {
t.Fatalf("Put: %v", err)
}

got, ok, err := r.Get(ctx, "BB21-WES")
if err != nil || !ok {
t.Fatalf("Get: ok=%v err=%v", ok, err)
}
if got.Model != "Honda Pan European" {
t.Errorf("expected model Honda Pan European, got %s", got.Model)
}

list, err := r.List(ctx)
if err != nil || len(list) != 1 {
t.Fatalf("List: len=%d err=%v", len(list), err)
}

deleted, err := r.Delete(ctx, "BB21-WES")
if err != nil || !deleted {
t.Fatalf("Delete: %v", err)
}

_, ok, _ = r.Get(ctx, "BB21-WES")
if ok {
t.Error("expected bike to be absent after delete")
}
}

func TestBikesRepo_GetNotFound(t *testing.T) {
r := NewBikesRepo()
_, ok, err := r.Get(ctx, "missing")
if err != nil || ok {
t.Errorf("expected (nil, false, nil), got ok=%v err=%v", ok, err)
}
}

// ---- DepotsRepo ----

func TestDepotsRepo_PutListGetDelete(t *testing.T) {
r := NewDepotsRepo()
d := &repo.Depot{DepotID: "depot-1", Name: "Galway", Lat: 53.27, Lng: -9.05}
if err := r.Put(ctx, d); err != nil {
t.Fatalf("Put: %v", err)
}

got, ok, err := r.Get(ctx, "depot-1")
if err != nil || !ok {
t.Fatalf("Get: %v", err)
}
if got.Name != "Galway" {
t.Errorf("expected Galway, got %s", got.Name)
}

list, err := r.List(ctx)
if err != nil || len(list) != 1 {
t.Fatalf("List: %v", err)
}

deleted, err := r.Delete(ctx, "depot-1")
if err != nil || !deleted {
t.Fatalf("Delete: %v", err)
}
}

func TestDepotsRepo_DeleteNotFound(t *testing.T) {
r := NewDepotsRepo()
deleted, err := r.Delete(ctx, "missing")
if err != nil {
t.Fatalf("unexpected error: %v", err)
}
if deleted {
t.Error("expected false deleting nonexistent depot")
}
}

// ---- JobsRepo ----

func TestJobsRepo_PutGetListDelete(t *testing.T) {
r := NewJobsRepo()
j := &repo.Job{
JobID:  "job-1",
Title:  "Blood delivery",
Status: "open",
}
if err := r.Put(ctx, j); err != nil {
t.Fatalf("Put: %v", err)
}

got, ok, err := r.Get(ctx, "job-1")
if err != nil || !ok {
t.Fatalf("Get: %v", err)
}
if got.Title != "Blood delivery" {
t.Errorf("expected title 'Blood delivery', got %s", got.Title)
}

list, err := r.List(ctx)
if err != nil || len(list) != 1 {
t.Fatalf("List: %v", err)
}

deleted, err := r.Delete(ctx, "job-1")
if err != nil || !deleted {
t.Fatalf("Delete: %v", err)
}
}

func TestJobsRepo_Put_UpdatesExisting(t *testing.T) {
r := NewJobsRepo()
_ = r.Put(ctx, &repo.Job{JobID: "job-1", Status: "open"})
_ = r.Put(ctx, &repo.Job{JobID: "job-1", Status: "accepted"})
j, _, _ := r.Get(ctx, "job-1")
if j.Status != "accepted" {
t.Errorf("expected accepted, got %s", j.Status)
}
}

// ---- Concurrency ----

func TestUsersRepo_ConcurrentReadsWrites(t *testing.T) {
r := NewUsersRepo()
done := make(chan struct{})
go func() {
for i := 0; i < 200; i++ {
id := "rider-" + string(rune('A'+i%26))
_ = r.Put(ctx, &repo.User{RiderID: id, UpdatedAt: time.Now()})
}
close(done)
}()
for i := 0; i < 100; i++ {
_, _ = r.List(ctx)
}
<-done
}
