import { z } from 'zod';

import {
  CanonicalIsoTimestampSchema,
  EvidenceUrlSchema,
  OverviewProjectV1Schema,
  OverviewProvenanceReferenceV1Schema,
} from './overview.js';

const ProjectKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const ProvenanceRefSchema = z.string().trim().min(1).max(256);
const ProvenanceRefsSchema = z.array(ProvenanceRefSchema).max(20);
const CountSchema = z.number().int().safe().nonnegative();

export const HistoricalContextPeriodSchema = z.literal('180d');
export const HistoricalContextRequestSchema = z.strictObject({
  projectKey: ProjectKeySchema,
  period: HistoricalContextPeriodSchema,
  asOf: CanonicalIsoTimestampSchema.optional(),
});

export const HistoricalContextMetricKeySchema = z.enum([
  'github.stars',
  'github.open_issues',
  'github.views',
  'github.clones',
]);
export const HistoricalContextAvailabilitySchema = z.enum(['complete', 'partial', 'unavailable']);
export const HistoricalContextMethodSchema = z.enum(['observed', 'reconstructed', 'lower-bound']);

export const HistoricalContextPointV1Schema = z.strictObject({
  timestamp: CanonicalIsoTimestampSchema,
  value: CountSchema.nullable(),
  availability: HistoricalContextAvailabilitySchema,
  provenanceRefs: ProvenanceRefsSchema,
});

export const HistoricalContextSeriesV1Schema = z.strictObject({
  metricKey: HistoricalContextMetricKeySchema,
  label: z.string().trim().min(1).max(200),
  unit: z.enum(['count', 'views', 'clones']),
  bucket: z.enum(['calendar-month-end', 'utc-day']),
  method: HistoricalContextMethodSchema,
  availability: HistoricalContextAvailabilitySchema,
  limitation: z.string().trim().min(1).max(2_000),
  reasonCode: z
    .enum(['source-rolling-window', 'reconstructed-lower-bound', 'reconstructed'])
    .nullable(),
  evidenceUrl: EvidenceUrlSchema.nullable(),
  points: z.array(HistoricalContextPointV1Schema).max(200),
});

export const HistoricalContextReadModelV1Schema = z
  .strictObject({
    version: z.literal(1),
    project: OverviewProjectV1Schema,
    period: HistoricalContextPeriodSchema,
    window: z.strictObject({
      start: CanonicalIsoTimestampSchema,
      end: CanonicalIsoTimestampSchema,
    }),
    asOf: CanonicalIsoTimestampSchema,
    series: z.array(HistoricalContextSeriesV1Schema).length(4),
    provenance: z.strictObject({
      scope: z.literal('Codename-11/hermes-relay'),
      generatedAt: CanonicalIsoTimestampSchema,
      references: z.array(OverviewProvenanceReferenceV1Schema).max(100),
    }),
  })
  .superRefine((history, context) => {
    const references = new Set(history.provenance.references.map(({ ref }) => ref));
    history.series.forEach((series, seriesIndex) => {
      series.points.forEach((point, pointIndex) => {
        point.provenanceRefs.forEach((ref, refIndex) => {
          if (!references.has(ref)) {
            context.addIssue({
              code: 'custom',
              path: ['series', seriesIndex, 'points', pointIndex, 'provenanceRefs', refIndex],
              message: 'History provenance reference does not resolve',
            });
          }
        });
      });
    });
  });

export type HistoricalContextRequest = z.infer<typeof HistoricalContextRequestSchema>;
export type HistoricalContextReadModelV1 = z.infer<typeof HistoricalContextReadModelV1Schema>;
export type HistoricalContextSeriesV1 = z.infer<typeof HistoricalContextSeriesV1Schema>;
