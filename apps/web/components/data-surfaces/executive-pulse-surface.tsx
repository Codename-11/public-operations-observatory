'use client';

import type {
  OverviewAvailability,
  OverviewReadModelV1,
} from '@public-operations-observatory/contracts';
import {
  Card,
  CardContent,
  CardHeader,
  EvidenceLink,
  StatusBadge,
} from '@public-operations-observatory/ui';

import {
  buildExecutivePulseModel,
  type ExecutivePulseAttentionItem,
  type ExecutivePulseDecisionRow,
} from '../../lib/executive-pulse-model';
import { selectMetricChange } from '../../lib/data-surfaces';
import { availabilityStatus } from './data-surface-shared';
import styles from './executive-pulse-microcharts.module.css';
import { WorkspaceCommandHeader } from './reach-command-header';

const integer = new Intl.NumberFormat('en-US');

const compactDuration = (
  milliseconds: number,
): { accessibleLabel: string; value: string; unit: string } => {
  if (milliseconds < 60_000) {
    const seconds = Number((milliseconds / 1_000).toFixed(1));
    return {
      accessibleLabel: `${seconds} ${Math.abs(seconds) === 1 ? 'second' : 'seconds'}`,
      value: String(seconds),
      unit: 'sec',
    };
  }

  if (milliseconds < 3_600_000) {
    const minutes = Math.round(milliseconds / 60_000);
    return {
      accessibleLabel: `${minutes} ${Math.abs(minutes) === 1 ? 'minute' : 'minutes'}`,
      value: String(minutes),
      unit: 'min',
    };
  }

  const hours = Number((milliseconds / 3_600_000).toFixed(1));
  return {
    accessibleLabel: `${hours} ${Math.abs(hours) === 1 ? 'hour' : 'hours'}`,
    value: String(hours),
    unit: 'hr',
  };
};

const textValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Unavailable';
  if (typeof value === 'boolean') return value ? 'Healthy' : 'Needs attention';
  if (typeof value === 'string') {
    const friendlyStates: Record<string, string> = {
      complete: 'Complete',
      healthy: 'Healthy',
      partial: 'Partial',
      stale: 'Stale',
      failed: 'Failed',
      empty: 'Unavailable',
      unavailable: 'Unavailable',
    };
    return friendlyStates[value] ?? value;
  }
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return 'Unavailable';
};

const briefingSummary = (briefing: unknown): string | null => {
  if (typeof briefing === 'string' && briefing.length > 0) return briefing;
  if (
    briefing !== null &&
    typeof briefing === 'object' &&
    'summary' in briefing &&
    typeof briefing.summary === 'string' &&
    briefing.summary.length > 0
  ) {
    return briefing.summary;
  }
  return null;
};

const healthAvailability = (value: unknown): OverviewAvailability =>
  value === 'complete' ||
  value === 'partial' ||
  value === 'stale' ||
  value === 'failed' ||
  value === 'empty'
    ? value
    : 'empty';

const uniqueEvidenceActions = (
  items: ExecutivePulseAttentionItem[],
): Array<ExecutivePulseAttentionItem & { evidenceUrl: string }> => {
  const actions = new Map<string, ExecutivePulseAttentionItem & { evidenceUrl: string }>();
  for (const item of items) {
    if (item.evidenceUrl !== null && !actions.has(item.evidenceUrl)) {
      actions.set(item.evidenceUrl, { ...item, evidenceUrl: item.evidenceUrl });
    }
  }
  return Array.from(actions.values());
};

const SlopeChart = ({
  label,
  current,
  previous,
}: {
  label: string;
  current: number | null;
  previous: number | null;
}) => {
  const state = current === null ? 'empty' : previous === null ? 'endpoint' : 'comparison';
  const ariaLabel =
    current === null
      ? `${label} comparison unavailable`
      : previous === null
        ? `${label}, current ${integer.format(current)}; prior unavailable`
        : `${label}, prior ${integer.format(previous)}, current ${integer.format(current)}`;
  const rises = current !== null && previous !== null && current > previous;
  const previousY = current === previous ? 21 : rises ? 30 : 12;
  const currentY = current === previous ? 21 : rises ? 12 : 30;

  return (
    <svg
      className={styles.metricChart}
      viewBox="0 0 120 42"
      role="img"
      aria-label={ariaLabel}
      data-chart-state={state}
    >
      <g aria-hidden="true">
        <path className={styles.track} d="M8 34 H112" />
        {state === 'comparison' ? (
          <>
            <path
              className={styles.slopeLine}
              d={`M14 ${previousY} L106 ${currentY}`}
              pathLength="1"
            />
            <circle className={styles.priorPoint} cx="14" cy={previousY} r="3" />
          </>
        ) : null}
        {current !== null ? (
          <circle
            className={styles.currentPoint}
            cx="106"
            cy={state === 'comparison' ? currentY : 21}
            r="4"
          />
        ) : null}
      </g>
    </svg>
  );
};

