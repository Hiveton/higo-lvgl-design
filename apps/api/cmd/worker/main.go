package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"os"
	"time"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/config"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/jobs"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/migrate"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/projects"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/queue"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/server"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/storage"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg := config.Load(map[string]string{
		"DATABASE_URL":              os.Getenv("DATABASE_URL"),
		"REDIS_URL":                 os.Getenv("REDIS_URL"),
		"OBJECT_STORAGE_BUCKET":     os.Getenv("OBJECT_STORAGE_BUCKET"),
		"OBJECT_STORAGE_ENDPOINT":   os.Getenv("OBJECT_STORAGE_ENDPOINT"),
		"OBJECT_STORAGE_ACCESS_KEY": os.Getenv("OBJECT_STORAGE_ACCESS_KEY"),
		"OBJECT_STORAGE_SECRET_KEY": os.Getenv("OBJECT_STORAGE_SECRET_KEY"),
		"OBJECT_STORAGE_USE_SSL":    os.Getenv("OBJECT_STORAGE_USE_SSL"),
	})
	if cfg.DatabaseURL == "" || cfg.RedisURL == "" {
		log.Fatal("worker requires DATABASE_URL and REDIS_URL")
	}

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	ctx := context.Background()
	if err := db.PingContext(ctx); err != nil {
		log.Fatal(err)
	}
	if err := migrate.Run(ctx, db); err != nil {
		log.Fatal(err)
	}

	redisOptions, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatal(err)
	}
	redisClient := redis.NewClient(redisOptions)
	defer redisClient.Close()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatal(err)
	}

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
	processor := server.NewExportJobProcessor(
		projects.NewSQLRepository(db),
		jobs.NewSQLRepository(db),
		objectStore,
	)
	exportQueue := queue.NewRedisQueue(redisClient, queue.DefaultExportQueueKey)

	log.Printf("LVGL Online Editor worker listening for export jobs")
	for {
		task, err := exportQueue.DequeueExport(ctx, 5*time.Second)
		if err != nil {
			if errors.Is(err, queue.ErrQueueEmpty) {
				continue
			}
			log.Printf("dequeue export task failed: %v", err)
			continue
		}
		if err := processor.Run(ctx, task.OwnerID, task.JobID); err != nil {
			log.Printf("export job %s failed: %v", task.JobID, err)
		}
	}
}
