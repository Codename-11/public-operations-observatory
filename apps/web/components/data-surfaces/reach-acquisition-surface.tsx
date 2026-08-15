'use client';

import type {
  HistoricalContextReadModelV1,
  HistoricalContextSeriesV1,
  OverviewReadModelV1,
} from '@public-operations-observatory/contracts';
import {
  BlurFade,
  Card,
  CardContent,
  CardHeader,
  EvidenceLink,
} from '@public-operations-observatory/ui';

import { selectReachAcquisition, type MetricChangeSelection } from '../../lib/data-surfaces';
import {
  comparisonBarWidth,
  DataSurfaceHeader,
  MetricComparisonCard,
  SurfaceAvailabilityNotice,
  SurfaceSection,
} from './data-surface-shared';

function ComparisonVisual({ metrics }: { metrics: MetricChangeSelection[] }) {
  const values = metrics.flatMap(({ change }) =>
    [change.current, change.previous].filter((value): value is number => value !== null),
  );
  const maximum = Math.max(...values, 1);

  return (
    <Card aria-labelledby="reach-comparison-visual-title">
      <CardHeader>
        <div>
          <h2 id="reach-comparison-visual-title">Current and prior observations</h2>
          <p>Bar lengths provide a comparison; exact values follow in the table.</p>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="data-surface-comparison-bars"
          role="img"
          aria-label="Current and prior repository signal comparison. Exact values follow in the data table."
        >
          {metrics.map(({ change }) => (
            <div className="signal-comparison-row" key={change.metricKey}>
              <strong>{change.label}</strong>
              <div className="signal-comparison-bar-group">
                <span>Current</span>
                <span
                  className="signal-comparison-bar signal-comparison-bar--current"
                  style={{ width: comparisonBarWidth(change.current, maximum) }}
                />
                <span>Prior</span>
                <span
                  className="signal-comparison-bar signal-comparison-bar--prior"
                  style={{ width: comparisonBarWidth(change.previous, maximum) }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="data-surface-table-hint">Scroll horizontally for all exact columns.</p>
        <table className="data-surface-exact-table">
          <caption>Exact independent aggregate repository signal values</caption>
          <thead>
            <tr>
              <th scope="col">Signal</th>
              <th scope="col">Unit</th>
              <th scope="col">Current 7-day window</th>
              <th scope="col">Prior 7-day window</th>
              <th scope="col">Delta</th>
              <th scope="col">Availability</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(({ change }) => (
              <tr key={change.metricKey}>
                <th scope="row">{change.label}</th>
                <td>{change.unit}</td>
                <td>{change.current ?? 'Unavailable'}</td>
                <td>{change.previous ?? 'Unavailable'}</td>
                <td>
                  {change.delta === null
                    ? 'Unavailable'
                    : `${change.delta > 0 ? '+' : ''}${change.delta}`}
                </td>
                <td>{change.availability}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function HistoricalSeriesCard({ series }: { series: HistoricalContextSeriesV1 }) {
  const points = series.points.filter(
    (point): point is typeof point & { value: number } => point.value !== null,
  );
  const values = points.map(({ value }) => value);
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, 1);
  const range = Math.max(maximum - minimum, 1);
  const coordinates = points
    .map(({ value }, index) => {
      const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 100 - ((value - minimum) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');
  const first = points[0];
  const latest = points.at(-1);
  const method =
    series.method === 'lower-bound'
      ? 'Lower-bound reconstruction'
      : series.method === 'reconstructed'
        ? 'Reconstructed'
        : 'Directly observed';

  return (
    <Card className="history-series-card">
      <CardHeader>
        <div>
          <h3>{series.label}</h3>
          <p>{method}</p>
        </div>
        <span className={`history-method history-method--${series.method}`}>{series.method}</span>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p>No recoverable historical points.</p>
        ) : (
          <>
            <svg
              className="history-sparkline"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label={`${series.label} history from ${first?.timestamp ?? 'unknown'} to ${latest?.timestamp ?? 'unknown'}; ${first?.value ?? 0} to ${latest?.value ?? 0} ${series.unit}.`}
            >
              <polyline points={coordinates} vectorEffect="non-scaling-stroke" />
            </svg>
            <dl className="history-series-summary">
              <div>
                <dt>First recoverable</dt>
                <dd>{first?.value ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Latest</dt>
                <dd>{latest?.value ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt>Points</dt>
                <dd>{points.length}</dd>
              </div>
            </dl>
          </>
        )}
        {series.limitation ? <p className="history-limitation">{series.limitation}</p> : null}
        {series.evidenceUrl ? (
          <EvidenceLink href={series.evidenceUrl}>Inspect source</EvidenceLink>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ReachAcquisitionSurface({
  overview,
  history = null,
}: {
  overview: OverviewReadModelV1;
  history?: HistoricalContextReadModelV1 | null;
}) {
  const reach = selectReachAcquisition(overview);
  const view = overview.view ?? 'completed';
  const metrics = [reach.views, reach.clones, reach.stars].filter(
    (metric): metric is MetricChangeSelection => metric !== null,
  );

  return (
    <div className="data-surface data-surface--reach-acquisition">
      <DataSurfaceHeader
        eyebrow="Reach and acquisition"
        title={`${overview.project.name} repository signals`}
        description="Views, Clones, and Stars are presented as independent aggregate repository signals. Read each observation on its own terms."
        window={reach.window}
        availability={reach.availability}
        provenance={overview.provenance}
        view={view}
        projectKey={overview.project.key}
      />
      <SurfaceAvailabilityNotice availability={reach.availability} />

      <SurfaceSection
        id="reach-signals-title"
        title="Independent aggregate repository signals"
        description="Exact current, prior, and delta observations for the same bounded windows."
      >
        <div className="data-surface-metric-grid data-surface-metric-grid--three">
          <BlurFade delay={0.02} inView>
            <MetricComparisonCard metric={reach.views} />
          </BlurFade>
          <BlurFade delay={0.07} inView>
            <MetricComparisonCard metric={reach.clones} />
          </BlurFade>
          <BlurFade delay={0.12} inView>
            <MetricComparisonCard metric={reach.stars} />
          </BlurFade>
        </div>
      </SurfaceSection>

      {metrics.length === 0 ? (
        <Card className="data-surface-empty-comparison">
          <CardHeader>
            <h2>Current and prior observations</h2>
          </CardHeader>
          <CardContent>
            <p>No matching repository signal records were provided.</p>
          </CardContent>
        </Card>
      ) : (
        <BlurFade inView>
          <ComparisonVisual metrics={metrics} />
        </BlurFade>
      )}

      {history === null ? (
        <SurfaceSection
          id="reach-history-title"
          title="Best-effort historical signals"
          description="Historical context is unavailable. Current and completed seven-day signals remain valid."
        >
          <p className="data-surface-empty">No historical series are available right now.</p>
        </SurfaceSection>
      ) : history ? (
        <SurfaceSection
          id="reach-history-title"
          title="Best-effort historical signals"
          description="Primary-source history where recoverable. Reconstruction methods and unavailable source windows stay explicit."
        >
          <div className="history-series-grid">
            {history.series.map((series) => (
              <HistoricalSeriesCard key={series.metricKey} series={series} />
            ))}
          </div>
        </SurfaceSection>
      ) : null}
    </div>
  );
}
