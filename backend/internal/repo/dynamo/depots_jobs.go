package dynamo

import (
	"context"
	"errors"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/repo"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type depotsRepo struct {
	client *dynamodb.Client
	table  *tableMeta
	name   string
}

type depotItem struct {
	DepotID string  `dynamodbav:"depotId,omitempty"`
	Name    string  `dynamodbav:"name,omitempty"`
	Lat     float64 `dynamodbav:"lat,omitempty"`
	Lng     float64 `dynamodbav:"lng,omitempty"`
}

func newDepotsRepo(client *dynamodb.Client, tableName string) repo.DepotsRepository {
	return &depotsRepo{client: client, table: newTableMeta(client, tableName), name: tableName}
}

func (r *depotsRepo) List(ctx context.Context) ([]repo.Depot, error) {
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{TableName: &r.name})
	if err != nil {
		return nil, err
	}
	items := make([]depotItem, 0, len(out.Items))
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &items); err != nil {
		return nil, err
	}
	depots := make([]repo.Depot, 0, len(items))
	for _, it := range items {
		depots = append(depots, repo.Depot{DepotID: it.DepotID, Name: it.Name, Lat: it.Lat, Lng: it.Lng})
	}
	return depots, nil
}

func (r *depotsRepo) Get(ctx context.Context, depotID string) (*repo.Depot, bool, error) {
	if depotID == "" {
		return nil, false, errors.New("depotId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return nil, false, err
	}
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{TableName: &r.name, Key: map[string]types.AttributeValue{pk: &types.AttributeValueMemberS{Value: depotID}}})
	if err != nil {
		return nil, false, err
	}
	if len(out.Item) == 0 {
		return nil, false, nil
	}
	var it depotItem
	if err := attributevalue.UnmarshalMap(out.Item, &it); err != nil {
		return nil, false, err
	}
	return &repo.Depot{DepotID: it.DepotID, Name: it.Name, Lat: it.Lat, Lng: it.Lng}, true, nil
}

func (r *depotsRepo) Put(ctx context.Context, d *repo.Depot) error {
	if d == nil {
		return errors.New("depot required")
	}
	if d.DepotID == "" {
		return errors.New("depotId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return err
	}
	it := depotItem{DepotID: d.DepotID, Name: d.Name, Lat: d.Lat, Lng: d.Lng}
	item, err := attributevalue.MarshalMap(it)
	if err != nil {
		return err
	}
	item[pk] = &types.AttributeValueMemberS{Value: d.DepotID}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: &r.name, Item: item})
	return err
}

func (r *depotsRepo) Delete(ctx context.Context, depotID string) (bool, error) {
	if depotID == "" {
		return false, errors.New("depotId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return false, err
	}
	out, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: &r.name, Key: map[string]types.AttributeValue{pk: &types.AttributeValueMemberS{Value: depotID}}, ReturnValues: types.ReturnValueAllOld})
	if err != nil {
		return false, err
	}
	return len(out.Attributes) > 0, nil
}

type jobsRepo struct {
	client *dynamodb.Client
	table  *tableMeta
	name   string
}

type jobItem struct {
	JobID      string         `dynamodbav:"jobId,omitempty"`
	Title      string         `dynamodbav:"title,omitempty"`
	Status     string         `dynamodbav:"status,omitempty"`
	CreatedBy  string         `dynamodbav:"createdBy,omitempty"`
	AcceptedBy string         `dynamodbav:"acceptedBy,omitempty"`
	Pickup     map[string]any `dynamodbav:"pickup,omitempty"`
	Dropoff    map[string]any `dynamodbav:"dropoff,omitempty"`
	Timestamps map[string]any `dynamodbav:"timestamps,omitempty"`
}

func newJobsRepo(client *dynamodb.Client, tableName string) repo.JobsRepository {
	return &jobsRepo{client: client, table: newTableMeta(client, tableName), name: tableName}
}

func (r *jobsRepo) List(ctx context.Context) ([]repo.Job, error) {
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{TableName: &r.name})
	if err != nil {
		return nil, err
	}
	items := make([]jobItem, 0, len(out.Items))
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &items); err != nil {
		return nil, err
	}
	jobs := make([]repo.Job, 0, len(items))
	for _, it := range items {
		jobs = append(jobs, repo.Job{JobID: it.JobID, Title: it.Title, Status: it.Status, CreatedBy: it.CreatedBy, AcceptedBy: it.AcceptedBy, Pickup: it.Pickup, Dropoff: it.Dropoff, Timestamps: it.Timestamps})
	}
	return jobs, nil
}

func (r *jobsRepo) Get(ctx context.Context, jobID string) (*repo.Job, bool, error) {
	if jobID == "" {
		return nil, false, errors.New("jobId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return nil, false, err
	}
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{TableName: &r.name, Key: map[string]types.AttributeValue{pk: &types.AttributeValueMemberS{Value: jobID}}})
	if err != nil {
		return nil, false, err
	}
	if len(out.Item) == 0 {
		return nil, false, nil
	}
	var it jobItem
	if err := attributevalue.UnmarshalMap(out.Item, &it); err != nil {
		return nil, false, err
	}
	return &repo.Job{JobID: it.JobID, Title: it.Title, Status: it.Status, CreatedBy: it.CreatedBy, AcceptedBy: it.AcceptedBy, Pickup: it.Pickup, Dropoff: it.Dropoff, Timestamps: it.Timestamps}, true, nil
}

func (r *jobsRepo) Put(ctx context.Context, j *repo.Job) error {
	if j == nil {
		return errors.New("job required")
	}
	if j.JobID == "" {
		return errors.New("jobId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return err
	}
	it := jobItem{JobID: j.JobID, Title: j.Title, Status: j.Status, CreatedBy: j.CreatedBy, AcceptedBy: j.AcceptedBy, Pickup: j.Pickup, Dropoff: j.Dropoff, Timestamps: j.Timestamps}
	item, err := attributevalue.MarshalMap(it)
	if err != nil {
		return err
	}
	item[pk] = &types.AttributeValueMemberS{Value: j.JobID}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: &r.name, Item: item})
	return err
}

func (r *jobsRepo) Delete(ctx context.Context, jobID string) (bool, error) {
	if jobID == "" {
		return false, errors.New("jobId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return false, err
	}
	out, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{TableName: &r.name, Key: map[string]types.AttributeValue{pk: &types.AttributeValueMemberS{Value: jobID}}, ReturnValues: types.ReturnValueAllOld})
	if err != nil {
		return false, err
	}
	return len(out.Attributes) > 0, nil
}
