\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'observatory_read_model') THEN
    CREATE ROLE observatory_read_model;
  END IF;
END
$$;

ALTER ROLE observatory_read_model
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'observatory_read_model'
      AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'observatory_read_model has prohibited role attributes';
  END IF;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM observatory_read_model;
GRANT USAGE ON SCHEMA public TO observatory_read_model;
GRANT SELECT ON TABLE
  normalized_records,
  collection_runs,
  source_checkpoint_history,
  annotations,
  briefing_revisions
TO observatory_read_model;

SET ROLE observatory_read_model;
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT transaction_timestamp();
SELECT id, record_kind, external_id, effective_at, payload, evidence_url, source_created_at, normalized_at
FROM normalized_records LIMIT 0;
SELECT id, status, started_at, finished_at FROM collection_runs LIMIT 0;
SELECT collection_run_id, cursor_at, recorded_at FROM source_checkpoint_history LIMIT 0;
SELECT id, occurred_at, kind, title, evidence_url, created_at FROM annotations LIMIT 0;
SELECT id, content_markdown, created_at FROM briefing_revisions LIMIT 0;
COMMIT;

DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM observations LIMIT 1;
    RAISE EXCEPTION 'read-model role unexpectedly selected raw observations';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO normalized_records
      (source_observation_id, source, scope, record_kind, external_id, effective_at,
       schema_version, normalizer_version, payload, evidence_url, source_created_at)
    VALUES
      (gen_random_uuid(), 'github', 'denied', 'denied', 'denied', now(), 1, 1,
       '{}'::jsonb, 'https://github.com/denied/denied', now());
    RAISE EXCEPTION 'read-model role unexpectedly wrote normalized records';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE briefing_revisions SET content_markdown = 'denied' WHERE false;
    RAISE EXCEPTION 'read-model role unexpectedly updated durable records';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;

SELECT 'least-privilege read-model role verified' AS result;
