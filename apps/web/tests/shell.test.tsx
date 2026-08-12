import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ObservatoryShell } from '../components/shell/observatory-shell';
import {
  EmptyState,
  EvidenceLink,
  PanelState,
  StatusBadge,
} from '@public-operations-observatory/ui';

const shell = (children = <h1>Hermes-Relay public operations</h1>) =>
  render(<ObservatoryShell projectKey="hermes-relay">{children}</ObservatoryShell>);
const shellCss = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

describe('Observatory shell', () => {
  it('provides landmarks, project context, skip navigation, and one active route', () => {
    shell();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getAllByText('Hermes-Relay')).not.toHaveLength(0);
    expect(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
        name: 'Overview',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('renders unsupported destinations as disabled text, never dead links', () => {
    shell();
    const navigation = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(navigation).getByText('Attention')).toHaveAttribute('aria-disabled', 'true');
    expect(within(navigation).queryByRole('link', { name: 'Attention' })).not.toBeInTheDocument();
    expect(within(navigation).getByText('Briefings')).toHaveAttribute('aria-disabled', 'true');
  });

  it('opens and closes a labelled mobile navigation sheet', async () => {
    const user = userEvent.setup();
    shell();
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = screen.getByRole('dialog', { name: 'Observatory navigation' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('link', { name: 'Overview' })).toHaveFocus();
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
