type User struct {
package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// User represents an authenticated user
type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

// AuthMiddleware validates JWT tokens using Cognito JWKS. It expects
// an Authorization header: "Bearer <token>" and, on success, places a
// *auth.User into the request context under key "user".
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing authorization header", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}

		tokenStr := parts[1]

		// Parse and validate the token using JWKS keyfunc
		token, err := jwt.Parse(tokenStr, Keyfunc())
		if err != nil || !token.Valid {
			http.Error(w, fmt.Sprintf("invalid token: %v", err), http.StatusUnauthorized)
			return
		}

		// Extract claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "invalid token claims", http.StatusUnauthorized)
			return
		}

		user := &User{}
		if sub, ok := claims["sub"].(string); ok {
			user.ID = sub
		}
		// Cognito sometimes uses "cognito:username"
		if uname, ok := claims["cognito:username"].(string); ok {
			user.Username = uname
		} else if uname, ok := claims["username"].(string); ok {
			user.Username = uname
		}
		if email, ok := claims["email"].(string); ok {
			user.Email = email
		}

		// Put user into context
		ctx := context.WithValue(r.Context(), "user", user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUser extracts user from request context
func GetUser(r *http.Request) *User {
	user, ok := r.Context().Value("user").(*User)
	if !ok {
		return nil
	}
	return user
}
