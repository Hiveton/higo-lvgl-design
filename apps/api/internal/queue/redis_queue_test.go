package queue

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/go-redis/redismock/v9"
)

func TestRedisQueueEnqueuesExportTask(t *testing.T) {
	client, mock := redismock.NewClientMock()
	queue := NewRedisQueue(client, "lvgl:test:export")
	task := ExportTask{OwnerID: "user-1", JobID: "job-1"}
	raw, err := json.Marshal(task)
	if err != nil {
		t.Fatal(err)
	}

	mock.ExpectRPush("lvgl:test:export", raw).SetVal(1)

	if err := queue.EnqueueExport(context.Background(), task); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestRedisQueueDequeuesExportTask(t *testing.T) {
	client, mock := redismock.NewClientMock()
	queue := NewRedisQueue(client, "lvgl:test:export")
	task := ExportTask{OwnerID: "user-1", JobID: "job-1"}
	raw, err := json.Marshal(task)
	if err != nil {
		t.Fatal(err)
	}

	mock.ExpectBLPop(time.Second, "lvgl:test:export").SetVal([]string{"lvgl:test:export", string(raw)})

	dequeued, err := queue.DequeueExport(context.Background(), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if dequeued != task {
		t.Fatalf("unexpected task: %#v", dequeued)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestRedisQueueReturnsEmptyWhenNoTaskIsAvailable(t *testing.T) {
	client, mock := redismock.NewClientMock()
	queue := NewRedisQueue(client, "lvgl:test:export")

	mock.ExpectBLPop(time.Second, "lvgl:test:export").RedisNil()

	_, err := queue.DequeueExport(context.Background(), time.Second)
	if !errors.Is(err, ErrQueueEmpty) {
		t.Fatalf("expected ErrQueueEmpty, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
