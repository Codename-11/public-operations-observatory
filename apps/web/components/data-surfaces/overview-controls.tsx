'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActionState } from 'react';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { refreshOverview, type RefreshActionState } from '../../lib/refresh-action';

const initialState: RefreshActionState = { status: 'idle', message: '' };

function RefreshButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="ui-button ui-button--primary ui-button--compact"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Refreshing…' : label}
    </button>
  );
}

export function OverviewControls({
  projectKey,
  view,
  refreshLabel = 'Refresh now',
  middleAction,
}: {
  projectKey: string;
  view: 'current' | 'completed';
  refreshLabel?: string;
  middleAction?: ReactNode;
}) {
  const pathname = usePathname() ?? `/projects/${projectKey}`;
  const [state, action] = useActionState(refreshOverview, initialState);

  return (
    <div className="overview-controls">
      <nav className="overview-view-switch" aria-label="Observation view">
        <Link
          className="overview-view-switch__option"
          href={pathname}
          aria-current={view === 'current' ? 'page' : undefined}
        >
          Current
        </Link>
        <Link
          className="overview-view-switch__option"
          href={`${pathname}?view=completed`}
          aria-current={view === 'completed' ? 'page' : undefined}
        >
          Completed week
        </Link>
      </nav>
      {middleAction}
      <form action={action}>
        <input name="projectKey" type="hidden" value={projectKey} />
        <RefreshButton label={refreshLabel} />
      </form>
      <p
        className={`overview-refresh-status overview-refresh-status--${state.status}`}
        aria-live="polite"
      >
        {state.message}
      </p>
    </div>
  );
}
