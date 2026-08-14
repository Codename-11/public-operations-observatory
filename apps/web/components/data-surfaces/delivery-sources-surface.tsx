'use client';

import type {
  OverviewReadModelV1,
  OverviewTrendV1,
} from '@public-operations-observatory/contracts';
import {
  AnimatedGridPattern,
  BlurFade,
  BorderBeam,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  EvidenceLink,
  PanelState,
  StatusBadge,
} from '@public-operations-observatory/ui';

import { selectDeliverySources } from '../../lib/data-surfaces';
import { TrendDataTable } from '../overview/trend-data-table';
import {
  AttentionList,
  availabilityStatus,
  comparisonBarWidth,
  DataSurfaceHeader,
  formatTimestamp,
  MetricNumber,
  SurfaceAvailabilityNotice,
} from './data-surface-shared';

function TrendVisual({ trend }: { trend: OverviewTrendV1 }) {
  const values = trend.points.flatMap((point) => (point.value === null ? [] : [point.value]));
  const maximum = Math.max(...values, 1);
  return (
    <div
      className="data-surface-trend-bars"
      role="img"
      aria-label={`${trend.label} observed interval trend, measured in ${trend.unit}. Exact values follow in the data table.`}
    >
      {trend.points.map((point) => (
        <div className="signal-trend-column" key={point.timestamp}>
          <span
            className={`signal-trend-bar signal-trend-bar--${point.availability}`}
            style={{ height: comparisonBarWidth(point.value, maximum) }}
          />
          <span className="sr-only">
            {point.timestamp}: {point.value ?? 'unavailable'} {trend.unit}; {point.availability}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DeliverySourcesSurface({ overview }: { overview: OverviewReadModelV1 }) {
  const delivery = selectDeliverySources(overview);
  const downloads = delivery.releaseDownloads?.change ?? null;
  const release = delivery.release;
  const trend = delivery.trend;

  return (
    <div className="data-surface data-surface--delivery-sources">
      <DataSurfaceHeader
        eyebrow="Delivery and sources"
        title={`${overview.project.name} release delivery`}
        description="Exact release asset download observations, the provided release record, interval trend points, and source collection state."
        window={delivery.window}
        availability={delivery.availability}
        provenance={overview.provenance}
      />
      <SurfaceAvailabilityNotice availability={delivery.availability} />

      <BlurFade className="data-surface-hero-wrap">
        <section
          className="data-surface-hero signal-hero"
          aria-labelledby="delivery-downloads-title"
        >
          <AnimatedGridPattern numSquares={24} className="data-surface-hero__grid" />
          <BorderBeam duration={12} reverse />
          <div className="data-surface-hero__content">
            <p className="data-surface-eyebrow">Observed release delivery signal</p>
            <h2 id="delivery-downloads-title">Release asset downloads</h2>
            {downloads?.current === null || downloads === null ? (
              <div className="signal-unavailable">
                <strong>Release asset downloads unavailable</strong>
                <p>No current value was provided for this window.</p>
              </div>
            ) : (
              <>
                <p className="data-surface-hero__value">
                  <MetricNumber
                    value={downloads.current}
                    className="signal-value signal-value--hero"
                  />
                  <span>{downloads.unit}</span>
                </p>
                <dl className="data-surface-hero__comparison">
                  <div>
                    <dt>Prior 7-day window</dt>
                    <dd>{downloads.previous ?? 'Unavailable'}</dd>
                  </div>
                  <div>
                    <dt>Delta</dt>
                    <dd>
                      {downloads.delta === null
                        ? 'Unavailable'
                        : `${downloads.delta > 0 ? '+' : ''}${downloads.delta}`}
                    </dd>
                  </div>
                </dl>
              </>
            )}
            {downloads ? (
              <StatusBadge
                status={availabilityStatus(downloads.availability)}
                detail={downloads.availability}
              />
            ) : null}
            {downloads?.evidenceUrl ? (
              <EvidenceLink
                href={downloads.evidenceUrl}
                aria-label="Open Release asset downloads evidence (opens in a new tab)"
              >
                Inspect download evidence
              </EvidenceLink>
            ) : null}
          </div>
        </section>
      </BlurFade>

      <div className="data-surface-grid data-surface-grid--delivery-context">
        <Card aria-labelledby="release-context-title">
          <CardHeader>
            <div>
              <h2 id="release-context-title">Release context</h2>
              <p>The release record supplied with this Overview</p>
            </div>
            {release ? (
              <StatusBadge
                status={availabilityStatus(release.availability)}
                detail={release.availability}
              />
            ) : null}
          </CardHeader>
          <CardContent>
            {release === null ? (
              <PanelState state="partial" title="Release record unavailable">
                No release record was provided.
              </PanelState>
            ) : release.availability === 'failed' ? (
              <PanelState state="error" title="Release record failed">
                No release fields are available.
              </PanelState>
            ) : release.availability === 'empty' ? (
              <EmptyState kind="no-records">No release record for this period.</EmptyState>
            ) : (
              <>
                {release.availability !== 'complete' ? (
                  <PanelState
                    state={release.availability}
                    title={`${release.availability === 'partial' ? 'Partial' : 'Stale'} release record`}
                  >
                    Retained release fields remain visible.
                  </PanelState>
                ) : null}
                <h3>{release.tagName ?? 'Release tag unavailable'}</h3>
                {release.name ? <p>{release.name}</p> : null}
                <dl className="data-surface-release-details">
                  <div>
                    <dt>Published</dt>
                    <dd>{formatTimestamp(release.publishedAt)}</dd>
                  </div>
                  <div>
                    <dt>Asset downloads in release record</dt>
                    <dd>{release.assetDownloads ?? 'Unavailable'}</dd>
                  </div>
                </dl>
                {release.evidenceUrl ? (
                  <EvidenceLink
                    href={release.evidenceUrl}
                    aria-label={`Open ${release.tagName ?? 'release'} evidence on GitHub (opens in a new tab)`}
                  >
                    Inspect release evidence
                  </EvidenceLink>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card aria-labelledby="observed-total-title">
          <CardHeader>
            <div>
              <h2 id="observed-total-title">Observed interval total</h2>
              <p>{delivery.observedTrendTotal.label}</p>
            </div>
            <StatusBadge
              status={availabilityStatus(delivery.observedTrendTotal.availability)}
              detail={delivery.observedTrendTotal.availability}
            />
          </CardHeader>
          <CardContent>
            {delivery.observedTrendTotal.value === null ? (
              <p className="signal-unavailable">Observed total unavailable.</p>
            ) : (
              <p className="signal-value">
                <MetricNumber value={delivery.observedTrendTotal.value} /> {trend.unit}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card aria-labelledby="delivery-trend-title">
        <CardHeader>
          <div>
            <h2 id="delivery-trend-title">{trend.label} intervals</h2>
            <p>Observed points inside this Overview window.</p>
          </div>
          <StatusBadge
            status={availabilityStatus(trend.availability)}
            detail={trend.availability}
          />
        </CardHeader>
        <CardContent>
          {trend.availability === 'failed' ? (
            <PanelState state="error" title="Trend response failed">
              Any interval points still carried by the contract remain visible with their individual
              state.
            </PanelState>
          ) : trend.availability === 'empty' ? (
            <EmptyState kind="no-records">No complete interval set is available.</EmptyState>
          ) : trend.availability !== 'complete' ? (
            <PanelState
              state={trend.availability}
              title={`${trend.availability === 'partial' ? 'Partial' : 'Stale'} interval trend`}
            >
              Available interval points remain visible with their individual state.
            </PanelState>
          ) : null}
          {trend.points.length === 0 ? (
            trend.availability === 'complete' ? (
              <EmptyState kind="no-records">
                No observed download intervals are available.
              </EmptyState>
            ) : null
          ) : (
            <BlurFade inView className="data-surface-trend-visual">
              <TrendVisual trend={trend} />
              <TrendDataTable points={trend.points} label={trend.label} unit={trend.unit} />
            </BlurFade>
          )}
        </CardContent>
      </Card>

      <div className="data-surface-grid data-surface-grid--sources">
        <Card aria-labelledby="delivery-sources-title">
          <CardHeader>
            <div>
              <h2 id="delivery-sources-title">Source freshness and status</h2>
              <p>Collection checkpoints supplied for each source</p>
            </div>
          </CardHeader>
          <CardContent>
            {delivery.sources.length === 0 ? (
              <EmptyState kind="no-records">No source records were provided.</EmptyState>
            ) : (
              <ul className="data-surface-source-list">
                {delivery.sources.map(({ source }) => (
                  <li
                    className={`signal-source signal-source--${source.availability}`}
                    key={source.key}
                  >
                    <div>
                      <strong>{source.label}</strong>
                      <span>Last attempt {formatTimestamp(source.lastAttemptAt)}</span>
                      <span>Last successful {formatTimestamp(source.lastSuccessfulAt)}</span>
                    </div>
                    <StatusBadge
                      status={availabilityStatus(source.availability)}
                      detail={source.availability}
                    />
                    {source.warnings.length > 0 ? (
                      <ul>
                        {source.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ) : null}
                    {source.evidenceUrl ? (
                      <EvidenceLink
                        href={source.evidenceUrl}
                        aria-label={`Open ${source.label} source evidence (opens in a new tab)`}
                      >
                        Inspect source evidence
                      </EvidenceLink>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card aria-labelledby="delivery-attention-title">
          <CardHeader>
            <div>
              <h2 id="delivery-attention-title">Source attention</h2>
              <p>Collection and metric-window exceptions only</p>
            </div>
          </CardHeader>
          <CardContent>
            <AttentionList attention={delivery.attention} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
