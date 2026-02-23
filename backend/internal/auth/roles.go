package auth

import (
	"context"
	"fmt"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// RolesFromContext extracts Cognito roles from the request context.
// Callable from any package without importing jwt directly.
func RolesFromContext(ctx context.Context) []string {
	return GetRolesFromClaims(ClaimsFromContext(ctx))
}

// UsernameFromContext extracts the authenticated username from the request context.
// Tries cognito:username, then username, then falls back to the JWT sub.
func UsernameFromContext(ctx context.Context) string {
	claims := ClaimsFromContext(ctx)
	if claims != nil {
		if u, ok := claims["cognito:username"].(string); ok && u != "" {
			return u
		}
		if u, ok := claims["username"].(string); ok && u != "" {
			return u
		}
	}
	return SubFromContext(ctx)
}

// GetRolesFromClaims extracts Cognito group roles from JWT claims.
// Works with both cognito:groups and custom roles claims.
func GetRolesFromClaims(claims jwt.MapClaims) []string {
	if claims == nil {
		return nil
	}
	if groups, ok := claims["cognito:groups"].([]interface{}); ok {
		roles := make([]string, len(groups))
		for i, g := range groups {
			roles[i] = fmt.Sprintf("%v", g)
		}
		return roles
	}
	if rolesI, ok := claims["roles"]; ok {
		switch rv := rolesI.(type) {
		case []interface{}:
			out := make([]string, len(rv))
			for i, r := range rv {
				out[i] = fmt.Sprintf("%v", r)
			}
			return out
		case []string:
			return rv
		}
	}
	return nil
}

// HasRole checks if a user has a specific role
func HasRole(roles []string, requiredRole string) bool {
	for _, role := range roles {
		if normalizeRoleName(role) == normalizeRoleName(requiredRole) {
			return true
		}
	}
	return false
}

// HasRoleOrAbove checks if a user has a specific role or higher hierarchy
// Role hierarchy: BloodBikeAdmin > FleetManager > Rider
func HasRoleOrAbove(roles []string, minRole string) bool {
	normalizedMin := normalizeRoleName(minRole)
	
	// Define role hierarchy (higher index = higher permission)
	roleHierarchy := map[string]int{
		"rider":        0,
		"dispatcher":   1,
		"fleetmanager": 2,
		"admin":        3,
	}
	
	minLevel := roleHierarchy[normalizedMin]
	
	for _, role := range roles {
		normalized := normalizeRoleName(role)
		if level, ok := roleHierarchy[normalized]; ok && level >= minLevel {
			return true
		}
	}
	return false
}

// normalizeRoleName converts various role formats to lowercase without special chars
func normalizeRoleName(role string) string {
	// Convert to lowercase and remove extra spaces
	normalized := strings.ToLower(strings.TrimSpace(role))
	// Remove hyphens, underscores, and "bloodbike" prefix
	normalized = strings.ReplaceAll(normalized, "-", "")
	normalized = strings.ReplaceAll(normalized, "_", "")
	normalized = strings.TrimPrefix(normalized, "bloodbike")
	return normalized
}
