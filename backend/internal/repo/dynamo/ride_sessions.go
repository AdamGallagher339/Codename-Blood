package dynamo

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type rideSessionsRepo struct {
	client *dynamodb.Client
	table  *tableMeta
	name   string
}

type rideSessionItem struct {
	SessionID  string    `dynamodbav:"SessionID"`
	BikeID     string    `dynamodbav:"BikeID"`
	RiderID    string    `dynamodbav:"RiderID"`
	Depot      string    `dynamodbav:"Depot,omitempty"`
	StartTime  time.Time `dynamodbav:"StartTime"`
	EndTime    time.Time `dynamodbav:"EndTime,omitempty"`
	StartMiles int       `dynamodbav:"StartMiles,omitempty"`
	EndMiles   int       `dynamodbav:"EndMiles,omitempty"`
}

func newRideSessionsRepo(client *dynamodb.Client, tableName string) repo.RideSessionsRepository {
	return &rideSessionsRepo{client: client, table: newTableMeta(client, tableName), name: tableName}
}

func (r *rideSessionsRepo) List(ctx context.Context) ([]repo.RideSession, error) {
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{TableName: &r.name})
	if err != nil {
		return nil, err
	}
	var items []rideSessionItem
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &items); err != nil {
		return nil, err
	}
	sessions := make([]repo.RideSession, 0, len(items))
	for _, it := range items {
		sessions = append(sessions, toRepoSession(it))
	}
	return sessions, nil
}

func (r *rideSessionsRepo) Get(ctx context.Context, sessionID string) (*repo.RideSession, bool, error) {
	if sessionID == "" {
		return nil, false, errors.New("sessionId required")
	}
	// RideSessions has PK=SessionID, SK=BikeID. For Get-by-PK we query with PK only.
	out, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              &r.name,
		KeyConditionExpression: strPtr("SessionID = :sid"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":sid": &types.AttributeValueMemberS{Value: sessionID},
		},
	})
	if err != nil {
		return nil, false, err
	}
	if len(out.Items) == 0 {
		return nil, false, nil
	}
	var it rideSessionItem
	if err := attributevalue.UnmarshalMap(out.Items[0], &it); err != nil {
		return nil, false, err
	}
	s := toRepoSession(it)
	return &s, true, nil
}

func (r *rideSessionsRepo) Put(ctx context.Context, s *repo.RideSession) error {
	if s == nil {
		return errors.New("session required")
	}
	if s.SessionID == "" || s.BikeID == "" {
		return errors.New("sessionId and bikeId required")
	}
	it := rideSessionItem{
		SessionID:  s.SessionID,
		BikeID:     s.BikeID,
		RiderID:    s.RiderID,
		Depot:      s.Depot,
		StartTime:  s.StartTime,
		EndTime:    s.EndTime,
		StartMiles: s.StartMiles,
		EndMiles:   s.EndMiles,
	}
	item, err := attributevalue.MarshalMap(it)
	if err != nil {
		return err
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: &r.name, Item: item})
	if err != nil {
		log.Printf("op=RideSessionsPut table=%s sessionId=%s err=%v", r.name, s.SessionID, err)
		return fmt.Errorf("put ride session: %w", err)
	}
	return nil
}

func (r *rideSessionsRepo) Delete(ctx context.Context, sessionID string) (bool, error) {
	if sessionID == "" {
		return false, errors.New("sessionId required")
	}
	// Need to find all items with this PK (could be multiple SK values)
	sess, ok, err := r.Get(ctx, sessionID)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, nil
	}
	out, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: &r.name,
		Key: map[string]types.AttributeValue{
			"SessionID": &types.AttributeValueMemberS{Value: sessionID},
			"BikeID":    &types.AttributeValueMemberS{Value: sess.BikeID},
		},
		ReturnValues: types.ReturnValueAllOld,
	})
	if err != nil {
		return false, err
	}
	return len(out.Attributes) > 0, nil
}

func (r *rideSessionsRepo) ListByBike(ctx context.Context, bikeID string) ([]repo.RideSession, error) {
	// Full scan with filter — acceptable for low-volume table
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        &r.name,
		FilterExpression: strPtr("BikeID = :bid"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":bid": &types.AttributeValueMemberS{Value: bikeID},
		},
	})
	if err != nil {
		return nil, err
	}
	var items []rideSessionItem
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &items); err != nil {
		return nil, err
	}
	sessions := make([]repo.RideSession, 0, len(items))
	for _, it := range items {
		sessions = append(sessions, toRepoSession(it))
	}
	return sessions, nil
}

func toRepoSession(it rideSessionItem) repo.RideSession {
	return repo.RideSession{
		SessionID:  it.SessionID,
		BikeID:     it.BikeID,
		RiderID:    it.RiderID,
		Depot:      it.Depot,
		StartTime:  it.StartTime,
		EndTime:    it.EndTime,
		StartMiles: it.StartMiles,
		EndMiles:   it.EndMiles,
	}
}

func strPtr(s string) *string { return &s }
