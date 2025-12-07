package auth

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/MicahParks/keyfunc"
    "github.com/golang-jwt/jwt/v5"
)

// jwks holds the cached JWKS fetched from Cognito
var jwks *keyfunc.JWKS

// InitJWKS initializes and starts a refresher for the JWKS from Cognito.
// region e.g. "us-east-1" and userPoolID e.g. "us-east-1_xxx" are required.
func InitJWKS(ctx context.Context, region, userPoolID string) error {
    if region == "" || userPoolID == "" {
        return fmt.Errorf("region and userPoolID must be provided")
    }

    jwksURL := fmt.Sprintf("https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json", region, userPoolID)

    options := keyfunc.Options{
        RefreshInterval:   time.Hour, // refresh keys hourly
        RefreshUnknownKID: true,
    }

    var err error
    jwks, err = keyfunc.Get(jwksURL, options)
    if err != nil {
        return fmt.Errorf("failed to get JWKS from %s: %w", jwksURL, err)
    }

    log.Printf("Initialized JWKS from %s\n", jwksURL)
    return nil
}

// Keyfunc returns a jwt.Keyfunc backed by the cached JWKS.
func Keyfunc() func(token *jwt.Token) (interface{}, error) {
    if jwks == nil {
        return func(token *jwt.Token) (interface{}, error) {
            return nil, fmt.Errorf("jwks not initialized")
        }
    }
    return jwks.Keyfunc
}
