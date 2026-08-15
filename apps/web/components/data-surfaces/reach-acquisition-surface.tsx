'use client';

import type { OverviewReadModelV1 } from '@public-operations-observatory/contracts';
import { BlurFade, Card, CardContent, CardHeader } from '@public-operations-observatory/ui';

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

export function ReachAcquisitionSurface({ overview }: { overview: OverviewReadModelV1 }) {
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
    </div>
  );
}
