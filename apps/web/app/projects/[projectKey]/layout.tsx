import { ObservatoryShell } from '../../../components/shell/observatory-shell';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;
  return (
    <Suspense fallback={<ObservatoryShell projectKey={projectKey}>{children}</ObservatoryShell>}>
      <ObservatoryShell projectKey={projectKey}>{children}</ObservatoryShell>
    </Suspense>
  );
}
