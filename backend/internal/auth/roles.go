package auth

import (
	"strings"
)

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
