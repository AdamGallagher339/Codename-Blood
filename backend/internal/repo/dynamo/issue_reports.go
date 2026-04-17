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

type issueReportsRepo struct {
	client *dynamodb.Client
	table  *tableMeta
	name   string
}

type issueReportItem struct {
	IssueID     string    `dynamodbav:"IssueID"`
	BikeID      string    `dynamodbav:"BikeID,omitempty"`
	RiderID     string    `dynamodbav:"RiderID,omitempty"`
	Type        string    `dynamodbav:"Type,omitempty"`
	Description string    `dynamodbav:"Description,omitempty"`
	Timestamp   time.Time `dynamodbav:"Timestamp"`
	Resolved    bool      `dynamodbav:"Resolved"`
}

func newIssueReportsRepo(client *dynamodb.Client, tableName string) repo.IssueReportsRepository {
	return &issueReportsRepo{client: client, table: newTableMeta(client, tableName), name: tableName}
}

func (r *issueReportsRepo) List(ctx context.Context) ([]repo.IssueReport, error) {
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{TableName: &r.name})
	if err != nil {
		return nil, err
	}
	var items []issueReportItem
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &items); err != nil {
		return nil, err
	}
	reports := make([]repo.IssueReport, 0, len(items))
	for _, it := range items {
		reports = append(reports, toRepoIssue(it))
	}
	return reports, nil
}

func (r *issueReportsRepo) Get(ctx context.Context, issueID string) (*repo.IssueReport, bool, error) {
	if issueID == "" {
		return nil, false, errors.New("issueId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return nil, false, err
	}
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &r.name,
		Key:       map[string]types.AttributeValue{pk: &types.AttributeValueMemberS{Value: issueID}},
	})
	if err != nil {
		return nil, false, err
	}
	if len(out.Item) == 0 {
		return nil, false, nil
	}
	var it issueReportItem
	if err := attributevalue.UnmarshalMap(out.Item, &it); err != nil {
		return nil, false, err
	}
	ir := toRepoIssue(it)
	return &ir, true, nil
}

func (r *issueReportsRepo) Put(ctx context.Context, ir *repo.IssueReport) error {
	if ir == nil {
		return errors.New("issue report required")
	}
	if ir.IssueID == "" {
		return errors.New("issueId required")
	}
	if ir.Timestamp.IsZero() {
		ir.Timestamp = time.Now()
	}
	it := issueReportItem{
		IssueID:     ir.IssueID,
		BikeID:      ir.BikeID,
		RiderID:     ir.RiderID,
		Type:        ir.Type,
		Description: ir.Description,
		Timestamp:   ir.Timestamp,
		Resolved:    ir.Resolved,
	}
	item, err := attributevalue.MarshalMap(it)
	if err != nil {
		return err
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return err
	}
	item[pk] = &types.AttributeValueMemberS{Value: ir.IssueID}

	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: &r.name, Item: item})
	if err != nil {
		log.Printf("op=IssueReportsPut table=%s issueId=%s err=%v", r.name, ir.IssueID, err)
		return fmt.Errorf("put issue report: %w", err)
	}
	return nil
}

func (r *issueReportsRepo) Delete(ctx context.Context, issueID string) (bool, error) {
	if issueID == "" {
		return false, errors.New("issueId required")
	}
	pk, err := r.table.partitionKey(ctx)
	if err != nil {
		return false, err
	}
	out, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName:    &r.name,
		Key:          map[string]types.AttributeValue{pk: &types.AttributeValueMemberS{Value: issueID}},
		ReturnValues: types.ReturnValueAllOld,
	})
	if err != nil {
		return false, err
	}
	return len(out.Attributes) > 0, nil
}

func toRepoIssue(it issueReportItem) repo.IssueReport {
	return repo.IssueReport{
		IssueID:     it.IssueID,
		BikeID:      it.BikeID,
		RiderID:     it.RiderID,
		Type:        it.Type,
		Description: it.Description,
		Timestamp:   it.Timestamp,
		Resolved:    it.Resolved,
	}
}
