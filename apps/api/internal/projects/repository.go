package projects

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/ids"
)

var ErrNotFound = errors.New("project not found")

type Project struct {
	ID        string         `json:"id"`
	OwnerID   string         `json:"-"`
	Name      string         `json:"name"`
	Doc       map[string]any `json:"doc"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

type ProjectVersion struct {
	ID        string         `json:"id"`
	ProjectID string         `json:"projectId"`
	OwnerID   string         `json:"-"`
	Name      string         `json:"name"`
	Doc       map[string]any `json:"doc"`
	CreatedAt time.Time      `json:"createdAt"`
}

type Repository interface {
	Create(ctx context.Context, ownerID string, name string, doc map[string]any) (Project, error)
	Get(ctx context.Context, ownerID string, projectID string) (Project, error)
	List(ctx context.Context, ownerID string) ([]Project, error)
	SaveDoc(ctx context.Context, ownerID string, projectID string, name string, doc map[string]any) error
	CreateVersion(ctx context.Context, ownerID string, projectID string, name string, doc map[string]any) (ProjectVersion, error)
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

func (repository *SQLRepository) Create(ctx context.Context, ownerID string, name string, doc map[string]any) (Project, error) {
	now := repository.now()
	projectID := repository.newID("project")
	row := repository.db.QueryRowContext(ctx, `
INSERT INTO projects (id, owner_id, name, doc, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, owner_id, name, doc, created_at, updated_at
`, projectID, ownerID, name, jsonBytes(doc), now, now)
	return scanProject(row)
}

func (repository *SQLRepository) Get(ctx context.Context, ownerID string, projectID string) (Project, error) {
	row := repository.db.QueryRowContext(ctx, `
SELECT id, owner_id, name, doc, created_at, updated_at
FROM projects
WHERE id = $1 AND owner_id = $2
`, projectID, ownerID)
	return scanProject(row)
}

func (repository *SQLRepository) List(ctx context.Context, ownerID string) ([]Project, error) {
	rows, err := repository.db.QueryContext(ctx, `
SELECT id, owner_id, name, doc, created_at, updated_at
FROM projects
WHERE owner_id = $1
ORDER BY updated_at DESC
`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	projects := []Project{}
	for rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return projects, nil
}

func (repository *SQLRepository) SaveDoc(ctx context.Context, ownerID string, projectID string, name string, doc map[string]any) error {
	result, err := repository.db.ExecContext(ctx, `
UPDATE projects
SET doc = $1, name = $2, updated_at = $3
WHERE id = $4 AND owner_id = $5
`, jsonBytes(doc), name, repository.now(), projectID, ownerID)
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

func (repository *SQLRepository) CreateVersion(ctx context.Context, ownerID string, projectID string, name string, doc map[string]any) (ProjectVersion, error) {
	now := repository.now()
	versionID := repository.newID("version")
	row := repository.db.QueryRowContext(ctx, `
INSERT INTO project_versions (id, project_id, owner_id, name, doc, created_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, project_id, owner_id, name, doc, created_at
`, versionID, projectID, ownerID, name, jsonBytes(doc), now)
	return scanProjectVersion(row)
}

type projectScanner interface {
	Scan(dest ...any) error
}

func scanProject(scanner projectScanner) (Project, error) {
	var project Project
	var rawDoc []byte
	if err := scanner.Scan(&project.ID, &project.OwnerID, &project.Name, &rawDoc, &project.CreatedAt, &project.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Project{}, ErrNotFound
		}
		return Project{}, err
	}
	if err := json.Unmarshal(rawDoc, &project.Doc); err != nil {
		return Project{}, err
	}
	return project, nil
}

func scanProjectVersion(scanner projectScanner) (ProjectVersion, error) {
	var version ProjectVersion
	var rawDoc []byte
	if err := scanner.Scan(&version.ID, &version.ProjectID, &version.OwnerID, &version.Name, &rawDoc, &version.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ProjectVersion{}, ErrNotFound
		}
		return ProjectVersion{}, err
	}
	if err := json.Unmarshal(rawDoc, &version.Doc); err != nil {
		return ProjectVersion{}, err
	}
	return version, nil
}

func jsonBytes(value map[string]any) []byte {
	raw, err := json.Marshal(value)
	if err != nil {
		return []byte("{}")
	}
	return raw
}
