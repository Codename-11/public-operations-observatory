'use client';

import type { OverviewReadModelV1 } from '@public-operations-observatory/contracts';
import { Card, CardContent, CardHeader, StatusBadge } from '@public-operations-observatory/ui';
import type { KeyboardEvent } from 'react';
import { useId, useState } from 'react';

import type {
  MetricEvidenceKind,
  ReachMetricKey,
  ReachMetricModel,
} from '../../lib/reach-metric-registry';
import type { ObservatoryTimezone } from '../../lib/timezone';
import { useTimezone } from '../timezone/timezone-provider';

const integer = new Intl.NumberFormat('en-US');
const percentage = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

type BadgeStatus = 'available' | 'partial' | 'stale' | 'unavailable' | 'error';
type ChartPoint = { timestamp: string; value: number };

const formatValue = (value: number | null): string =>
  value === null ? 'Unavailable' : integer.format(value);

const formatTimestamp = (value: string, timeZone: ObservatoryTimezone): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(new Date(value));

const formatChartTimestamp = (value: string, timeZone: ObservatoryTimezone): string =>
  Number.isNaN(Date.parse(value))
    ? value
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone }).format(new Date(value));

const availabilityStatus = (availability: OverviewReadModelV1['availability']): BadgeStatus => {
  if (availability === 'complete') return 'available';
  if (availability === 'failed') return 'error';
  if (availability === 'empty') return 'unavailable';
  return availability;
};

const evidenceLabel = (kind: MetricEvidenceKind): string =>
  kind === 'lower-bound' ? 'Lower-bound' : kind.charAt(0).toUpperCase() + kind.slice(1);

function EvidenceBadge({ kind }: { kind: MetricEvidenceKind }) {
  return (
    <span className={`reach-evidence-badge reach-evidence-badge--${kind}`}>
      {evidenceLabel(kind)}
    </span>
  );
}

const nonNullHistoryPoints = (metric: ReachMetricModel): ChartPoint[] =>
  metric.history?.points.flatMap((point) =>
    point.value === null ? [] : [{ timestamp: point.timestamp, value: point.value }],
  ) ?? [];

const cardSparklinePoints = (metric: ReachMetricModel): ChartPoint[] => {
  const historyPoints = nonNullHistoryPoints(metric);
  if (historyPoints.length > 0) return historyPoints;

  const points: ChartPoint[] = [];
  if (metric.previous !== null) {
    points.push({ timestamp: 'Prior window', value: metric.previous });
  }
  if (metric.value !== null) {
    points.push({ timestamp: 'Current window', value: metric.value });
  }
  return points;
};

const chartCoordinates = (
  points: readonly ChartPoint[],
  width: number,
  height: number,
  padding: number,
  domainMinimum?: number,
  domainMaximum?: number,
): Array<{ x: number; y: number }> => {
  if (points.length === 0) return [];
  const values = points.map(({ value }) => value);
  const minimum = domainMinimum ?? Math.min(...values);
  const maximum = domainMaximum ?? Math.max(...values);
  const range = maximum - minimum;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return points.map(({ value }, index) => ({
    x: points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * innerWidth,
    y: range === 0 ? height / 2 : padding + ((maximum - value) / range) * innerHeight,
  }));
};

const polylinePoints = (coordinates: Array<{ x: number; y: number }>): string =>
  coordinates.map(({ x, y }) => `${x},${y}`).join(' ');

const chartAriaLabel = (
  label: string,
  points: readonly ChartPoint[],
  timeZone: ObservatoryTimezone,
): string =>
  `${label}: ${points
    .map(
      ({ timestamp, value }) =>
        `${formatChartTimestamp(timestamp, timeZone)}, ${integer.format(value)}`,
    )
    .join('; ')}`;

const comparisonText = (metric: ReachMetricModel): string | null => {
  if (metric.comparison === null || metric.previous === null) return 'Comparison unavailable';

  const { comparison } = metric;
  const delta = `${comparison.delta > 0 ? '+' : ''}${integer.format(comparison.delta)}`;
  const percent =
    comparison.percent === null
      ? ''
      : ` (${comparison.percent > 0 ? '+' : ''}${percentage.format(comparison.percent)}%)`;
  return `Prior ${integer.format(metric.previous)} · ${comparison.direction} ${delta}${percent}`;
};

