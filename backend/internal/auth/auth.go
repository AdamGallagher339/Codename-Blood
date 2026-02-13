package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/aws/aws-sdk-go-v2/config"
	cognito "github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
	"github.com/golang-jwt/jwt/v5"
	bolt "go.etcd.io/bbolt"
)

type contextKey string

const (
	authSubKey    contextKey = "auth_sub"
	authClaimsKey contextKey = "auth_claims"
)

type AuthClient struct {
	client     *cognito.Client
	region     string
	userPoolID string
	clientID   string

	jwks     *keyfunc.JWKS
	jwksOnce sync.Once
	jwksErr  error
	// local mode (development) - simple in-memory users and HMAC-signed JWTs
	local     bool
	jwtSecret []byte
	usersMu   sync.RWMutex
	users     map[string]localUser
	db        *bolt.DB
}

type localUser struct {
	Username string
	Password string // stored plaintext for dev only
	Email    string
	Roles    []string
	Sub      string
}

type TokensResponse struct {
	AccessToken  string `json:"accessToken,omitempty"`
	IdToken      string `json:"idToken,omitempty"`
	RefreshToken string `json:"refreshToken,omitempty"`
	ExpiresIn    int32  `json:"expiresIn,omitempty"`
	TokenType    string `json:"tokenType,omitempty"`
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
	if region == "" {
		region = cfg.Region
	}
	if region == "" {
		return nil, errors.New("AWS region not configured (set AWS_REGION)")
	}
	// Ensure the service client uses the same region we record.
	cfg.Region = region

	return &AuthClient{
		client:     cognito.NewFromConfig(cfg),
		region:     region,
		userPoolID: userPool,
		clientID:   clientId,
	}, nil
}

// SetUserGroups sets a user's Cognito groups to match the provided list.
// This is used by the fleet package to keep roles (groups) in sync with the DB/API.
func (a *AuthClient) SetUserGroups(ctx context.Context, username string, groups []string) error {
	if username == "" {
		return errors.New("username required")
	}

	// Normalize desired groups (dedupe + stable)
	desiredSet := map[string]struct{}{}
	for _, g := range groups {
		if g == "" {
			continue
		}
		desiredSet[g] = struct{}{}
	}
	desired := make([]string, 0, len(desiredSet))
	for g := range desiredSet {
		desired = append(desired, g)
	}
	sort.Strings(desired)

	if a.local {
		// Best-effort local mode: update roles in the dev store.
		a.usersMu.Lock()
		u, ok := a.users[username]
		if ok {
			u.Roles = desired
			a.users[username] = u
			_ = a.saveUserToDB(u)
		}
		a.usersMu.Unlock()
		return nil
	}

	// Fetch current groups.
	currentSet := map[string]struct{}{}
	listOut, err := a.client.AdminListGroupsForUser(ctx, &cognito.AdminListGroupsForUserInput{
		UserPoolId: &a.userPoolID,
		Username:   &username,
	})
	if err != nil {
		return fmt.Errorf("list cognito groups: %w", err)
	}
	for _, g := range listOut.Groups {
		if g.GroupName != nil && *g.GroupName != "" {
			currentSet[*g.GroupName] = struct{}{}
		}
	}

	// Remove groups not desired.
	for g := range currentSet {
		if _, ok := desiredSet[g]; ok {
			continue
		}
		name := g
		_, err := a.client.AdminRemoveUserFromGroup(ctx, &cognito.AdminRemoveUserFromGroupInput{
			GroupName:  &name,
			UserPoolId: &a.userPoolID,
			Username:   &username,
		})
		if err != nil {
			return fmt.Errorf("remove user from group %s: %w", g, err)
		}
	}

	// Add missing desired groups.
	for _, g := range desired {
		if _, ok := currentSet[g]; ok {
			continue
		}
		name := g
		_, err := a.client.AdminAddUserToGroup(ctx, &cognito.AdminAddUserToGroupInput{
			GroupName:  &name,
			UserPoolId: &a.userPoolID,
			Username:   &username,
		})
		if err != nil {
			return fmt.Errorf("add user to group %s: %w", g, err)
		}
	}

	return nil
}

