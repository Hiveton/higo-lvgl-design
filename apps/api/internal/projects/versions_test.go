package projects

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRepositoryCreatesProjectVersion(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	now := time.Date(2026, 5, 8, 0, 0, 0, 0, time.UTC)
	repo := NewSQLRepository(db, WithNow(func() time.Time { return now }), WithID(func(prefix string) string {
		if prefix == "version" {
			return "version-1"
		}
		return prefix + "-1"
	}))
	doc := map[string]any{"schemaVersion": 1, "name": "Watch UI"}

	mock.ExpectQuery(regexp.QuoteMeta(`
INSERT INTO project_versions (id, project_id, owner_id, name, doc, created_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, project_id, owner_id, name, doc, created_at
`)).
		WithArgs("version-1", "project-1", "user-1", "Before build", jsonArg(t, doc), now).
		WillReturnRows(sqlmock.NewRows([]string{"id", "project_id", "owner_id", "name", "doc", "created_at"}).
			AddRow("version-1", "project-1", "user-1", "Before build", mustJSON(t, doc), now))

	version, err := repo.CreateVersion(context.Background(), "user-1", "project-1", "Before build", doc)
	if err != nil {
		t.Fatalf("CreateVersion returned error: %v", err)
	}
	if version.ID != "version-1" || version.ProjectID != "project-1" || version.OwnerID != "user-1" {
		t.Fatalf("unexpected version: %#v", version)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
