'use client';

import type { OverviewReadModelV1 } from '@public-operations-observatory/contracts';

import { EvidenceSheet } from '../overview/evidence-sheet';
import { useTimezone } from '../timezone/timezone-provider';
import { timezoneAbbreviation } from '../../lib/timezone';
import { formatDate } from './data-surface-shared';
import { OverviewControls } from './overview-controls';

const collectionFreshness = (
  overview: OverviewReadModelV1,
): { healthy: boolean; label: string } => {
  const { availability, checkedAt, lastSuccessfulAt, staleAfter } = overview.freshness;
  if (lastSuccessfulAt === null) return { healthy: false, label: 'No successful collection' };

  const minutes = Math.max(
    0,
    Math.round((Date.parse(checkedAt) - Date.parse(lastSuccessfulAt)) / 60_000),
  );
  const lagLabel = minutes < 1 ? 'collected just now' : `last collected ${minutes} min ago`;
  const isPastStaleAfter = staleAfter !== null && Date.parse(checkedAt) >= Date.parse(staleAfter);

  if (availability === 'failed')
    return { healthy: false, label: `Collection failed · ${lagLabel}` };
  if (availability === 'empty')
    return { healthy: false, label: `Collection unavailable · ${lagLabel}` };
  if (availability === 'stale' || isPastStaleAfter) {
    return { healthy: false, label: `Collection stale · ${lagLabel}` };
  }
  if (availability === 'partial')
    return { healthy: false, label: `Collection partial · ${lagLabel}` };
  return {
    healthy: true,
    label: minutes < 1 ? 'Collected just now' : `Last collected ${minutes} min ago`,
  };
};

export interface WorkspaceCommandHeaderProps {
  overview: OverviewReadModelV1;
  surfaceLabel: string;
  heading: string;
  description: string;
  refreshLabel: string;
  showWindow?: boolean;
}

export function WorkspaceCommandHeader({
  overview,
  surfaceLabel,
  heading,
  description,
  refreshLabel,
  showWindow = false,
}: WorkspaceCommandHeaderProps) {
  const view = overview.view ?? 'completed';
  const { timezone } = useTimezone();
  const freshness = collectionFreshness(overview);
  return (
    <header className={`reach-command${showWindow ? ' reach-command--window-visible' : ''}`}>
      <div className="reach-command__bar">
        <p className="reach-command__breadcrumb">
          <strong>{overview.project.name}</strong>
          <span aria-hidden="true">/</span>
          <span>{surfaceLabel}</span>
        </p>
        <p
          className={`reach-command__freshness reach-command__freshness--${freshness.healthy ? 'healthy' : 'attention'}`}
        >
          {freshness.healthy ? <span aria-hidden="true" /> : null}
          {freshness.label}
        </p>
        <div className="reach-command__actions">
          <OverviewControls
            projectKey={overview.project.key}
            view={view}
            refreshLabel={refreshLabel}
            middleAction={<EvidenceSheet provenance={overview.provenance} />}
          />
        </div>
      </div>
      <div className="reach-command__heading">
        <h1>{heading}</h1>
        <p>{description}</p>
        <p className="reach-command__window">
          {view === 'current' ? 'Current observation window' : 'Completed reporting window'} ·{' '}
          {formatDate(overview.window.start, timezone)}–{formatDate(overview.window.end, timezone)}{' '}
          {timezoneAbbreviation(timezone, overview.window.start)}, end exclusive
        </p>
      </div>
    </header>
  );
}

export function ReachCommandHeader({ overview }: { overview: OverviewReadModelV1 }) {
  return (
    <WorkspaceCommandHeader
      overview={overview}
      surfaceLabel="Reach & Acquisition"
      heading="Reach & acquisition"
      description="Repository attention, acquisition, and retained historical evidence."
      refreshLabel="Refresh data"
    />
  );
}
