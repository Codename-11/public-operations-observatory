CREATE OR REPLACE FUNCTION enforce_successful_checkpoint_run()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  run_status text;
BEGIN
  SELECT status INTO run_status
  FROM collection_runs
  WHERE id = NEW.collection_run_id
  FOR UPDATE;

  IF run_status IS DISTINCT FROM 'succeeded' THEN
    RAISE EXCEPTION 'checkpoint collection run must be succeeded';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_annotation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'annotations are append-only';
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'annotations are append-only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS annotations_append_only ON annotations;
CREATE TRIGGER annotations_append_only
BEFORE UPDATE OR DELETE ON annotations
FOR EACH ROW EXECUTE FUNCTION prevent_annotation_mutation();
