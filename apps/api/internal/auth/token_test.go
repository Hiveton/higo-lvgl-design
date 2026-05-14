package auth

import (
	"strings"
	"testing"
	"time"
)

func TestTokenSignerIssuesAndVerifiesClaims(t *testing.T) {
	signer := NewTokenSigner("test-secret", time.Hour)
	now := time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC)

	token, err := signer.Issue("user-1", "demo@hiveton.dev", "Hiveton Demo", now)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := signer.Verify(token, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if claims.ID != "user-1" || claims.Email != "demo@hiveton.dev" || claims.DisplayName != "Hiveton Demo" {
		t.Fatalf("unexpected claims: %#v", claims)
	}
}

func TestTokenSignerRejectsTamperedToken(t *testing.T) {
	signer := NewTokenSigner("test-secret", time.Hour)
	now := time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC)
	token, err := signer.Issue("user-1", "demo@hiveton.dev", "Hiveton Demo", now)
	if err != nil {
		t.Fatal(err)
	}

	tampered := strings.Replace(token, ".", "x.", 1)
	if _, err := signer.Verify(tampered, now); err != ErrInvalidToken {
		t.Fatalf("expected ErrInvalidToken, got %v", err)
	}
}

func TestTokenSignerRejectsExpiredToken(t *testing.T) {
	signer := NewTokenSigner("test-secret", time.Hour)
	now := time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC)
	token, err := signer.Issue("user-1", "demo@hiveton.dev", "Hiveton Demo", now)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := signer.Verify(token, now.Add(2*time.Hour)); err != ErrExpiredToken {
		t.Fatalf("expected ErrExpiredToken, got %v", err)
	}
}
