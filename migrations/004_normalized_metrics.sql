CREATE OR REPLACE VIEW normalized_metric_observations AS
SELECT
  o.id AS source_observation_id,
  o.scope,
  o.external_id,
  o.observed_bucket AS effective_at,
  o.created_at,
  o.evidence_url,
  d.metric_key,
  d.version AS metric_version,
  d.unit,
  d.aggregation,
  (o.payload ->> d.value_path)::numeric AS value_numeric
FROM observations o
JOIN metric_definitions d ON d.source_kind = o.record_kind
WHERE o.source = 'github'
  AND jsonb_typeof(o.payload -> d.value_path) = 'number';
