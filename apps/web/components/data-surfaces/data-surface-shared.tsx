'use client';

import type {
  OverviewAvailability,
  OverviewChangeV1,
  OverviewProvenanceV1,
  OverviewSourceAttentionExceptionV1,
  OverviewWarningV1,
  OverviewWindowV1,
} from '@public-operations-observatory/contracts';
import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  EvidenceLink,
  NumberTicker,
  PanelState,
  StatusBadge,
} from '@public-operations-observatory/ui';
import type { ReactNode } from 'react';

import type { MetricChangeSelection } from '../../lib/data-surfaces';
import { EvidenceSheet } from '../overview/evidence-sheet';

const integer = new Intl.NumberFormat('en-US');

export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value),
  );

export const formatTimestamp = (value: string | null): string =>
  value
    ? `${new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date(value))} UTC`
    : 'Unavailable';

export const availabilityStatus = (
  availability: OverviewAvailability,
): 'available' | 'partial' | 'stale' | 'unavailable' | 'error' =>
  availability === 'complete'
    ? 'available'
    : availability === 'failed'
      ? 'error'
      : availability === 'empty'
        ? 'unavailable'
        : availability;

export function DataSurfaceHeader({
  eyebrow,
  title,
  description,
  window,
  availability,
  provenance,
}: {
  eyebrow: string;
  title: string;
  description: string;
  window: OverviewWindowV1;
  availability: OverviewAvailability;
  provenance: OverviewProvenanceV1;
}) {
  return (
    <header className="data-surface-header">
      <div className="data-surface-header__copy">
        <p className="data-surface-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <p className="data-surface-window">
          {formatDate(window.start)}–{formatDate(window.end)} UTC, end exclusive · exact 7-day
          window compared with {formatDate(window.comparisonStart)}–
          {formatDate(window.comparisonEnd)} UTC.
        </p>
      </div>
      <div className="data-surface-header__actions">
        <StatusBadge status={availabilityStatus(availability)} detail={availability} />
        <EvidenceSheet provenance={provenance} />
      </div>
    </header>
  );
}

export function SurfaceAvailabilityNotice({
  availability,
}: {
  availability: OverviewAvailability;
}) {
  if (availability === 'complete') return null;
  if (availability === 'empty') {
    return (
      <EmptyState kind="no-records">
        No collected records are available for parts of this window. Any retained values remain
        visible with their own state.
      </EmptyState>
    );
  }
  return (
    <PanelState
      state={availability === 'failed' ? 'error' : availability}
      title={`${availability === 'failed' ? 'Failed' : availability === 'partial' ? 'Partial' : 'Stale'} overview`}
    >
      Available contract values remain visible. Treat each value according to its displayed state.
    </PanelState>
  );
}

export function MetricNumber({ value, className }: { value: number; className?: string }) {
  return <NumberTicker value={value} className={className} aria-label={integer.format(value)} />;
}

const signed = (value: number): string => `${value > 0 ? '+' : ''}${integer.format(value)}`;

export function MetricComparisonCard({
  metric,
  headingLevel = 3,
  className,
}: {
  metric: MetricChangeSelection | null;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  if (metric === null) {
    return (
      <Card className={`data-surface-metric ${className ?? ''}`.trim()}>
        <CardHeader>
          <Heading>Metric unavailable</Heading>
        </CardHeader>
        <CardContent>
          <p>No matching metric record was provided.</p>
        </CardContent>
      </Card>
    );
  }
  const { change } = metric;
  return (
    <Card
      className={`data-surface-metric signal-metric signal-metric--${change.availability} ${className ?? ''}`.trim()}
      aria-label={`${change.label} metric`}
    >
      <CardHeader>
        <div>
          <Heading>{change.label}</Heading>
          <p>{change.unit}</p>
        </div>
        <StatusBadge
          status={availabilityStatus(change.availability)}
          detail={change.availability}
        />
      </CardHeader>
      <CardContent>
        <dl className="data-surface-comparison">
          <div>
            <dt>Current 7-day window</dt>
            <dd>
              {change.current === null ? (
                'Unavailable'
              ) : (
                <MetricNumber value={change.current} className="signal-value" />
              )}
            </dd>
          </div>
          <div>
            <dt>Prior 7-day window</dt>
            <dd>{change.previous === null ? 'Unavailable' : integer.format(change.previous)}</dd>
          </div>
          <div>
            <dt>Delta</dt>
            <dd>{change.delta === null ? 'Unavailable' : signed(change.delta)}</dd>
          </div>
        </dl>
        {change.evidenceUrl ? (
          <EvidenceLink
            href={change.evidenceUrl}
            aria-label={`Open ${change.label} evidence (opens in a new tab)`}
          >
            Inspect evidence
          </EvidenceLink>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AttentionList({
  attention,
}: {
  attention: Array<{ exception: OverviewSourceAttentionExceptionV1 }>;
}) {
  if (attention.length === 0) {
    return <EmptyState kind="no-exceptions">No current source exceptions.</EmptyState>;
  }
  return (
    <ul className="data-surface-attention-list">
      {attention.map(({ exception }) => (
        <li
          className={`signal-attention signal-attention--${exception.severity}`}
          key={`${exception.sourceKey}:${exception.kind}:${exception.detectedAt}`}
        >
          <strong>{exception.title}</strong>
          <p>{exception.detail}</p>
          <span>
            {exception.sourceKey} · {exception.severity} · detected{' '}
            {formatTimestamp(exception.detectedAt)}
          </span>
          {exception.evidenceUrl ? (
            <EvidenceLink
              href={exception.evidenceUrl}
              aria-label={`Open evidence for ${exception.title} (opens in a new tab)`}
            >
              Inspect evidence
            </EvidenceLink>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function WarningList({ warnings }: { warnings: OverviewWarningV1[] }) {
  if (warnings.length === 0) return <p>No overview warnings.</p>;
  return (
    <ul className="data-surface-warning-list">
      {warnings.map((warning, index) => (
        <li
          className="signal-warning"
          key={`${warning.code}:${warning.sourceKey ?? 'all'}:${index}`}
        >
          <strong>{warning.code.replaceAll('_', ' ')}</strong>
          <p>{warning.message}</p>
          {warning.sourceKey ? <span>Source: {warning.sourceKey}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function SurfaceSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`data-surface-section ${className ?? ''}`.trim()} aria-labelledby={id}>
      <header className="data-surface-section__header">
        <div>
          <h2 id={id}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export const comparisonBarWidth = (value: number | null, maximum: number): string =>
  value === null || value === 0 ? '0%' : `${Math.max(4, (value / maximum) * 100)}%`;

export type MetricChange = OverviewChangeV1;
