package server

import (
	"context"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/queue"
)

type JobRunner interface {
	EnqueueExport(ownerID string, jobID string, fallback func()) error
}

type inlineJobRunner struct{}

func (runner inlineJobRunner) EnqueueExport(_ string, _ string, fallback func()) error {
	fallback()
	return nil
}

type AsyncJobRunner struct{}

func NewAsyncJobRunner() AsyncJobRunner {
	return AsyncJobRunner{}
}

func (runner AsyncJobRunner) EnqueueExport(_ string, _ string, fallback func()) error {
	go fallback()
	return nil
}

type RedisJobRunner struct {
	queue interface {
		EnqueueExport(ctx context.Context, task queue.ExportTask) error
	}
}

func NewRedisJobRunner(queue interface {
	EnqueueExport(ctx context.Context, task queue.ExportTask) error
}) RedisJobRunner {
	return RedisJobRunner{queue: queue}
}

func (runner RedisJobRunner) EnqueueExport(ownerID string, jobID string, _ func()) error {
	return runner.queue.EnqueueExport(context.Background(), queue.ExportTask{OwnerID: ownerID, JobID: jobID})
}
