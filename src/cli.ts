import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { generateWeeklyBriefing } from './briefing/generate.js';
import { latestCompletedUtcWeekEnd } from './briefing/window.js';
import { loadConfig } from './config.js';
import { addAnnotation, type AnnotationKind } from './db/annotations.js';
import { createDatabase } from './db/client.js';
import { migrate } from './db/migrate.js';
import { ObservationStore } from './db/observation-store.js';
import { applyRetention } from './db/retention.js';
import { GitHubClient } from './github/client.js';
import { collectGitHub } from './github/collector.js';
import { normalizeGitHubObservations } from './normalization/github.js';

if (existsSync('.env')) loadEnvFile('.env');

async function main(): Promise<void> {
  const [group, command, ...arguments_] = process.argv.slice(2);
  const config = loadConfig();
  const database = createDatabase(config.DATABASE_URL);

  try {
    if (group === 'db' && command === 'migrate') {
      const applied = await migrate(database);
      console.log(JSON.stringify({ applied }));
      return;
    }

    if (group === 'collect' && command === 'github') {
      await migrate(database);
      const client = new GitHubClient(config.GITHUB_TOKEN);
      const store = new ObservationStore(database);
      const result = await collectGitHub(
        client,
        store,
        config.OBSERVATORY_GITHUB_OWNER,
        config.OBSERVATORY_GITHUB_REPOSITORY,
      );
      const normalized = await normalizeGitHubObservations(
        database,
        `${config.OBSERVATORY_GITHUB_OWNER}/${config.OBSERVATORY_GITHUB_REPOSITORY}`,
      );
      console.log(JSON.stringify({ ...result, normalized }));
      if (result.errors.length > 0) process.exitCode = 2;
      return;
    }

    if (group === 'normalize' && command === 'github') {
      await migrate(database);
      const normalized = await normalizeGitHubObservations(
        database,
        `${config.OBSERVATORY_GITHUB_OWNER}/${config.OBSERVATORY_GITHUB_REPOSITORY}`,
      );
      console.log(JSON.stringify({ normalized }));
      return;
    }

    if (group === 'briefing' && command === 'weekly') {
      await migrate(database);
      const windowEnd = parseWindowEnd(arguments_);
      const windowStart = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1_000);
      const result = await generateWeeklyBriefing(database, {
        scope: `${config.OBSERVATORY_GITHUB_OWNER}/${config.OBSERVATORY_GITHUB_REPOSITORY}`,
        windowStart,
        windowEnd,
        outputDirectory: resolve(config.OBSERVATORY_OUTPUT_DIR),
        freshnessHours: config.OBSERVATORY_FRESHNESS_HOURS,
      });
      console.log(JSON.stringify({ digest: result.digest, outputPath: result.outputPath }));
      return;
    }

    if (group === 'annotate' && command === 'add') {
      await migrate(database);
      const flags = parseFlags(arguments_);
      const occurredAt = new Date(requireFlag(flags, 'at'));
      if (Number.isNaN(occurredAt.getTime())) throw new Error('--at must be an ISO timestamp');
      const kind = requireFlag(flags, 'kind');
      if (!isAnnotationKind(kind)) {
        throw new Error('--kind must be release, documentation, communication, or other');
      }
      const id = await addAnnotation(database, {
        scope: `${config.OBSERVATORY_GITHUB_OWNER}/${config.OBSERVATORY_GITHUB_REPOSITORY}`,
        occurredAt,
        kind,
        title: requireFlag(flags, 'title'),
        evidenceUrl: requireFlag(flags, 'url'),
        ...(flags.note ? { note: flags.note } : {}),
      });
      console.log(JSON.stringify({ id }));
      return;
    }

    if (group === 'maintenance' && command === 'retention') {
      await migrate(database);
      console.log(JSON.stringify(await applyRetention(database)));
      return;
    }

    throw new Error(
      'Usage: db migrate | collect github | normalize github | briefing weekly [--end YYYY-MM-DD] | annotate add --kind KIND --at ISO --title TITLE --url URL [--note NOTE] | maintenance retention',
    );
  } finally {
    await database.end();
  }
}

function parseWindowEnd(arguments_: string[]): Date {
  const index = arguments_.indexOf('--end');
  if (index === -1) return latestCompletedUtcWeekEnd(new Date());
  const value = arguments_[index + 1];
  if (!value) throw new Error('--end requires an ISO date');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid --end date: ${value}`);
  return parsed;
}

function parseFlags(arguments_: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (!flag?.startsWith('--') || !value) throw new Error('Flags must use --name value pairs');
    flags[flag.slice(2)] = value;
  }
  return flags;
}

function requireFlag(flags: Record<string, string>, name: string): string {
  const value = flags[name];
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function isAnnotationKind(value: string): value is AnnotationKind {
  return ['release', 'documentation', 'communication', 'other'].includes(value);
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(message);
  process.exitCode = 1;
});
