import type { OverviewTrendV1 } from '@public-operations-observatory/contracts';
import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  EvidenceLink,
  PanelState,
} from '@public-operations-observatory/ui';
import { TrendDataTable } from './trend-data-table';

const annotationDate = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));

function TrendAnnotations({ annotations }: { annotations: OverviewTrendV1['annotations'] }) {
  if (annotations.length === 0) return null;
  return (
    <section className="trend-annotations" aria-labelledby="trend-annotations-title">
      <h3 id="trend-annotations-title">Timeline annotations</h3>
      <ol>
        {annotations.map((annotation) => (
          <li key={annotation.id}>
            <div>
              <strong>{annotation.label}</strong>
              <span>
                {annotation.kind} · {annotationDate(annotation.occurredAt)} UTC
              </span>
            </div>
            {annotation.evidenceUrl ? (
              <EvidenceLink
                href={annotation.evidenceUrl}
                aria-label={`Open evidence for ${annotation.label} (opens in a new tab)`}
              >
                Inspect evidence
              </EvidenceLink>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TrendPanel({ trend }: { trend: OverviewTrendV1 }) {
  const isReleaseDownloadTrend = trend.metricKey === 'github.release_asset_downloads';
  const values = trend.points.flatMap((point) => (point.value === null ? [] : [point.value]));
  const maximum = Math.max(...values, 1);
  return (
    <Card aria-labelledby="trend-title">
      <CardHeader>
        <div>
          <h2 id="trend-title">{trend.label}</h2>
          <p>
            Observed download intervals in the completed window. This does not establish causation.
          </p>
        </div>
        <span className="availability-label">{trend.availability}</span>
      </CardHeader>
      <CardContent>
        <>
          {!isReleaseDownloadTrend ? (
            <PanelState state="error" title="Trend metric unavailable">
              The expected release asset download trend was not provided.
            </PanelState>
          ) : trend.availability === 'failed' ? (
            <PanelState state="error" title="Trend unavailable">
              The trend response could not be used. Other panels remain available.
            </PanelState>
          ) : trend.availability === 'empty' ? (
            <EmptyState kind="no-records">
              No release asset download intervals are available.
            </EmptyState>
          ) : (
            <>
              {trend.availability !== 'complete' ? (
                <PanelState
                  state={trend.availability === 'stale' ? 'stale' : 'partial'}
                  title={`${trend.availability === 'stale' ? 'Stale' : 'Partial'} trend`}
                >
                  Available intervals are shown with their individual state.
                </PanelState>
              ) : null}
              <div
                className="trend-bars"
                role="img"
                aria-label={`${trend.label} trend, measured in ${trend.unit}. Exact values follow in the data table.`}
              >
                {trend.points.map((point) => (
                  <div className="trend-bar-column" key={point.timestamp}>
                    <span
                      className="trend-bar"
                      style={{
                        height:
                          point.value === null
                            ? '0'
                            : point.value === 0
                              ? '0'
                              : `${Math.max(6, (point.value / maximum) * 100)}%`,
                      }}
                    />
                    <span className="sr-only">
                      {point.timestamp}: {point.value ?? 'unavailable'}
                    </span>
                  </div>
                ))}
              </div>
              <TrendDataTable points={trend.points} label={trend.label} unit={trend.unit} />
            </>
          )}
          <TrendAnnotations annotations={trend.annotations} />
        </>
      </CardContent>
    </Card>
  );
}
