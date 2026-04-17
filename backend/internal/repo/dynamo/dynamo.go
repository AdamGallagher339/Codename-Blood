package dynamo

import (
	"context"
	"errors"
	"os"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

type Repositories struct {
	Users        repo.UsersRepository
	Bikes        repo.BikesRepository
	Depots       repo.DepotsRepository
	Jobs         repo.JobsRepository
	Events       repo.EventsRepository
	RideSessions repo.RideSessionsRepository
	IssueReports repo.IssueReportsRepository
}

type Config struct {
	Region            string
	UsersTable        string
	BikesTable        string
	DepotsTable       string
	JobsTable         string
	EventsTable       string
	RideSessionsTable string
	IssueReportsTable string
}

func ConfigFromEnv() Config {
	return Config{
		Region:            os.Getenv("AWS_REGION"),
		UsersTable:        os.Getenv("USERS_TABLE"),
		BikesTable:        os.Getenv("BIKES_TABLE"),
		DepotsTable:       os.Getenv("DEPOTS_TABLE"),
		JobsTable:         os.Getenv("JOBS_TABLE"),
		EventsTable:       os.Getenv("EVENTS_TABLE"),
		RideSessionsTable: os.Getenv("RIDE_SESSIONS_TABLE"),
		IssueReportsTable: os.Getenv("ISSUE_REPORTS_TABLE"),
	}
}

func New(ctx context.Context, cfg Config) (*Repositories, error) {
	awsCfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	if cfg.Region != "" {
		awsCfg.Region = cfg.Region
	}
	if awsCfg.Region == "" {
		return nil, errors.New("AWS region not configured (set AWS_REGION)")
	}

	ddb := dynamodb.NewFromConfig(awsCfg)

	repos := &Repositories{}
	if cfg.UsersTable != "" {
		repos.Users = newUsersRepo(ddb, cfg.UsersTable)
	}
	if cfg.BikesTable != "" {
		repos.Bikes = newBikesRepo(ddb, cfg.BikesTable)
	}
	if cfg.DepotsTable != "" {
		repos.Depots = newDepotsRepo(ddb, cfg.DepotsTable)
	}
	if cfg.JobsTable != "" {
		repos.Jobs = newJobsRepo(ddb, cfg.JobsTable)
	}
	if cfg.EventsTable != "" {
		repos.Events = newEventsRepo(ddb, cfg.EventsTable)
	}
	if cfg.RideSessionsTable != "" {
		repos.RideSessions = newRideSessionsRepo(ddb, cfg.RideSessionsTable)
	}
	if cfg.IssueReportsTable != "" {
		repos.IssueReports = newIssueReportsRepo(ddb, cfg.IssueReportsTable)
	}

	return repos, nil
}
