'use client';

import type {
  HistoricalContextReadModelV1,
  OverviewReadModelV1,
} from '@public-operations-observatory/contracts';
import { buildReachMetricModels } from '../../lib/reach-metric-registry';
import { ReachCommandHeader } from './reach-command-header';
import {
  CollectionActivityPanel,
  CurrentWindowTable,
  EvidenceHealthPanel,
  ProvenanceLimitationsPanel,
  ReachMetricCards,
  SignalHistoryPanel,
} from './reach-dashboard-panels';

export function ReachAcquisitionSurface({
  overview,
  history = null,
}: {
  overview: OverviewReadModelV1;
  history?: HistoricalContextReadModelV1 | null;
}) {
  const metrics = buildReachMetricModels(overview, history);

  return (
    <div className="data-surface data-surface--reach-acquisition reach-dashboard">
      <ReachCommandHeader overview={overview} />
      <div className="reach-dashboard__layout">
        <section className="reach-dashboard__primary" aria-label="Repository signal dashboard">
          <ReachMetricCards metrics={metrics} />
          <SignalHistoryPanel metrics={metrics} />
          <div className="reach-dashboard__detail-grid">
            <CurrentWindowTable metrics={metrics} />
            <ProvenanceLimitationsPanel metrics={metrics} />
          </div>
        </section>
        <aside className="reach-dashboard__rail" aria-label="Evidence operations">
          <EvidenceHealthPanel overview={overview} metrics={metrics} />
          <CollectionActivityPanel
            overview={overview}
            historyGeneratedAt={history?.provenance.generatedAt ?? null}
          />
        </aside>
      </div>
    </div>
  );
}
