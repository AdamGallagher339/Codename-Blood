package configdb

import (
	"context"
	"os"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func LoadEnvFromDynamo(ctx context.Context, tableName string) (int, error) {
	awsCfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return 0, err
	}

	client := dynamodb.NewFromConfig(awsCfg)
	paginator := dynamodb.NewScanPaginator(client, &dynamodb.ScanInput{TableName: &tableName})

	loaded := 0
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return loaded, err
		}

		for _, item := range page.Items {
			key, ok := stringAttr(item["key"])
			if !ok || strings.TrimSpace(key) == "" {
				continue
			}

			value := attrToString(item["value"])
			if err := os.Setenv(key, value); err != nil {
				continue
			}
			loaded++
		}
	}

	return loaded, nil
}

func stringAttr(attr types.AttributeValue) (string, bool) {
	s, ok := attr.(*types.AttributeValueMemberS)
	if !ok {
		return "", false
	}
	return s.Value, true
}

func attrToString(attr types.AttributeValue) string {
	switch v := attr.(type) {
	case *types.AttributeValueMemberS:
		return v.Value
	case *types.AttributeValueMemberN:
		return v.Value
	case *types.AttributeValueMemberBOOL:
		return strconv.FormatBool(v.Value)
	default:
		return ""
	}
}