function MetricSparkline({ metric }: { metric: ReachMetricModel }) {
  const { timezone } = useTimezone();
  const points = cardSparklinePoints(metric);
  const coordinates = chartCoordinates(points, 120, 36, 3);
  if (points.length === 0) return null;
  const usesHistory = nonNullHistoryPoints(metric).length > 0;
  const sparklineEvidenceKind = usesHistory
    ? metric.historyEvidenceKind
    : metric.currentEvidenceKind;
  const dashed =
    sparklineEvidenceKind === 'reconstructed' || sparklineEvidenceKind === 'lower-bound';

  return (
    <svg
      className="reach-metric__sparkline"
      viewBox="0 0 120 36"
      preserveAspectRatio="none"
      role="img"
      aria-label={chartAriaLabel(
        `${metric.label} ${evidenceLabel(sparklineEvidenceKind)} sparkline`,
        points,
        timezone,
      )}
    >
      {coordinates.length > 1 ? (
        <polyline
          className="reach-metric__sparkline-line"
          points={polylinePoints(coordinates)}
          fill="none"
          strokeDasharray={dashed ? '6 4' : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {coordinates.map(({ x, y }, index) => (
        <circle
          className="reach-metric__sparkline-point"
          cx={x}
          cy={y}
          r="2"
          vectorEffect="non-scaling-stroke"
          key={`${points[index]?.timestamp ?? index}:${points[index]?.value ?? ''}`}
        />
      ))}
    </svg>
  );
}

export function ReachMetricCards({ metrics }: { metrics: ReachMetricModel[] }) {
  return (
    <div className="reach-dashboard__metric-grid">
      {metrics.map((metric) => {
        const comparison = comparisonText(metric);
        return (
          <Card
            className="reach-metric__card"
            aria-label={`${metric.label} metric, current ${formatValue(metric.value)}, ${evidenceLabel(metric.summaryEvidenceKind)}, coverage ${metric.coverageLabel}`}
            key={metric.key}
          >
            <CardHeader className="reach-metric__header">
              <div className="reach-metric__heading">
                <h2>{metric.label}</h2>
              </div>
              <EvidenceBadge kind={metric.summaryEvidenceKind} />
            </CardHeader>
            <CardContent className="reach-metric__content">
              <div className="reach-metric__value">{formatValue(metric.value)}</div>
              <p className="reach-metric__comparison">{comparison}</p>
              <p className="reach-metric__coverage">
                {metric.coverageLabel.endsWith('days')
                  ? `Coverage: ${metric.coverageLabel}`
                  : metric.coverageLabel}
              </p>
              <MetricSparkline metric={metric} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SignalChart({ metric }: { metric: ReachMetricModel }) {
  const { timezone } = useTimezone();
  const points = nonNullHistoryPoints(metric);
  if (points.length === 0) {
    return <p className="reach-dashboard__empty-state">Historical values are unavailable.</p>;
  }

  const values = points.map(({ value }) => value);
  const maximum = Math.max(...values);
  const axisMaximum = maximum === 0 ? 4 : maximum;
  const coordinates = chartCoordinates(points, 960, 240, 32, 0, axisMaximum);
  const yTicks = Array.from({ length: 5 }, (_, index) => ({
    value: Math.round(axisMaximum - (axisMaximum * index) / 4),
    y: 32 + (index * 176) / 4,
  }));
  const xTickIndexes = points.flatMap((_, index) => {
    if (points.length <= 6) return [index];
    const interval = Math.max(1, Math.floor((points.length - 1) / 5));
    return index % interval === 0 || index === points.length - 1 ? [index] : [];
  });
  const dashed =
    metric.historyEvidenceKind === 'reconstructed' || metric.historyEvidenceKind === 'lower-bound';
  const endpoint = points.at(-1);
  const observedEndpoint =
    dashed &&
    coordinates.length > 1 &&
    endpoint !== undefined &&
    endpoint.timestamp === metric.historyAsOf &&
    metric.currentEvidenceKind === 'observed' &&
    metric.value === endpoint.value;
  const firstCoordinate = coordinates[0];
  const endpointCoordinate = coordinates.at(-1);

  return (
    <>
      <figure className="reach-dashboard__history-figure">
        <svg
          className="reach-dashboard__history-chart"
          viewBox="0 0 960 240"
          role="img"
          aria-label={chartAriaLabel(`${metric.label} history`, points, timezone)}
        >
          <g className="reach-dashboard__axis" aria-hidden="true">
            {yTicks.map((tick) => (
              <text x="4" y={tick.y + 3} key={`y:${tick.y}`}>
                {integer.format(tick.value)}
              </text>
            ))}
            {xTickIndexes.map((index) => {
              const coordinate = coordinates[index];
              const point = points[index];
              if (!coordinate || !point) return null;
              return (
                <text
                  x={coordinate.x}
                  y="236"
                  textAnchor={
                    index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'
                  }
                  key={`x:${point.timestamp}`}
                >
                  {new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    timeZone: timezone,
                  }).format(new Date(point.timestamp))}
                </text>
              );
            })}
          </g>
          {firstCoordinate && endpointCoordinate ? (
            <polygon
              className="reach-dashboard__history-area"
              points={`${firstCoordinate.x},208 ${polylinePoints(coordinates)} ${endpointCoordinate.x},208`}
            />
          ) : null}
          {coordinates.length > 1 ? (
            <polyline
              className="reach-dashboard__history-line"
              points={polylinePoints(coordinates)}
              fill="none"
              strokeDasharray={dashed ? '8 6' : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {endpointCoordinate ? (
            <line
              className="reach-dashboard__history-guide"
              x1={endpointCoordinate.x}
              x2={endpointCoordinate.x}
              y1="32"
              y2="208"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {coordinates.map(({ x, y }, index) => (
            <circle
              className="reach-dashboard__history-point"
              cx={x}
              cy={y}
              r="4"
              vectorEffect="non-scaling-stroke"
              key={`${points[index]?.timestamp ?? index}:${points[index]?.value ?? ''}`}
            />
          ))}
          {observedEndpoint && endpointCoordinate ? (
            <circle
              className="reach-dashboard__history-endpoint--observed"
              cx={endpointCoordinate.x}
              cy={endpointCoordinate.y}
              r="6"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        <figcaption className="reach-dashboard__history-caption">
          {endpoint
            ? `${formatTimestamp(endpoint.timestamp, timezone)} · ${integer.format(endpoint.value)}`
            : 'Unavailable'}
        </figcaption>
      </figure>
      <div className="reach-dashboard__history-legend" aria-label="Chart evidence legend">
        <span
          className={
            dashed ? 'reach-dashboard__legend-line--dashed' : 'reach-dashboard__legend-line--solid'
          }
        />
        <span>{evidenceLabel(metric.historyEvidenceKind)}</span>
        {observedEndpoint ? (
          <>
            <span className="reach-dashboard__legend-point--observed" />
            <span>Observed latest</span>
          </>
        ) : null}
      </div>
      <details className="reach-dashboard__history-data">
        <summary>Exact chart values</summary>
        <ol>
          {points.map((point) => (
            <li key={`${point.timestamp}:${point.value}`}>
              <time dateTime={point.timestamp}>{formatTimestamp(point.timestamp, timezone)}</time>:{' '}
              {integer.format(point.value)}
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}

export function SignalHistoryPanel({ metrics }: { metrics: ReachMetricModel[] }) {
  const tabId = useId();
  const [selectedKey, setSelectedKey] = useState<ReachMetricKey | undefined>(metrics[0]?.key);
  const selected = metrics.find(({ key }) => key === selectedKey) ?? metrics[0];
  const selectTab = (key: ReachMetricKey, focus = false): void => {
    setSelectedKey(key);
    if (focus) document.getElementById(`${tabId}-${key}-tab`)?.focus();
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % metrics.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + metrics.length) % metrics.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = metrics.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextMetric = metrics[nextIndex];
    if (nextMetric) selectTab(nextMetric.key, true);
  };

  return (
    <Card className="reach-dashboard__panel" aria-labelledby={`${tabId}-title`}>
      <CardHeader className="reach-dashboard__panel-header">
        <div>
          <h2 id={`${tabId}-title`}>Signal history</h2>
        </div>
        <span className="reach-dashboard__history-range" aria-label="History range: six months">
          6 months
        </span>
      </CardHeader>
      <CardContent className="reach-dashboard__panel-content">
        {metrics.length === 0 || selected === undefined ? (
          <p className="reach-dashboard__empty-state">No signal history is available.</p>
        ) : (
          <>
            <div
              className="reach-dashboard__tabs"
              role="tablist"
              aria-label="Choose a signal history"
            >
              {metrics.map((metric, index) => {
                const isSelected = metric.key === selected.key;
                return (
                  <button
                    className={
                      isSelected ? 'reach-dashboard__tab--selected' : 'reach-dashboard__tab'
                    }
                    type="button"
                    role="tab"
                    id={`${tabId}-${metric.key}-tab`}
                    aria-controls={`${tabId}-${metric.key}-panel`}
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => selectTab(metric.key)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    key={metric.key}
                  >
                    {metric.shortLabel}
                  </button>
                );
              })}
            </div>
            <div
              className="reach-dashboard__tab-panel"
              role="tabpanel"
              id={`${tabId}-${selected.key}-panel`}
              aria-labelledby={`${tabId}-${selected.key}-tab`}
            >
              <SignalChart metric={selected} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function CurrentWindowTable({ metrics }: { metrics: ReachMetricModel[] }) {
  const titleId = useId();
  return (
    <Card className="reach-dashboard__panel" aria-labelledby={titleId}>
      <CardHeader className="reach-dashboard__panel-header">
        <div>
          <h2 id={titleId}>Current window</h2>
          <p>Comparison of the current 7-day window to the supported prior window.</p>
        </div>
      </CardHeader>
      <CardContent className="reach-dashboard__table-wrap">
        <p className="reach-dashboard__table-hint">Swipe to view prior values and coverage.</p>
        <table className="reach-dashboard__table">
          <caption className="sr-only">Exact current-window repository signal values</caption>
          <thead>
            <tr>
              <th scope="col">Signal</th>
              <th scope="col">Current</th>
              <th scope="col">Prior</th>
              <th scope="col">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.key}>
                <th scope="row">{metric.label}</th>
                <td>{formatValue(metric.value)}</td>
                <td>{formatValue(metric.previous)}</td>
                <td>{metric.coverageLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function ProvenanceLimitationsPanel({ metrics }: { metrics: ReachMetricModel[] }) {
  const titleId = useId();
  return (
    <Card className="reach-dashboard__panel" aria-labelledby={titleId}>
      <CardHeader className="reach-dashboard__panel-header">
        <div>
          <h2 id={titleId}>Provenance &amp; limitations</h2>
          <p>How each signal is produced and any important limitations.</p>
        </div>
      </CardHeader>
      <CardContent className="reach-dashboard__panel-content">
        {metrics.length === 0 ? (
          <p className="reach-dashboard__empty-state">No metric provenance is available.</p>
        ) : (
          <ul className="reach-dashboard__provenance-list">
            {metrics.map((metric) => {
              const describesHistory = metric.limitation !== null && metric.history !== null;
              return (
                <li className="reach-dashboard__provenance-row" key={metric.key}>
                  <span className="sr-only">{metric.label}: </span>
                  <EvidenceBadge
                    kind={
                      describesHistory ? metric.historyEvidenceKind : metric.currentEvidenceKind
                    }
                  />
                  <p>{metric.limitation ?? metric.description}</p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const formatDuration = (milliseconds: number): string => {
  const sign = milliseconds < 0 ? '-' : '';
  const absolute = Math.abs(milliseconds);
  const seconds = Math.floor(absolute / 1_000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  const parts = [
    days > 0 ? `${days}d` : null,
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    remainingSeconds > 0 || seconds === 0 ? `${remainingSeconds}s` : null,
  ].filter((part): part is string => part !== null);
  return `${sign}${parts.join(' ')}`;
};

const historicalTrafficState = (
  metrics: ReachMetricModel[],
): { label: 'Available' | 'Limited' | 'Unavailable'; status: BadgeStatus } => {
  const traffic = metrics.filter(({ key }) => key === 'github.views' || key === 'github.clones');
  const withPoints = traffic.filter((metric) => nonNullHistoryPoints(metric).length > 0);
  if (withPoints.length === 0) return { label: 'Unavailable', status: 'unavailable' };
  if (
    traffic.length > 0 &&
    withPoints.length === traffic.length &&
    traffic.every(({ history }) => history?.availability === 'complete')
  ) {
    return { label: 'Available', status: 'available' };
  }
  return { label: 'Limited', status: 'partial' };
};

export function EvidenceHealthPanel({
  overview,
  metrics,
}: {
  overview: OverviewReadModelV1;
  metrics: ReachMetricModel[];
}) {
  const titleId = useId();
  const { timezone } = useTimezone();
  const firstSource = overview.sources[0];
  const trafficCoverage = metrics
    .filter(({ key }) => key === 'github.views' || key === 'github.clones')
    .flatMap(({ change }) => (change?.coverage ? [change.coverage] : []));
  const minimumCoverage = trafficCoverage.reduce<(typeof trafficCoverage)[number] | undefined>(
    (minimum, coverage) =>
      minimum === undefined || coverage.currentObservedDays < minimum.currentObservedDays
        ? coverage
        : minimum,
    undefined,
  );
  const trafficHistory = historicalTrafficState(metrics);
  const freshnessLag =
    overview.freshness.lastSuccessfulAt === null
      ? null
      : Date.parse(overview.freshness.checkedAt) - Date.parse(overview.freshness.lastSuccessfulAt);

  return (
    <Card className="reach-dashboard__panel" aria-labelledby={titleId}>
      <CardHeader className="reach-dashboard__panel-header">
        <h2 id={titleId}>Evidence health</h2>
      </CardHeader>
      <CardContent className="reach-dashboard__panel-content">
        <dl className="reach-dashboard__health-grid">
          <div>
            <dt>Overall availability</dt>
            <dd>
              <StatusBadge
                status={availabilityStatus(overview.availability)}
                detail={overview.availability}
              />
            </dd>
          </div>
          <div>
            <dt>Primary source</dt>
            <dd>
              {firstSource ? (
                <>
                  <span>{firstSource.label}</span>
                  <StatusBadge
                    status={availabilityStatus(firstSource.availability)}
                    detail={firstSource.availability}
                  />
                </>
              ) : (
                'Unavailable'
              )}
            </dd>
          </div>
          <div>
            <dt>Minimum current traffic coverage</dt>
            <dd>
              {minimumCoverage
                ? `${minimumCoverage.currentObservedDays}/${minimumCoverage.requiredDays} days`
                : 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt>Historical traffic</dt>
            <dd>
              <StatusBadge status={trafficHistory.status} detail={trafficHistory.label} />
            </dd>
          </div>
          <div>
            <dt>Freshness lag</dt>
            <dd>
              {freshnessLag === null ? (
                'Unavailable'
              ) : (
                <>
                  <span>{formatDuration(freshnessLag)}</span>
                  <span className="reach-dashboard__health-detail">
                    {overview.freshness.lastSuccessfulAt
                      ? `${formatTimestamp(overview.freshness.lastSuccessfulAt, timezone)} to ${formatTimestamp(overview.freshness.checkedAt, timezone)}`
                      : null}
                  </span>
                </>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

interface CollectionEvent {
  label: string;
  timestamp: string;
}

export function CollectionActivityPanel({
  overview,
  historyGeneratedAt,
}: {
  overview: OverviewReadModelV1;
  historyGeneratedAt?: string | null;
}) {
  const titleId = useId();
  const { timezone } = useTimezone();
  const sourceEvents = overview.sources.flatMap<CollectionEvent>((source) => {
    const events: CollectionEvent[] = [];
    if (source.lastAttemptAt) {
      events.push({
        label: `${source.label} collection attempted`,
        timestamp: source.lastAttemptAt,
      });
    }
    if (source.lastSuccessfulAt) {
      events.push({
        label: `${source.label} collection succeeded`,
        timestamp: source.lastSuccessfulAt,
      });
    }
    return events;
  });
  const candidates: CollectionEvent[] = [
    ...sourceEvents,
    { label: 'Overview generated', timestamp: overview.provenance.generatedAt },
    ...(historyGeneratedAt ? [{ label: 'History generated', timestamp: historyGeneratedAt }] : []),
  ];
  const seen = new Set<string>();
  const events = candidates
    .filter(({ label, timestamp }) => {
      const key = `${label}\u0000${timestamp}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));

  return (
    <Card className="reach-dashboard__panel" aria-labelledby={titleId}>
      <CardHeader className="reach-dashboard__panel-header">
        <h2 id={titleId}>Collection activity</h2>
      </CardHeader>
      <CardContent className="reach-dashboard__panel-content">
        <ol className="reach-dashboard__activity-list">
          {events.map((event) => (
            <li className="reach-dashboard__activity-row" key={`${event.label}:${event.timestamp}`}>
              <strong>{event.label}</strong>
              <time dateTime={event.timestamp}>{formatTimestamp(event.timestamp, timezone)}</time>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
