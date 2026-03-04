package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/AdamGallagher339/Codename-Blood/backend/internal/configdb"
	"github.com/AdamGallagher339/Codename-Blood/backend/internal/httpapi"
	"github.com/joho/godotenv"
)

func main() {
	ctx := context.Background()

	// Load .env file if it exists
	_ = godotenv.Load()

	if !strings.EqualFold(os.Getenv("APP_CONFIG_ENABLED"), "false") {
		tableName := os.Getenv("APP_CONFIG_TABLE")
		if tableName == "" {
			tableName = "AppConfig"
		}

		loaded, err := configdb.LoadEnvFromDynamo(ctx, tableName)
		if err != nil {
			log.Printf("Config DB env load skipped: %v", err)
		} else {
			log.Printf("Loaded %d env var(s) from DynamoDB table %s", loaded, tableName)
		}
	}

	h, err := httpapi.NewHandler(ctx)
	if err != nil {
		log.Fatal(err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port

	log.Printf("Backend running on %s", addr)
	log.Fatal(http.ListenAndServe(addr, h))
}
