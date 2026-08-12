import { z } from 'zod';

/** Every timestamp crossing the Overview boundary uses UTC with millisecond precision. */
export const CanonicalIsoTimestampSchema = z.iso.datetime({
  offset: false,
  precision: 3,
});

/** Evidence is deliberately limited to links that are safe to present as web links. */
export const EvidenceUrlSchema = z.url().superRefine((value, context) => {
  const url = new URL(value);
  const allowedHosts = new Set(['github.com', 'api.github.com']);

  if (url.protocol !== 'https:') {
    context.addIssue({ code: 'custom', message: 'Evidence URL must use HTTPS' });
  }
  if (url.username !== '' || url.password !== '') {
    context.addIssue({ code: 'custom', message: 'Evidence URL must not contain credentials' });
  }
  if (url.hash !== '') {
    context.addIssue({ code: 'custom', message: 'Evidence URL must not contain a fragment' });
  }
  if (url.search !== '') {
    context.addIssue({ code: 'custom', message: 'Evidence URL must not contain a query string' });
  }
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    context.addIssue({ code: 'custom', message: 'Evidence URL host is not approved' });
  }
  const hasLiteralControlCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
  if (/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value) || hasLiteralControlCharacter) {
    context.addIssue({
      code: 'custom',
      message: 'Evidence URL must not contain control characters',
    });
  }
});

export const OverviewAvailabilitySchema = z.enum([
  'complete',
  'partial',
  'stale',
  'failed',
  'empty',
]);

const RetainedValueAvailabilitySchema = z.enum(['partial', 'stale']);
const UnavailableValueAvailabilitySchema = z.enum(['failed', 'empty']);

export const OverviewPeriodSchema = z.literal('7d');

const ProjectKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const NonEmptyTextSchema = z.string().trim().min(1).max(2_000);
const ProvenanceRefSchema = z.string().trim().min(1).max(256);
const SourceKeySchema = z.string().trim().min(1).max(80);
export const OverviewMetricKeySchema = z.enum([
  'github.stars',
  'github.views',
  'github.clones',
  'github.release_asset_downloads',
  'github.open_issues',
]);
const CountSchema = z.number().int().safe().nonnegative();
const SignedCountSchema = z.number().int().safe();
const Phase0RepositoryScopeSchema = z.literal('Codename-11/hermes-relay');
const NullableTimestampSchema = CanonicalIsoTimestampSchema.nullable();
const NullableEvidenceUrlSchema = EvidenceUrlSchema.nullable();
const ProvenanceRefsSchema = z
  .array(ProvenanceRefSchema)
  .max(20)
  .superRefine((refs, context) => {
    const seen = new Set<string>();
    refs.forEach((ref, index) => {
      if (seen.has(ref)) {
        context.addIssue({
          code: 'custom',
          path: [index],
          message: 'Provenance references must be unique within each array',
        });
      }
      seen.add(ref);
    });
  });

export const OverviewReadModelV1RequestSchema = z.strictObject({
  projectKey: ProjectKeySchema,
  period: OverviewPeriodSchema,
  windowEnd: CanonicalIsoTimestampSchema.optional(),
  asOf: CanonicalIsoTimestampSchema.optional(),
});

export const OverviewProjectV1Schema = z.strictObject({
  key: ProjectKeySchema,
  name: NonEmptyTextSchema,
  repository: Phase0RepositoryScopeSchema,
  scope: Phase0RepositoryScopeSchema,
});

export const OverviewWindowV1Schema = z
  .strictObject({
    start: CanonicalIsoTimestampSchema,
    end: CanonicalIsoTimestampSchema,
    comparisonStart: CanonicalIsoTimestampSchema,
    comparisonEnd: CanonicalIsoTimestampSchema,
  })
  .superRefine((window, context) => {
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);
    const comparisonStart = Date.parse(window.comparisonStart);
    const comparisonEnd = Date.parse(window.comparisonEnd);
    const sevenDays = 7 * 24 * 60 * 60 * 1_000;

    if (end - start !== sevenDays) {
      context.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'Overview window must cover exactly seven days',
      });
    }
    if (comparisonEnd - comparisonStart !== sevenDays || comparisonEnd !== start) {
      context.addIssue({
        code: 'custom',
        path: ['comparisonEnd'],
        message: 'Comparison window must be the immediately preceding seven days',
      });
    }
  });

export const OverviewFreshnessV1Schema = z.strictObject({
  availability: OverviewAvailabilitySchema,
  checkedAt: CanonicalIsoTimestampSchema,
  lastSuccessfulAt: NullableTimestampSchema,
  staleAfter: NullableTimestampSchema,
});

