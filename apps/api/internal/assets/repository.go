package assets

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/ids"
)

var ErrNotFound = errors.New("asset not found")

type Asset struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	OwnerID   string    `json:"-"`
	Name      string    `json:"name"`
	Kind      string    `json:"kind"`
	MimeType  string    `json:"mimeType"`
	Width     int       `json:"width,omitempty"`
	Height    int       `json:"height,omitempty"`
	SizeBytes int64     `json:"sizeBytes"`
	ObjectKey string    `json:"objectKey"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreateAssetInput struct {
	ProjectID string
	OwnerID   string
	Name      string
	Kind      string
	MimeType  string
	Width     int
	Height    int
	SizeBytes int64
	ObjectKey string
}

type Repository interface {
	Create(ctx context.Context, input CreateAssetInput) (Asset, error)
	List(ctx context.Context, ownerID string, projectID string) ([]Asset, error)
	Delete(ctx context.Context, ownerID string, projectID string, assetID string) error
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

func (repository *SQLRepository) Create(ctx context.Context, input CreateAssetInput) (Asset, error) {
	now := repository.now()
	assetID := repository.newID("asset")
	row := repository.db.QueryRowContext(ctx, `
INSERT INTO assets (id, project_id, owner_id, name, kind, mime_type, width, height, size_bytes, object_key, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id, project_id, owner_id, name, kind, mime_type, width, height, size_bytes, object_key, created_at
`, assetID, input.ProjectID, input.OwnerID, input.Name, input.Kind, input.MimeType, input.Width, input.Height, input.SizeBytes, input.ObjectKey, now)
	return scanAsset(row)
}

func (repository *SQLRepository) List(ctx context.Context, ownerID string, projectID string) ([]Asset, error) {
	rows, err := repository.db.QueryContext(ctx, `
SELECT id, project_id, owner_id, name, kind, mime_type, width, height, size_bytes, object_key, created_at
FROM assets
WHERE project_id = $1 AND owner_id = $2
ORDER BY created_at DESC
`, projectID, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := []Asset{}
	for rows.Next() {
		asset, err := scanAsset(rows)
		if err != nil {
			return nil, err
		}
		assets = append(assets, asset)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return assets, nil
}

func (repository *SQLRepository) Delete(ctx context.Context, ownerID string, projectID string, assetID string) error {
	result, err := repository.db.ExecContext(ctx, `
DELETE FROM assets
WHERE id = $1 AND project_id = $2 AND owner_id = $3
`, assetID, projectID, ownerID)
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

type assetScanner interface {
	Scan(dest ...any) error
}

func scanAsset(scanner assetScanner) (Asset, error) {
	var asset Asset
	if err := scanner.Scan(
		&asset.ID,
		&asset.ProjectID,
		&asset.OwnerID,
		&asset.Name,
		&asset.Kind,
		&asset.MimeType,
		&asset.Width,
		&asset.Height,
		&asset.SizeBytes,
		&asset.ObjectKey,
		&asset.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Asset{}, ErrNotFound
		}
		return Asset{}, err
	}
	return asset, nil
}
