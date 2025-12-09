package main

import (
	"context"
	"encoding/json"
	"log"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

var client *dynamodb.Client
var tableName string

func init() {
	var err error

	tableName = os.Getenv("MOTORCYCLES_TABLE")
	if tableName == "" {
		log.Fatal("MOTORCYCLES_TABLE environment variable is not set")
	}

	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatalf("failed to load AWS config: %v", err)
	}

	client = dynamodb.NewFromConfig(cfg)
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {

	out, err := client.Scan(ctx, &dynamodb.ScanInput{
		TableName: &tableName,
	})
	if err != nil {
		log.Printf("DDB scan error: %v", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Body:       `{"error":"scan failed"}`,
		}, nil
	}

	items := []map[string]any{}

	for _, i := range out.Items {
		m := map[string]any{}
		for k, v := range i {
			switch t := v.(type) {
			case *types.AttributeValueMemberS:
				m[k] = t.Value
			case *types.AttributeValueMemberN:
				m[k] = t.Value
			}
		}
		items = append(items, m)
	}

	body, _ := json.Marshal(items)

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Body:       string(body),
		Headers:    map[string]string{"Content-Type": "application/json"},
	}, nil
}

func main() {
	lambda.Start(handler)
}
