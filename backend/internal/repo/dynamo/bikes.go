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

type bikesRepo struct {
	client *dynamodb.Client
	table  *tableMeta
	name   string
}

type bikeItem struct {
	ID               string    `dynamodbav:"id,omitempty"`
	BikeID           string    `dynamodbav:"bikeId,omitempty"`
	BikeIDLegacy     string    `dynamodbav:"BikeID,omitempty"`
	Model            string    `dynamodbav:"model,omitempty"`
	Depot            string    `dynamodbav:"depot,omitempty"`
	Mileage          int       `dynamodbav:"mileage,omitempty"`
	LastServiceMiles int       `dynamodbav:"lastServiceMiles,omitempty"`
	LastServiceDate  time.Time `dynamodbav:"lastServiceDate,omitempty"`
	Status           string    `dynamodbav:"status,omitempty"`
	CurrentRiderID   string    `dynamodbav:"currentRiderId,omitempty"`
	LocationLat      float64   `dynamodbav:"locationLat,omitempty"`
	LocationLng      float64   `dynamodbav:"locationLng,omitempty"`
	UpdatedAt        time.Time `dynamodbav:"updatedAt,omitempty"`
}

func newBikesRepo(client *dynamodb.Client, tableName string) repo.BikesRepository {
	return &bikesRepo{client: client, table: newTableMeta(client, tableName), name: tableName}
}

func (r *bikesRepo) List(ctx context.Context) ([]repo.Bike, error) {
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{TableName: &r.name})
	if err != nil {
		return nil, err
	}
	items := make([]bikeItem, 0, len(out.Items))
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &items); err != nil {
		return nil, err
	}

	bikes := make([]repo.Bike, 0, len(items))
	for _, it := range items {
		id := it.ID
		if id == "" {
			if it.BikeID != "" {
				id = it.BikeID
			} else {
				id = it.BikeIDLegacy
			}
		}
		bikes = append(bikes, repo.Bike{
			ID:               id,
			Model:            it.Model,
			Depot:            it.Depot,
			Mileage:          it.Mileage,
			LastServiceMiles: it.LastServiceMiles,
			LastServiceDate:  it.LastServiceDate,
			Status:           it.Status,
			CurrentRiderID:   it.CurrentRiderID,
			LocationLat:      it.LocationLat,
			LocationLng:      it.LocationLng,
			UpdatedAt:        it.UpdatedAt,
		})
	}
	return bikes, nil
}

func (r *bikesRepo) Get(ctx context.Context, bikeID string) (*repo.Bike, bool, error) {
	if bikeID == "" {
		return nil, false, errors.New("bikeId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return nil, false, err
	}
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &r.name,
		Key:       map[string]types.AttributeValue{pk: &types.AttributeValueMemberS{Value: bikeID}},
	})
	if err != nil {
		return nil, false, err
	}
	if len(out.Item) == 0 {
		return nil, false, nil
	}
	var it bikeItem
	if err := attributevalue.UnmarshalMap(out.Item, &it); err != nil {
		return nil, false, err
	}
	id := it.ID
	if id == "" {
		if it.BikeID != "" {
			id = it.BikeID
		} else {
			id = it.BikeIDLegacy
		}
	}
	b := &repo.Bike{
		ID:               id,
		Model:            it.Model,
		Depot:            it.Depot,
		Mileage:          it.Mileage,
		LastServiceMiles: it.LastServiceMiles,
		LastServiceDate:  it.LastServiceDate,
		Status:           it.Status,
		CurrentRiderID:   it.CurrentRiderID,
		LocationLat:      it.LocationLat,
		LocationLng:      it.LocationLng,
		UpdatedAt:        it.UpdatedAt,
	}
	return b, true, nil
}

func (r *bikesRepo) Put(ctx context.Context, b *repo.Bike) error {
	if b == nil {
		return errors.New("bike required")
	}
	if b.ID == "" {
		return errors.New("id required")
	}
	if b.UpdatedAt.IsZero() {
		b.UpdatedAt = time.Now()
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return err
	}

	it := bikeItem{
		ID:               b.ID,
		BikeID:           b.ID,
		BikeIDLegacy:     b.ID,
		Model:            b.Model,
		Depot:            b.Depot,
		Mileage:          b.Mileage,
		LastServiceMiles: b.LastServiceMiles,
		LastServiceDate:  b.LastServiceDate,
		Status:           b.Status,
		CurrentRiderID:   b.CurrentRiderID,
		LocationLat:      b.LocationLat,
		LocationLng:      b.LocationLng,
		UpdatedAt:        b.UpdatedAt,
	}
	item, err := attributevalue.MarshalMap(it)
	if err != nil {
		return err
	}
	item[pk] = &types.AttributeValueMemberS{Value: b.ID}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: &r.name, Item: item})
	if err != nil {
		log.Printf("op=BikesPut table=%s bikeId=%s err=%v", r.name, b.ID, err)
		return fmt.Errorf("put bike: %w", err)
	}
	return nil
}

func (r *bikesRepo) Delete(ctx context.Context, bikeID string) (bool, error) {
	if bikeID == "" {
		return false, errors.New("bikeId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return false, err
	}
	out, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName:    &r.name,
		Key:          map[string]types.AttributeValue{pk: &types.AttributeValueMemberS{Value: bikeID}},
		ReturnValues: types.ReturnValueAllOld,
	})
	if err != nil {
		return false, err
	}
	return len(out.Attributes) > 0, nil
}
