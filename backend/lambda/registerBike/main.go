package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type Motorcycle struct {
	BikeID    string `json:"bikeId"`
	Model     string `json:"model"`
	Depot     string `json:"depot"`
	Status    string `json:"status"`
	Mileage   int    `json:"mileage"`
	UpdatedAt int64  `json:"updatedAt"`
}

var client *dynamodb.Client
var tableName string

func init() {
	tableName = os.Getenv("MOTORCYCLES_TABLE")
	if tableName == "" {
		log.Fatal("MOTORCYCLES_TABLE environment variable missing")
	}

	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatalf("Unable to load SDK config, %v", err)
	}

	client = dynamodb.NewFromConfig(cfg)
}

func handler(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {

	var bike Motorcycle
	if err := json.Unmarshal([]byte(req.Body), &bike); err != nil {
		log.Println("Invalid JSON:", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Body:       `{"error":"invalid JSON"}`,
		}, nil
	}

	bike.UpdatedAt = time.Now().UnixMilli()

	_, err := client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &tableName,
		Item: map[string]types.AttributeValue{
			"BikeID":    &types.AttributeValueMemberS{Value: bike.BikeID},
			"Model":     &types.AttributeValueMemberS{Value: bike.Model},
			"Depot":     &types.AttributeValueMemberS{Value: bike.Depot},
			"Status":    &types.AttributeValueMemberS{Value: bike.Status},
			"Mileage":   &types.AttributeValueMemberN{Value: strconv.Itoa(bike.Mileage)},
			"UpdatedAt": &types.AttributeValueMemberN{Value: strconv.FormatInt(bike.UpdatedAt, 10)},
		},
	})

	if err != nil {
		log.Println("PutItem error:", err)
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Body:       `{"error":"unable to write to database"}`,
		}, nil
	}

	response, _ := json.Marshal(bike)

	return events.APIGatewayProxyResponse{
		StatusCode: 201,
		Body:       string(response),
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
	}, nil
}

func main() {
	lambda.Start(handler)
}
