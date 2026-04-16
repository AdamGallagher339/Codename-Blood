package auth

import (
"context"
"testing"

"github.com/golang-jwt/jwt/v5"
)

// ---- GetRolesFromClaims ----

func TestGetRolesFromClaims_Nil(t *testing.T) {
roles := GetRolesFromClaims(nil)
if roles != nil {
t.Errorf("expected nil, got %v", roles)
}
}

func TestGetRolesFromClaims_CognitoGroups(t *testing.T) {
claims := jwt.MapClaims{
"cognito:groups": []interface{}{"Admin", "Rider"},
}
roles := GetRolesFromClaims(claims)
if len(roles) != 2 {
t.Fatalf("expected 2 roles, got %v", roles)
}
if roles[0] != "Admin" || roles[1] != "Rider" {
t.Errorf("unexpected roles: %v", roles)
}
}

func TestGetRolesFromClaims_RolesSliceInterface(t *testing.T) {
claims := jwt.MapClaims{
"roles": []interface{}{"Dispatcher", "FleetManager"},
}
roles := GetRolesFromClaims(claims)
if len(roles) != 2 {
t.Fatalf("expected 2 roles, got %v", roles)
}
}

func TestGetRolesFromClaims_RolesSliceString(t *testing.T) {
claims := jwt.MapClaims{
"roles": []string{"Rider"},
}
roles := GetRolesFromClaims(claims)
if len(roles) != 1 || roles[0] != "Rider" {
t.Errorf("expected [Rider], got %v", roles)
}
}

func TestGetRolesFromClaims_NoClaims(t *testing.T) {
claims := jwt.MapClaims{"sub": "user-123"}
roles := GetRolesFromClaims(claims)
if roles != nil {
t.Errorf("expected nil for claims with no roles, got %v", roles)
}
}

// ---- HasRole ----

func TestHasRole_Present(t *testing.T) {
if !HasRole([]string{"Admin", "Rider"}, "Admin") {
t.Error("expected HasRole to return true for Admin")
}
}

func TestHasRole_Absent(t *testing.T) {
if HasRole([]string{"Rider"}, "Admin") {
t.Error("expected HasRole to return false for Admin")
}
}

func TestHasRole_CaseInsensitive(t *testing.T) {
if !HasRole([]string{"RIDER"}, "rider") {
t.Error("expected HasRole to be case-insensitive")
}
}

func TestHasRole_BloodBikePrefix(t *testing.T) {
if !HasRole([]string{"BloodBikeAdmin"}, "Admin") {
t.Error("expected BloodBikeAdmin to match Admin after prefix strip")
}
}

func TestHasRole_EmptyRoles(t *testing.T) {
if HasRole([]string{}, "Rider") {
t.Error("expected false for empty roles")
}
}

// ---- HasRoleOrAbove ----

func TestHasRoleOrAbove_AdminHasAll(t *testing.T) {
roles := []string{"Admin"}
for _, required := range []string{"Rider", "Dispatcher", "FleetManager", "Admin"} {
if !HasRoleOrAbove(roles, required) {
t.Errorf("Admin should satisfy %s", required)
}
}
}

func TestHasRoleOrAbove_RiderOnlyRider(t *testing.T) {
roles := []string{"Rider"}
if !HasRoleOrAbove(roles, "Rider") {
t.Error("Rider should satisfy Rider")
}
if HasRoleOrAbove(roles, "Admin") {
t.Error("Rider should not satisfy Admin")
}
}

func TestHasRoleOrAbove_FleetManagerLevel(t *testing.T) {
roles := []string{"FleetManager"}
if !HasRoleOrAbove(roles, "Dispatcher") {
t.Error("FleetManager should satisfy Dispatcher")
}
if HasRoleOrAbove(roles, "Admin") {
t.Error("FleetManager should not satisfy Admin")
}
}

func TestHasRoleOrAbove_UnknownRoleReturnsFalse(t *testing.T) {
if HasRoleOrAbove([]string{"UnknownRole"}, "Rider") {
t.Error("unknown role should not satisfy any level")
}
}

// ---- UsernameFromContext ----

func TestUsernameFromContext_CognitoUsername(t *testing.T) {
claims := jwt.MapClaims{"cognito:username": "alice"}
ctx := context.WithValue(context.Background(), authClaimsKey, claims)
if got := UsernameFromContext(ctx); got != "alice" {
t.Errorf("expected alice, got %s", got)
}
}

func TestUsernameFromContext_FallbackUsername(t *testing.T) {
claims := jwt.MapClaims{"username": "bob"}
ctx := context.WithValue(context.Background(), authClaimsKey, claims)
if got := UsernameFromContext(ctx); got != "bob" {
t.Errorf("expected bob, got %s", got)
}
}

func TestUsernameFromContext_FallbackSub(t *testing.T) {
ctx := context.WithValue(context.Background(), authSubKey, "sub-123")
if got := UsernameFromContext(ctx); got != "sub-123" {
t.Errorf("expected sub-123, got %s", got)
}
}

func TestUsernameFromContext_EmptyContext(t *testing.T) {
got := UsernameFromContext(context.Background())
if got != "" {
t.Errorf("expected empty string for blank context, got %s", got)
}
}
