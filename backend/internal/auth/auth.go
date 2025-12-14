package auth

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "net/http"
    "os"
    "sync"
    "time"

    "github.com/golang-jwt/jwt/v5"
    "github.com/MicahParks/keyfunc"
    "github.com/aws/aws-sdk-go-v2/config"
    cognito "github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
    "github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
)

type AuthClient struct {
    client     *cognito.Client
    region     string
    userPoolID string
    clientID   string

    jwks     *keyfunc.JWKS
    jwksOnce sync.Once
    jwksErr  error
}

// NewAuthClient initializes an AuthClient using environment variables:
// COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, AWS_REGION (optional)
func NewAuthClient(ctx context.Context) (*AuthClient, error) {
    userPool := os.Getenv("COGNITO_USER_POOL_ID")
    clientId := os.Getenv("COGNITO_CLIENT_ID")
    region := os.Getenv("AWS_REGION")
    if userPool == "" || clientId == "" {
        return nil, errors.New("COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set")
    }

    cfg, err := config.LoadDefaultConfig(ctx)
    if err != nil {
        return nil, fmt.Errorf("load aws config: %w", err)
    }

    return &AuthClient{
        client:     cognito.NewFromConfig(cfg),
        region:     region,
        userPoolID: userPool,
        clientID:   clientId,
    }, nil
}

// SignUpHandler expects JSON: { "username": "u", "password": "p", "email": "e" }
func (a *AuthClient) SignUpHandler(w http.ResponseWriter, r *http.Request) {
    var body struct {
        Username string `json:"username"`
        Password string `json:"password"`
        Email    string `json:"email"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        http.Error(w, "invalid request body", http.StatusBadRequest)
        return
    }
    if body.Username == "" || body.Password == "" || body.Email == "" {
        http.Error(w, "username, password and email required", http.StatusBadRequest)
        return
    }

    input := &cognito.SignUpInput{
        ClientId: &a.clientID,
        Username: &body.Username,
        Password: &body.Password,
        UserAttributes: []types.AttributeType{
            {Name: awsString("email"), Value: &body.Email},
        },
    }

    _, err := a.client.SignUp(r.Context(), input)
    if err != nil {
        http.Error(w, fmt.Sprintf("signup failed: %v", err), http.StatusBadRequest)
        return
    }

    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]string{"message": "signup initiated"})
}

// ConfirmSignUpHandler expects JSON: { "username": "u", "code": "123456" }
func (a *AuthClient) ConfirmSignUpHandler(w http.ResponseWriter, r *http.Request) {
    var body struct {
        Username string `json:"username"`
        Code     string `json:"code"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        http.Error(w, "invalid request body", http.StatusBadRequest)
        return
    }
    input := &cognito.ConfirmSignUpInput{
        ClientId: &a.clientID,
        Username: &body.Username,
        ConfirmationCode: &body.Code,
    }
    _, err := a.client.ConfirmSignUp(r.Context(), input)
    if err != nil {
        http.Error(w, fmt.Sprintf("confirm failed: %v", err), http.StatusBadRequest)
        return
    }
    json.NewEncoder(w).Encode(map[string]string{"message": "confirmed"})
}

// SignInHandler expects JSON: { "username": "u", "password": "p" }
// Responds with Cognito tokens JSON on success.
func (a *AuthClient) SignInHandler(w http.ResponseWriter, r *http.Request) {
    var body struct {
        Username string `json:"username"`
        Password string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        http.Error(w, "invalid request body", http.StatusBadRequest)
        return
    }

    input := &cognito.InitiateAuthInput{
        AuthFlow: types.AuthFlowTypeUserPasswordAuth,
        ClientId: &a.clientID,
        AuthParameters: map[string]string{
            "USERNAME": body.Username,
            "PASSWORD": body.Password,
        },
    }

    resp, err := a.client.InitiateAuth(r.Context(), input)
    if err != nil {
        http.Error(w, fmt.Sprintf("signin failed: %v", err), http.StatusUnauthorized)
        return
    }

    json.NewEncoder(w).Encode(resp.AuthenticationResult)
}

// RequireAuth wraps handlers to verify Bearer JWTs (access or id token).
func (a *AuthClient) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        token, err := extractBearer(r)
        if err != nil {
            http.Error(w, "missing or invalid authorization header", http.StatusUnauthorized)
            return
        }
        claims, err := a.parseAndVerifyToken(r.Context(), token)
        if err != nil {
            http.Error(w, "invalid token", http.StatusUnauthorized)
            return
        }
        // attach subject to context for downstream handlers
        ctx := context.WithValue(r.Context(), "auth_sub", claims.Subject)
        next(w, r.WithContext(ctx))
    }
}

func (a *AuthClient) parseAndVerifyToken(ctx context.Context, tokenString string) (*jwt.RegisteredClaims, error) {
    // lazy init JWKS
    a.jwksOnce.Do(func() {
        jwksURL := fmt.Sprintf("https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json", a.region, a.userPoolID)
        a.jwks, a.jwksErr = keyfunc.Get(jwksURL, keyfunc.Options{RefreshInterval: time.Hour})
    })
    if a.jwksErr != nil {
        return nil, a.jwksErr
    }

    var claims jwt.RegisteredClaims
    _, err := jwt.ParseWithClaims(tokenString, &claims, a.jwks.Keyfunc)
    if err != nil {
        return nil, err
    }
    return &claims, nil
}

func extractBearer(r *http.Request) (string, error) {
    h := r.Header.Get("Authorization")
    if h == "" {
        return "", errors.New("no auth header")
    }
    var token string
    fmt.Sscanf(h, "Bearer %s", &token)
    if token == "" {
        return "", errors.New("no bearer token")
    }
    return token, nil
}

func awsString(s string) *string { return &s }
