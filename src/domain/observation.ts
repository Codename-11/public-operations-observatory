import { createHash } from 'node:crypto';

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ObservationInput {
  source: string;
  scope: string;
  recordKind: string;
  externalId: string;
  observedBucket: Date;
  schemaVersion: number;
  payload: JsonValue;
  evidenceUrl: string;
}

export interface StoredObservation extends ObservationInput {
  id: string;
  payloadDigest: string;
  createdAt: Date;
}

function canonicalize(value: JsonValue): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const entries = Object.entries(value).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(',')}}`;
}

export function digestPayload(payload: JsonValue): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}

export function dayBucket(date: Date): Date {
  const bucket = new Date(date);
  bucket.setUTCHours(0, 0, 0, 0);
  return bucket;
}
