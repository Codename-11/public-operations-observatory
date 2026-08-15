import type { Metadata } from 'next';

import { DataSurfaceResult } from '../../../../components/data-surfaces/data-surface-result';
import { ReachAcquisitionSurface } from '../../../../components/data-surfaces/reach-acquisition-surface';
import { fetchOverview } from '../../../../lib/api';

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
  return (
    <DataSurfaceResult
      result={await fetchOverview(projectKey, { view })}
      surface={ReachAcquisitionSurface}
      eyebrow="Reach and acquisition"
      heading="Hermes-Relay repository signals"
    />
  );
}
