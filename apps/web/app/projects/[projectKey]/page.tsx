import type { Metadata } from 'next';

import { OverviewPanels } from '../../../components/overview/overview-panels';
import { fetchOverview } from '../../../lib/api';

export const metadata: Metadata = { title: 'Hermes-Relay overview' };
export const dynamic = 'force-dynamic';

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  return <OverviewPanels result={await fetchOverview(projectKey)} />;
}
