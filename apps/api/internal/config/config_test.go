package config

import "testing"

func TestLoadConfigUsesDefaults(t *testing.T) {
	cfg := Load(map[string]string{})

	if cfg.Addr != ":8080" {
		t.Fatalf("expected default addr :8080, got %s", cfg.Addr)
	}
	if cfg.DatabaseURL != "" {
		t.Fatalf("expected empty database url, got %s", cfg.DatabaseURL)
	}
}

func TestLoadConfigUsesEnvironment(t *testing.T) {
	cfg := Load(map[string]string{
		"PORT":                      "9090",
		"DATABASE_URL":              "postgres://lvgl:lvgl@localhost:5432/lvgl",
		"REDIS_URL":                 "redis://localhost:6379/0",
		"OBJECT_STORAGE_BUCKET":     "lvgl-assets",
		"OBJECT_STORAGE_ENDPOINT":   "localhost:9000",
		"OBJECT_STORAGE_ACCESS_KEY": "lvgl",
		"OBJECT_STORAGE_SECRET_KEY": "lvgl-secret",
		"OBJECT_STORAGE_USE_SSL":    "true",
		"AUTH_TOKEN_SECRET":         "test-secret",
	})

	if cfg.Addr != ":9090" {
		t.Fatalf("expected addr :9090, got %s", cfg.Addr)
	}
	if cfg.DatabaseURL == "" || cfg.RedisURL == "" || cfg.ObjectStorageBucket != "lvgl-assets" {
		t.Fatalf("unexpected config: %#v", cfg)
	}
	if cfg.ObjectStorageEndpoint != "localhost:9000" || cfg.ObjectStorageAccessKey != "lvgl" || cfg.ObjectStorageSecretKey != "lvgl-secret" || !cfg.ObjectStorageUseSSL {
		t.Fatalf("unexpected config: %#v", cfg)
	}
	if cfg.AuthTokenSecret != "test-secret" {
		t.Fatalf("unexpected auth secret: %#v", cfg)
	}
}
