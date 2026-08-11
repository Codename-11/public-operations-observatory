ALTER TABLE retention_runs
  ADD COLUMN IF NOT EXISTS unnormalized_raw_observations_deleted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_observations_overdue integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION prevent_checkpoint_run_demotion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'succeeded' AND NEW.status <> 'succeeded' AND (
    EXISTS (SELECT 1 FROM source_checkpoints WHERE collection_run_id = OLD.id)
    OR EXISTS (SELECT 1 FROM source_checkpoint_history WHERE collection_run_id = OLD.id)
  ) THEN
    RAISE EXCEPTION 'a collection run referenced by a checkpoint must remain succeeded';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collection_runs_checkpoint_status_invariant ON collection_runs;
CREATE TRIGGER collection_runs_checkpoint_status_invariant
BEFORE UPDATE OF status ON collection_runs
FOR EACH ROW EXECUTE FUNCTION prevent_checkpoint_run_demotion();
