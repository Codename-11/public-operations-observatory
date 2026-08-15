'use client';

import type { OverviewReadModelV1 } from '@public-operations-observatory/contracts';

import { EvidenceSheet } from '../overview/evidence-sheet';
import { formatDate } from './data-surface-shared';
import { OverviewControls } from './overview-controls';

const collectionLagLabel = (overview: OverviewReadModelV1): string => {
  const { checkedAt, lastSuccessfulAt } = overview.freshness;
  if (lastSuccessfulAt === null) return 'No successful collection';
  const minutes = Math.max(
    0,
    Math.round((Date.parse(checkedAt) - Date.parse(lastSuccessfulAt)) / 60_000),
  );
  return minutes < 1 ? 'Collected just now' : `Last collected ${minutes} min ago`;
};

export function ReachCommandHeader({ overview }: { overview: OverviewReadModelV1 }) {
  const view = overview.view ?? 'completed';
  return (
    <header className="reach-command">
      <div className="reach-command__bar">
        <p className="reach-command__breadcrumb">
          <strong>{overview.project.name}</strong>
          <span aria-hidden="true">/</span>
          <span>Reach &amp; Acquisition</span>
        </p>
        <p className="reach-command__freshness">
          <span aria-hidden="true" />
          {collectionLagLabel(overview)}
        </p>
        <div className="reach-command__actions">
          <OverviewControls
            projectKey={overview.project.key}
            view={view}
            refreshLabel="Refresh data"
            middleAction={<EvidenceSheet provenance={overview.provenance} />}
          />
        </div>
      </div>
      <div className="reach-command__heading">
        <h1>Reach &amp; acquisition</h1>
        <p>Repository attention, acquisition, and retained historical evidence.</p>
        <p className="reach-command__window">
          {view === 'current' ? 'Current observation window' : 'Completed reporting window'} ·{' '}
          {formatDate(overview.window.start)}–{formatDate(overview.window.end)} UTC, end exclusive
        </p>
      </div>
    </header>
  );
}
