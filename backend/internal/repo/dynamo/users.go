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

type usersRepo struct {
	client *dynamodb.Client
	table  *tableMeta
	name   string
}

type userItem struct {
	RiderID        string    `dynamodbav:"riderId,omitempty"`
	UserID         string    `dynamodbav:"userId,omitempty"`
	Name           string    `dynamodbav:"name,omitempty"`
	Email          string    `dynamodbav:"email,omitempty"`
	Tags           []string  `dynamodbav:"tags,omitempty"`
	Status         string    `dynamodbav:"status,omitempty"`
	AvailableUntil string    `dynamodbav:"availableUntil,omitempty"`
	CurrentJobID   string    `dynamodbav:"currentJobId,omitempty"`
	UpdatedAt      time.Time `dynamodbav:"updatedAt,omitempty"`
}

func newUsersRepo(client *dynamodb.Client, tableName string) repo.UsersRepository {
	return &usersRepo{client: client, table: newTableMeta(client, tableName), name: tableName}
}

func (r *usersRepo) List(ctx context.Context) ([]repo.User, error) {
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{TableName: &r.name})
	if err != nil {
		return nil, err
	}
	items := make([]userItem, 0, len(out.Items))
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &items); err != nil {
		return nil, err
	}

	users := make([]repo.User, 0, len(items))
	for _, it := range items {
		riderID := it.RiderID
		if riderID == "" {
			riderID = it.UserID
		}
		users = append(users, repo.User{
			RiderID:        riderID,
			Name:           it.Name,
			Email:          it.Email,
			Tags:           it.Tags,
			Status:         it.Status,
			AvailableUntil: it.AvailableUntil,
			CurrentJobID:   it.CurrentJobID,
			UpdatedAt:      it.UpdatedAt,
		})
	}
	return users, nil
}

func (r *usersRepo) Get(ctx context.Context, riderID string) (*repo.User, bool, error) {
	if riderID == "" {
		return nil, false, errors.New("riderId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return nil, false, err
	}
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &r.name,
		Key: map[string]types.AttributeValue{
			pk: &types.AttributeValueMemberS{Value: riderID},
		},
	})
	if err != nil {
		return nil, false, err
	}
	if len(out.Item) == 0 {
		return nil, false, nil
	}
	var it userItem
	if err := attributevalue.UnmarshalMap(out.Item, &it); err != nil {
		return nil, false, err
	}
	if it.RiderID == "" {
		it.RiderID = it.UserID
	}
	return &repo.User{RiderID: it.RiderID, Name: it.Name, Email: it.Email, Tags: it.Tags, Status: it.Status, AvailableUntil: it.AvailableUntil, CurrentJobID: it.CurrentJobID, UpdatedAt: it.UpdatedAt}, true, nil
}

func (r *usersRepo) Put(ctx context.Context, u *repo.User) error {
	if u == nil {
		return errors.New("user required")
	}
	if u.RiderID == "" {
		return errors.New("riderId required")
	}
	if u.UpdatedAt.IsZero() {
		u.UpdatedAt = time.Now()
	}

	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return err
	}

	it := userItem{
		RiderID:        u.RiderID,
		UserID:         u.RiderID,
		Name:           u.Name,
		Email:          u.Email,
		Tags:           u.Tags,
		Status:         u.Status,
		AvailableUntil: u.AvailableUntil,
		CurrentJobID:   u.CurrentJobID,
		UpdatedAt:      u.UpdatedAt,
	}

	item, err := attributevalue.MarshalMap(it)
	if err != nil {
		return err
	}
	// Ensure the table's actual PK attribute is present.
	item[pk] = &types.AttributeValueMemberS{Value: u.RiderID}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: &r.name, Item: item})
	if err != nil {
		log.Printf("op=UsersPut table=%s riderId=%s err=%v", r.name, u.RiderID, err)
		return fmt.Errorf("put user: %w", err)
	}
	return nil
}

func (r *usersRepo) Delete(ctx context.Context, riderID string) (bool, error) {
	if riderID == "" {
		return false, errors.New("riderId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return false, err
	}
	out, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName:    &r.name,
		Key:          map[string]types.AttributeValue{pk: &types.AttributeValueMemberS{Value: riderID}},
		ReturnValues: types.ReturnValueAllOld,
	})
	if err != nil {
		return false, err
	}
	if len(out.Attributes) == 0 {
		return false, nil
	}
	return true, nil
}
