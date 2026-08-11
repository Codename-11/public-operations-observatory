import type { Database } from '../db/client.js';

const normalizerVersion = 1;
const supportedRecordKinds = [
  'issues.summary',
  'pulls.summary',
  'release.summary',
  'repository.summary',
  'traffic.clones',
  'traffic.clones.window',
  'traffic.views',
  'traffic.views.window',
  'workflows.summary',
] as const;

export async function normalizeGitHubObservations(
  database: Database,
  scope: string,
): Promise<number> {
  const unsupported = await database.query<{ record_kind: string; schema_version: number }>(
    `SELECT DISTINCT observation.record_kind, observation.schema_version
     FROM observations observation
     LEFT JOIN normalized_records normalized
       ON normalized.source_observation_id = observation.id
      AND normalized.normalizer_version = $2
     WHERE observation.source = 'github' AND observation.scope = $1
       AND normalized.id IS NULL
       AND (observation.schema_version <> 1 OR NOT (observation.record_kind = ANY($3::text[])))`,
    [scope, normalizerVersion, supportedRecordKinds],
  );
  if (unsupported.rows.length > 0) {
    const row = unsupported.rows[0];
    throw new Error(
      `Unsupported GitHub observation for normalizer ${normalizerVersion}: ${row?.record_kind} schema ${row?.schema_version}`,
    );
  }

  const inserted = await database.query(
    `INSERT INTO normalized_records
       (source_observation_id, source, scope, record_kind, external_id, effective_at,
        schema_version, normalizer_version, payload, evidence_url, source_created_at)
     SELECT observation.id, observation.source, observation.scope, observation.record_kind,
       observation.external_id, observation.observed_bucket, observation.schema_version, $2,
       observation.payload, observation.evidence_url, observation.created_at
     FROM observations observation
     LEFT JOIN normalized_records normalized
       ON normalized.source_observation_id = observation.id
      AND normalized.normalizer_version = $2
     WHERE observation.source = 'github' AND observation.scope = $1
       AND normalized.id IS NULL
     ON CONFLICT (source_observation_id, normalizer_version) DO NOTHING`,
    [scope, normalizerVersion],
  );
  return inserted.rowCount ?? 0;
}
