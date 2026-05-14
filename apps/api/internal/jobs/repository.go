package jobs

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/ids"
)

var ErrNotFound = errors.New("job not found")

type LogEntry struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

type Job struct {
	ID              string     `json:"id"`
	OwnerID         string     `json:"-"`
	ProjectID       string     `json:"projectId,omitempty"`
	Kind            string     `json:"kind"`
	Status          string     `json:"status"`
	Progress        int        `json:"progress"`
	Logs            []LogEntry `json:"logs"`
	ResultObjectKey string     `json:"resultObjectKey,omitempty"`
	ErrorCode       string     `json:"errorCode,omitempty"`
	ErrorMessage    string     `json:"errorMessage,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type CreateJobInput struct {
	OwnerID   string
	ProjectID string
	Kind      string
	Logs      []LogEntry
}

type UpdateJobInput struct {
	Status          string
	Progress        int
	Logs            []LogEntry
	ResultObjectKey string
	ErrorCode       string
	ErrorMessage    string
}

type Repository interface {
	Create(ctx context.Context, input CreateJobInput) (Job, error)
	Get(ctx context.Context, ownerID string, jobID string) (Job, error)
	Update(ctx context.Context, ownerID string, jobID string, input UpdateJobInput) error
}

type SQLRepository struct {
	db    *sql.DB
	now   func() time.Time
	newID func(prefix string) string
}

type Option func(*SQLRepository)

func WithNow(now func() time.Time) Option {
	return func(repository *SQLRepository) {
		repository.now = now
	}
}

func WithID(newID func(prefix string) string) Option {
	return func(repository *SQLRepository) {
		repository.newID = newID
	}
}

func NewSQLRepository(db *sql.DB, options ...Option) *SQLRepository {
	repository := &SQLRepository{
		db:    db,
		now:   func() time.Time { return time.Now().UTC() },
		newID: func(string) string { return ids.NewUUID() },
	}
	for _, option := range options {
		option(repository)
	}
	return repository
}

func (repository *SQLRepository) Create(ctx context.Context, input CreateJobInput) (Job, error) {
	now := repository.now()
	jobID := repository.newID("job")
	row := repository.db.QueryRowContext(ctx, `
INSERT INTO jobs (id, owner_id, project_id, kind, status, progress, logs, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, owner_id, project_id, kind, status, progress, logs, result_object_key, error_code, error_message, created_at, updated_at
`, jobID, input.OwnerID, input.ProjectID, input.Kind, "queued", 0, logsJSON(input.Logs), now, now)
	return scanJob(row)
}

func (repository *SQLRepository) Get(ctx context.Context, ownerID string, jobID string) (Job, error) {
	row := repository.db.QueryRowContext(ctx, `
SELECT id, owner_id, project_id, kind, status, progress, logs, result_object_key, error_code, error_message, created_at, updated_at
FROM jobs
WHERE id = $1 AND owner_id = $2
`, jobID, ownerID)
	return scanJob(row)
}

func (repository *SQLRepository) Update(ctx context.Context, ownerID string, jobID string, input UpdateJobInput) error {
	result, err := repository.db.ExecContext(ctx, `
UPDATE jobs
SET status = $1, progress = $2, logs = $3, result_object_key = $4, error_code = $5, error_message = $6, updated_at = $7
WHERE id = $8 AND owner_id = $9
`, input.Status, input.Progress, logsJSON(input.Logs), nullableString(input.ResultObjectKey), nullableString(input.ErrorCode), nullableString(input.ErrorMessage), repository.now(), jobID, ownerID)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return ErrNotFound
	}
	return nil
}

type jobScanner interface {
	Scan(dest ...any) error
}

func scanJob(scanner jobScanner) (Job, error) {
	var job Job
	var rawLogs []byte
	var resultObjectKey sql.NullString
	var errorCode sql.NullString
	var errorMessage sql.NullString
	if err := scanner.Scan(
		&job.ID,
		&job.OwnerID,
		&job.ProjectID,
		&job.Kind,
		&job.Status,
		&job.Progress,
		&rawLogs,
		&resultObjectKey,
		&errorCode,
		&errorMessage,
		&job.CreatedAt,
		&job.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Job{}, ErrNotFound
		}
		return Job{}, err
	}
	if err := json.Unmarshal(rawLogs, &job.Logs); err != nil {
		return Job{}, err
	}
	if resultObjectKey.Valid {
		job.ResultObjectKey = resultObjectKey.String
	}
	if errorCode.Valid {
		job.ErrorCode = errorCode.String
	}
	if errorMessage.Valid {
		job.ErrorMessage = errorMessage.String
	}
	return job, nil
}

func logsJSON(logs []LogEntry) []byte {
	raw, err := json.Marshal(logs)
	if err != nil {
		return []byte("[]")
	}
	return raw
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
