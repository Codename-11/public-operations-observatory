import type { OverviewReadModelV1 } from '@public-operations-observatory/contracts';
import { ErrorState, PanelState, StatusBadge } from '@public-operations-observatory/ui';

import { ChangedStrip } from './changed-strip';
import { EvidenceSheet } from './evidence-sheet';
import { LatestReleaseContext } from './latest-release-context';
import { SourceAttentionRail } from './source-attention-rail';
import { SourceFreshness } from './source-freshness';
import { TrendPanel } from './trend-panel';
import type { OverviewApiResult } from '../../lib/api';

const date = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value),
  );
const badge = (value: OverviewReadModelV1['availability']) =>
  value === 'complete'
    ? 'available'
    : value === 'failed'
      ? 'error'
      : value === 'empty'
        ? 'unavailable'
        : value;

export function OverviewPanels({ result }: { result: OverviewApiResult }) {
  if (!result.ok) {
    return (
      <div className="page-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Weekly operating view</p>
            <h1>Hermes-Relay public operations</h1>
            <p>What changed, what needs source attention, and the evidence behind it.</p>
          </div>
          <StatusBadge status="error" detail="Overview unavailable" />
        </header>
        <ErrorState
          title="Overview unavailable"
          available="Application navigation and project context"
          retry="Retry after API connectivity and authentication are restored."
        >
          {result.message}
        </ErrorState>
      </div>
    );
  }
  const overview = result.data;
  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <p className="eyebrow">Weekly operating view</p>
          <h1>{overview.project.name} public operations</h1>
          <p>
            {date(overview.window.start)}–{date(overview.window.end)} UTC, end exclusive · compared
            with the prior seven-day window.
          </p>
        </div>
        <div className="overview-header-actions">
          <StatusBadge status={badge(overview.availability)} detail={overview.availability} />
          <EvidenceSheet provenance={overview.provenance} />
        </div>
      </header>
      {overview.availability === 'partial' || overview.availability === 'stale' ? (
        <PanelState
          state={overview.availability}
          title={`${overview.availability === 'partial' ? 'Partial' : 'Stale'} Overview`}
        >
          Available evidence remains visible. Treat affected values according to their displayed
          availability.
        </PanelState>
      ) : overview.availability === 'failed' ? (
        <PanelState state="error" title="Failed Overview state">
          Only contract fields carrying usable values remain visible.
        </PanelState>
      ) : overview.availability === 'empty' ? (
        <div className="overview-empty-banner">
          Empty Overview: no collected records are available for parts of this period.
        </div>
      ) : null}
      <ChangedStrip changes={overview.changes} />
      <div className="overview-grid overview-grid--primary">
        <TrendPanel trend={overview.trend} />
        <SourceAttentionRail exceptions={overview.attention} />
      </div>
      <div className="overview-grid">
        <LatestReleaseContext release={overview.release} briefing={overview.briefing} />
        <SourceFreshness freshness={overview.freshness} sources={overview.sources} />
      </div>
    </div>
  );
}
