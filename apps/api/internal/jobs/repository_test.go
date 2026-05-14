package jobs

import (
	"context"
	"encoding/json"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRepositoryCreatesAndGetsJob(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	now := time.Date(2026, 5, 8, 0, 0, 0, 0, time.UTC)
	repo := NewSQLRepository(db, WithNow(func() time.Time { return now }), WithID(func(prefix string) string {
		return "job-1"
	}))
	logs := []LogEntry{{Time: now.Format(time.RFC3339), Level: "info", Message: "Build started"}}

	mock.ExpectQuery(regexp.QuoteMeta(`
INSERT INTO jobs (id, owner_id, project_id, kind, status, progress, logs, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, owner_id, project_id, kind, status, progress, logs, result_object_key, error_code, error_message, created_at, updated_at
`)).
		WithArgs("job-1", "user-1", "project-1", "export_c", "queued", 0, mustLogsJSON(t, logs), now, now).
		WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id", "project_id", "kind", "status", "progress", "logs", "result_object_key", "error_code", "error_message", "created_at", "updated_at"}).
			AddRow("job-1", "user-1", "project-1", "export_c", "queued", 0, mustLogsJSON(t, logs), nil, nil, nil, now, now))

	job, err := repo.Create(context.Background(), CreateJobInput{
		OwnerID:   "user-1",
		ProjectID: "project-1",
		Kind:      "export_c",
		Logs:      logs,
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if job.ID != "job-1" || job.Status != "queued" {
		t.Fatalf("unexpected job: %#v", job)
	}

	mock.ExpectQuery(regexp.QuoteMeta(`
SELECT id, owner_id, project_id, kind, status, progress, logs, result_object_key, error_code, error_message, created_at, updated_at
FROM jobs
WHERE id = $1 AND owner_id = $2
`)).
		WithArgs("job-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id", "project_id", "kind", "status", "progress", "logs", "result_object_key", "error_code", "error_message", "created_at", "updated_at"}).
			AddRow("job-1", "user-1", "project-1", "export_c", "queued", 0, mustLogsJSON(t, logs), nil, nil, nil, now, now))

	loaded, err := repo.Get(context.Background(), "user-1", "job-1")
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if len(loaded.Logs) != 1 || loaded.Logs[0].Message != "Build started" {
		t.Fatalf("unexpected logs: %#v", loaded.Logs)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestRepositoryUpdatesJobStatus(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	now := time.Date(2026, 5, 8, 0, 0, 0, 0, time.UTC)
	repo := NewSQLRepository(db, WithNow(func() time.Time { return now }))
	logs := []LogEntry{{Time: now.Format(time.RFC3339), Level: "info", Message: "Build completed successfully"}}

	mock.ExpectExec(regexp.QuoteMeta(`
UPDATE jobs
SET status = $1, progress = $2, logs = $3, result_object_key = $4, error_code = $5, error_message = $6, updated_at = $7
WHERE id = $8 AND owner_id = $9
`)).
		WithArgs("succeeded", 100, mustLogsJSON(t, logs), "exports/job-1.zip", nil, nil, now, "job-1", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.Update(context.Background(), "user-1", "job-1", UpdateJobInput{
		Status:          "succeeded",
		Progress:        100,
		Logs:            logs,
		ResultObjectKey: "exports/job-1.zip",
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func mustLogsJSON(t *testing.T, logs []LogEntry) []byte {
	t.Helper()
	raw, err := json.Marshal(logs)
	if err != nil {
		t.Fatalf("marshal logs: %v", err)
	}
	return raw
}
