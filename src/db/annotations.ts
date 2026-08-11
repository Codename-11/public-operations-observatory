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
  const note = input.note ?? null;
  const result = await database.query<{ id: string; note: string | null }>(
    `INSERT INTO annotations (scope, occurred_at, kind, title, evidence_url, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (scope, occurred_at, kind, title, evidence_url) DO UPDATE
     SET note = annotations.note
     RETURNING id, note`,
    [input.scope, input.occurredAt, input.kind, input.title.trim(), evidenceUrl.toString(), note],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to create annotation');
  if (row.note !== note) {
    throw new Error('Annotation already exists with a different note');
  }
  return row.id;
}
