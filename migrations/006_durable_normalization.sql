CREATE TABLE IF NOT EXISTS normalized_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_observation_id uuid NOT NULL,
  source text NOT NULL,
  scope text NOT NULL,
  record_kind text NOT NULL,
  external_id text NOT NULL,
  effective_at timestamptz NOT NULL,
  schema_version integer NOT NULL,
  normalizer_version integer NOT NULL,
  payload jsonb NOT NULL,
  evidence_url text NOT NULL,
  source_created_at timestamptz NOT NULL,
  normalized_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_observation_id, normalizer_version)
);

CREATE INDEX IF NOT EXISTS normalized_records_scope_time_idx
  ON normalized_records (source, scope, record_kind, effective_at DESC);

INSERT INTO normalized_records
  (source_observation_id, source, scope, record_kind, external_id, effective_at,
   schema_version, normalizer_version, payload, evidence_url, source_created_at, normalized_at)
SELECT id, source, scope, record_kind, external_id, observed_bucket,
  schema_version, 1, payload, evidence_url, created_at, created_at
FROM observations
WHERE source = 'github' AND schema_version = 1
ON CONFLICT (source_observation_id, normalizer_version) DO NOTHING;

DROP VIEW normalized_metric_observations;

CREATE VIEW normalized_metric_observations AS
SELECT
  r.source_observation_id,
  r.scope,
  r.external_id,
  r.effective_at,
  r.source_created_at AS created_at,
  r.normalized_at,
  r.evidence_url,
  d.metric_key,
  d.version AS metric_version,
  d.unit,
  d.aggregation,
  (r.payload ->> d.value_path)::numeric AS value_numeric
FROM normalized_records r
JOIN metric_definitions d ON d.source_kind = r.record_kind
WHERE r.source = 'github'
  AND jsonb_typeof(r.payload -> d.value_path) = 'number';

ALTER TABLE retention_runs
  ADD COLUMN IF NOT EXISTS raw_observations_deleted integer NOT NULL DEFAULT 0;

ALTER TABLE retention_runs
  ADD COLUMN IF NOT EXISTS raw_cutoff_at timestamptz;

UPDATE retention_runs
SET raw_cutoff_at = cutoff_at - interval '60 days'
WHERE raw_cutoff_at IS NULL;

ALTER TABLE retention_runs
  ALTER COLUMN raw_cutoff_at SET NOT NULL;

DELETE FROM source_checkpoint_history history
USING collection_runs run
WHERE history.collection_run_id = run.id AND run.status <> 'succeeded';

DELETE FROM source_checkpoints checkpoint
USING collection_runs run
WHERE checkpoint.collection_run_id = run.id AND run.status <> 'succeeded';

CREATE OR REPLACE FUNCTION enforce_successful_checkpoint_run()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM collection_runs
    WHERE id = NEW.collection_run_id AND status = 'succeeded'
  ) THEN
    RAISE EXCEPTION 'checkpoint collection run must be succeeded';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS source_checkpoints_successful_run ON source_checkpoints;
CREATE TRIGGER source_checkpoints_successful_run
BEFORE INSERT OR UPDATE ON source_checkpoints
FOR EACH ROW EXECUTE FUNCTION enforce_successful_checkpoint_run();

DROP TRIGGER IF EXISTS source_checkpoint_history_successful_run ON source_checkpoint_history;
CREATE TRIGGER source_checkpoint_history_successful_run
BEFORE INSERT OR UPDATE ON source_checkpoint_history
FOR EACH ROW EXECUTE FUNCTION enforce_successful_checkpoint_run();
