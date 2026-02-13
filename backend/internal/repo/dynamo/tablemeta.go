package dynamo

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type tableMeta struct {
	client *dynamodb.Client
	name   string

	once sync.Once
	err  error
	pk   string
	sk   string
}

func newTableMeta(client *dynamodb.Client, name string) *tableMeta {
	return &tableMeta{client: client, name: name}
}

func (t *tableMeta) ensure(ctx context.Context) error {
	t.once.Do(func() {
		out, err := t.client.DescribeTable(ctx, &dynamodb.DescribeTableInput{TableName: &t.name})
		if err != nil {
			t.err = fmt.Errorf("describe table %s: %w", t.name, err)
			return
		}
		if out.Table == nil {
			t.err = fmt.Errorf("describe table %s: missing table", t.name)
			return
		}

		var pk, sk string
		for _, ks := range out.Table.KeySchema {
			switch ks.KeyType {
			case types.KeyTypeHash:
				if ks.AttributeName != nil {
					pk = *ks.AttributeName
				}
			case types.KeyTypeRange:
				if ks.AttributeName != nil {
					sk = *ks.AttributeName
				}
			}
		}

		if pk == "" {
			t.err = errors.New("table has no partition key")
			return
		}
		t.pk = pk
		t.sk = sk
	})
	return t.err
}

func (t *tableMeta) partitionKey(ctx context.Context) (string, error) {
	if err := t.ensure(ctx); err != nil {
		return "", err
	}
	return t.pk, nil
}

func (t *tableMeta) sortKey(ctx context.Context) (string, bool, error) {
	if err := t.ensure(ctx); err != nil {
		return "", false, err
	}
	if t.sk == "" {
		return "", false, nil
	}
	return t.sk, true, nil
}