const CoverageChart = ({ observed, required }: { observed: number | null; required: number }) => {
  const active = observed === null ? 0 : Math.min(Math.max(observed, 0), required);
  const gap = 3;
  const width = (120 - gap * (required - 1)) / required;

  return (
    <svg
      className={styles.barChart}
      viewBox="0 0 120 20"
      role="img"
      aria-label={
        observed === null
          ? `Traffic coverage unavailable; ${required} required days`
          : `Traffic coverage, ${observed} of ${required} required days observed`
      }
      data-chart-state={observed === null ? 'empty' : 'coverage'}
    >
      <g aria-hidden="true">
        {Array.from({ length: required }, (_, index) => {
          const state = observed === null ? 'unavailable' : index < active ? 'active' : 'inactive';
          return (
            <rect
              key={index}
              className={state === 'active' ? styles.activeSegment : styles.segment}
              data-segment-state={state}
              x={index * (width + gap)}
              y="4"
              width={width}
              height="12"
              rx="2"
            />
          );
        })}
      </g>
    </svg>
  );
};

const FreshnessGauge = ({ overview }: { overview: OverviewReadModelV1 }) => {
  const { checkedAt, lastSuccessfulAt, staleAfter } = overview.freshness;
  const checked = Date.parse(checkedAt);
  const successful = lastSuccessfulAt === null ? Number.NaN : Date.parse(lastSuccessfulAt);
  const stale = staleAfter === null ? Number.NaN : Date.parse(staleAfter);
  const lag = checked - successful;
  const threshold = stale - successful;
  const available = Number.isFinite(lag) && Number.isFinite(threshold) && lag >= 0 && threshold > 0;
  const width = available ? Math.min(lag / threshold, 1) * 108 : 0;

  return (
    <svg
      className={styles.barChart}
      viewBox="0 0 120 20"
      role="img"
      aria-label={
        available
          ? `Collection freshness, ${compactDuration(lag).accessibleLabel} lag; stale threshold ${compactDuration(threshold).accessibleLabel}`
          : 'Collection freshness threshold unavailable'
      }
      data-chart-state={available ? 'threshold' : 'empty'}
    >
      <g aria-hidden="true">
        <rect className={styles.gaugeTrack} x="6" y="6" width="108" height="8" rx="4" />
        {available ? (
          <rect className={styles.gaugeFill} x="6" y="6" width={width} height="8" rx="4" />
        ) : null}
        <path className={styles.threshold} d="M114 3 V17" />
      </g>
    </svg>
  );
};

