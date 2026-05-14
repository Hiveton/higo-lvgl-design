package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("expired token")
)

type UserClaims struct {
	ID          string `json:"sub"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	ExpiresAt   int64  `json:"exp"`
}

type TokenSigner struct {
	secret []byte
	ttl    time.Duration
}

func NewTokenSigner(secret string, ttl time.Duration) TokenSigner {
	if strings.TrimSpace(secret) == "" {
		secret = "dev-secret-change-me"
	}
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return TokenSigner{secret: []byte(secret), ttl: ttl}
}

func (signer TokenSigner) Issue(userID string, email string, displayName string, now time.Time) (string, error) {
	claims := UserClaims{
		ID:          userID,
		Email:       email,
		DisplayName: displayName,
		ExpiresAt:   now.Add(signer.ttl).Unix(),
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	signature := signer.sign(encodedPayload)
	return encodedPayload + "." + signature, nil
}

func (signer TokenSigner) Verify(token string, now time.Time) (UserClaims, error) {
	payload, signature, ok := strings.Cut(token, ".")
	if !ok || payload == "" || signature == "" {
		return UserClaims{}, ErrInvalidToken
	}
	expected := signer.sign(payload)
	if !hmac.Equal([]byte(signature), []byte(expected)) {
		return UserClaims{}, ErrInvalidToken
	}
	decodedPayload, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return UserClaims{}, ErrInvalidToken
	}
	var claims UserClaims
	if err := json.Unmarshal(decodedPayload, &claims); err != nil {
		return UserClaims{}, ErrInvalidToken
	}
	if claims.ID == "" || claims.Email == "" || claims.ExpiresAt == 0 {
		return UserClaims{}, ErrInvalidToken
	}
	if now.Unix() >= claims.ExpiresAt {
		return UserClaims{}, ErrExpiredToken
	}
	return claims, nil
}

func (signer TokenSigner) sign(payload string) string {
	mac := hmac.New(sha256.New, signer.secret)
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
