'use client';

import type { OverviewReadModelV1 } from '@public-operations-observatory/contracts';
import {
  BlurFade,
  BorderBeam,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  EvidenceLink,
  Particles,
  PanelState,
  StatusBadge,
} from '@public-operations-observatory/ui';

import { selectExecutivePulse } from '../../lib/data-surfaces';
import {
  AttentionList,
  availabilityStatus,
  DataSurfaceHeader,
  formatTimestamp,
  MetricComparisonCard,
  MetricNumber,
  SurfaceAvailabilityNotice,
  SurfaceSection,
  WarningList,
} from './data-surface-shared';

export function ExecutivePulseSurface({ overview }: { overview: OverviewReadModelV1 }) {
  const pulse = selectExecutivePulse(overview);
  const view = overview.view ?? 'completed';
  const stars = pulse.stars?.change ?? null;
  const briefing = pulse.briefing.briefing;
  const lag = pulse.freshness.lag.milliseconds;

  return (
    <div className="data-surface data-surface--executive-pulse">
      <DataSurfaceHeader
        eyebrow="Executive pulse"
        title={`${overview.project.name} decision layer`}
        description={
          view === 'current'
            ? 'Latest persisted repository signals, freshness, and source exceptions for the current observation window.'
            : 'Exact repository signals, briefing context, freshness, and source exceptions for the completed operating window.'
        }
        window={pulse.window}
        availability={pulse.availability}
        provenance={overview.provenance}
        view={view}
        projectKey={overview.project.key}
      />
      <SurfaceAvailabilityNotice availability={pulse.availability} />

      <BlurFade className="data-surface-hero-wrap">
        <section className="data-surface-hero signal-hero" aria-labelledby="executive-stars-title">
          <Particles quantity={32} className="data-surface-hero__particles" />
          <BorderBeam duration={10} />
          <div className="data-surface-hero__content">
            <p className="data-surface-eyebrow">Primary repository signal</p>
            <h2 id="executive-stars-title">Stars</h2>
            {stars?.current === null || stars === null ? (
              <div className="signal-unavailable">
                <strong>Stars unavailable</strong>
                <p>No current Stars value was provided for this window.</p>
              </div>
            ) : (
              <>
                <p className="data-surface-hero__value">
                  <MetricNumber value={stars.current} className="signal-value signal-value--hero" />
                  <span>{stars.unit}</span>
                </p>
                <dl className="data-surface-hero__comparison">
                  <div>
                    <dt>Prior 7-day window</dt>
                    <dd>{stars.previous ?? 'Unavailable'}</dd>
                  </div>
                  <div>
                    <dt>Delta</dt>
                    <dd>
                      {stars.delta === null
                        ? 'Unavailable'
                        : `${stars.delta > 0 ? '+' : ''}${stars.delta}`}
                    </dd>
                  </div>
                </dl>
              </>
            )}
            {stars ? (
              <StatusBadge
                status={availabilityStatus(stars.availability)}
                detail={stars.availability}
              />
            ) : null}
            {stars?.evidenceUrl ? (
              <EvidenceLink
                href={stars.evidenceUrl}
                aria-label="Open Stars evidence (opens in a new tab)"
              >
                Inspect Stars evidence
              </EvidenceLink>
            ) : null}
          </div>
        </section>
      </BlurFade>

      <SurfaceSection
        id="executive-comparison-title"
        title="Operating comparison"
        description="Exact current, prior, and delta values from the Overview contract."
      >
        <div className="data-surface-metric-grid">
          <BlurFade delay={0.05} inView>
            <MetricComparisonCard metric={pulse.stars} />
          </BlurFade>
          <BlurFade delay={0.1} inView>
            <MetricComparisonCard metric={pulse.openIssues} />
          </BlurFade>
        </div>
      </SurfaceSection>

      <div className="data-surface-grid data-surface-grid--executive-context">
        <Card aria-labelledby="executive-briefing-title">
          <CardHeader>
            <div>
              <h2 id="executive-briefing-title">Briefing summary</h2>
              <p>Bounded summary supplied by the Overview response</p>
            </div>
            <StatusBadge
              status={availabilityStatus(briefing.availability)}
              detail={briefing.availability}
            />
          </CardHeader>
          <CardContent>
            {briefing.availability === 'failed' ? (
              <PanelState state="error" title="Briefing unavailable">
                No briefing summary value is shown.
              </PanelState>
            ) : briefing.availability === 'empty' ? (
              <EmptyState kind="no-records">No briefing summary for this period.</EmptyState>
            ) : (
              <>
                {briefing.availability !== 'complete' ? (
                  <PanelState
                    state={briefing.availability}
                    title={`${briefing.availability === 'partial' ? 'Partial' : 'Stale'} briefing`}
                  >
                    Retained briefing fields remain visible.
                  </PanelState>
                ) : null}
                <p>{briefing.summary ?? 'Briefing summary unavailable'}</p>
                <p>Generated {formatTimestamp(briefing.generatedAt)}</p>
                {briefing.evidenceUrl ? (
                  <EvidenceLink
                    href={briefing.evidenceUrl}
                    aria-label="Open briefing evidence (opens in a new tab)"
                  >
                    Inspect briefing evidence
                  </EvidenceLink>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card aria-labelledby="executive-freshness-title">
          <CardHeader>
            <div>
              <h2 id="executive-freshness-title">Freshness</h2>
              <p>UTC collection checkpoint state</p>
            </div>
            <StatusBadge
              status={availabilityStatus(pulse.freshness.availability)}
              detail={pulse.freshness.availability}
            />
          </CardHeader>
          <CardContent>
            <dl className="data-surface-freshness">
              <div>
                <dt>Checked</dt>
                <dd>{formatTimestamp(pulse.freshness.freshness.checkedAt)}</dd>
              </div>
              <div>
                <dt>Last successful</dt>
                <dd>{formatTimestamp(pulse.freshness.freshness.lastSuccessfulAt)}</dd>
              </div>
              <div>
                <dt>Stale after</dt>
                <dd>{formatTimestamp(pulse.freshness.freshness.staleAfter)}</dd>
              </div>
              <div>
                <dt>{pulse.freshness.lag.label}</dt>
                <dd>{lag === null ? 'Unavailable' : `${Math.round(lag / 60_000)} minutes`}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="data-surface-grid data-surface-grid--attention">
        <Card aria-labelledby="executive-attention-title">
          <CardHeader>
            <div>
              <h2 id="executive-attention-title">Source attention</h2>
              <p>Collection and metric-window exceptions only</p>
            </div>
          </CardHeader>
          <CardContent>
            <AttentionList attention={pulse.attention} />
          </CardContent>
        </Card>
        <Card aria-labelledby="executive-warnings-title">
          <CardHeader>
            <div>
              <h2 id="executive-warnings-title">Overview warnings</h2>
              <p>Warnings supplied with this response</p>
            </div>
          </CardHeader>
          <CardContent>
            <WarningList warnings={pulse.warnings} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
