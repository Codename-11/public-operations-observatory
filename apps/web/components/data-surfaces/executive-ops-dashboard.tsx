'use client';

import type {
  HistoricalContextReadModelV1,
  OverviewReadModelV1,
} from '@public-operations-observatory/contracts';
import { StatusBadge } from '@public-operations-observatory/ui';
import Link from 'next/link';

import { selectMetricChange } from '../../lib/data-surfaces';
import { buildExecutivePulseModel } from '../../lib/executive-pulse-model';
import { buildReachMetricModels, type ReachMetricModel } from '../../lib/reach-metric-registry';
import { useTimezone } from '../timezone/timezone-provider';
import { availabilityStatus } from './data-surface-shared';
import { WorkspaceCommandHeader } from './reach-command-header';
import styles from './executive-ops-dashboard.module.css';

const integer = new Intl.NumberFormat('en-US');
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const compactDuration = (milliseconds: number | null): string => {
  if (milliseconds === null) return 'Unavailable';
  if (milliseconds < 60_000) return `${Number((milliseconds / 1_000).toFixed(1))} sec`;
  if (milliseconds < 3_600_000) return `${Math.round(milliseconds / 60_000)} min`;
  return `${Number((milliseconds / 3_600_000).toFixed(1))} hr`;
};

const comparisonLabel = (
  comparison: { delta: number; percent: number | null; direction: string } | null,
): string => {
  if (comparison === null) return 'No complete comparison';
  if (comparison.direction === 'unchanged') return 'No change';
  const sign = comparison.delta > 0 ? '+' : '';
  return `${sign}${integer.format(comparison.delta)}${
    comparison.percent === null ? '' : ` · ${sign}${percent.format(comparison.percent)}%`
  }`;
};

const statusTitle = (availability: OverviewReadModelV1['availability']): string => {
  if (availability === 'complete') return 'All metrics current';
  if (availability === 'partial') return 'Some metrics are incomplete';
  if (availability === 'stale') return 'Data refresh overdue';
  if (availability === 'failed') return 'Collection needs attention';
  return 'Performance data unavailable';
};

const attentionDetail = (detail: string): string =>
  detail
    .replace('Exact prior-period comparison unavailable.', 'Prior comparison unavailable.')
    .replace('current or comparison evidence is incomplete.', 'current coverage is incomplete.');

const pointsFor = (metric: ReachMetricModel) =>
  metric.history?.points.filter(
    (point): point is typeof point & { value: number } => point.value !== null,
  ) ?? [];

const linePoints = (values: number[]): string => {
  if (values.length === 0) return '';
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 100 : (index / (values.length - 1)) * 100;
      const y = 32 - ((value - minimum) / range) * 24;
      return `${x},${y}`;
    })
    .join(' ');
};

function MomentumLane({ metric }: { metric: ReachMetricModel }) {
  const { timezone } = useTimezone();
  const points = pointsFor(metric);
  const latest = points.at(-1);
  const first = points[0];
  const summary =
    points.length === 0
      ? `${metric.label} history unavailable`
      : `${metric.label}, ${points.length} retained points from ${new Intl.DateTimeFormat('en-US', {
          month: 'short',
          year: 'numeric',
          timeZone: timezone,
        }).format(new Date(first!.timestamp))} to ${new Intl.DateTimeFormat('en-US', {
          month: 'short',
          year: 'numeric',
          timeZone: timezone,
        }).format(new Date(latest!.timestamp))}; latest ${integer.format(latest!.value)}`;

  return (
    <div className={styles.lane}>
      <div className={styles.laneLabel}>
        <span>{metric.shortLabel}</span>
        <strong>{latest ? integer.format(latest.value) : '—'}</strong>
      </div>
      {points.length > 0 ? (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={summary}>
          <path d="M0 32 H100" className={styles.chartGrid} aria-hidden="true" />
          <polyline
            points={linePoints(points.map(({ value }) => value))}
            className={styles.chartLine}
            pathLength="1"
            aria-hidden="true"
          />
        </svg>
      ) : (
        <span className={styles.unavailable}>History unavailable</span>
      )}
      <span className={styles.laneMethod}>{metric.history?.method ?? 'unavailable'}</span>
    </div>
  );
}

