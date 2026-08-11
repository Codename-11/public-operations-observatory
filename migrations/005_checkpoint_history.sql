CREATE TABLE IF NOT EXISTS source_checkpoint_history (
  source text NOT NULL,
  scope text NOT NULL,
  checkpoint_key text NOT NULL,
  cursor jsonb NOT NULL,
  cursor_at timestamptz NOT NULL,
  collection_run_id uuid NOT NULL REFERENCES collection_runs(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_run_id, checkpoint_key)
);

CREATE INDEX IF NOT EXISTS source_checkpoint_history_lookup_idx
  ON source_checkpoint_history (source, scope, checkpoint_key, cursor_at DESC);

INSERT INTO source_checkpoint_history
  (source, scope, checkpoint_key, cursor, cursor_at, collection_run_id, recorded_at)
SELECT source, scope, checkpoint_key, cursor, cursor_at, collection_run_id, advanced_at
FROM source_checkpoints
ON CONFLICT (collection_run_id, checkpoint_key) DO NOTHING;
