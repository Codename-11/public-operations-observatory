ALTER TABLE collection_runs
  ADD COLUMN operation text NOT NULL DEFAULT 'snapshot';

ALTER TABLE collection_runs
  ADD CONSTRAINT collection_runs_operation_check
  CHECK (operation IN ('snapshot', 'history_backfill'));

UPDATE collection_runs
SET operation = 'history_backfill'
WHERE source_metadata ? 'backfill';

CREATE INDEX collection_runs_source_scope_operation_finished_idx
  ON collection_runs (source, scope, operation, finished_at DESC)
  WHERE finished_at IS NOT NULL;
