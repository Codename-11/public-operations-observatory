import type { Metadata } from 'next';

import { DataSurfaceResult } from '../../../components/data-surfaces/data-surface-result';
import { ExecutiveOpsDashboard } from '../../../components/data-surfaces/executive-ops-dashboard';
import { ExecutivePulseSurface } from '../../../components/data-surfaces/executive-pulse-surface';
import { fetchHistoricalContext, fetchOverview } from '../../../lib/api';

export const metadata: Metadata = { title: 'Hermes-Relay executive pulse' };
export const dynamic = 'force-dynamic';

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { projectKey } = await params;
  const view = (await searchParams).view === 'completed' ? 'completed' : 'current';
  const [overview, history] = await Promise.all([
    fetchOverview(projectKey, { view }),
    fetchHistoricalContext(projectKey),
  ]);
  if (overview.ok) {
    return (
      <ExecutiveOpsDashboard overview={overview.data} history={history.ok ? history.data : null} />
    );
  }
  return (
    <DataSurfaceResult
      result={overview}
      surface={ExecutivePulseSurface}
      eyebrow="Executive pulse"
      heading="Hermes-Relay decision layer"
    />
  );
}
