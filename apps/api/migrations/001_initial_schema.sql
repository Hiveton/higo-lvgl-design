CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  doc JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects(owner_id);

CREATE TABLE IF NOT EXISTS project_versions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  doc JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS project_versions_project_id_idx ON project_versions(project_id);
CREATE INDEX IF NOT EXISTS project_versions_owner_id_idx ON project_versions(owner_id);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INT,
  height INT,
  size_bytes BIGINT NOT NULL,
  object_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS assets_project_id_idx ON assets(project_id);
CREATE INDEX IF NOT EXISTS assets_owner_id_idx ON assets(owner_id);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  logs JSONB NOT NULL DEFAULT '[]',
  result_object_key TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS jobs_owner_id_idx ON jobs(owner_id);
CREATE INDEX IF NOT EXISTS jobs_project_id_idx ON jobs(project_id);