export function ExecutiveOpsDashboard({
  overview,
  history = null,
}: {
  overview: OverviewReadModelV1;
  history?: HistoricalContextReadModelV1 | null;
}) {
  const model = buildExecutivePulseModel(overview);
  const reachMetrics = buildReachMetricModels(overview, history);
  const byKey = new Map(reachMetrics.map((metric) => [metric.key, metric]));
  const openIssues = selectMetricChange(overview, 'github.open_issues');
  const performance = [
    byKey.get('github.stars'),
    byKey.get('github.views'),
    byKey.get('github.clones'),
  ].filter((metric): metric is ReachMetricModel => metric !== undefined);
  const kpis = [
    ...performance.map((metric) => ({
      key: metric.key,
      label: metric.shortLabel,
      value: metric.value,
      comparison: metric.comparison,
      coverage: metric.coverageLabel,
    })),
    {
      key: 'github.release_asset_downloads',
      label: 'Release downloads',
      value: overview.release?.assetDownloads ?? null,
      comparison: null,
      coverage: overview.release?.tagName ?? 'Latest release',
    },
  ];
  const attention = model.attentionItems.slice(0, 3);
  const coverage =
    model.evidenceHealth.trafficObservedDays === null
      ? 'Unavailable'
      : `${model.evidenceHealth.trafficObservedDays}/${model.evidenceHealth.trafficRequiredDays} days`;

  return (
    <div className={`data-surface ${styles.dashboard}`}>
      <WorkspaceCommandHeader
        overview={overview}
        surfaceLabel="Executive Pulse"
        heading="Performance overview"
        description="Audience movement, repository activity, and operating health."
        refreshLabel="Refresh data"
        showWindow
      />

      <section className={styles.status} aria-label="Operating status">
        <div>
          <span className={styles.statusEyebrow}>Today</span>
          <strong>{statusTitle(overview.availability)}</strong>
        </div>
        <StatusBadge status={availabilityStatus(model.operatingStatus.availability)} />
      </section>

      <section className={styles.kpiGrid} aria-label="Performance snapshot">
        {kpis.map((kpi) => (
          <article className={styles.kpi} key={kpi.key} aria-label={`${kpi.label} metric`}>
            <div className={styles.kpiHeading}>
              <span>{kpi.label}</span>
              <small>{kpi.coverage}</small>
            </div>
            <strong className={styles.kpiValue}>
              {kpi.value === null ? '—' : integer.format(kpi.value)}
            </strong>
            <span
              className={`${styles.delta} ${
                kpi.comparison?.direction === 'increase'
                  ? styles.positive
                  : kpi.comparison?.direction === 'decrease'
                    ? styles.negative
                    : ''
              }`}
            >
              {comparisonLabel(kpi.comparison)}
            </span>
          </article>
        ))}
      </section>

      <div className={styles.mainGrid}>
        <section className={styles.momentum} aria-labelledby="momentum-title">
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>180-day context</span>
              <h2 id="momentum-title">Repository momentum</h2>
            </div>
            <Link href="/projects/hermes-relay/reach-acquisition">Open acquisition view</Link>
          </header>
          <div className={styles.lanes}>
            {performance.map((metric) => (
              <MomentumLane metric={metric} key={metric.key} />
            ))}
          </div>
          <p className={styles.chartNote}>
            Each lane uses its own scale. Traffic shows directly observed retained days; Stars may
            include lower-bound reconstructed history.
          </p>
        </section>

        <aside className={styles.attention} aria-labelledby="attention-title">
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Priority queue</span>
              <h2 id="attention-title">Needs attention</h2>
            </div>
            <strong>{model.attentionItems.length}</strong>
          </header>
          {attention.length === 0 ? (
            <p className={styles.empty}>No evidence limitations require attention.</p>
          ) : (
            <ol>
              {attention.map((item) => (
                <li key={item.key}>
                  <strong>{item.label}</strong>
                  <span>{attentionDetail(item.detail)}</span>
                </li>
              ))}
            </ol>
          )}
          {model.attentionItems.length > attention.length ? (
            <Link className={styles.reviewLink} href="/projects/hermes-relay/reach-acquisition">
              Review all evidence
            </Link>
          ) : null}
        </aside>
      </div>

      <section className={styles.operations} aria-label="Operating health">
        <div>
          <span>Open issues</span>
          <strong>{openIssues?.change.current ?? '—'}</strong>
          <small>{comparisonLabel(openIssues?.comparison ?? null)}</small>
        </div>
        <div>
          <span>Traffic coverage</span>
          <strong>{coverage}</strong>
          <small>Observed days</small>
        </div>
        <div>
          <span>Collection freshness</span>
          <strong>{compactDuration(model.evidenceHealth.freshnessLagMilliseconds)}</strong>
          <small>{model.evidenceHealth.collection}</small>
        </div>
        <div>
          <span>Evidence status</span>
          <strong>{model.evidenceHealth.overall}</strong>
          <small>{overview.view === 'completed' ? 'Completed window' : 'Current window'}</small>
        </div>
      </section>
    </div>
  );
}
