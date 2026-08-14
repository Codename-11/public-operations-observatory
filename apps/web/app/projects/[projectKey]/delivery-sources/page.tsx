import type { Metadata } from 'next';

import { DataSurfaceResult } from '../../../../components/data-surfaces/data-surface-result';
import { DeliverySourcesSurface } from '../../../../components/data-surfaces/delivery-sources-surface';
import { fetchOverview } from '../../../../lib/api';

export const metadata: Metadata = { title: 'Hermes-Relay delivery and sources' };
export const dynamic = 'force-dynamic';

export default async function DeliverySourcesPage({
  params,
}: {
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  return (
    <DataSurfaceResult
      result={await fetchOverview(projectKey)}
      surface={DeliverySourcesSurface}
      eyebrow="Delivery and sources"
      heading="Hermes-Relay release delivery"
    />
  );
}
