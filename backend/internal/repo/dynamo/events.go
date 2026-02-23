package dynamo

import (
	"context"
	"errors"
	"fmt"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type eventsRepo struct {
	client *dynamodb.Client
	table  *tableMeta
	name   string
}

func newEventsRepo(client *dynamodb.Client, tableName string) repo.EventsRepository {
	return &eventsRepo{client: client, table: newTableMeta(client, tableName), name: tableName}
}

func (r *eventsRepo) List(ctx context.Context) ([]repo.Event, error) {
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{TableName: &r.name})
	if err != nil {
		return nil, err
	}
	items := make([]repo.Event, 0, len(out.Items))
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *eventsRepo) Get(ctx context.Context, eventID string) (*repo.Event, bool, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &r.name,
		Key:       map[string]types.AttributeValue{"id": &types.AttributeValueMemberS{Value: eventID}},
	})
	if err != nil {
		return nil, false, err
	}
	if len(out.Item) == 0 {
		return nil, false, nil
	}

	var event repo.Event
	if err := attributevalue.UnmarshalMap(out.Item, &event); err != nil {
		return nil, false, err
	}
	return &event, true, nil
}

func (r *eventsRepo) Put(ctx context.Context, e *repo.Event) error {
	if e.ID == "" {
		return errors.New("event ID required")
	}
	av, err := attributevalue.MarshalMap(e)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &r.name,
		Item:      av,
	})
	return err
}

func (r *eventsRepo) Delete(ctx context.Context, eventID string) (bool, error) {
	out, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName:    &r.name,
		Key:          map[string]types.AttributeValue{"id": &types.AttributeValueMemberS{Value: eventID}},
		ReturnValues: types.ReturnValueAllOld,
	})
	if err != nil {
		return false, err
	}
	return len(out.Attributes) > 0, nil
}
