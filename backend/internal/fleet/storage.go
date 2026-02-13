package fleet

import (
	"context"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
)

var usersRepo repo.UsersRepository
var bikesRepo repo.BikesRepository

// CognitoGroupManager allows the fleet package to sync roles to Cognito groups.
// It is intentionally tiny so we can set it from main without importing auth here.
type CognitoGroupManager interface {
	SetUserGroups(ctx context.Context, username string, groups []string) error
}

var cognitoGroups CognitoGroupManager

func SetRepositories(users repo.UsersRepository, bikes repo.BikesRepository) {
	usersRepo = users
	bikesRepo = bikes
}

func SetCognitoGroupManager(mgr CognitoGroupManager) {
	cognitoGroups = mgr
}
