package queue

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

var ErrQueueEmpty = errors.New("queue empty")

const DefaultExportQueueKey = "lvgl:export_jobs"

type ExportTask struct {
	OwnerID string `json:"ownerId"`
	JobID   string `json:"jobId"`
}

type RedisQueue struct {
	client *redis.Client
	key    string
}

func NewRedisQueue(client *redis.Client, key string) *RedisQueue {
	return &RedisQueue{client: client, key: key}
}

func (queue *RedisQueue) EnqueueExport(ctx context.Context, task ExportTask) error {
	raw, err := json.Marshal(task)
	if err != nil {
		return err
	}
	return queue.client.RPush(ctx, queue.key, raw).Err()
}

func (queue *RedisQueue) DequeueExport(ctx context.Context, timeout time.Duration) (ExportTask, error) {
	result, err := queue.client.BLPop(ctx, timeout, queue.key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return ExportTask{}, ErrQueueEmpty
		}
		return ExportTask{}, err
	}
	if len(result) != 2 {
		return ExportTask{}, ErrQueueEmpty
	}
	var task ExportTask
	if err := json.Unmarshal([]byte(result[1]), &task); err != nil {
		return ExportTask{}, err
	}
	return task, nil
}
