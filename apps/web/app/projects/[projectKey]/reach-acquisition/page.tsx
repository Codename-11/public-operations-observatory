import type { Metadata } from 'next';

import { DataSurfaceResult } from '../../../../components/data-surfaces/data-surface-result';
import { ReachAcquisitionSurface } from '../../../../components/data-surfaces/reach-acquisition-surface';
import { fetchHistoricalContext, fetchOverview } from '../../../../lib/api';

export const metadata: Metadata = { title: 'Hermes-Relay reach and acquisition' };
export const dynamic = 'force-dynamic';

export default async function ReachAcquisitionPage({
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
      <ReachAcquisitionSurface
        overview={overview.data}
        history={history.ok ? history.data : null}
      />
    );
  }
  return (
    <DataSurfaceResult
      result={overview}
      surface={ReachAcquisitionSurface}
      eyebrow="Reach and acquisition"
      heading="Hermes-Relay repository signals"
    />
  );
}
