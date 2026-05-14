package assets

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRepositoryCreatesAssetMetadata(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	now := time.Date(2026, 5, 8, 0, 0, 0, 0, time.UTC)
	repo := NewSQLRepository(db, WithNow(func() time.Time { return now }), WithID(func(prefix string) string {
		return "asset-1"
	}))

	input := CreateAssetInput{
		ProjectID: "project-1",
		OwnerID:   "user-1",
		Name:      "icon_heart.png",
		Kind:      "image",
		MimeType:  "image/png",
		Width:     32,
		Height:    32,
		SizeBytes: 128,
		ObjectKey: "projects/project-1/assets/asset-1/icon_heart.png",
	}

	mock.ExpectQuery(regexp.QuoteMeta(`
INSERT INTO assets (id, project_id, owner_id, name, kind, mime_type, width, height, size_bytes, object_key, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id, project_id, owner_id, name, kind, mime_type, width, height, size_bytes, object_key, created_at
`)).
		WithArgs("asset-1", input.ProjectID, input.OwnerID, input.Name, input.Kind, input.MimeType, input.Width, input.Height, input.SizeBytes, input.ObjectKey, now).
		WillReturnRows(sqlmock.NewRows([]string{"id", "project_id", "owner_id", "name", "kind", "mime_type", "width", "height", "size_bytes", "object_key", "created_at"}).
			AddRow("asset-1", input.ProjectID, input.OwnerID, input.Name, input.Kind, input.MimeType, input.Width, input.Height, input.SizeBytes, input.ObjectKey, now))

	asset, err := repo.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if asset.ID != "asset-1" || asset.ObjectKey != input.ObjectKey {
		t.Fatalf("unexpected asset: %#v", asset)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestRepositoryListsAndDeletesAssetMetadata(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	now := time.Date(2026, 5, 8, 0, 0, 0, 0, time.UTC)
	repo := NewSQLRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`
SELECT id, project_id, owner_id, name, kind, mime_type, width, height, size_bytes, object_key, created_at
FROM assets
WHERE project_id = $1 AND owner_id = $2
ORDER BY created_at DESC
`)).
		WithArgs("project-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "project_id", "owner_id", "name", "kind", "mime_type", "width", "height", "size_bytes", "object_key", "created_at"}).
			AddRow("asset-1", "project-1", "user-1", "icon_heart.png", "image", "image/png", 32, 32, int64(128), "objects/asset-1", now))

	assets, err := repo.List(context.Background(), "user-1", "project-1")
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if len(assets) != 1 || assets[0].ID != "asset-1" {
		t.Fatalf("unexpected assets: %#v", assets)
	}

	mock.ExpectExec(regexp.QuoteMeta(`
DELETE FROM assets
WHERE id = $1 AND project_id = $2 AND owner_id = $3
`)).
		WithArgs("asset-1", "project-1", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.Delete(context.Background(), "user-1", "project-1", "asset-1"); err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
