'use client';

import { MobileMenuButton, Sheet, TooltipProvider } from '@public-operations-observatory/ui';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { PrimaryNavigation } from './navigation';

export function ObservatoryShell({
  projectKey,
  children,
}: {
  projectKey: string;
  children: ReactNode;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const currentPath = usePathname();
  const completedView = useSearchParams()?.get('view') === 'completed';
  return (
    <TooltipProvider delayDuration={250}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="observatory-shell">
        <aside className="desktop-sidebar" aria-label="Observatory">
          <ProductName />
          <PrimaryNavigation projectKey={projectKey} currentPath={currentPath} />
        </aside>
        <div className="shell-body">
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
              <span className="project-monogram" aria-hidden="true">
                HR
              </span>
              <div>
                <span className="context-label">Project</span>
                <strong>Hermes-Relay</strong>
              </div>
            </div>
            <div className="review-context">
              <span className="context-label">Observation view</span>
              <span>
                {completedView ? 'Latest completed UTC week' : 'Current UTC observation window'}
              </span>
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
