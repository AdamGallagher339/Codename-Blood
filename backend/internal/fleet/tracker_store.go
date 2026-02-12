package fleet

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type TrackerStore struct {
	client       *dynamodb.Client
	bikesTable   string
	serviceTable string
}

func NewTrackerStore(ctx context.Context) (*TrackerStore, error) {
	bikesTable := os.Getenv("FLEET_BIKES_TABLE")
	serviceTable := os.Getenv("FLEET_SERVICE_TABLE")
	if bikesTable == "" || serviceTable == "" {
		return nil, errors.New("FLEET_BIKES_TABLE and FLEET_SERVICE_TABLE must be set")
	}

	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}

	return &TrackerStore{
		client:       dynamodb.NewFromConfig(cfg),
		bikesTable:   bikesTable,
		serviceTable: serviceTable,
	}, nil
}

func (s *TrackerStore) ListBikes(ctx context.Context) ([]FleetBike, error) {
	out, err := s.client.Scan(ctx, &dynamodb.ScanInput{TableName: &s.bikesTable})
	if err != nil {
		return nil, err
	}

	var bikes []FleetBike
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &bikes); err != nil {
		return nil, err
	}
	return bikes, nil
}

func (s *TrackerStore) GetBike(ctx context.Context, bikeID string) (*FleetBike, bool, error) {
	out, err := s.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &s.bikesTable,
		Key: map[string]types.AttributeValue{
			"BikeID": &types.AttributeValueMemberS{Value: bikeID},
		},
	})
	if err != nil {
		return nil, false, err
	}
	if len(out.Item) == 0 {
		return nil, false, nil
	}

	var bike FleetBike
	if err := attributevalue.UnmarshalMap(out.Item, &bike); err != nil {
		return nil, false, err
	}
	return &bike, true, nil
}

func (s *TrackerStore) PutBike(ctx context.Context, bike *FleetBike) error {
	item, err := attributevalue.MarshalMap(bike)
	if err != nil {
		return err
	}

	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &s.bikesTable,
		Item:      item,
	})
	return err
}

func (s *TrackerStore) AddServiceEntry(ctx context.Context, entry *ServiceEntry) error {
	item, err := attributevalue.MarshalMap(entry)
	if err != nil {
		return err
	}

	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &s.serviceTable,
		Item:      item,
	})
	return err
}

func (s *TrackerStore) ListServiceEntries(ctx context.Context, bikeID string) ([]ServiceEntry, error) {
	out, err := s.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              &s.serviceTable,
		KeyConditionExpression: awsString("BikeID = :bikeId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":bikeId": &types.AttributeValueMemberS{Value: bikeID},
		},
		ScanIndexForward: awsBool(false),
	})
	if err != nil {
		return nil, err
	}

	var entries []ServiceEntry
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &entries); err != nil {
		return nil, err
	}
	return entries, nil
}

func newServiceID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return "svc_" + hex.EncodeToString(b)
}

func awsString(value string) *string { return &value }

func awsBool(value bool) *bool { return &value }
