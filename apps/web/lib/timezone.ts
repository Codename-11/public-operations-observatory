export const TIMEZONE_COOKIE_NAME = 'observatory-timezone';
export const DEFAULT_TIMEZONE = 'America/New_York';
export const TIMEZONE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (EST/EDT)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
  { value: 'America/Chicago', label: 'Central Time (CST/CDT)' },
  { value: 'America/Denver', label: 'Mountain Time (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PST/PDT)' },
] as const;

export type ObservatoryTimezone = (typeof TIMEZONE_OPTIONS)[number]['value'];

export const isObservatoryTimezone = (value: unknown): value is ObservatoryTimezone =>
  typeof value === 'string' && TIMEZONE_OPTIONS.some((option) => option.value === value);

export const resolveTimezone = (value: unknown): ObservatoryTimezone =>
  isObservatoryTimezone(value) ? value : DEFAULT_TIMEZONE;

export const timezoneLabel = (timezone: ObservatoryTimezone): string =>
  TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? TIMEZONE_OPTIONS[0].label;

export const timezoneAbbreviation = (
  timezone: ObservatoryTimezone,
  instant: string | Date = new Date(),
): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
    .formatToParts(new Date(instant))
    .find(({ type }) => type === 'timeZoneName')?.value ?? timezone;

export const serializeTimezoneCookie = (timezone: ObservatoryTimezone): string =>
  `${TIMEZONE_COOKIE_NAME}=${timezone}; Path=/; SameSite=Lax; Max-Age=${TIMEZONE_COOKIE_MAX_AGE}`;
