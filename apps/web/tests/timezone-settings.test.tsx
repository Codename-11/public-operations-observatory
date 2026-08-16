import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TimezoneSettings } from '../components/settings/timezone-settings';
import { TimezoneProvider } from '../components/timezone/timezone-provider';
import {
  DEFAULT_TIMEZONE,
  resolveTimezone,
  serializeTimezoneCookie,
  timezoneAbbreviation,
} from '../lib/timezone';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

describe('timezone settings', () => {
  beforeEach(() => refresh.mockClear());

  it('defaults invalid settings to Eastern Time and follows daylight saving time', () => {
    expect(resolveTimezone('invalid')).toBe(DEFAULT_TIMEZONE);
    expect(timezoneAbbreviation(DEFAULT_TIMEZONE, '2026-08-15T12:00:00Z')).toBe('EDT');
    expect(timezoneAbbreviation(DEFAULT_TIMEZONE, '2026-01-15T12:00:00Z')).toBe('EST');
  });

  it('saves a supported timezone in a durable same-site cookie and refreshes the route', async () => {
    const user = userEvent.setup();
    render(
      <TimezoneProvider initialTimezone={DEFAULT_TIMEZONE}>
        <TimezoneSettings />
      </TimezoneProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    const select = screen.getByLabelText('Display timezone');
    expect(select).toHaveValue('America/New_York');
    await user.selectOptions(select, 'UTC');
    await user.click(screen.getByRole('button', { name: 'Save timezone' }));

    expect(screen.getByRole('status')).toHaveTextContent('Timezone saved.');
    expect(document.cookie).toContain('observatory-timezone=UTC');
    expect(refresh).toHaveBeenCalledOnce();
    expect(serializeTimezoneCookie('UTC')).toContain('Path=/; SameSite=Lax; Max-Age=31536000');
  });
});