export function ExecutivePulseSurface({ overview }: { overview: OverviewReadModelV1 }) {
  const model = buildExecutivePulseModel(overview);
  const starsChange = selectMetricChange(overview, 'github.stars')?.change ?? null;
  const issuesChange = selectMetricChange(overview, 'github.open_issues')?.change ?? null;
  const facts = [
    model.facts.stars,
    model.facts.openIssues,
    model.facts.trafficCoverage,
    model.facts.freshness,
  ];
  const authoredSummary = briefingSummary(model.authoredBriefing);
  const action = model.decisionRows.find((row: ExecutivePulseDecisionRow) => row.key === 'action')!;
  const evidenceActions = uniqueEvidenceActions(model.attentionItems);
  const trafficCoverage =
    model.evidenceHealth.trafficObservedDays === null
      ? 'Unavailable'
      : `${model.evidenceHealth.trafficObservedDays}/${model.evidenceHealth.trafficRequiredDays} days`;
  const freshness =
    model.evidenceHealth.freshnessLagMilliseconds === null
      ? 'Unavailable'
      : `${Math.round(model.evidenceHealth.freshnessLagMilliseconds / 60_000)} minutes`;

  return (
    <div className="data-surface data-surface--executive-pulse executive-pulse">
      <WorkspaceCommandHeader
        overview={overview}
        surfaceLabel="Executive Pulse"
        heading="Executive pulse"
        description="Operating state, material changes, and evidence requiring attention."
        refreshLabel="Refresh data"
        showWindow
      />

      <section className="executive-pulse__status" aria-labelledby="executive-status-title">
        <div className="executive-pulse__status-copy">
          <h2 id="executive-status-title">{model.operatingStatus.title}</h2>
          <p>{model.operatingStatus.detail}</p>
        </div>
        <StatusBadge status={availabilityStatus(model.operatingStatus.availability)} />
      </section>

      <section className="executive-pulse__fact-grid" aria-label="Executive pulse facts">
        {facts.map((fact) => (
          <Card
            className="executive-pulse__fact-card"
            role="region"
            aria-label={`${fact.label} fact`}
            key={fact.key}
          >
            <CardHeader>
              <h2>{fact.label}</h2>
            </CardHeader>
            <CardContent>
              <p
                className={`executive-pulse__fact-value${
                  fact.value === null ? ' executive-pulse__fact-value--unavailable' : ''
                }`}
              >
                {fact.key === 'collection-freshness' && typeof fact.value === 'number' ? (
                  <span aria-label={compactDuration(fact.value).accessibleLabel}>
                    <span className="executive-pulse__fact-number">
                      {compactDuration(fact.value).value}
                    </span>{' '}
                    <small className="executive-pulse__fact-unit">
                      {compactDuration(fact.value).unit}
                    </small>
                  </span>
                ) : fact.key === 'traffic-coverage' && typeof fact.value === 'number' ? (
                  <>
                    <span className="executive-pulse__fact-number">
                      {fact.value}/{model.evidenceHealth.trafficRequiredDays}
                    </span>{' '}
                    <small className="executive-pulse__fact-unit">days</small>
                  </>
                ) : typeof fact.value === 'number' ? (
                  <>
                    <span className="executive-pulse__fact-number">
                      {integer.format(fact.value)}
                    </span>
                    {fact.unit ? (
                      <>
                        {' '}
                        <small className="executive-pulse__fact-unit">{fact.unit}</small>
                      </>
                    ) : null}
                  </>
                ) : (
                  textValue(fact.value)
                )}
              </p>
              {fact.key === 'stars' ? (
                <SlopeChart
                  label="Stars"
                  current={starsChange?.current ?? null}
                  previous={starsChange?.previous ?? null}
                />
              ) : fact.key === 'open-issues' ? (
                <SlopeChart
                  label="Open issues"
                  current={issuesChange?.current ?? null}
                  previous={issuesChange?.previous ?? null}
                />
              ) : fact.key === 'traffic-coverage' ? (
                <CoverageChart
                  observed={model.evidenceHealth.trafficObservedDays}
                  required={model.evidenceHealth.trafficRequiredDays}
                />
              ) : (
                <FreshnessGauge overview={overview} />
              )}
              <p>{fact.detail}</p>
              {fact.evidenceUrl ? (
                <EvidenceLink
                  href={fact.evidenceUrl}
                  aria-label={`${fact.evidenceLabel} for ${fact.label} (opens in a new tab)`}
                >
                  {fact.evidenceLabel}
                </EvidenceLink>
              ) : (
                <p>{fact.evidenceLabel}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="executive-pulse__workspace">
        <div className="executive-pulse__main">
          <Card aria-labelledby="executive-decision-title">
            <CardHeader>
              <h2 id="executive-decision-title">Decision brief</h2>
            </CardHeader>
            <CardContent>
              <dl className="executive-pulse__decision-list">
                {model.decisionRows.map((row) => (
                  <div className="executive-pulse__decision-row" key={row.key}>
                    <dt>{row.label}</dt>
                    <dd>{row.text}</dd>
                  </div>
                ))}
              </dl>
              <p className="executive-pulse__briefing-note">
                {authoredSummary ?? 'Authored briefing unavailable for this window.'}
              </p>
            </CardContent>
          </Card>

          <Card aria-labelledby="executive-attention-title">
            <CardHeader>
              <div>
                <h2 id="executive-attention-title">Needs attention</h2>
                <p>
                  {model.attentionItems.length}{' '}
                  {model.attentionItems.length === 1 ? 'item' : 'items'}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {model.attentionItems.length === 0 ? (
                <p>No evidence limitations require attention.</p>
              ) : (
                <ul className="executive-pulse__attention-list">
                  {model.attentionItems.map((item) => (
                    <li className="executive-pulse__attention-row" key={item.key}>
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                      {item.evidenceUrl ? (
                        <EvidenceLink
                          href={item.evidenceUrl}
                          aria-label={`Inspect ${item.label} evidence (opens in a new tab)`}
                        >
                          Inspect
                        </EvidenceLink>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="executive-pulse__rail" aria-label="Evidence health and actions">
          <Card aria-labelledby="executive-health-title">
            <CardHeader>
              <h2 id="executive-health-title">Evidence health</h2>
            </CardHeader>
            <CardContent>
              <dl className="executive-pulse__health-list">
                <div className="executive-pulse__health-row">
                  <dt>Overall</dt>
                  <dd>
                    <StatusBadge
                      status={availabilityStatus(healthAvailability(model.evidenceHealth.overall))}
                    />
                  </dd>
                </div>
                <div className="executive-pulse__health-row">
                  <dt>Collection</dt>
                  <dd>{textValue(model.evidenceHealth.collection)}</dd>
                </div>
                <div className="executive-pulse__health-row">
                  <dt>Traffic coverage</dt>
                  <dd>{trafficCoverage}</dd>
                </div>
                <div className="executive-pulse__health-row">
                  <dt>Freshness</dt>
                  <dd>{freshness}</dd>
                </div>
                <div className="executive-pulse__health-row">
                  <dt>Briefing</dt>
                  <dd>{textValue(model.evidenceHealth.briefing)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card aria-labelledby="executive-evidence-actions-title">
            <CardHeader>
              <h2 id="executive-evidence-actions-title">Evidence actions</h2>
            </CardHeader>
            <CardContent>
              <div className="executive-pulse__evidence-actions">
                <p>{action.text}</p>
                {evidenceActions.length > 0 ? (
                  <ul>
                    {evidenceActions.map((item) => (
                      <li key={item.evidenceUrl}>
                        <EvidenceLink
                          href={item.evidenceUrl}
                          aria-label={`Inspect ${item.label} evidence (opens in a new tab)`}
                        >
                          Inspect {item.label} evidence
                        </EvidenceLink>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