// NewLocalAuthClient returns an AuthClient configured for local development.
// It creates an in-memory user store and a default admin user.
func NewLocalAuthClient() *AuthClient {
	// Allow override of the dev JWT secret via env var for safety.
	s := os.Getenv("LOCAL_AUTH_SECRET")
	var secret []byte
	if s == "" {
		secret = []byte("dev-secret-change-me")
	} else {
		secret = []byte(s)
	}

	// Open (or create) DB for local users
	dataDir := filepath.Join("..", "data")
	_ = os.MkdirAll(dataDir, 0o755)
	dbPath := filepath.Join(dataDir, "users.db")
	db, err := bolt.Open(dbPath, 0o600, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		// If DB can't be opened, fall back to in-memory map
		users := map[string]localUser{}
		users["BloodBikeAdmin"] = localUser{
			Username: "BloodBikeAdmin",
			Password: "password",
			Email:    "admin@blood.bike",
			Roles:    []string{"BloodBikeAdmin"},
			Sub:      "local-admin-1",
		}
		return &AuthClient{local: true, jwtSecret: secret, users: users}
	}

	// Ensure users bucket exists
	_ = db.Update(func(tx *bolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte("users"))
		return err
	})

	a := &AuthClient{local: true, jwtSecret: secret, users: map[string]localUser{}, db: db}

	// load users from DB into memory
	_ = a.loadUsersFromDB()

	// ensure default admin exists
	a.usersMu.Lock()
	if _, ok := a.users["BloodBikeAdmin"]; !ok {
		u := localUser{Username: "BloodBikeAdmin", Password: "password", Email: "admin@blood.bike", Roles: []string{"BloodBikeAdmin"}, Sub: "local-admin-1"}
		a.users["BloodBikeAdmin"] = u
		_ = a.saveUserToDB(u)
	}
	a.usersMu.Unlock()
	return a
}

func (a *AuthClient) loadUsersFromDB() error {
	if a.db == nil {
		return errors.New("no db")
	}
	return a.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte("users"))
		if b == nil {
			return nil
		}
		return b.ForEach(func(k, v []byte) error {
			var u localUser
			if err := json.Unmarshal(v, &u); err != nil {
				return nil
			}
			a.users[string(k)] = u
			return nil
		})
	})
}

func (a *AuthClient) saveUserToDB(u localUser) error {
	if a.db == nil {
		return errors.New("no db")
	}
	data, err := json.Marshal(u)
	if err != nil {
		return err
	}
	return a.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte("users"))
		if b == nil {
			return errors.New("users bucket missing")
		}
		return b.Put([]byte(u.Username), data)
	})
}

