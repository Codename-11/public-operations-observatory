ALTER TABLE source_checkpoints
  ADD COLUMN IF NOT EXISTS cursor_at timestamptz;

UPDATE source_checkpoints
SET cursor_at = COALESCE(NULLIF(cursor ->> 'observedAt', '')::timestamptz, advanced_at)
WHERE cursor_at IS NULL;

ALTER TABLE source_checkpoints
  ALTER COLUMN cursor_at SET NOT NULL;

WITH ranked_annotations AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY scope, occurred_at, kind, title, evidence_url
      ORDER BY created_at DESC, id DESC
    ) AS revision_rank
  FROM annotations
)
DELETE FROM annotations
WHERE id IN (SELECT id FROM ranked_annotations WHERE revision_rank > 1);

CREATE UNIQUE INDEX IF NOT EXISTS annotations_natural_key_idx
  ON annotations (scope, occurred_at, kind, title, evidence_url);

CREATE TABLE IF NOT EXISTS retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version integer NOT NULL,
  cutoff_at timestamptz NOT NULL,
  diagnostics_redacted integer NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now()
);
