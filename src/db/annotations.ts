import type { Database } from './client.js';

export type AnnotationKind = 'communication' | 'documentation' | 'other' | 'release';

export interface AnnotationInput {
  scope: string;
  occurredAt: Date;
  kind: AnnotationKind;
  title: string;
  evidenceUrl: string;
  note?: string;
}

export async function addAnnotation(database: Database, input: AnnotationInput): Promise<string> {
  const evidenceUrl = new URL(input.evidenceUrl);
  if (!['http:', 'https:'].includes(evidenceUrl.protocol)) {
    throw new Error('Annotation evidence URL must use http or https');
  }
  if (!input.title.trim()) throw new Error('Annotation title must not be empty');
  const result = await database.query<{ id: string }>(
    `INSERT INTO annotations (scope, occurred_at, kind, title, evidence_url, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (scope, occurred_at, kind, title, evidence_url) DO UPDATE
     SET note = EXCLUDED.note
     RETURNING id`,
    [
      input.scope,
      input.occurredAt,
      input.kind,
      input.title.trim(),
      evidenceUrl.toString(),
      input.note ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to create annotation');
  return row.id;
}
