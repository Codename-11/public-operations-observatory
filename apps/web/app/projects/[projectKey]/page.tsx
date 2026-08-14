import type { Metadata } from 'next';

import { DataSurfaceResult } from '../../../components/data-surfaces/data-surface-result';
import { ExecutivePulseSurface } from '../../../components/data-surfaces/executive-pulse-surface';
import { fetchOverview } from '../../../lib/api';

export const metadata: Metadata = { title: 'Hermes-Relay executive pulse' };
export const dynamic = 'force-dynamic';

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  return (
    <DataSurfaceResult
      result={await fetchOverview(projectKey)}
      surface={ExecutivePulseSurface}
      eyebrow="Executive pulse"
      heading="Hermes-Relay decision layer"
    />
  );
}
