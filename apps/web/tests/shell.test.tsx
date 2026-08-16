import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ObservatoryShell } from '../components/shell/observatory-shell';
import {
  EmptyState,
  EvidenceLink,
  PanelState,
  StatusBadge,
} from '@public-operations-observatory/ui';

const navigationState = vi.hoisted<{ pathname: string | null; view: string | null }>(() => ({
  pathname: '/projects/hermes-relay',
  view: null,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => ({ get: (key: string) => (key === 'view' ? navigationState.view : null) }),
}));

const shell = (children = <h1>Hermes-Relay public operations</h1>) =>
  render(<ObservatoryShell projectKey="hermes-relay">{children}</ObservatoryShell>);
const shellCss = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

describe('Observatory shell', () => {
  it('provides landmarks, project context, skip navigation, and one active route', () => {
    const { container } = shell();
    expect(container.querySelector('.shell-body')).toHaveClass('shell-body--command-workspace');
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getAllByText('Hermes-Relay')).not.toHaveLength(0);
    expect(screen.getByText('Current UTC observation window')).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
        name: 'Executive pulse',
      }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
        name: 'Reach & acquisition',
      }),
    ).not.toHaveAttribute('aria-current');
  });

  it('marks the trailing-slash project root as a command workspace', () => {
    navigationState.pathname = '/projects/hermes-relay/';
    try {
      const { container } = shell();
      expect(container.querySelector('.shell-body')).toHaveClass('shell-body--command-workspace');
      expect(container.querySelector('.shell-body')).not.toHaveClass('shell-body--reach');
    } finally {
      navigationState.pathname = '/projects/hermes-relay';
    }
  });

  it('marks Reach as a command workspace and keeps its navigation item active', () => {
    navigationState.pathname = '/projects/hermes-relay/reach-acquisition';
    try {
      const { container } = shell();
      expect(container.querySelector('.shell-body')).toHaveClass('shell-body--command-workspace');
      expect(
        within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
          name: 'Reach & acquisition',
        }),
      ).toHaveAttribute('aria-current', 'page');
    } finally {
      navigationState.pathname = '/projects/hermes-relay';
    }
  });

  it('does not mark Delivery & Sources as a command workspace', () => {
    navigationState.pathname = '/projects/hermes-relay/delivery-sources';
    try {
      const { container } = shell();
      expect(container.querySelector('.shell-body')).not.toHaveClass(
        'shell-body--command-workspace',
      );
      expect(
        within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
          name: 'Delivery & sources',
        }),
      ).toHaveAttribute('aria-current', 'page');
    } finally {
      navigationState.pathname = '/projects/hermes-relay';
    }
  });

  it('falls back to the command-workspace project root when pathname is unavailable', () => {
    navigationState.pathname = null;
    try {
      const { container } = shell();
      expect(container.querySelector('.shell-body')).toHaveClass('shell-body--command-workspace');
      expect(
        within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
          name: 'Executive pulse',
        }),
      ).toHaveAttribute('aria-current', 'page');
    } finally {
      navigationState.pathname = '/projects/hermes-relay';
    }
  });

  it('labels the completed-week shell context only when that view is selected', () => {
    navigationState.view = 'completed';
    try {
      shell();
      expect(screen.getByText('Latest completed UTC week')).toBeInTheDocument();
    } finally {
      navigationState.view = null;
    }
  });

  it('renders the focused supported navigation and marks future operations as disabled', () => {
    shell();
    const navigation = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(navigation).queryByText('Attention')).not.toBeInTheDocument();
    expect(within(navigation).getByText('Briefings')).toHaveAttribute('aria-disabled', 'true');
    expect(within(navigation).getByRole('link', { name: 'Reach & acquisition' })).toHaveAttribute(
      'href',
      '/projects/hermes-relay/reach-acquisition',
    );
    expect(within(navigation).getByRole('link', { name: 'Delivery & sources' })).toHaveAttribute(
      'href',
      '/projects/hermes-relay/delivery-sources',
    );
  });

  it('opens and closes a labelled mobile navigation sheet', async () => {
    const user = userEvent.setup();
    shell();
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = screen.getByRole('dialog', { name: 'Observatory navigation' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('link', { name: 'Delivery & sources' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveFocus();
  });

  it('defines visible keyboard focus hooks for every focusable control and the skip link', () => {
    expect(shellCss).toMatch(
      /:focus-visible\s*{[^}]*outline:\s*2px solid var\(--focus\);[^}]*outline-offset:\s*3px;/s,
    );
    expect(shellCss).toMatch(/\.skip-link:focus\s*{[^}]*transform:\s*translateY\(0\);/s);
  });

  it('disables transitions, repeated animation, and smooth scrolling for reduced motion', () => {
    const reducedMotion = shellCss.match(
      /@media \(prefers-reduced-motion: reduce\)\s*{([\s\S]*)}\s*$/,
    )?.[1];
    expect(reducedMotion).toContain('scroll-behavior: auto !important');
    expect(reducedMotion).toContain('transition-duration: 0.01ms !important');
    expect(reducedMotion).toContain('animation-duration: 0.01ms !important');
    expect(reducedMotion).toContain('animation-iteration-count: 1 !important');
  });

  it('encodes the canonical desktop, compact, tablet, and mobile navigation breakpoints', () => {
    expect(shellCss).toMatch(/@media \(min-width: 960px\) and \(max-width: 1279px\)/);
    expect(shellCss).toMatch(
      /@media \(min-width: 640px\) and \(max-width: 959px\)[\s\S]*?\.desktop-sidebar\s*{\s*display:\s*none;[\s\S]*?\.tablet-navigation\s*{[^}]*display:\s*flex;/,
    );
    expect(shellCss).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?\.desktop-sidebar\s*{\s*display:\s*none;[\s\S]*?\.mobile-menu\s*{\s*display:\s*block;/,
    );
    shell();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Tablet primary' })).toBeInTheDocument();
    expect(screen.getByLabelText('Current project')).toHaveTextContent('Hermes-Relay');
  });

  it('has no detectable axe violations', async () => {
    const { container } = shell();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('exposes semantic, non-color-only states and safe evidence links', () => {
    render(
      <>
        <StatusBadge status="stale" detail="Collection delayed" />
        <PanelState state="partial" title="Some evidence is unavailable">
          Other sections remain available.
        </PanelState>
        <EmptyState kind="awaiting">Waiting for the first successful collection.</EmptyState>
        <EvidenceLink href="https://github.com/Codename-11/hermes-relay">
          Open evidence on GitHub
        </EvidenceLink>
        <EvidenceLink
          href="https://github.com/Codename-11/hermes-relay/issues"
          target="_self"
          rel="opener"
        >
          Open evidence issues
        </EvidenceLink>
      </>,
    );
    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Some evidence is unavailable');
    expect(screen.getByRole('link', { name: 'Open evidence on GitHub' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    const overriddenLink = screen.getByRole('link', { name: 'Open evidence issues' });
    expect(overriddenLink).toHaveAttribute(
      'href',
      'https://github.com/Codename-11/hermes-relay/issues',
    );
    expect(overriddenLink).toHaveAttribute('target', '_blank');
    expect(overriddenLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
