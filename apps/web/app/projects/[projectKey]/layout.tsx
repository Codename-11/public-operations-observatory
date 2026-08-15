import type { ReactNode } from 'react';

import { ObservatoryShell } from '../../../components/shell/observatory-shell';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  return <ObservatoryShell projectKey={projectKey}>{children}</ObservatoryShell>;
}
