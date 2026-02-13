package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/aws/aws-sdk-go-v2/config"
	cognito "github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
	"github.com/aws/smithy-go"
	"github.com/golang-jwt/jwt/v5"
	bolt "go.etcd.io/bbolt"
)

type contextKey string

const (
	authSubKey    contextKey = "auth_sub"
	authClaimsKey contextKey = "auth_claims"
)

type AuthClient struct {
	client       *cognito.Client
	region       string
	userPoolID   string
	clientID     string
	clientSecret string

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
	// Local/dev mode shortcut (useful for local testing without Cognito).
	//
	// Supported flags:
	// - AUTH_MODE=local
	// - LOCAL_AUTH=1|true
	mode := strings.TrimSpace(strings.ToLower(os.Getenv("AUTH_MODE")))
	localFlag := strings.TrimSpace(strings.ToLower(os.Getenv("LOCAL_AUTH")))
	if mode == "local" || localFlag == "1" || localFlag == "true" || localFlag == "yes" {
		return NewLocalAuthClient(), nil
	}

	userPool := os.Getenv("COGNITO_USER_POOL_ID")
	clientId := os.Getenv("COGNITO_CLIENT_ID")
	clientSecret := os.Getenv("COGNITO_CLIENT_SECRET")
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

	a := &AuthClient{
		client:       cognito.NewFromConfig(cfg),
		region:       region,
		userPoolID:   userPool,
		clientID:     clientId,
		clientSecret: clientSecret,
	}
	log.Printf("Auth mode local=%v region=%s userPool=%s clientID=%s hasSecret=%v", a.local, a.region, a.userPoolID, a.clientID, a.clientSecret != "")
	return a, nil
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

// ListUsersInGroup returns the usernames of all users in a Cognito group.
func (a *AuthClient) ListUsersInGroup(ctx context.Context, groupName string) ([]string, error) {
	if a.local {
		a.usersMu.RLock()
		defer a.usersMu.RUnlock()
		var out []string
		for _, u := range a.users {
			for _, r := range u.Roles {
				if strings.EqualFold(r, groupName) {
					out = append(out, u.Username)
					break
				}
			}
		}
		return out, nil
	}

	var usernames []string
	var nextToken *string
	for {
		input := &cognito.ListUsersInGroupInput{
			UserPoolId: &a.userPoolID,
			GroupName:  &groupName,
			NextToken:  nextToken,
		}
		out, err := a.client.ListUsersInGroup(ctx, input)
		if err != nil {
			return nil, fmt.Errorf("list users in group %s: %w", groupName, err)
		}
		for _, u := range out.Users {
			if u.Username != nil {
				usernames = append(usernames, *u.Username)
			}
		}
		if out.NextToken == nil {
			break
		}
		nextToken = out.NextToken
	}
	return usernames, nil
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

	// Add SECRET_HASH if client has a secret
	if a.clientSecret != "" {
		input.SecretHash = awsString(a.computeSecretHash(body.Username))
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

	// Add SECRET_HASH if client has a secret
	if a.clientSecret != "" {
		input.SecretHash = awsString(a.computeSecretHash(body.Username))
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

	// Add SECRET_HASH if client has a secret
	if a.clientSecret != "" {
		hash := a.computeSecretHash(body.Username)
		input.AuthParameters["SECRET_HASH"] = hash
		log.Printf("SignIn with SECRET_HASH: username=%s hash=%s", body.Username, hash[:20]+"...")
	} else {
		log.Printf("SignIn without SECRET_HASH (no client secret configured)")
	}

	resp, err := a.client.InitiateAuth(r.Context(), input)
	if err != nil {
		fmt.Printf("InitiateAuth err type=%T err=%v\n", err, err)
		http.Error(w, fmt.Sprintf("signin failed: %s", awsErrString(err)), http.StatusUnauthorized)
		return
	}
	if resp.AuthenticationResult == nil {
		// Challenge required (e.g. NEW_PASSWORD_REQUIRED)
		challenge := map[string]any{
			"challenge": string(resp.ChallengeName),
			"session":   resp.Session,
		}
		if resp.ChallengeParameters != nil {
			challenge["challengeParameters"] = resp.ChallengeParameters
		}
		writeJSON(w, http.StatusConflict, challenge)
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

	// For Cognito, call ListUsers API with pagination
	var allUsers []map[string]any
	var paginationToken *string
	for {
		out, err := a.client.ListUsers(r.Context(), &cognito.ListUsersInput{
			UserPoolId:      &a.userPoolID,
			PaginationToken: paginationToken,
			Limit:           awsInt32Ptr(60),
		})
		if err != nil {
			log.Printf("op=ListUsers err=%v", err)
			http.Error(w, "failed to list users", http.StatusInternalServerError)
			return
		}
		for _, u := range out.Users {
			username := ""
			email := ""
			status := ""
			if u.Username != nil {
				username = *u.Username
			}
			if u.UserStatus != "" {
				status = string(u.UserStatus)
			}
			for _, attr := range u.Attributes {
				if attr.Name != nil && *attr.Name == "email" && attr.Value != nil {
					email = *attr.Value
				}
			}
			allUsers = append(allUsers, map[string]any{
				"username": username,
				"email":    email,
				"status":   status,
				"roles":    []string{},
			})
		}
		if out.PaginationToken == nil {
			break
		}
		paginationToken = out.PaginationToken
	}

	// Enrich with group membership
	knownGroups := []string{"BloodBikeAdmin", "Rider", "FleetManager", "Dispatcher"}
	userRoles := make(map[string][]string)
	for _, g := range knownGroups {
		members, err := a.ListUsersInGroup(r.Context(), g)
		if err != nil {
			log.Printf("op=ListUsersInGroup group=%s err=%v", g, err)
			continue
		}
		for _, m := range members {
			userRoles[m] = append(userRoles[m], g)
		}
	}
	for i, u := range allUsers {
		if roles, ok := userRoles[u["username"].(string)]; ok {
			allUsers[i]["roles"] = roles
		}
	}

	writeJSON(w, http.StatusOK, allUsers)
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

func awsInt32Ptr(v int32) *int32 { return &v }

// RespondToChallengeHandler handles Cognito auth challenges (e.g. NEW_PASSWORD_REQUIRED).
func (a *AuthClient) RespondToChallengeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		ChallengeName      string            `json:"challengeName"`
		Session            string            `json:"session"`
		Username           string            `json:"username"`
		NewPassword        string            `json:"newPassword"`
		Email              string            `json:"email"`
		ChallengeResponses map[string]string `json:"challengeResponses"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.ChallengeName == "" || body.Session == "" {
		http.Error(w, "challengeName and session required", http.StatusBadRequest)
		return
	}

	if a.local {
		http.Error(w, "challenges not supported in local mode", http.StatusNotImplemented)
		return
	}

	// Build ChallengeResponses from flat fields if not provided directly
	if body.ChallengeResponses == nil {
		body.ChallengeResponses = make(map[string]string)
	}
	if body.NewPassword != "" {
		body.ChallengeResponses["NEW_PASSWORD"] = body.NewPassword
	}
	if body.Username != "" {
		body.ChallengeResponses["USERNAME"] = body.Username
	}
	if body.Email != "" {
		body.ChallengeResponses["userAttributes.email"] = body.Email
	}

	// Add SECRET_HASH if client has a secret
	if a.clientSecret != "" && body.Username != "" {
		body.ChallengeResponses["SECRET_HASH"] = a.computeSecretHash(body.Username)
	}

	input := &cognito.RespondToAuthChallengeInput{
		ChallengeName:      types.ChallengeNameType(body.ChallengeName),
		ClientId:           &a.clientID,
		Session:            &body.Session,
		ChallengeResponses: body.ChallengeResponses,
	}

	resp, err := a.client.RespondToAuthChallenge(r.Context(), input)
	if err != nil {
		http.Error(w, fmt.Sprintf("challenge response failed: %s", awsErrString(err)), http.StatusBadRequest)
		return
	}

	// Another challenge required
	if resp.AuthenticationResult == nil {
		challenge := map[string]any{
			"challenge": string(resp.ChallengeName),
			"session":   resp.Session,
		}
		if resp.ChallengeParameters != nil {
			challenge["challengeParameters"] = resp.ChallengeParameters
		}
		writeJSON(w, http.StatusConflict, challenge)
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

// AdminCreateUserHandler allows an authenticated admin to create a new Cognito user.
func (a *AuthClient) AdminCreateUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		Username          string   `json:"username"`
		Email             string   `json:"email"`
		TemporaryPassword string   `json:"temporaryPassword"`
		Password          string   `json:"password"`
		Groups            []string `json:"groups"`
		Roles             []string `json:"roles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.Username == "" || body.Email == "" {
		http.Error(w, "username and email required", http.StatusBadRequest)
		return
	}
	// Cognito usernames must not contain whitespace
	body.Username = strings.ReplaceAll(body.Username, " ", "")
	if body.Username == "" {
		http.Error(w, "username must not be empty or only whitespace", http.StatusBadRequest)
		return
	}
	// Accept "password" as alias for "temporaryPassword"
	if body.TemporaryPassword == "" && body.Password != "" {
		body.TemporaryPassword = body.Password
	}
	// Accept "roles" as alias for "groups"
	if len(body.Groups) == 0 && len(body.Roles) > 0 {
		body.Groups = body.Roles
	}

	if a.local {
		// In local mode, create a local user
		a.usersMu.Lock()
		if _, exists := a.users[body.Username]; exists {
			a.usersMu.Unlock()
			http.Error(w, "user already exists", http.StatusConflict)
			return
		}
		pwd := body.TemporaryPassword
		if pwd == "" {
			pwd = "TempPass123!"
		}
		u := localUser{
			Username: body.Username,
			Password: pwd,
			Email:    body.Email,
			Roles:    body.Groups,
			Sub:      fmt.Sprintf("local-%s-%d", body.Username, time.Now().UnixNano()),
		}
		a.users[body.Username] = u
		a.usersMu.Unlock()
		_ = a.saveUserToDB(u)
		writeJSON(w, http.StatusCreated, map[string]any{
			"username": u.Username,
			"email":    u.Email,
			"sub":      u.Sub,
		})
		return
	}

	// Cognito: AdminCreateUser
	attrs := []types.AttributeType{
		{Name: strPtr("email"), Value: &body.Email},
		{Name: strPtr("email_verified"), Value: strPtr("true")},
	}
	createInput := &cognito.AdminCreateUserInput{
		UserPoolId:             &a.userPoolID,
		Username:               &body.Username,
		UserAttributes:         attrs,
		DesiredDeliveryMediums: []types.DeliveryMediumType{types.DeliveryMediumTypeEmail},
	}
	if body.TemporaryPassword != "" {
		createInput.TemporaryPassword = &body.TemporaryPassword
	}

	result, err := a.client.AdminCreateUser(r.Context(), createInput)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to create user: %s", awsErrString(err)), http.StatusBadRequest)
		return
	}

	// Add user to groups if specified
	for _, group := range body.Groups {
		_, err := a.client.AdminAddUserToGroup(r.Context(), &cognito.AdminAddUserToGroupInput{
			UserPoolId: &a.userPoolID,
			Username:   &body.Username,
			GroupName:  strPtr(group),
		})
		if err != nil {
			log.Printf("warning: failed to add user %s to group %s: %v", body.Username, group, err)
		}
	}

	out := map[string]any{
		"username": body.Username,
		"email":    body.Email,
	}
	if result.User != nil && result.User.Attributes != nil {
		for _, attr := range result.User.Attributes {
			if attr.Name != nil && *attr.Name == "sub" && attr.Value != nil {
				out["sub"] = *attr.Value
			}
		}
	}
	writeJSON(w, http.StatusCreated, out)
}

func strPtr(s string) *string { return &s }

// computeSecretHash computes the SECRET_HASH required by Cognito when the client has a secret.
// SECRET_HASH = HMAC-SHA256(client_secret, username + client_id), then base64 encoded
func (a *AuthClient) computeSecretHash(username string) string {
	if a.clientSecret == "" {
		return ""
	}
	message := username + a.clientID
	h := hmac.New(sha256.New, []byte(a.clientSecret))
	h.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

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

// DeleteUser removes a user from the Cognito user pool.
func (a *AuthClient) DeleteUser(ctx context.Context, username string) error {
	if username == "" {
		return errors.New("username required")
	}
	if a.local {
		a.usersMu.Lock()
		delete(a.users, username)
		a.usersMu.Unlock()
		if a.db != nil {
			_ = a.db.Update(func(tx *bolt.Tx) error {
				b := tx.Bucket([]byte("users"))
				if b != nil {
					return b.Delete([]byte(username))
				}
				return nil
			})
		}
		return nil
	}
	_, err := a.client.AdminDeleteUser(ctx, &cognito.AdminDeleteUserInput{
		UserPoolId: &a.userPoolID,
		Username:   &username,
	})
	if err != nil {
		return fmt.Errorf("delete cognito user %s: %w", username, err)
	}
	return nil
}

func awsErrString(err error) string {
	// Most useful: Cognito error code + message
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		return fmt.Sprintf("%s: %s", apiErr.ErrorCode(), apiErr.ErrorMessage())
	}
	return err.Error()
}
