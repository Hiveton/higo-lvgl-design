package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/assets"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/auth"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/config"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/jobs"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/migrate"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/projects"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/queue"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/server"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/storage"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/users"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load(map[string]string{
		"PORT":                      os.Getenv("PORT"),
		"DATABASE_URL":              os.Getenv("DATABASE_URL"),
		"REDIS_URL":                 os.Getenv("REDIS_URL"),
		"OBJECT_STORAGE_BUCKET":     os.Getenv("OBJECT_STORAGE_BUCKET"),
		"OBJECT_STORAGE_ENDPOINT":   os.Getenv("OBJECT_STORAGE_ENDPOINT"),
		"OBJECT_STORAGE_ACCESS_KEY": os.Getenv("OBJECT_STORAGE_ACCESS_KEY"),
		"OBJECT_STORAGE_SECRET_KEY": os.Getenv("OBJECT_STORAGE_SECRET_KEY"),
		"OBJECT_STORAGE_USE_SSL":    os.Getenv("OBJECT_STORAGE_USE_SSL"),
		"AUTH_TOKEN_SECRET":         os.Getenv("AUTH_TOKEN_SECRET"),
	})
	handler := http.Handler(server.NewInMemoryServer())
	if cfg.DatabaseURL == "" {
		log.Printf("LVGL Online Editor API using in-memory storage")
	} else {
		log.Printf("LVGL Online Editor API configured with PostgreSQL")
		db, err := sql.Open("postgres", cfg.DatabaseURL)
		if err != nil {
			log.Fatal(err)
		}
		defer db.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			log.Fatal(err)
		}
		if err := migrate.Run(ctx, db); err != nil {
			log.Fatal(err)
		}
		if err := seedDemoUsers(ctx, db); err != nil {
			log.Fatal(err)
		}
		projectRepo := projects.NewSQLRepository(db)
		assetRepo := assets.NewSQLRepository(db)
		jobRepo := jobs.NewSQLRepository(db)
		userRepo := users.NewSQLRepository(db)
		objectStore, err := storage.NewStore(storage.Settings{
			Endpoint:  cfg.ObjectStorageEndpoint,
			AccessKey: cfg.ObjectStorageAccessKey,
			SecretKey: cfg.ObjectStorageSecretKey,
			Bucket:    cfg.ObjectStorageBucket,
			UseSSL:    cfg.ObjectStorageUseSSL,
		})
		if err != nil {
			log.Fatal(err)
		}
		jobRunner := server.JobRunner(server.NewAsyncJobRunner())
		if cfg.RedisURL != "" {
			redisOptions, err := redis.ParseURL(cfg.RedisURL)
			if err != nil {
				log.Fatal(err)
			}
			redisClient := redis.NewClient(redisOptions)
			defer redisClient.Close()
			if err := redisClient.Ping(ctx).Err(); err != nil {
				log.Fatal(err)
			}
			jobRunner = server.NewRedisJobRunner(queue.NewRedisQueue(redisClient, queue.DefaultExportQueueKey))
		}
		handler = server.NewRepositoryServerWithStorageRunnerAndUsers(projectRepo, assetRepo, jobRepo, objectStore, jobRunner, userRepo, auth.NewTokenSigner(cfg.AuthTokenSecret, 24*time.Hour))
	}
	log.Printf("LVGL Online Editor API listening on %s", cfg.Addr)
	if err := http.ListenAndServe(cfg.Addr, handler); err != nil {
		log.Fatal(err)
	}
}

func seedDemoUsers(ctx context.Context, db *sql.DB) error {
	now := time.Now().UTC()
	passwordHash, err := auth.HashPassword("password")
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `
INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
VALUES
  ($1, 'demo@hiveton.dev', $3, 'Hiveton Demo', $4, $4),
  ($2, 'other@hiveton.dev', $3, 'Other User', $4, $4)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    updated_at = EXCLUDED.updated_at
`, server.DemoUserID, server.OtherUserID, passwordHash, now)
	return err
}
