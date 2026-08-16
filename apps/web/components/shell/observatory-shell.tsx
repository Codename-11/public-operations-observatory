'use client';

import { MobileMenuButton, Sheet, TooltipProvider } from '@public-operations-observatory/ui';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Suspense, useState } from 'react';
import { PrimaryNavigation } from './navigation';
import { timezoneLabel } from '../../lib/timezone';
import { useTimezone } from '../timezone/timezone-provider';

export function ObservatoryShell({
  projectKey,
  children,
}: {
  projectKey: string;
  children: ReactNode;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const projectRoot = `/projects/${projectKey}`;
  const pathname = usePathname() ?? projectRoot;
  const currentPath = pathname === `${projectRoot}/` ? projectRoot : pathname;
  const reachSurface = currentPath === `${projectRoot}/reach-acquisition`;
  const commandWorkspace = currentPath === projectRoot || reachSurface;
  const surfaceLabel =
    currentPath === `${projectRoot}/delivery-sources`
      ? 'Delivery & Sources'
      : reachSurface
        ? 'Reach & Acquisition'
        : currentPath === `${projectRoot}/settings`
          ? 'Settings'
          : 'Executive Pulse';
  return (
    <TooltipProvider delayDuration={250}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="observatory-shell">
        <aside className="desktop-sidebar" aria-label="Observatory">
          <ProductName />
          <ProjectSelector projectKey={projectKey} />
          <PrimaryNavigation projectKey={projectKey} currentPath={currentPath} />
          <SidebarFooter />
        </aside>
        <div
          className={`shell-body ${commandWorkspace ? 'shell-body--command-workspace' : ''}`.trim()}
        >
          <header className="topbar">
            <div className="mobile-menu">
              <Sheet
                open={navigationOpen}
                onOpenChange={setNavigationOpen}
                title="Observatory navigation"
                description="Available and planned work areas"
                trigger={<MobileMenuButton aria-label="Open navigation" />}
              >
                <PrimaryNavigation
                  projectKey={projectKey}
                  currentPath={currentPath}
                  onNavigate={() => setNavigationOpen(false)}
                />
              </Sheet>
            </div>
            <div className="project-context">
              <strong>Hermes-Relay</strong>
              <span aria-hidden="true">/</span>
              <span>{surfaceLabel}</span>
            </div>
            <div className="review-context">
              <span className="context-label">Observation view</span>
              <Suspense fallback={<span>Current UTC observation window</span>}>
                <ObservationViewLabel />
              </Suspense>
            </div>
          </header>
          <div className="tablet-navigation">
            <div className="tablet-project-switcher" aria-label="Current project">
              <span className="project-monogram" aria-hidden="true">
                HR
              </span>
              <span>
                <span className="context-label">Project</span>
                <strong>Hermes-Relay</strong>
              </span>
            </div>
            <PrimaryNavigation
              projectKey={projectKey}
              currentPath={currentPath}
              ariaLabel="Tablet primary"
            />
          </div>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SidebarFooter() {
  const { timezone } = useTimezone();
  return (
    <footer className="sidebar-footer">
      <p>ⓘ &nbsp;Help &amp; Documentation ↗</p>
      <div>
        <span>© 2026 Public Operations Observatory</span>
        <span>All times {timezoneLabel(timezone)}</span>
      </div>
    </footer>
  );
}

function ProjectSelector({ projectKey }: { projectKey: string }) {
  return (
    <div className="sidebar-project" aria-label="Selected project">
      <span className="context-label">Project</span>
      <div>
        <strong>{projectKey === 'hermes-relay' ? 'Hermes-Relay' : projectKey}</strong>
        <span aria-hidden="true">⌄</span>
      </div>
    </div>
  );
}

function ObservationViewLabel() {
  const completedView = useSearchParams()?.get('view') === 'completed';
  const { timezone } = useTimezone();
  const label = timezoneLabel(timezone);
  return (
    <span>
      {completedView ? `Latest completed week · ${label}` : `Current observation window · ${label}`}
    </span>
  );
}

function ProductName() {
  return (
    <div className="product-name">
      <span className="instrument-mark" aria-hidden="true" />
      <div>
        <strong>Public Operations Observatory</strong>
        <span>Evidence-led review</span>
      </div>
    </div>
  );
}
