package main

import (
	"context"
	"log"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/httpapi"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
)

func main() {
	h, err := httpapi.NewHandler(context.Background())
	if err != nil {
		log.Fatal(err)
	}

	adapter := httpadapter.New(h)
	lambda.Start(adapter.ProxyWithContext)
}
