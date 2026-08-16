import type { ReactNode } from 'react';
import { cookies } from 'next/headers';

import { ObservatoryShell } from '../../../components/shell/observatory-shell';
import { TimezoneProvider } from '../../../components/timezone/timezone-provider';
import { resolveTimezone, TIMEZONE_COOKIE_NAME } from '../../../lib/timezone';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectKey: string }>;
}) {
  const [{ projectKey }, cookieStore] = await Promise.all([params, cookies()]);
  const timezone = resolveTimezone(cookieStore.get(TIMEZONE_COOKIE_NAME)?.value);
  return (
    <TimezoneProvider initialTimezone={timezone}>
      <ObservatoryShell projectKey={projectKey}>{children}</ObservatoryShell>
    </TimezoneProvider>
  );
}
