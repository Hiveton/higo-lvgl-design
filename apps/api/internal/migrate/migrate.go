package migrate

import (
	"context"
	"database/sql"
	"embed"
)

//go:embed 001_initial_schema.sql
var schemaFiles embed.FS

func Run(ctx context.Context, db *sql.DB) error {
	schema, err := schemaFiles.ReadFile("001_initial_schema.sql")
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, string(schema))
	return err
}
