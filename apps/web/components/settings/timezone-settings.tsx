'use client';

import { Button, Card, CardContent, CardHeader } from '@public-operations-observatory/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import {
  serializeTimezoneCookie,
  TIMEZONE_OPTIONS,
  type ObservatoryTimezone,
} from '../../lib/timezone';
import { useTimezone } from '../timezone/timezone-provider';
import styles from './timezone-settings.module.css';

export function TimezoneSettings() {
  const router = useRouter();
  const { timezone, setTimezone } = useTimezone();
  const [selection, setSelection] = useState<ObservatoryTimezone>(timezone);
  const [saved, setSaved] = useState(false);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    document.cookie = serializeTimezoneCookie(selection);
    setTimezone(selection);
    setSaved(true);
    router.refresh();
  };

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Project settings</p>
        <h1>Settings</h1>
        <p>Choose how dates and timestamps are presented throughout this project.</p>
      </header>

      <Card className={styles.card} aria-labelledby="timezone-settings-title">
        <CardHeader>
          <div>
            <h2 id="timezone-settings-title">Timezone</h2>
            <p>Observation windows keep their exact instants; this changes presentation only.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className={styles.form} onSubmit={save}>
            <div className={styles.field}>
              <label htmlFor="project-timezone">Display timezone</label>
              <select
                id="project-timezone"
                name="timezone"
                value={selection}
                onChange={(event) => {
                  setSelection(event.target.value as ObservatoryTimezone);
                  setSaved(false);
                }}
              >
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p id="timezone-help">
                Eastern Time follows daylight saving time automatically (EST/EDT).
              </p>
            </div>
            <div className={styles.actions}>
              <Button type="submit" variant="primary">
                Save timezone
              </Button>
              <p className={styles.feedback} role="status" aria-live="polite">
                {saved ? 'Timezone saved.' : ''}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
