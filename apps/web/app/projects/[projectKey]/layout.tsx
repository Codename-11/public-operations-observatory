import { ObservatoryShell } from '../../../components/shell/observatory-shell';
import type { ReactNode } from 'react';
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
