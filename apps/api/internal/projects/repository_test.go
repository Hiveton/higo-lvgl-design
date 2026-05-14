package projects

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRepositoryCreatesProject(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	now := time.Date(2026, 5, 8, 0, 0, 0, 0, time.UTC)
	repo := NewSQLRepository(db, WithNow(func() time.Time { return now }), WithID(func(prefix string) string {
		if prefix == "project" {
			return "project-1"
		}
		return prefix + "-1"
	}))
	doc := map[string]any{"schemaVersion": 1, "name": "Watch UI"}

	mock.ExpectQuery(regexp.QuoteMeta(`
INSERT INTO projects (id, owner_id, name, doc, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, owner_id, name, doc, created_at, updated_at
`)).
		WithArgs("project-1", "user-1", "Watch UI", jsonArg(t, doc), now, now).
		WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id", "name", "doc", "created_at", "updated_at"}).
			AddRow("project-1", "user-1", "Watch UI", mustJSON(t, doc), now, now))

	project, err := repo.Create(context.Background(), "user-1", "Watch UI", doc)
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if project.ID != "project-1" || project.OwnerID != "user-1" || project.Name != "Watch UI" {
		t.Fatalf("unexpected project: %#v", project)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestRepositoryGetsProjectForOwner(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewSQLRepository(db)
	now := time.Date(2026, 5, 8, 0, 0, 0, 0, time.UTC)
	doc := map[string]any{"schemaVersion": 1, "name": "Watch UI"}

	mock.ExpectQuery(regexp.QuoteMeta(`
SELECT id, owner_id, name, doc, created_at, updated_at
FROM projects
WHERE id = $1 AND owner_id = $2
`)).
		WithArgs("project-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id", "name", "doc", "created_at", "updated_at"}).
			AddRow("project-1", "user-1", "Watch UI", mustJSON(t, doc), now, now))

	project, err := repo.Get(context.Background(), "user-1", "project-1")
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if project.Doc["name"] != "Watch UI" {
		t.Fatalf("unexpected doc: %#v", project.Doc)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestRepositoryListsProjectsForOwner(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewSQLRepository(db)
	now := time.Date(2026, 5, 8, 0, 0, 0, 0, time.UTC)

	mock.ExpectQuery(regexp.QuoteMeta(`
SELECT id, owner_id, name, doc, created_at, updated_at
FROM projects
WHERE owner_id = $1
ORDER BY updated_at DESC
`)).
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "owner_id", "name", "doc", "created_at", "updated_at"}).
			AddRow("project-2", "user-1", "Panel UI", mustJSON(t, map[string]any{"name": "Panel UI"}), now, now).
			AddRow("project-1", "user-1", "Watch UI", mustJSON(t, map[string]any{"name": "Watch UI"}), now, now))

	projects, err := repo.List(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if len(projects) != 2 || projects[0].ID != "project-2" || projects[1].ID != "project-1" {
		t.Fatalf("unexpected projects: %#v", projects)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestRepositorySavesProjectDoc(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	now := time.Date(2026, 5, 8, 0, 0, 0, 0, time.UTC)
	repo := NewSQLRepository(db, WithNow(func() time.Time { return now }))
	doc := map[string]any{"schemaVersion": 1, "name": "Saved UI"}

	mock.ExpectExec(regexp.QuoteMeta(`
UPDATE projects
SET doc = $1, name = $2, updated_at = $3
WHERE id = $4 AND owner_id = $5
`)).
		WithArgs(jsonArg(t, doc), "Saved UI", now, "project-1", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.SaveDoc(context.Background(), "user-1", "project-1", "Saved UI", doc); err != nil {
		t.Fatalf("SaveDoc returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

type jsonMatcher struct {
	t    *testing.T
	want map[string]any
}

func jsonArg(t *testing.T, want map[string]any) sqlmock.Argument {
	t.Helper()
	return jsonMatcher{t: t, want: want}
}

func (matcher jsonMatcher) Match(value driver.Value) bool {
	raw, ok := value.([]byte)
	if !ok {
		text, ok := value.(string)
		if !ok {
			return false
		}
		raw = []byte(text)
	}
	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		matcher.t.Fatalf("invalid json arg: %v", err)
	}
	return got["name"] == matcher.want["name"] && int(got["schemaVersion"].(float64)) == matcher.want["schemaVersion"].(int)
}

func mustJSON(t *testing.T, value map[string]any) []byte {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal json: %v", err)
	}
	return raw
}
