package server

import (
	"context"
	"testing"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/queue"
)

func TestRedisJobRunnerEnqueuesExportTaskWithoutRunningFallback(t *testing.T) {
	exportQueue := &fakeExportQueue{}
	runner := NewRedisJobRunner(exportQueue)
	ranFallback := false

	if err := runner.EnqueueExport("user-1", "job-1", func() { ranFallback = true }); err != nil {
		t.Fatal(err)
	}
	if ranFallback {
		t.Fatal("redis runner should enqueue only; worker executes the job later")
	}
	if exportQueue.task != (queue.ExportTask{OwnerID: "user-1", JobID: "job-1"}) {
		t.Fatalf("unexpected task: %#v", exportQueue.task)
	}
}

type fakeExportQueue struct {
	task queue.ExportTask
}

func (queue *fakeExportQueue) EnqueueExport(_ context.Context, task queue.ExportTask) error {
	queue.task = task
	return nil
}