export const OverviewWarningCodeSchema = z.enum([
  'source_failure',
  'partial_run',
  'stale_collection',
  'missing_successful_checkpoint',
  'incomplete_metric_window',
]);

export const OverviewWarningV1Schema = z.strictObject({
  code: OverviewWarningCodeSchema,
  message: NonEmptyTextSchema,
  sourceKey: SourceKeySchema.optional(),
  metricKey: OverviewMetricKeySchema.optional(),
});

export const OverviewMetricUnitSchema = z.enum(['count', 'views', 'clones', 'downloads']);

const MetricUnits = {
  'github.stars': 'count',
  'github.views': 'views',
  'github.clones': 'clones',
  'github.release_asset_downloads': 'downloads',
  'github.open_issues': 'count',
} as const;

const validateMetricUnit = (
  value: { metricKey: keyof typeof MetricUnits; unit: string },
  context: z.RefinementCtx,
): void => {
  if (value.unit !== MetricUnits[value.metricKey]) {
    context.addIssue({
      code: 'custom',
      path: ['unit'],
      message: `Unit must be ${MetricUnits[value.metricKey]} for ${value.metricKey}`,
    });
  }
};

const OverviewChangeV1CommonShape = {
  metricKey: OverviewMetricKeySchema,
  label: NonEmptyTextSchema,
  unit: OverviewMetricUnitSchema,
  evidenceUrl: NullableEvidenceUrlSchema,
  provenanceRefs: ProvenanceRefsSchema,
};

export const OverviewChangeV1Schema = z
  .discriminatedUnion('availability', [
    z.strictObject({
      ...OverviewChangeV1CommonShape,
      availability: z.literal('complete'),
      current: CountSchema,
      previous: CountSchema,
      delta: SignedCountSchema,
    }),
    z.strictObject({
      ...OverviewChangeV1CommonShape,
      availability: RetainedValueAvailabilitySchema,
      current: CountSchema.nullable(),
      previous: CountSchema.nullable(),
      delta: SignedCountSchema.nullable(),
    }),
    z.strictObject({
      ...OverviewChangeV1CommonShape,
      availability: UnavailableValueAvailabilitySchema,
      current: z.null(),
      previous: z.null(),
      delta: z.null(),
    }),
  ])
  .superRefine((change, context) => {
    validateMetricUnit(change, context);
    if (change.availability === 'complete' && change.delta !== change.current - change.previous) {
      context.addIssue({
        code: 'custom',
        path: ['delta'],
        message: 'Complete change delta must equal current minus previous',
      });
    }
    if (change.availability === 'partial' || change.availability === 'stale') {
      const current = change.current;
      const previous = change.previous;
      const hasBothOperands = current !== null && previous !== null;
      if (hasBothOperands && change.delta !== current - previous) {
        context.addIssue({
          code: 'custom',
          path: ['delta'],
          message: 'Retained change delta must equal current minus previous',
        });
      }
      if (!hasBothOperands && change.delta !== null) {
        context.addIssue({
          code: 'custom',
          path: ['delta'],
          message: 'Change delta must be null when either retained operand is unavailable',
        });
      }
    }
  });

const OverviewTrendPointV1CommonShape = {
  timestamp: CanonicalIsoTimestampSchema,
  provenanceRefs: ProvenanceRefsSchema,
};

export const OverviewTrendPointV1Schema = z.discriminatedUnion('availability', [
  z.strictObject({
    ...OverviewTrendPointV1CommonShape,
    availability: z.literal('complete'),
    value: CountSchema,
  }),
  z.strictObject({
    ...OverviewTrendPointV1CommonShape,
    availability: RetainedValueAvailabilitySchema,
    value: CountSchema.nullable(),
  }),
  z.strictObject({
    ...OverviewTrendPointV1CommonShape,
    availability: UnavailableValueAvailabilitySchema,
    value: z.null(),
  }),
]);

export const OverviewAnnotationKindSchema = z.enum([
  'release',
  'documentation',
  'communication',
  'other',
]);

export const OverviewTrendAnnotationV1Schema = z.strictObject({
  id: NonEmptyTextSchema,
  kind: OverviewAnnotationKindSchema,
  label: NonEmptyTextSchema,
  occurredAt: CanonicalIsoTimestampSchema,
  evidenceUrl: NullableEvidenceUrlSchema,
  provenanceRefs: ProvenanceRefsSchema,
});

