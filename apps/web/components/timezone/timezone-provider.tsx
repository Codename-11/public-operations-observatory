'use client';

import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import { DEFAULT_TIMEZONE, type ObservatoryTimezone } from '../../lib/timezone';

interface TimezoneContextValue {
  timezone: ObservatoryTimezone;
  setTimezone: (timezone: ObservatoryTimezone) => void;
}

const TimezoneContext = createContext<TimezoneContextValue | null>(null);

export function TimezoneProvider({
  children,
  initialTimezone,
}: {
  children: ReactNode;
  initialTimezone: ObservatoryTimezone;
}) {
  const [timezone, setTimezone] = useState(initialTimezone);
  const value = useMemo(() => ({ timezone, setTimezone }), [timezone]);

  return <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>;
}

export const useTimezone = (): TimezoneContextValue =>
  useContext(TimezoneContext) ?? {
    timezone: DEFAULT_TIMEZONE,
    setTimezone: () => undefined,
  };