// SignUpHandler expects JSON: { "username": "u", "password": "p", "email": "e" }
func (a *AuthClient) SignUpHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string   `json:"username"`
		Password string   `json:"password"`
		Email    string   `json:"email"`
		Roles    []string `json:"roles,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.Username == "" || body.Password == "" || body.Email == "" {
		http.Error(w, "username, password and email required", http.StatusBadRequest)
		return
	}

	if a.local {
		a.usersMu.Lock()
		defer a.usersMu.Unlock()
		if _, ok := a.users[body.Username]; ok {
			http.Error(w, "user exists", http.StatusConflict)
			return
		}
		u := localUser{
			Username: body.Username,
			Password: body.Password,
			Email:    body.Email,
			Roles:    body.Roles,
			Sub:      fmt.Sprintf("local-%s", body.Username),
		}
		a.users[body.Username] = u
		// persist
		_ = a.saveUserToDB(u)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"message": "signup created (local)"})
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
	if body.Username == "" || body.Code == "" {
		http.Error(w, "username and code required", http.StatusBadRequest)
		return
	}
	if a.local {
		// no-op for local
		json.NewEncoder(w).Encode(map[string]string{"message": "confirmed (local)"})
		return
	}
	input := &cognito.ConfirmSignUpInput{
		ClientId:         &a.clientID,
		Username:         &body.Username,
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
	if body.Username == "" || body.Password == "" {
		http.Error(w, "username and password required", http.StatusBadRequest)
		return
	}

	if a.local {
		a.usersMu.RLock()
		u, ok := a.users[body.Username]
		a.usersMu.RUnlock()
		if !ok || u.Password != body.Password {
			http.Error(w, "invalid username or password", http.StatusUnauthorized)
			return
		}
		// build a simple JWT (HS256)
		claims := jwt.MapClaims{
			"sub":              u.Sub,
			"cognito:username": u.Username,
			"email":            u.Email,
			"cognito:groups":   u.Roles,
			"exp":              time.Now().Add(24 * time.Hour).Unix(),
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signed, err := token.SignedString(a.jwtSecret)
		if err != nil {
			http.Error(w, "failed to sign token", http.StatusInternalServerError)
			return
		}
		out := TokensResponse{
			AccessToken: signed,
			IdToken:     signed,
			ExpiresIn:   86400,
			TokenType:   "Bearer",
		}
		writeJSON(w, http.StatusOK, out)
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
	if resp.AuthenticationResult == nil {
		http.Error(w, "signin requires additional steps", http.StatusConflict)
		return
	}

	result := resp.AuthenticationResult
	out := TokensResponse{}
	if result.AccessToken != nil {
		out.AccessToken = *result.AccessToken
	}
	if result.IdToken != nil {
		out.IdToken = *result.IdToken
	}
	if result.RefreshToken != nil {
		out.RefreshToken = *result.RefreshToken
	}
	out.ExpiresIn = result.ExpiresIn
	if result.TokenType != nil {
		out.TokenType = *result.TokenType
	}

	writeJSON(w, http.StatusOK, out)
}

// RequireAuth wraps handlers to verify Bearer JWTs (access or id token).
func (a *AuthClient) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, err := extractBearer(r)
		if err != nil {
			http.Error(w, "missing or invalid authorization header", http.StatusUnauthorized)
			return
		}
		claims, err := a.VerifyToken(r.Context(), token)
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		// attach subject + claims to context for downstream handlers
		sub, _ := claims["sub"].(string)
		ctx := context.WithValue(r.Context(), authSubKey, sub)
		ctx = context.WithValue(ctx, authClaimsKey, claims)
		next(w, r.WithContext(ctx))
	}
}

func (a *AuthClient) VerifyToken(ctx context.Context, tokenString string) (jwt.MapClaims, error) {
	if a.local {
		claims := jwt.MapClaims{}
		parsed, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
			// only HS256 supported for local tokens
			if token.Method != jwt.SigningMethodHS256 {
				return nil, errors.New("unexpected signing method")
			}
			return a.jwtSecret, nil
		})
		if err != nil {
			return nil, err
		}
		if parsed == nil || !parsed.Valid {
			return nil, errors.New("invalid token")
		}
		return claims, nil
	}

	// lazy init JWKS
	a.jwksOnce.Do(func() {
		jwksURL := fmt.Sprintf(
			"https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json",
			a.region,
			a.userPoolID,
		)

		a.jwks, a.jwksErr = keyfunc.Get(jwksURL, keyfunc.Options{
			RefreshInterval: time.Hour,
		})
	})

	if a.jwksErr != nil {
		return nil, a.jwksErr
	}

	claims := jwt.MapClaims{}
	parsed, err := jwt.ParseWithClaims(tokenString, claims, a.jwks.Keyfunc)
	if err != nil {
		return nil, err
	}
	if parsed == nil || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (a *AuthClient) MeHandler(w http.ResponseWriter, r *http.Request) {
	claims := ClaimsFromContext(r.Context())
	if claims == nil {
		http.Error(w, "no auth claims", http.StatusUnauthorized)
		return
	}

	roles := []string{}
	if raw, ok := claims["cognito:groups"]; ok {
		switch v := raw.(type) {
		case []any:
			for _, item := range v {
				if s, ok := item.(string); ok {
					roles = append(roles, s)
				}
			}
		case []string:
			roles = append(roles, v...)
		}
	}

	username, _ := claims["cognito:username"].(string)
	email, _ := claims["email"].(string)
	sub, _ := claims["sub"].(string)

	writeJSON(w, http.StatusOK, map[string]any{
		"sub":      sub,
		"username": username,
		"email":    email,
		"roles":    roles,
	})
}

// ListUsersHandler returns all auth users (admin only)
func (a *AuthClient) ListUsersHandler(w http.ResponseWriter, r *http.Request) {
	if a.local {
		a.usersMu.RLock()
		list := make([]map[string]any, 0)
		for _, u := range a.users {
			list = append(list, map[string]any{
				"username": u.Username,
				"email":    u.Email,
				"roles":    u.Roles,
				"sub":      u.Sub,
			})
		}
		a.usersMu.RUnlock()
		writeJSON(w, http.StatusOK, list)
		return
	}

	// For Cognito, this would need to call ListUsers API
	// For now, return empty list
	writeJSON(w, http.StatusOK, []map[string]any{})
}

func ClaimsFromContext(ctx context.Context) jwt.MapClaims {
	if ctx == nil {
		return nil
	}
	claims, _ := ctx.Value(authClaimsKey).(jwt.MapClaims)
	return claims
}

func SubFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	sub, _ := ctx.Value(authSubKey).(string)
	return sub
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// GetAllAuthUsers returns all auth users as a slice of maps for serialization
func (a *AuthClient) GetAllAuthUsers() []map[string]any {
	a.usersMu.RLock()
	defer a.usersMu.RUnlock()

	result := make([]map[string]any, 0, len(a.users))
	for _, u := range a.users {
		result = append(result, map[string]any{
			"username": u.Username,
			"email":    u.Email,
			"roles":    u.Roles,
			"sub":      u.Sub,
		})
	}
	return result
}
