import type { Metadata } from 'next';

import { DataSurfaceResult } from '../../../../components/data-surfaces/data-surface-result';
import { ReachAcquisitionSurface } from '../../../../components/data-surfaces/reach-acquisition-surface';
import { fetchOverview } from '../../../../lib/api';

export const metadata: Metadata = { title: 'Hermes-Relay reach and acquisition' };
export const dynamic = 'force-dynamic';

export default async function ReachAcquisitionPage({
  params,
}: {
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  return (
    <DataSurfaceResult
      result={await fetchOverview(projectKey)}
      surface={ReachAcquisitionSurface}
      eyebrow="Reach and acquisition"
      heading="Hermes-Relay repository signals"
    />
  );
}
