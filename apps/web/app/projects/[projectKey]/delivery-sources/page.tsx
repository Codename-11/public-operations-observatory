import type { Metadata } from 'next';

import { DataSurfaceResult } from '../../../../components/data-surfaces/data-surface-result';
import { DeliverySourcesSurface } from '../../../../components/data-surfaces/delivery-sources-surface';
import { fetchOverview } from '../../../../lib/api';

export const metadata: Metadata = { title: 'Hermes-Relay delivery and sources' };
export const dynamic = 'force-dynamic';

export default async function DeliverySourcesPage({
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
      surface={DeliverySourcesSurface}
      eyebrow="Delivery and sources"
      heading="Hermes-Relay release delivery"
    />
  );
}