export const OverviewTrendV1Schema = z
  .strictObject({
    metricKey: OverviewMetricKeySchema,
    label: NonEmptyTextSchema,
    unit: OverviewMetricUnitSchema,
    availability: OverviewAvailabilitySchema,
    points: z.array(OverviewTrendPointV1Schema).max(366),
    annotations: z.array(OverviewTrendAnnotationV1Schema).max(100),
  })
  .superRefine((trend, context) => {
    validateMetricUnit(trend, context);
    if (trend.availability !== 'complete') {
      return;
    }
    if (trend.points.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['points'],
        message: 'A complete trend must contain at least one point',
      });
    }
    trend.points.forEach((point, index) => {
      if (point.availability !== 'complete') {
        context.addIssue({
          code: 'custom',
          path: ['points', index, 'availability'],
          message: 'Every point in a complete trend must be complete',
        });
      }
    });
  });

const OverviewReleaseV1CommonShape = {
  provenanceRefs: ProvenanceRefsSchema,
};

export const OverviewReleaseV1Schema = z.discriminatedUnion('availability', [
  z.strictObject({
    ...OverviewReleaseV1CommonShape,
    availability: z.literal('complete'),
    tagName: NonEmptyTextSchema,
    name: NonEmptyTextSchema.nullable(),
    publishedAt: CanonicalIsoTimestampSchema,
    evidenceUrl: EvidenceUrlSchema,
    assetDownloads: CountSchema,
  }),
  z.strictObject({
    ...OverviewReleaseV1CommonShape,
    availability: RetainedValueAvailabilitySchema,
    tagName: NonEmptyTextSchema.nullable(),
    name: NonEmptyTextSchema.nullable(),
    publishedAt: NullableTimestampSchema,
    evidenceUrl: NullableEvidenceUrlSchema,
    assetDownloads: CountSchema.nullable(),
  }),
  z.strictObject({
    ...OverviewReleaseV1CommonShape,
    availability: UnavailableValueAvailabilitySchema,
    tagName: z.null(),
    name: z.null(),
    publishedAt: z.null(),
    evidenceUrl: z.null(),
    assetDownloads: z.null(),
  }),
]);

const OverviewBriefingSummaryV1CommonShape = {
  evidenceUrl: NullableEvidenceUrlSchema,
  provenanceRefs: ProvenanceRefsSchema,
};

export const OverviewBriefingSummaryV1Schema = z.discriminatedUnion('availability', [
  z.strictObject({
    ...OverviewBriefingSummaryV1CommonShape,
    availability: z.literal('complete'),
    summary: NonEmptyTextSchema,
    generatedAt: CanonicalIsoTimestampSchema,
  }),
  z.strictObject({
    ...OverviewBriefingSummaryV1CommonShape,
    availability: RetainedValueAvailabilitySchema,
    summary: NonEmptyTextSchema.nullable(),
    generatedAt: NullableTimestampSchema,
  }),
  z.strictObject({
    ...OverviewBriefingSummaryV1CommonShape,
    availability: UnavailableValueAvailabilitySchema,
    summary: z.null(),
    generatedAt: z.null(),
  }),
]);

export const OverviewSourceV1Schema = z.strictObject({
  key: SourceKeySchema,
  label: NonEmptyTextSchema,
  availability: OverviewAvailabilitySchema,
  lastAttemptAt: NullableTimestampSchema,
  lastSuccessfulAt: NullableTimestampSchema,
  evidenceUrl: NullableEvidenceUrlSchema,
  warnings: z.array(NonEmptyTextSchema).max(100),
  provenanceRefs: ProvenanceRefsSchema,
});

export const OverviewAttentionKindSchema = OverviewWarningCodeSchema;

/** Attention is intentionally source-only: no issue, PR, check, or action shape exists. */
export const OverviewSourceAttentionExceptionV1Schema = z.strictObject({
  kind: OverviewAttentionKindSchema,
  sourceKey: SourceKeySchema,
  severity: z.enum(['warning', 'critical']),
  title: NonEmptyTextSchema,
  detail: NonEmptyTextSchema,
  detectedAt: CanonicalIsoTimestampSchema,
  evidenceUrl: NullableEvidenceUrlSchema,
  provenanceRefs: ProvenanceRefsSchema,
});

export const OverviewProvenanceReferenceV1Schema = z.strictObject({
  ref: ProvenanceRefSchema,
  sourceKey: SourceKeySchema,
  observedAt: CanonicalIsoTimestampSchema,
  evidenceUrl: NullableEvidenceUrlSchema,
});

export const OverviewProvenanceV1Schema = z.strictObject({
  scope: Phase0RepositoryScopeSchema,
  metricDefinitionVersion: z.literal(1),
  windowEnd: CanonicalIsoTimestampSchema,
  asOf: CanonicalIsoTimestampSchema,
  generatedAt: CanonicalIsoTimestampSchema,
  references: z.array(OverviewProvenanceReferenceV1Schema).max(500),
});

