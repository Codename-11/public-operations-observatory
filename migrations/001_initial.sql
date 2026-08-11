CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  scope text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_summary text,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  scope text NOT NULL,
  record_kind text NOT NULL,
  external_id text NOT NULL,
  observed_bucket timestamptz NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  payload jsonb NOT NULL,
  payload_digest text NOT NULL,
  evidence_url text NOT NULL,
  collection_run_id uuid NOT NULL REFERENCES collection_runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, scope, record_kind, external_id, observed_bucket, schema_version, payload_digest)
);

CREATE INDEX IF NOT EXISTS observations_scope_kind_bucket_idx
  ON observations (scope, record_kind, observed_bucket DESC);

CREATE TABLE IF NOT EXISTS source_checkpoints (
  source text NOT NULL,
  scope text NOT NULL,
  checkpoint_key text NOT NULL,
  cursor jsonb NOT NULL,
  cursor_at timestamptz NOT NULL,
  collection_run_id uuid NOT NULL REFERENCES collection_runs(id),
  advanced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, scope, checkpoint_key)
);

CREATE TABLE IF NOT EXISTS annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  occurred_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('release', 'documentation', 'communication', 'other')),
  title text NOT NULL,
  evidence_url text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS annotations_scope_occurred_idx
  ON annotations (scope, occurred_at DESC);

CREATE TABLE IF NOT EXISTS briefing_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  metric_version integer NOT NULL,
  content_digest text NOT NULL,
  content_markdown text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, window_start, window_end, metric_version, content_digest)
);