export const OverviewReadModelV1Schema = z
  .strictObject({
    version: z.literal(1),
    project: OverviewProjectV1Schema,
    period: OverviewPeriodSchema,
    window: OverviewWindowV1Schema,
    asOf: CanonicalIsoTimestampSchema,
    availability: OverviewAvailabilitySchema,
    freshness: OverviewFreshnessV1Schema,
    warnings: z.array(OverviewWarningV1Schema).max(100),
    changes: z.array(OverviewChangeV1Schema).max(20),
    trend: OverviewTrendV1Schema,
    release: OverviewReleaseV1Schema.nullable(),
    briefing: OverviewBriefingSummaryV1Schema,
    sources: z.array(OverviewSourceV1Schema).max(20),
    attention: z.array(OverviewSourceAttentionExceptionV1Schema).max(100),
    provenance: OverviewProvenanceV1Schema,
  })
  .superRefine((overview, context) => {
    const referenceIds = new Set<string>();
    overview.provenance.references.forEach((reference, index) => {
      if (referenceIds.has(reference.ref)) {
        context.addIssue({
          code: 'custom',
          path: ['provenance', 'references', index, 'ref'],
          message: 'Provenance reference IDs must be unique',
        });
      }
      referenceIds.add(reference.ref);
    });

    const validateRefs = (refs: string[], path: (string | number)[]): void => {
      refs.forEach((ref, index) => {
        if (!referenceIds.has(ref)) {
          context.addIssue({
            code: 'custom',
            path: [...path, index],
            message: `Unresolved provenance reference: ${ref}`,
          });
        }
      });
    };

    overview.changes.forEach((change, index) =>
      validateRefs(change.provenanceRefs, ['changes', index, 'provenanceRefs']),
    );
    overview.trend.points.forEach((point, index) =>
      validateRefs(point.provenanceRefs, ['trend', 'points', index, 'provenanceRefs']),
    );
    overview.trend.annotations.forEach((annotation, index) =>
      validateRefs(annotation.provenanceRefs, ['trend', 'annotations', index, 'provenanceRefs']),
    );
    if (overview.release !== null) {
      validateRefs(overview.release.provenanceRefs, ['release', 'provenanceRefs']);
    }
    validateRefs(overview.briefing.provenanceRefs, ['briefing', 'provenanceRefs']);
    overview.sources.forEach((source, index) =>
      validateRefs(source.provenanceRefs, ['sources', index, 'provenanceRefs']),
    );
    overview.attention.forEach((attention, index) =>
      validateRefs(attention.provenanceRefs, ['attention', index, 'provenanceRefs']),
    );

    if (overview.window.end !== overview.provenance.windowEnd) {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'windowEnd'],
        message: 'Provenance windowEnd must match the Overview window end',
      });
    }
    if (overview.asOf !== overview.provenance.asOf) {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'asOf'],
        message: 'Provenance asOf must match the Overview asOf',
      });
    }
    if (overview.project.scope !== overview.provenance.scope) {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'scope'],
        message: 'Provenance scope must match the project scope',
      });
    }
  });

export type OverviewReadModelV1Request = z.infer<typeof OverviewReadModelV1RequestSchema>;
export type OverviewReadModelV1 = z.infer<typeof OverviewReadModelV1Schema>;
export type OverviewAvailability = z.infer<typeof OverviewAvailabilitySchema>;
export type OverviewProjectV1 = z.infer<typeof OverviewProjectV1Schema>;
export type OverviewWindowV1 = z.infer<typeof OverviewWindowV1Schema>;
export type OverviewFreshnessV1 = z.infer<typeof OverviewFreshnessV1Schema>;
export type OverviewWarningV1 = z.infer<typeof OverviewWarningV1Schema>;
export type OverviewChangeV1 = z.infer<typeof OverviewChangeV1Schema>;
export type OverviewTrendPointV1 = z.infer<typeof OverviewTrendPointV1Schema>;
export type OverviewTrendAnnotationV1 = z.infer<typeof OverviewTrendAnnotationV1Schema>;
export type OverviewTrendV1 = z.infer<typeof OverviewTrendV1Schema>;
export type OverviewReleaseV1 = z.infer<typeof OverviewReleaseV1Schema>;
export type OverviewBriefingSummaryV1 = z.infer<typeof OverviewBriefingSummaryV1Schema>;
export type OverviewSourceV1 = z.infer<typeof OverviewSourceV1Schema>;
export type OverviewSourceAttentionExceptionV1 = z.infer<
  typeof OverviewSourceAttentionExceptionV1Schema
>;
export type OverviewProvenanceReferenceV1 = z.infer<typeof OverviewProvenanceReferenceV1Schema>;
export type OverviewProvenanceV1 = z.infer<typeof OverviewProvenanceV1Schema>;
